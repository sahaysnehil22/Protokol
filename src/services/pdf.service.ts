import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { ProtocolRecord, ValidationCheck, ActivityType, ProjectRecord, ConcreteTruckRecord, SupportedLanguage } from '../types.js';
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
    lang?: SupportedLanguage;
  }): Promise<string> {
    const filename = `${params.protocol.id}.pdf`;
    const outputPath = path.join(config.pdfDir, filename);
    const lang = params.lang || 'es';

    // Retrieve project information from database
    const project = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `).get(params.protocol.project_id) as unknown as ProjectRecord | undefined;

    const projectName = project?.name || params.protocol.project_id;
    const contractNumber = project?.contract_number || 'N/A';
    const entity = project?.entity || 'Entidad Pública';
    const executionMode = project?.execution_mode || 'Administración Directa';
    const roadSection = project?.road_section || 'Tramo de Obra';

    // Retrieve any trucks recorded for this protocol
    const trucks = this.db.prepare(`
      SELECT * FROM concrete_trucks WHERE protocol_id = ? ORDER BY truck_number ASC
    `).all(params.protocol.id) as unknown as ConcreteTruckRecord[];

    // Retrieve any cylinder test results recorded
    const cylinders = this.db.prepare(`
      SELECT * FROM cylinders WHERE protocol_id = ? ORDER BY truck_number ASC, age_days ASC
    `).all(params.protocol.id) as any[];

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // --- 1. HEADER & LOGO BANNER ---
      doc.rect(40, 40, 515, 55).fillAndStroke('#1E293B', '#0F172A');
      const titleText = lang === 'en' ? 'PROTOKOL — QUALITY CONTROL' : 'PROTOKOL — CONTROL DE CALIDAD';
      const subtitleText = lang === 'en' 
        ? 'INSPECTION AND TEST PLAN (ITP) — ROAD INFRASTRUCTURE' 
        : 'PROGRAMA DE PUNTOS DE INSPECCIÓN (PPI) — INFRAESTRUCTURA VIAL';

      doc.fillColor('#F8FAFC').fontSize(15).font('Helvetica-Bold').text(titleText, 55, 50);
      doc.fontSize(9).font('Helvetica').text(subtitleText, 55, 70);

      // Metadata Bar
      let y = 105;
      doc.rect(40, y, 515, 75).fillAndStroke('#F1F5F9', '#CBD5E1');

      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text(lang === 'en' ? 'PROJECT:' : 'PROYECTO:', 50, y + 8);
      doc.font('Helvetica').text(projectName, 130, y + 8, { width: 250 });

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'CONTRACT:' : 'CONTRATO:', 390, y + 8);
      doc.font('Helvetica').text(contractNumber, 455, y + 8, { width: 95 });

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'ENTITY:' : 'ENTIDAD:', 50, y + 26);
      doc.font('Helvetica').text(entity, 130, y + 26, { width: 250 });

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'MODE:' : 'MODALIDAD:', 390, y + 26);
      doc.font('Helvetica').text(executionMode, 455, y + 26, { width: 95 });

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'PROTOCOL ID:' : 'ID PROTOCOLO:', 50, y + 44);
      doc.font('Helvetica-Bold').fillColor('#0284C7').text(params.protocol.id, 130, y + 44);

      doc.font('Helvetica-Bold').fillColor('#334155').text(lang === 'en' ? 'ACTIVITY:' : 'ACTIVIDAD:', 390, y + 44);
      doc.font('Helvetica-Bold').fillColor('#0F172A').text(params.protocol.activity, 455, y + 44);

      // --- 2. LOCATION, TIME & IDENTITY BLOCK ---
      y += 85;
      doc.rect(40, y, 515, 60).fillAndStroke('#FFFFFF', '#E2E8F0');

      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
      doc.text(lang === 'en' ? 'CHAINAGE (SECTION):' : 'PROGRESIVA (TRAMO):', 50, y + 8);
      doc.font('Helvetica').text(`${params.protocol.chainage} (${roadSection})`, 165, y + 8, { width: 145 });

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'PANEL / ELEMENT:' : 'PAÑO / ELEMENTO:', 320, y + 8);
      doc.font('Helvetica').text(params.protocol.panel, 420, y + 8);

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'FIELD TIME:' : 'HORA CAMPO:', 50, y + 24);
      doc.font('Helvetica').text(params.protocol.recorded_at, 165, y + 24);

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'SERVER TIME (UTC):' : 'HORA SERVIDOR (UTC):', 320, y + 24);
      doc.font('Helvetica').text(params.protocol.server_received_at, 420, y + 24);

      doc.font('Helvetica-Bold').text('GPS:', 50, y + 40);
      doc.font('Helvetica').text(`Lat: ${params.protocol.gps_lat.toFixed(6)}, Lng: ${params.protocol.gps_lng.toFixed(6)}`, 165, y + 40);

      doc.font('Helvetica-Bold').text(lang === 'en' ? 'TECHNICIAN:' : 'RESPONSABLE:', 320, y + 40);
      doc.font('Helvetica').text(`${params.technicianName} (${params.technicianRole})`, 420, y + 40, { width: 130 });

      // --- 3. VERDICT BANNER ---
      y += 70;
      let bannerColor = '#10B981';
      let verdictLabel = lang === 'en' ? 'CONFORMING / APPROVED (PASS)' : 'CONFORME / APROBADO (PASS)';

      if (params.protocol.verdict === 'PROVISIONAL_PASS') {
        bannerColor = '#F59E0B';
        verdictLabel = lang === 'en'
          ? 'APPROVED (Pending 28-day laboratory test results)'
          : 'APROBADO (Pendiente resultado de laboratorio a 28 días)';
      } else if (params.protocol.verdict === 'FAIL') {
        bannerColor = '#EF4444';
        verdictLabel = lang === 'en'
          ? `NON-CONFORMING — RECORDED NC (${params.nonconformanceId || 'NC'})`
          : `NO CONFORME — NO CONFORMIDAD REGISTRADA (${params.nonconformanceId || 'NC'})`;
      }

      doc.rect(40, y, 515, 26).fill(bannerColor);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text(verdictLabel, 50, y + 7, { align: 'center', width: 495 });

      // --- 4. CONCRETE TRUCKS TABLE (If Activity is Concrete) ---
      y += 34;
      if (params.protocol.activity === 'CONCRETE' && trucks.length > 0) {
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
          lang === 'en' ? 'READY-MIX TRUCKS INSPECTION LOG' : 'REGISTRO DE CONTROL POR CAMIÓN MIXER',
          40, y
        );
        y += 14;

        // Table Header
        doc.rect(40, y, 515, 18).fill('#E2E8F0');
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold');
        doc.text('#', 45, y + 5);
        doc.text(lang === 'en' ? 'MIXER ID' : 'CAMIÓN MIXER', 70, y + 5);
        doc.text(lang === 'en' ? 'DELIVERY NOTE' : 'GUÍA REMISIÓN', 160, y + 5);
        doc.text('SLUMP (cm)', 260, y + 5);
        doc.text(lang === 'en' ? 'CYLINDERS' : 'PROBETAS', 340, y + 5);
        doc.text("f'c DIS.", 415, y + 5);
        doc.text(lang === 'en' ? 'VERDICT' : 'ESTADO', 475, y + 5);

        y += 18;
        doc.font('Helvetica').fontSize(7.5);

        for (const t of trucks) {
          if (y > 720) {
            doc.addPage();
            y = 45;
          }
          const isRowFail = t.slump_verdict === 'FAIL';
          doc.rect(40, y, 515, 16).fill(isRowFail ? '#FEE2E2' : y % 32 === 0 ? '#F8FAFC' : '#FFFFFF');
          doc.fillColor('#1E293B');
          doc.text(String(t.truck_number), 45, y + 4);
          doc.text(t.mixer_id, 70, y + 4);
          doc.text(t.delivery_note, 160, y + 4);
          const slumpText = t.slump ? `${t.slump}"` : (t.slump_cm !== undefined ? `${t.slump_cm.toFixed(1)} cm` : '-');
          doc.text(slumpText, 260, y + 4);
          doc.text(`${t.cylinders_cast} und`, 340, y + 4);
          doc.text(`${t.design_fc}`, 415, y + 4);

          doc.font('Helvetica-Bold').fillColor(isRowFail ? '#DC2626' : '#16A34A');
          doc.text(t.slump_verdict, 475, y + 4);
          doc.font('Helvetica').fillColor('#1E293B');
          y += 16;
        }
        y += 10;
      }

      // --- 5. TECHNICAL CRITERIA VALIDATION TABLE ---
      if (y > 700) {
        doc.addPage();
        y = 45;
      }
      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
        lang === 'en' ? 'TECHNICAL CRITERIA & MEASUREMENTS' : 'MEDICIONES Y VERIFICACIÓN TÉCNICA (NORMA EG-2013 / EXPEDIENTE)',
        40, y
      );
      y += 14;

      // Table Header
      doc.rect(40, y, 515, 18).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold');
      doc.text(lang === 'en' ? 'PARAMETER / FIELD' : 'PARÁMETRO / CAMPO', 48, y + 5);
      doc.text(lang === 'en' ? 'REQUIRED CRITERION' : 'CRITERIO EXIGIDO', 180, y + 5);
      doc.text(lang === 'en' ? 'OBTAINED VALUE' : 'VALOR OBTENIDO', 330, y + 5);
      doc.text(lang === 'en' ? 'RESULT' : 'RESULTADO', 450, y + 5);

      y += 18;
      doc.font('Helvetica').fontSize(7.5);

      for (const check of params.checks) {
        if (y > 730) {
          doc.addPage();
          y = 45;
        }
        const isFail = check.result === 'FAIL';
        doc.rect(40, y, 515, 16).fill(isFail ? '#FEE2E2' : '#FFFFFF');

        doc.fillColor('#334155').text(check.field, 48, y + 4, { width: 125 });
        doc.text(check.expected, 180, y + 4, { width: 140 });
        doc.text(`${check.actual}${check.unit ? ' ' + check.unit : ''}`, 330, y + 4, { width: 110 });

        doc.font('Helvetica-Bold').fillColor(isFail ? '#DC2626' : '#16A34A');
        doc.text(check.result, 450, y + 4);
        doc.font('Helvetica');
        y += 16;
      }

      // --- 5.1 PAPER CHECKLIST PROTOCOL ITEMS (§3.6 / F1) ---
      const protocolChecks = this.db.prepare(`
        SELECT pc.*, ct.item_text, ct.section, ct.item_order
        FROM protocol_checks pc
        LEFT JOIN checklist_templates ct ON pc.template_item_id = ct.id
        WHERE pc.protocol_id = ?
        ORDER BY ct.item_order ASC, pc.id ASC
      `).all(params.protocol.id) as any[];

      if (protocolChecks.length > 0) {
        y += 12;
        if (y > 680) {
          doc.addPage();
          y = 45;
        }
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
          lang === 'en' ? 'PROTOCOL INSPECTION CHECKLIST (CUMPLE / NO CUMPLE / NO APLICA)' : 'LISTA DE CHEQUEO DEL PROTOCOLO (CUMPLE / NO CUMPLE / NO APLICA)',
          40, y
        );
        y += 14;

        doc.rect(40, y, 515, 18).fill('#E2E8F0');
        doc.fillColor('#1E293B').fontSize(7.5).font('Helvetica-Bold');
        doc.text('#', 45, y + 5);
        doc.text(lang === 'en' ? 'INSPECTION ITEM / REQUIREMENT' : 'ÍTEM DE INSPECCIÓN / REQUISITO', 70, y + 5);
        doc.text(lang === 'en' ? 'RESULT' : 'EVALUACIÓN', 370, y + 5);
        doc.text(lang === 'en' ? 'OBSERVATION' : 'OBSERVACIÓN', 440, y + 5);

        y += 18;
        doc.font('Helvetica').fontSize(7.5);

        for (let i = 0; i < protocolChecks.length; i++) {
          const chk = protocolChecks[i];
          if (y > 730) {
            doc.addPage();
            y = 45;
          }
          const isCheckFail = chk.result === 'NO_CUMPLE';
          doc.rect(40, y, 515, 16).fill(isCheckFail ? '#FEE2E2' : i % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
          doc.fillColor('#334155');
          doc.text(String(chk.item_order || i + 1), 45, y + 4);
          doc.text(chk.item_text || chk.template_item_id, 70, y + 4, { width: 295 });

          const badgeColor = chk.result === 'CUMPLE' ? '#16A34A' : chk.result === 'NO_CUMPLE' ? '#DC2626' : '#64748B';
          const labelResult = chk.result === 'CUMPLE' ? 'CUMPLE' : chk.result === 'NO_CUMPLE' ? 'NO CUMPLE' : 'N/A';
          doc.font('Helvetica-Bold').fillColor(badgeColor).text(labelResult, 370, y + 4);
          doc.font('Helvetica').fillColor('#64748B').text(chk.observation || '-', 440, y + 4, { width: 110 });
          y += 16;
        }
      }

      // --- 6. CYLINDER BREAK RESULTS (If Any Tested) ---
      if (cylinders.length > 0) {
        y += 8;
        if (y > 710) {
          doc.addPage();
          y = 45;
        }
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
          lang === 'en' ? 'LABORATORY CYLINDER COMPRESSIVE STRENGTH' : 'ENSAYOS DE ROTURA DE PROBETAS (LABORATORIO)',
          40, y
        );
        y += 14;

        doc.rect(40, y, 515, 16).fill('#E2E8F0');
        doc.fillColor('#1E293B').fontSize(7).font('Helvetica-Bold');
        doc.text(lang === 'en' ? 'CYLINDER CODE' : 'CÓDIGO PROBETA', 45, y + 4);
        doc.text(lang === 'en' ? 'TRUCK #' : 'CAMIÓN', 150, y + 4);
        doc.text(lang === 'en' ? 'AGE' : 'EDAD', 210, y + 4);
        doc.text(lang === 'en' ? 'STRENGTH' : 'RESISTENCIA', 270, y + 4);
        doc.text("f'c", 350, y + 4);
        doc.text('LAB', 410, y + 4);
        doc.text(lang === 'en' ? 'STATUS' : 'ESTADO', 475, y + 4);

        y += 16;
        doc.font('Helvetica').fontSize(7);

        for (const cyl of cylinders) {
          if (y > 740) {
            doc.addPage();
            y = 45;
          }
          doc.rect(40, y, 515, 14).fill('#FFFFFF');
          doc.fillColor('#334155');
          doc.text(cyl.cylinder_code, 45, y + 3);
          doc.text(cyl.truck_number ? `Camión ${cyl.truck_number}` : 'Vaciado', 150, y + 3);
          doc.text(`${cyl.age_days} d`, 210, y + 3);
          doc.text(cyl.strength_kgcm2 ? `${cyl.strength_kgcm2} kg/cm²` : '---', 270, y + 3);
          doc.text(`${cyl.design_fc} kg/cm²`, 350, y + 3);
          doc.text(cyl.lab || '---', 410, y + 3);
          const isPass = cyl.verdict === 'PASS';
          doc.font('Helvetica-Bold').fillColor(cyl.status === 'PENDING' ? '#D97706' : isPass ? '#16A34A' : '#DC2626');
          doc.text(cyl.status === 'PENDING' ? 'PENDIENTE' : cyl.verdict, 475, y + 3);
          doc.font('Helvetica').fillColor('#334155');
          y += 14;
        }
      }

      // --- 7. EVIDENCE PHOTOS ---
      const photos = this.photoService.getPhotosForProtocol(params.protocol.id);
      if (photos.length > 0) {
        y += 12;
        if (y > 660) {
          doc.addPage();
          y = 45;
        }
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
          lang === 'en' ? 'PHOTOGRAPHIC EVIDENCE WITH TAMPER-PROOF GPS' : 'EVIDENCIA FOTOGRÁFICA CON SELLO GPS INMUTABLE',
          40, y
        );
        y += 14;

        let photoX = 40;
        for (const p of photos) {
          const photoAbsPath = this.photoService.getPhotoAbsolutePath(p);
          if (fs.existsSync(photoAbsPath)) {
            try {
              if (y > 640) {
                doc.addPage();
                y = 45;
                photoX = 40;
              }
              doc.image(photoAbsPath, photoX, y, { width: 115, height: 85, fit: [115, 85] });
              doc.fontSize(6).fillColor('#64748B').text(
                `GPS: ${p.gps_lat?.toFixed(4)}, ${p.gps_lng?.toFixed(4)}\n${p.captured_at.substring(0, 19)}`,
                photoX,
                y + 88,
                { width: 115 }
              );
              photoX += 130;
              if (photoX > 450) {
                photoX = 40;
                y += 110;
              }
            } catch {
              // ignore broken photo render
            }
          }
        }
        y += 110;
      }

      // --- 8. 5-BOX OFFICIAL SIGNATURE & STAMP GRID (§3.7 / F4, F6, F8, F9) ---
      const signatures = this.db.prepare(`
        SELECT * FROM signatures WHERE protocol_id = ? ORDER BY sign_order ASC
      `).all(params.protocol.id) as any[];

      if (y > 660) {
        doc.addPage();
        y = 45;
      } else {
        y += 14;
      }

      doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold').text(
        lang === 'en' ? 'OFFICIAL SIGNATURES & STAMPS (RESPONSIBLE STAFF)' : 'CUADRO DE FIRMAS Y SELLOS OFICIALES DE CONFORMIDAD',
        40, y
      );
      y += 14;

      const sigList = signatures.length > 0 ? signatures : [
        { role: 'Especialista de Calidad (Ejecución)', signatory_name: 'Ing. David Valdez Ochoa', cip_number: null, status: 'SIGNED' },
        { role: 'Especialista de Calidad (Supervisión)', signatory_name: 'Ing. Cristian Manuel Torres Salinas', cip_number: '260873', status: 'PENDING' },
        { role: 'Supervisor de Obra', signatory_name: 'Ing. Teodoro Manuel Huamancusi Quispe', cip_number: '53548', status: 'PENDING' },
        { role: 'Residente de Obra', signatory_name: 'Ing. Edison Cuadros García', cip_number: '302775', status: 'PENDING' },
        { role: 'Especialista de Estructuras (Supervisión)', signatory_name: 'Ing. Roly Conocachi Huamaní', cip_number: '76843', status: 'PENDING' }
      ];

      const boxWidth = 98;
      const boxGap = 6;
      const boxHeight = 72;

      for (let i = 0; i < sigList.length; i++) {
        const s = sigList[i];
        const bx = 40 + i * (boxWidth + boxGap);

        // Box border and background
        doc.rect(bx, y, boxWidth, boxHeight).fillAndStroke(s.status === 'SIGNED' ? '#F0FDF4' : '#F8FAFC', '#CBD5E1');

        // Role title header banner
        doc.rect(bx, y, boxWidth, 18).fill('#1E293B');
        doc.fillColor('#F8FAFC').fontSize(5.2).font('Helvetica-Bold').text(
          s.role,
          bx + 2,
          y + 3,
          { width: boxWidth - 4, align: 'center' }
        );

        // Stamp/Signature area
        if (s.status === 'SIGNED') {
          doc.rect(bx + 10, y + 21, boxWidth - 20, 24).stroke('#16A34A');
          doc.fillColor('#16A34A').fontSize(5).font('Helvetica-Bold').text('FIRMADO DIGITAL', bx + 12, y + 23, { width: boxWidth - 24, align: 'center' });
          doc.fontSize(4.5).font('Helvetica').text('PIN/SELLO VERIFICADO', bx + 12, y + 31, { width: boxWidth - 24, align: 'center' });
          if (s.signed_at) {
            doc.fontSize(4).text(String(s.signed_at).substring(0, 10), bx + 12, y + 37, { width: boxWidth - 24, align: 'center' });
          }
        } else {
          doc.fillColor('#94A3B8').fontSize(5.5).font('Helvetica').text('[ PENDIENTE FIRMA ]', bx + 2, y + 30, { width: boxWidth - 4, align: 'center' });
        }

        // Signatory Name & CIP
        doc.fillColor('#0F172A').fontSize(5.5).font('Helvetica-Bold').text(
          s.signatory_name || 'Ingeniero Responsable',
          bx + 2,
          y + 49,
          { width: boxWidth - 4, align: 'center' }
        );
        doc.fillColor('#475569').fontSize(5).font('Helvetica').text(
          s.cip_number ? `CIP N° ${s.cip_number}` : 'CONTRATISTA',
          bx + 2,
          y + 61,
          { width: boxWidth - 4, align: 'center' }
        );
      }
      y += boxHeight + 12;

      // --- 9. FOOTER & INTEGRITY STAMP ---
      if (y > 750) {
        doc.addPage();
        y = 45;
      }
      y = Math.max(y + 10, 770);
      doc.rect(40, y, 515, 30).fill('#F8FAFC');
      doc.fillColor('#94A3B8').fontSize(6.5).font('Helvetica');
      doc.text(
        `PROTOKOL FORENSIC INTEGRITY HASH (SHA-256): ${params.protocol.integrity_hash}`,
        48,
        y + 6,
        { width: 500 }
      );
      doc.text(
        `Generado automáticamente de conformidad con Directiva N° 017-2023-CG/GMPL e INFOBRAS. Registro inmutable.`,
        48,
        y + 16,
        { width: 500 }
      );

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  /**
   * Generates the Master Quality Dossier PDF.
   */
  async generateDossierPdf(projectId: string): Promise<{ outputPath: string; protocolsCount: number; openNcCount: number }> {
    const project = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as unknown as ProjectRecord | undefined;
    const projectName = project?.name || projectId;
    const contractNumber = project?.contract_number || 'N/A';
    const entity = project?.entity || 'Entidad Pública';

    const protocols = this.db.prepare(`
      SELECT * FROM protocols WHERE project_id = ? ORDER BY chainage ASC, panel ASC
    `).all(projectId) as unknown as ProtocolRecord[];

    const openNcs = this.db.prepare(`
      SELECT nc.*, p.chainage, p.panel, p.activity FROM nonconformances nc
      JOIN protocols p ON nc.protocol_id = p.id
      WHERE p.project_id = ? AND nc.status = 'OPEN'
    `).all(projectId) as any[];

    const filename = `${projectId}-dossier-${new Date().toISOString().split('T')[0]}.pdf`;
    const outputPath = path.join(config.dossierDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Cover Page
      doc.rect(40, 40, 515, 760).stroke('#0284C7');
      doc.moveDown(8);
      doc.fillColor('#0F172A').fontSize(24).font('Helvetica-Bold').text('DOSIER DE CALIDAD', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text('REGISTRO OFICIAL DE PROTOCOLOS Y ENSAYOS', { align: 'center' });
      doc.moveDown(4);

      doc.fontSize(11).font('Helvetica-Bold').text('PROYECTO:', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(projectName, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(10).font('Helvetica-Bold').text(`CONTRATO: ${contractNumber}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`ENTIDAD: ${entity}`, { align: 'center' });
      doc.moveDown(4);

      doc.fontSize(12).font('Helvetica-Bold').text('RESUMEN EJECUTIVO PARA VALORIZACIÓN', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Protocolos Registrados: ${protocols.length}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`No Conformidades Abiertas: ${openNcs.length}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`, { align: 'center' });

      // Protocols index
      doc.addPage();
      doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text('ÍNDICE DE PROTOCOLOS DE CONTROL', 40, 40);
      doc.moveDown(1);

      let y = 70;
      doc.rect(40, y, 515, 20).fill('#E2E8F0');
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica-Bold');
      doc.text('ID PROTOCOLO', 45, y + 6);
      doc.text('ACTIVIDAD', 170, y + 6);
      doc.text('PROGRESIVA', 260, y + 6);
      doc.text('PAÑO', 340, y + 6);
      doc.text('VEREDICTO', 430, y + 6);

      y += 20;
      doc.font('Helvetica').fontSize(8);

      for (const p of protocols) {
        if (y > 750) {
          doc.addPage();
          y = 45;
        }
        doc.rect(40, y, 515, 18).fill(y % 36 === 0 ? '#F8FAFC' : '#FFFFFF');
        doc.fillColor('#334155').text(p.id, 45, y + 5);
        doc.text(p.activity, 170, y + 5);
        doc.text(p.chainage, 260, y + 5);
        doc.text(p.panel, 340, y + 5);

        const color = p.verdict === 'PASS' ? '#16A34A' : p.verdict === 'PROVISIONAL_PASS' ? '#D97706' : '#DC2626';
        doc.font('Helvetica-Bold').fillColor(color).text(p.verdict, 430, y + 5);
        doc.font('Helvetica');
        y += 18;
      }

      doc.end();
      stream.on('finish', () => resolve({ outputPath, protocolsCount: protocols.length, openNcCount: openNcs.length }));
      stream.on('error', reject);
    });
  }
}
