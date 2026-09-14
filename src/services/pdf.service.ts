import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { ProtocolRecord, ValidationCheck, ActivityType } from '../types.js';
import { PhotoService } from './photo.service.js';

export class PdfService {
  private photoService: PhotoService;

  constructor(private db: DatabaseSync) {
    this.photoService = new PhotoService(db);
    if (!fs.existsSync(config.pdfDir)) {
      fs.mkdirSync(config.pdfDir, { recursive: true });
    }
    if (!fs.existsSync(config.dossierDir)) {
      fs.mkdirSync(config.dossierDir, { recursive: true });
    }
  }

  /**
   * Generates a formal Peruvian PPI Protocol PDF certificate.
   */
  async generateProtocolPdf(params: {
    protocol: ProtocolRecord;
    checks: ValidationCheck[];
    technicianName: string;
    technicianRole: string;
    nonconformanceId?: string | null;
  }): Promise<string> {
    const filename = `${params.protocol.id}.pdf`;
    const outputPath = path.join(config.pdfDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // --- 1. HEADER & LOGO BANNER ---
      doc.rect(40, 40, 515, 60).fillAndStroke('#1E293B', '#0F172A');
      doc.fillColor('#F8FAFC').fontSize(16).font('Helvetica-Bold').text('PROTOKOL — CONTROL DE CALIDAD', 55, 52);
      doc.fontSize(10).font('Helvetica').text('PROGRAMA DE PUNTOS DE INSPECCIÓN (PPI) — INFRAESTRUCTURA VIAL', 55, 74);

      // Metadata Bar
      doc.moveDown(2);
      let y = 115;
      doc.rect(40, y, 515, 75).fillAndStroke('#F1F5F9', '#CBD5E1');

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('PROYECTO:', 50, y + 8);
      doc.font('Helvetica').text(config.pilotProjectName, 130, y + 8, { width: 260 });

      doc.font('Helvetica-Bold').text('CONTRATO:', 400, y + 8);
      doc.font('Helvetica').text(config.pilotContractNumber, 460, y + 8);

      doc.font('Helvetica-Bold').text('ENTIDAD:', 50, y + 26);
      doc.font('Helvetica').text(config.pilotEntity, 130, y + 26);

      doc.font('Helvetica-Bold').text('MODALIDAD:', 400, y + 26);
      doc.font('Helvetica').text(config.pilotExecutionMode, 460, y + 26);

      doc.font('Helvetica-Bold').text('ID PROTOCOLO:', 50, y + 44);
      doc.font('Helvetica-Bold').fillColor('#0284C7').text(params.protocol.id, 130, y + 44);

      doc.font('Helvetica-Bold').fillColor('#334155').text('ACTIVIDAD:', 400, y + 44);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(params.protocol.activity, 460, y + 44);

      // --- 2. LOCATION, TIME & IDENTITY BLOCK ---
      y += 85;
      doc.rect(40, y, 515, 65).fillAndStroke('#FFFFFF', '#E2E8F0');

      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      doc.text('PROGRESIVA (TRAMO):', 50, y + 10);
      doc.font('Helvetica').text(params.protocol.chainage, 165, y + 10);

      doc.font('Helvetica-Bold').text('PAÑO / ELEMENTO:', 320, y + 10);
      doc.font('Helvetica').text(params.protocol.panel, 420, y + 10);

      doc.font('Helvetica-Bold').text('HORA CAMPO (PET):', 50, y + 26);
      doc.font('Helvetica').text(params.protocol.recorded_at, 165, y + 26);

      doc.font('Helvetica-Bold').text('HORA SERVIDOR (UTC):', 320, y + 26);
      doc.font('Helvetica').text(params.protocol.server_received_at, 420, y + 26);

      doc.font('Helvetica-Bold').text('COORDENADAS GPS:', 50, y + 42);
      doc.font('Helvetica').text(`Lat: ${params.protocol.gps_lat.toFixed(6)}, Lng: ${params.protocol.gps_lng.toFixed(6)}`, 165, y + 42);

      doc.font('Helvetica-Bold').text('RESPONSABLE CAMPO:', 320, y + 42);
      doc.font('Helvetica').text(`${params.technicianName} (${params.technicianRole})`, 420, y + 42, { width: 130 });

      // --- 3. VERDICT BANNER ---
      y += 75;
      let bannerColor = '#10B981'; // Green for PASS
      let verdictLabel = 'CONFORME / APROBADO (PASS)';

      if (params.protocol.verdict === 'PROVISIONAL_PASS') {
        bannerColor = '#F59E0B'; // Amber for PROVISIONAL
        verdictLabel = 'APROBACIÓN PROVISIONAL — PENDIENTE ROTURA DE PROBETAS';
      } else if (params.protocol.verdict === 'FAIL') {
        bannerColor = '#EF4444'; // Red for FAIL
        verdictLabel = `NO CONFORME — NO CONFORMIDAD REGISTRADA (${params.nonconformanceId || 'NC'})`;
      }

      doc.rect(40, y, 515, 28).fill(bannerColor);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(verdictLabel, 50, y + 8, { align: 'center', width: 495 });

      // --- 4. MEASUREMENTS & TECHNICAL CRITERIA TABLE ---
      y += 38;
      doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('MEDICIONES Y VERIFICACIÓN TÉCNICA (NORMA EG-2013 / EXPEDIENTE)', 40, y);
      y += 16;

      // Table Header
      doc.rect(40, y, 515, 20).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold');
      doc.text('PARÁMETRO / CAMPO', 48, y + 6);
      doc.text('CRITERIO EXIGIDO', 180, y + 6);
      doc.text('VALOR OBTENIDO', 330, y + 6);
      doc.text('RESULTADO', 450, y + 6);

      y += 20;
      doc.font('Helvetica').fontSize(8);

      for (const chk of params.checks) {
        doc.rect(40, y, 515, 20).stroke('#E2E8F0');
        doc.fillColor('#334155').text(chk.field, 48, y + 6);
        doc.text(chk.expected, 180, y + 6);
        doc.text(String(chk.actual) + (chk.unit ? ' ' + chk.unit : ''), 330, y + 6);

        if (chk.result === 'PASS') {
          doc.fillColor('#059669').font('Helvetica-Bold').text('CONFORME', 450, y + 6);
        } else {
          doc.fillColor('#DC2626').font('Helvetica-Bold').text('FALLA (NC)', 450, y + 6);
        }
        doc.font('Helvetica');
        y += 20;
      }

      // --- 5. IMMUTABILITY HASH & AUDIT TRAIL ---
      y += 10;
      doc.rect(40, y, 515, 40).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#64748B').fontSize(7).font('Helvetica-Bold').text('HASH DE INTEGRIDAD CRIPTOGRÁFICA (SHA-256 HMAC):', 48, y + 6);
      doc.font('Courier').fontSize(7).fillColor('#334155').text(params.protocol.integrity_hash, 48, y + 17);
      doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(`Token de Dispositivo: ${params.protocol.device_token} | Registro Inmutable (Prohibida su modificación)`, 48, y + 27);

      // --- 6. ATTACHED PHOTOS SECTION ---
      const photos = this.photoService.getPhotosForProtocol(params.protocol.id);
      if (photos.length > 0) {
        y += 50;
        doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('REGISTRO FOTOGRÁFICO DE EVIDENCIA', 40, y);
        y += 16;

        let photoX = 40;
        for (const ph of photos.slice(0, 2)) {
          const photoPath = this.photoService.getPhotoAbsolutePath(ph);
          if (fs.existsSync(photoPath)) {
            try {
              doc.image(photoPath, photoX, y, { width: 140, height: 105, fit: [140, 105] });
              doc.rect(photoX, y, 140, 105).stroke('#CBD5E1');
              doc.fontSize(6).fillColor('#475569').text(`ID: ${ph.id}`, photoX, y + 108);
              doc.text(`Captura: ${ph.captured_at.split('T')[0]}`, photoX, y + 116);
              photoX += 160;
            } catch (err) {
              doc.fontSize(7).fillColor('#94A3B8').text(`[Imagen ${ph.id} registrada]`, photoX, y + 40);
              photoX += 160;
            }
          }
        }
      }

      // --- 7. SIGNATURE BLOCK (Peruvian Standards) ---
      y = 720;
      doc.moveTo(60, y).lineTo(220, y).stroke('#475569');
      doc.moveTo(330, y).lineTo(490, y).stroke('#475569');

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('ESPECIALISTA DE CALIDAD', 60, y + 6, { width: 160, align: 'center' });
      doc.font('Helvetica').fontSize(7).text('Ing. David Valdez Ochoa', 60, y + 17, { width: 160, align: 'center' });

      doc.font('Helvetica-Bold').fontSize(8).text('SUPERVISIÓN DE OBRA', 330, y + 6, { width: 160, align: 'center' });
      doc.font('Helvetica').fontSize(7).text('Consorcio Supervisor Ayacucho', 330, y + 17, { width: 160, align: 'center' });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Generates a compiled Quality Dossier (Dosier de Calidad) PDF compiling all project protocols.
   */
  async generateDossierPdf(projectId: string): Promise<{ dossierPath: string; protocolsCount: number; openNcCount: number }> {
    const filename = `${projectId}-dossier-${Date.now()}.pdf`;
    const outputPath = path.join(config.dossierDir, filename);

    const protocols = this.db.prepare(`
      SELECT p.*, t.name as technician_name, t.role as technician_role
      FROM protocols p
      JOIN technicians t ON p.technician_id = t.id
      WHERE p.project_id = ?
      ORDER BY p.recorded_at ASC
    `).all(projectId) as any[];

    const openNcs = this.db.prepare(`
      SELECT count(*) as count
      FROM nonconformances nc
      JOIN protocols p ON nc.protocol_id = p.id
      WHERE p.project_id = ? AND nc.status = 'OPEN'
    `).get(projectId) as { count: number };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // --- COVER PAGE ---
      doc.rect(40, 40, 515, 760).stroke('#0F172A');
      doc.moveDown(8);
      doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold').text('DOSIER DE CALIDAD', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica').text('COMPENDIO OFICIAL DE PROTOCOLOS DE LIBERACIÓN', { align: 'center' });
      doc.moveDown(3);

      doc.fontSize(12).font('Helvetica-Bold').text('PROYECTO:', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(config.pilotProjectName, { align: 'center' });
      doc.moveDown(1);

      doc.fontSize(10).font('Helvetica-Bold').text(`CONTRATO: ${config.pilotContractNumber}`, { align: 'center' });
      doc.font('Helvetica').text(`ENTIDAD: ${config.pilotEntity}`, { align: 'center' });
      doc.text(`MODALIDAD: ${config.pilotExecutionMode}`, { align: 'center' });
      doc.moveDown(4);

      doc.fontSize(10).font('Helvetica-Bold').text('RESPONSABLE DE CALIDAD:', { align: 'center' });
      doc.font('Helvetica').text('Ing. David Valdez Ochoa — Especialista de Calidad', { align: 'center' });
      doc.moveDown(6);

      doc.fontSize(9).font('Helvetica').text(`Compilado: ${new Date().toLocaleDateString('es-PE')} | Total Protocolos: ${protocols.length} | No Conformidades Abiertas: ${openNcs.count}`, { align: 'center' });

      // --- TABLE OF CONTENTS / SUMMARY LIST ---
      doc.addPage();
      doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('ÍNDICE DE PROTOCOLOS DE LIBERACIÓN', 40, 40);
      doc.moveDown(1.5);

      let y = 80;
      doc.rect(40, y, 515, 20).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold');
      doc.text('ID PROTOCOLO', 48, y + 6);
      doc.text('ACTIVIDAD', 170, y + 6);
      doc.text('PROGRESIVA', 250, y + 6);
      doc.text('PAÑO', 330, y + 6);
      doc.text('ESTADO', 390, y + 6);
      doc.text('FECHA', 470, y + 6);
      y += 20;

      doc.font('Helvetica').fontSize(8);
      for (const p of protocols) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        doc.rect(40, y, 515, 18).stroke('#E2E8F0');
        doc.fillColor('#334155').text(p.id, 48, y + 5);
        doc.text(p.activity, 170, y + 5);
        doc.text(p.chainage, 250, y + 5);
        doc.text(p.panel, 330, y + 5);

        const verdictColor = p.verdict === 'PASS' ? '#059669' : p.verdict === 'PROVISIONAL_PASS' ? '#D97706' : '#DC2626';
        doc.fillColor(verdictColor).font('Helvetica-Bold').text(p.verdict, 390, y + 5);
        doc.font('Helvetica').fillColor('#64748B').text(p.recorded_at.split('T')[0], 470, y + 5);

        y += 18;
      }

      doc.end();

      stream.on('finish', () => resolve({
        dossierPath: outputPath,
        protocolsCount: protocols.length,
        openNcCount: openNcs.count
      }));
      stream.on('error', (err) => reject(err));
    });
  }
}
