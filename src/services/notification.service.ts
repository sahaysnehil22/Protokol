import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import crypto from 'crypto';

export interface NotificationPayload {
  projectId: string;
  eventType: 'PROTOCOL_CREATED' | 'NC_OPENED' | 'CYLINDER_TESTED' | 'OVERDUE';
  recipient: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface NotificationAdapter {
  name: string;
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>;
}

/**
 * Development & testing adapter: logs formatted alerts to console and preserves full audit history.
 */
export class DevConsoleNotificationAdapter implements NotificationAdapter {
  name = 'WHATSAPP_DEV';

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    console.log(`\n======================================================`);
    console.log(`[WHATSAPP NOTIFICATION DISPATCH - ${payload.eventType}]`);
    console.log(`Channel: ${this.name} | Recipient: ${payload.recipient}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`------------------------------------------------------`);
    console.log(payload.message);
    console.log(`======================================================\n`);
    return { success: true };
  }
}

/**
 * Production Twilio WhatsApp adapter.
 */
export class TwilioWhatsAppAdapter implements NotificationAdapter {
  name = 'WHATSAPP_TWILIO';

  async send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
      return { success: false, error: 'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.' };
    }

    try {
      const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', `whatsapp:${config.twilioFromNumber}`);
      params.append('To', `whatsapp:${payload.recipient}`);
      params.append('Body', payload.message);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Twilio API error: ${response.status} ${errorText}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export class NotificationService {
  private adapter: NotificationAdapter;

  constructor(private db: DatabaseSync) {
    if (config.whatsappChannel === 'WHATSAPP_TWILIO' && config.twilioAccountSid) {
      this.adapter = new TwilioWhatsAppAdapter();
    } else {
      this.adapter = new DevConsoleNotificationAdapter();
    }
  }

  /**
   * Dispatches an outbound notification and records it in the database.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const notifId = `notif_${crypto.randomBytes(8).toString('hex')}`;
    const result = await this.adapter.send(payload);

    const stmt = this.db.prepare(`
      INSERT INTO notifications (id, project_id, recipient, event_type, payload, status, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      notifId,
      payload.projectId,
      payload.recipient,
      payload.eventType,
      JSON.stringify({
        message: payload.message,
        metadata: payload.metadata || {},
        delivery_error: result.error || null
      }),
      result.success ? 'SENT' : 'FAILED',
      this.adapter.name
    );
  }

  /**
   * Helper: Formats and sends a protocol creation notification.
   */
  async notifyProtocolCreated(params: {
    projectId: string;
    protocolId: string;
    activity: string;
    panel: string;
    chainage: string;
    verdict: string;
    technicianName: string;
  }): Promise<void> {
    const verdictIcon = params.verdict === 'PASS' ? '✅ APROBADO' : params.verdict === 'PROVISIONAL_PASS' ? '⏳ APROBACIÓN PROVISIONAL' : '❌ NO CONFORME (FALLA)';
    const message = [
      `🚨 *PROTOKOL CALIDAD — NUEVO PROTOCOLO*`,
      `*Proyecto:* ${params.projectId}`,
      `*Actividad:* ${params.activity}`,
      `*Progresiva:* ${params.chainage} | *Paño:* ${params.panel}`,
      `*Protocolo:* ${params.protocolId}`,
      `*Estado:* ${verdictIcon}`,
      `*Registrado por:* ${params.technicianName}`,
      `_Notificación automática para el Especialista de Calidad_`
    ].join('\n');

    await this.notify({
      projectId: params.projectId,
      eventType: 'PROTOCOL_CREATED',
      recipient: config.whatsappRecipient,
      message,
      metadata: params
    });
  }

  /**
   * Helper: Formats and sends a Non-Conformance opening alert (<60s requirement R2).
   */
  async notifyNonConformanceOpened(params: {
    projectId: string;
    protocolId: string;
    nonconformanceId: string;
    field: string;
    expected: string;
    actual: any;
    chainage: string;
    panel: string;
  }): Promise<void> {
    const message = [
      `⚠️ *ALERTA URGENTE — NO CONFORMIDAD ABIERTA*`,
      `*Proyecto:* ${params.projectId}`,
      `*No Conformidad:* ${params.nonconformanceId}`,
      `*Protocolo Origen:* ${params.protocolId}`,
      `*Ubicación:* Progresiva ${params.chainage}, Paño ${params.panel}`,
      `*Criterio Incumplido:* ${params.field}`,
      `*Esperado:* ${params.expected}`,
      `*Obtenido en Campo:* ${params.actual}`,
      `*Acción:* Requiere revisión inmediata y registro de acción correctiva.`,
      `_Plazo de notificación: < 60 segundos_`
    ].join('\n');

    await this.notify({
      projectId: params.projectId,
      eventType: 'NC_OPENED',
      recipient: config.whatsappRecipient,
      message,
      metadata: params
    });
  }

  /**
   * Helper: Formats and sends an overdue protocol notification (R10).
   */
  async notifyOverdueProtocol(params: {
    projectId: string;
    activity: string;
    panel: string;
    chainage: string;
    scheduledAt: string;
    hoursOverdue: number;
  }): Promise<void> {
    const message = [
      `⏰ *RECORDATORIO DE CONTROL — ACTIVIDAD ATRASADA (>4H)*`,
      `*Proyecto:* ${params.projectId}`,
      `*Actividad Programada:* ${params.activity}`,
      `*Ubicación:* Progresiva ${params.chainage}, Paño ${params.panel}`,
      `*Hora Programada:* ${params.scheduledAt}`,
      `*Atraso Estimado:* ${params.hoursOverdue.toFixed(1)} horas sin protocolo registrado.`,
      `*Atención:* Verificar con el equipo de campo si se ejecutó el trabajo.`
    ].join('\n');

    await this.notify({
      projectId: params.projectId,
      eventType: 'OVERDUE',
      recipient: config.whatsappRecipient,
      message,
      metadata: params
    });
  }

  /**
   * Helper: Formats and sends a cylinder lab test result alert.
   */
  async notifyCylinderResult(params: {
    projectId: string;
    protocolId: string;
    cylinderCode: string;
    ageDays: number;
    strengthKgcm2: number;
    designFc: number;
    verdict: string;
    nonconformanceId?: string | null;
  }): Promise<void> {
    const statusText = params.verdict === 'PASS' 
      ? `✅ Cumple f'c de diseño (${params.strengthKgcm2} ≥ ${params.designFc} kg/cm²)`
      : `❌ NO CUMPLE f'c de diseño (${params.strengthKgcm2} < ${params.designFc} kg/cm²). Se ha abierto la No Conformidad ${params.nonconformanceId}.`;

    const message = [
      `🧪 *RESULTADO DE LABORATORIO — ROTURA DE TESTIGO*`,
      `*Protocolo:* ${params.protocolId}`,
      `*Código de Probeta:* ${params.cylinderCode}`,
      `*Edad de Rotura:* ${params.ageDays} días`,
      `*Resistencia Obtenida:* ${params.strengthKgcm2} kg/cm² (Diseño: ${params.designFc} kg/cm²)`,
      `*Veredicto:* ${statusText}`
    ].join('\n');

    await this.notify({
      projectId: params.projectId,
      eventType: 'CYLINDER_TESTED',
      recipient: config.whatsappRecipient,
      message,
      metadata: params
    });
  }
}
