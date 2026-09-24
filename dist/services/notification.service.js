import { config } from '../config.js';
import crypto from 'crypto';
/**
 * Development & testing adapter: logs formatted alerts to console and preserves full audit history.
 */
export class DevConsoleNotificationAdapter {
    name = 'WHATSAPP_DEV';
    async send(payload) {
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
export class TwilioWhatsAppAdapter {
    name = 'WHATSAPP_TWILIO';
    async send(payload) {
        if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
            return { success: false, error: 'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.' };
        }
        try {
            const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');
            const params = new URLSearchParams();
            params.append('From', `whatsapp:${config.twilioFromNumber}`);
            params.append('To', `whatsapp:${payload.recipient}`);
            params.append('Body', payload.message);
            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });
            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: `Twilio API error: ${response.status} ${errorText}` };
            }
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
}
export class NotificationService {
    db;
    adapter;
    constructor(db) {
        this.db = db;
        if (config.whatsappChannel === 'WHATSAPP_TWILIO' && config.twilioAccountSid) {
            this.adapter = new TwilioWhatsAppAdapter();
        }
        else {
            this.adapter = new DevConsoleNotificationAdapter();
        }
    }
    /**
     * Resolves the configured WhatsApp recipient for a specific project.
     */
    getProjectRecipient(projectId) {
        try {
            const proj = this.db.prepare(`
        SELECT whatsapp_recipients FROM projects WHERE id = ?
      `).get(projectId);
            if (proj?.whatsapp_recipients && proj.whatsapp_recipients.trim().length > 0) {
                // Return first recipient if comma-separated
                return proj.whatsapp_recipients.split(',')[0].trim();
            }
            // Fallback to project's Quality Specialist
            const qa = this.db.prepare(`
        SELECT whatsapp FROM technicians WHERE project_id = ? AND role LIKE '%Quality%' LIMIT 1
      `).get(projectId);
            if (qa?.whatsapp && qa.whatsapp.trim().length > 0) {
                return qa.whatsapp.trim();
            }
        }
        catch {
            // ignore db errors on fallback
        }
        return config.whatsappFallbackRecipient;
    }
    /**
     * Dispatches an outbound notification and records it in the database.
     */
    async notify(payload) {
        const notifId = `notif_${crypto.randomBytes(8).toString('hex')}`;
        const result = await this.adapter.send(payload);
        const stmt = this.db.prepare(`
      INSERT INTO notifications (id, project_id, recipient, event_type, payload, status, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(notifId, payload.projectId, payload.recipient, payload.eventType, JSON.stringify({
            message: payload.message,
            metadata: payload.metadata || {},
            delivery_error: result.error || null
        }), result.success ? 'SENT' : 'FAILED', this.adapter.name);
    }
    /**
     * Helper: Formats and sends a protocol creation notification.
     */
    async notifyProtocolCreated(params) {
        const verdictIcon = params.verdict === 'PASS' ? '✅ APROBADO' : params.verdict === 'PROVISIONAL_PASS' ? '⏳ APROBACIÓN PROVISIONAL' : '❌ NO CONFORME (FALLA)';
        const truckDetail = params.trucksCount !== undefined && params.trucksCount > 1 ? `\n*Camiones Mixer:* ${params.trucksCount} unidades inspeccionadas` : '';
        const message = [
            `🚨 *PROTOKOL CALIDAD — NUEVO PROTOCOLO*`,
            `*Proyecto:* ${params.projectId}`,
            `*Actividad:* ${params.activity}`,
            `*Progresiva:* ${params.chainage} | *Paño:* ${params.panel}${truckDetail}`,
            `*Protocolo:* ${params.protocolId}`,
            `*Estado:* ${verdictIcon}`,
            `*Registrado por:* ${params.technicianName}`,
            `_Notificación automática para el Especialista de Calidad del Proyecto_`
        ].join('\n');
        const recipient = this.getProjectRecipient(params.projectId);
        await this.notify({
            projectId: params.projectId,
            eventType: 'PROTOCOL_CREATED',
            recipient,
            message,
            metadata: params
        });
    }
    /**
     * Helper: Formats and sends a Non-Conformance opening alert (<60s requirement R2).
     */
    async notifyNonConformanceOpened(params) {
        const truckLine = params.truckInfo ? `*Camión / Mixer:* ${params.truckInfo}\n` : '';
        const message = [
            `⚠️ *PROTOKOL ALERTA — NO CONFORMIDAD ABIERTA*`,
            `*Proyecto:* ${params.projectId}`,
            `*No Conformidad ID:* ${params.nonconformanceId}`,
            `*Protocolo Relacionado:* ${params.protocolId}`,
            `*Ubicación:* Progresiva ${params.chainage}, Paño ${params.panel}`,
            `${truckLine}*Parámetro Fuera de Norma:* ${params.field}`,
            `*Criterio Exigido:* ${params.expected}`,
            `*Valor Obtenido:* ${params.actual}`,
            `_Atención requerida: Se ha generado un registro formal de No Conformidad._`
        ].join('\n');
        const recipient = this.getProjectRecipient(params.projectId);
        await this.notify({
            projectId: params.projectId,
            eventType: 'NC_OPENED',
            recipient,
            message,
            metadata: params
        });
    }
    /**
     * Helper: Formats and sends a cylinder break laboratory result notification.
     */
    async notifyCylinderResult(params) {
        const statusText = params.verdict === 'PASS'
            ? `✅ CUMPLE f'c de diseño (${params.strengthKgcm2} >= ${params.designFc} kg/cm²)`
            : `❌ NO CUMPLE f'c de diseño (${params.strengthKgcm2} < ${params.designFc} kg/cm²). Se ha abierto la No Conformidad ${params.nonconformanceId}.`;
        const message = [
            `🧪 *RESULTADO DE LABORATORIO — ROTURA DE TESTIGO*`,
            `*Protocolo:* ${params.protocolId}`,
            `*Código de Probeta:* ${params.cylinderCode}`,
            `*Edad de Rotura:* ${params.ageDays} días`,
            `*Resistencia Obtenida:* ${params.strengthKgcm2} kg/cm² (Diseño: ${params.designFc} kg/cm²)`,
            `*Veredicto:* ${statusText}`
        ].join('\n');
        const recipient = this.getProjectRecipient(params.projectId);
        await this.notify({
            projectId: params.projectId,
            eventType: 'CYLINDER_TESTED',
            recipient,
            message,
            metadata: params
        });
    }
    /**
     * Helper: Formats and sends an overdue activity reminder (Requirement R10).
     */
    async notifyOverdueProtocol(params) {
        const message = [
            `⏰ *RECORDATORIO DE CONTROL — ACTIVIDAD ATRASADA (>4H)*`,
            `*Proyecto:* ${params.projectId}`,
            `*Actividad Programada:* ${params.activity}`,
            `*Ubicación:* Progresiva ${params.chainage}, Paño ${params.panel}`,
            `*Hora Programada:* ${params.scheduledAt}`,
            `*Atraso Estimado:* ${params.hoursOverdue.toFixed(1)} horas sin protocolo registrado.`,
            `*Atención:* Verificar con el equipo de campo si se ejecutó el trabajo.`
        ].join('\n');
        const recipient = this.getProjectRecipient(params.projectId);
        await this.notify({
            projectId: params.projectId,
            eventType: 'OVERDUE',
            recipient,
            message,
            metadata: params
        });
    }
    async notifyOverdueActivity(params) {
        return this.notifyOverdueProtocol(params);
    }
}
