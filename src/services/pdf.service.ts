import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { ProtocolRecord, ValidationCheck, ActivityType, ProjectRecord, ConcreteTruckRecord, SupportedLanguage } from '../types.js';
import { PhotoService } from './photo.service.js';

export interface GoreDocSpec {
  code: string;
  rev: string;
  date: string;
  title: string;
  defaultPartida: string;
  sigFamily: '4_BOX_PAVEMENT' | '5_BOX_PAVEMENT' | '5_BOX_SURVEY' | '4_BOX_LAB';
  checklistStateLabels: {
    pass: string;
    fail: string;
    na: string;
  };
  isConfirmed: boolean;
}

export const GORE_DOC_SPECS: Record<string, GoreDocSpec> = {
  FORMWORK: {
    code: 'GDC-PDE-2026',
    rev: 'Versión: 001',
    date: '13/06/2026',
    title: 'PROTOCOLO DE ENCOFRADO',
    defaultPartida: 'ENCOFRADO Y DESENCOFRADO',
    sigFamily: '5_BOX_PAVEMENT',
    checklistStateLabels: { pass: 'CUMPLE', fail: 'NO CUMPLE', na: 'NO APLICA' },
    isConfirmed: true
  },
  STEEL: {
    code: 'FO01PT03',
    rev: 'Versión: 001',
    date: '13/06/2026',
    title: 'PROTOCOLO DE INSTALACION DE ACERO DE REFUERZO',
    defaultPartida: 'HABILITACION Y COLOCACION DE ACERO CORRUGADO PARA SOPORTE DOWELS',
    sigFamily: '5_BOX_PAVEMENT',
    checklistStateLabels: { pass: 'CUMPLE', fail: 'NO CUMPLE', na: 'NO APLICA' },
    isConfirmed: true
  },
  CONCRETE: {
    code: 'GDC-PCC-2026',
    rev: 'Versión: 001',
    date: '13/06/2026',
    title: 'PROTOCOLO DE COLOCACIÓN DE PAVIMENTO RÍGIDO',
    defaultPartida: "CONCRETO FC=280 KG/CM2, EN PAVIMENTO RIGIDO E=0.25M",
    sigFamily: '5_BOX_PAVEMENT',
    checklistStateLabels: { pass: 'Si', fail: 'No', na: 'N/A' },
    isConfirmed: true
  },
  SURVEY: {
    code: 'GCO-PVT-2026',
    rev: 'Rev: 01',
    date: '08/06/2026',
    title: 'PROTOCOLO DE VERIFICACIÓN TOPOGRÁFICA',
    defaultPartida: 'TRAZO, NIVELACION Y REPLANTEO',
    sigFamily: '5_BOX_SURVEY',
    checklistStateLabels: { pass: 'C', fail: 'NC', na: 'NA' },
    isConfirmed: true
  },
  COMPACTION: {
    code: 'GDC-PCS-2026',
    rev: 'Versión: 001',
    date: '13/06/2026',
    title: 'PROTOCOLO DE CONTROL DE COMPACTACIÓN DE SUELOS',
    defaultPartida: 'CONFORMACION Y COMPACTACION DE SUB-BASE Y BASE',
    sigFamily: '4_BOX_PAVEMENT',
    checklistStateLabels: { pass: 'CUMPLE', fail: 'NO CUMPLE', na: 'NO APLICA' },
    isConfirmed: false // Formato no confirmado en archivo físico (criterios EG-2013 referenciales)
  },
  CYLINDERS: {
    code: 'SGC-CRP-2026',
    rev: 'Revisión: ---',
    date: 'JULIO 2026',
    title: 'CONTROL DE ROTURAS DE PROBETA',
    defaultPartida: 'ENSAYO DE RESISTENCIA A LA COMPRESIÓN',
    sigFamily: '4_BOX_LAB',
    checklistStateLabels: { pass: 'PASS', fail: 'FAIL', na: 'N/A' },
    isConfirmed: true
  }
};

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
   * Format date strictly as DD/MM/YYYY without hardcoded fallbacks
   */
  private formatDate(rawDate?: string | null): string {
    if (!rawDate) {
      const now = new Date();
      return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    } catch {}
    return String(rawDate).substring(0, 10);
  }

  /**
   * Read a value from protocol measurements (handles JSON string or object).
   */
  private getMeasurement(protocol: ProtocolRecord, key: string): any {
    const m: any = (protocol as any).measurements;
    if (!m) return undefined;
    try {
      const obj = typeof m === 'string' ? JSON.parse(m) : m;
      return obj?.[key];
    } catch {
      return undefined;
    }
  }

  /**
   * Get sequential correlative for project
   */
  private getCorrelativo(protocol: ProtocolRecord): string {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as count FROM protocols WHERE project_id = ? AND id <= ?
      `).get(protocol.project_id, protocol.id) as { count: number } | undefined;
      const num = row?.count || 1;
      return `N° ${String(num).padStart(4, '0')}`;
    } catch {
      return `N° 0001`;
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

    // Retrieve project information from database
    const project = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `).get(params.protocol.project_id) as unknown as ProjectRecord | undefined;

    const projectName = project?.name || '“MEJORAMIENTO Y AMPLIACIÓN DEL SERVICIO DE TRANSITABILIDAD ENTRE EL TRAMO AY-728 (PENAL DE YANAMILLA) HASTA EL TRAMO AY-729 (PTAR) LONGITUD 2.38KM, EN EL DISTRITO DE ANDRES AVELINO CACERES- PROVINCIA DE HUAMANGA- DEPARTAMENTO DE AYACUCHO”';
    const executingEntity = 'GOBIERNO REGIONAL DE AYACUCHO SEDE CENTRAL';
    const supervisingEntity = (project as any)?.supervisor_entity || ''; // Blank on physical formats
    const roadSection = project?.road_section || 'AY-728 / AY-729 (Totora - Yanamilla)';
    const referencePlan = this.getMeasurement(params.protocol, 'plano_referencia') || 'PC-01 (PLANO CLAVE)';

    const trucks = this.db.prepare(`
      SELECT * FROM concrete_trucks WHERE protocol_id = ? ORDER BY truck_number ASC
    `).all(params.protocol.id) as unknown as ConcreteTruckRecord[];

    const cylinders = this.db.prepare(`
      SELECT * FROM cylinders WHERE protocol_id = ? ORDER BY truck_number ASC, age_days ASC
    `).all(params.protocol.id) as any[];

    const protocolChecks = this.db.prepare(`
      SELECT pc.*, ct.item_text, ct.section, ct.item_order
      FROM protocol_checks pc
      LEFT JOIN checklist_templates ct ON pc.template_item_id = ct.id
      WHERE pc.protocol_id = ?
      ORDER BY ct.item_order ASC, pc.id ASC
    `).all(params.protocol.id) as any[];

    const signatures = this.db.prepare(`
      SELECT * FROM signatures WHERE protocol_id = ? ORDER BY sign_order ASC
    `).all(params.protocol.id) as any[];

    const photos = this.photoService.getPhotosForProtocol(params.protocol.id);

    const docSpec: GoreDocSpec = GORE_DOC_SPECS[params.protocol.activity] || {
      code: 'GDC-GEN-2026',
      rev: 'Versión: 001',
      date: '13/06/2026',
      title: `PROTOCOLO DE ${params.protocol.activity}`,
      defaultPartida: 'CONTROL DE CALIDAD Y PUNTOS DE INSPECCIÓN',
      sigFamily: '4_BOX_PAVEMENT',
      checklistStateLabels: { pass: 'CUMPLE', fail: 'NO CUMPLE', na: 'NO APLICA' },
      isConfirmed: false
    };

    const formattedDate = this.formatDate(params.protocol.recorded_at);
    const correlativo = this.getCorrelativo(params.protocol);

    return new Promise((resolve, reject) => {
      // 595.28 x 841.89 pt (A4 portrait)
      const doc = new PDFDocument({ margin: 35, size: 'A4', autoFirstPage: true });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = 525; // 595 - 70 margin
      const startX = 35;

      // =========================================================================
      // PAGE 1: FAITHFUL PAPER MIRROR (GOVERNMENT PROTOCOL FORMAT)
      // =========================================================================

      // --- 1. INSTITUTIONAL HEADER BLOCK ---
      let y = 35;
      const headerHeight = 48;
      doc.lineWidth(1).strokeColor('#000000');
      doc.rect(startX, y, pageWidth, headerHeight).stroke();

      // Left Box: Institutional Identification (115 pt)
      const leftW = 120;
      doc.rect(startX, y, leftW, headerHeight).stroke();
      doc.fillColor('#000000').fontSize(7.5).font('Helvetica-Bold').text('GOBIERNO REGIONAL', startX + 5, y + 10, { width: leftW - 10, align: 'center' });
      doc.fontSize(10).font('Helvetica-Bold').text('AYACUCHO', startX + 5, y + 20, { width: leftW - 10, align: 'center' });
      doc.fontSize(6).font('Helvetica').text('SEDE CENTRAL', startX + 5, y + 33, { width: leftW - 10, align: 'center' });

      // Center Box: Official Protocol Title (270 pt)
      const centerW = 265;
      const centerStartX = startX + leftW;
      doc.rect(centerStartX, y, centerW, headerHeight).stroke();
      doc.fontSize(9.5).font('Helvetica-Bold').text(docSpec.title, centerStartX + 5, y + 15, { width: centerW - 10, align: 'center' });
      if (!docSpec.isConfirmed && params.protocol.activity === 'COMPACTION') {
        doc.fontSize(5.5).font('Helvetica-Oblique').text('(Criterios de compactación EG-2013 / Formato referencial)', centerStartX + 5, y + 32, { width: centerW - 10, align: 'center' });
      }

      // Right Box: Control Code / Rev / Date (140 pt)
      const rightW = pageWidth - leftW - centerW;
      const rightStartX = centerStartX + centerW;
      doc.rect(rightStartX, y, rightW, headerHeight).stroke();

      // Dividing lines in right box
      const rh3 = headerHeight / 3;
      doc.moveTo(rightStartX, y + rh3).lineTo(rightStartX + rightW, y + rh3).stroke();
      doc.moveTo(rightStartX, y + rh3 * 2).lineTo(rightStartX + rightW, y + rh3 * 2).stroke();

      // Code label (Topografía uses Còdigo with grave accent verbatim)
      const codeLabel = params.protocol.activity === 'SURVEY' ? 'Còdigo:' : (params.protocol.activity === 'STEEL' ? 'Codigo:' : 'Código:');
      doc.fontSize(6.5).font('Helvetica-Bold').text(codeLabel, rightStartX + 6, y + 4);
      doc.font('Helvetica').text(docSpec.code, rightStartX + 42, y + 4);

      doc.font('Helvetica-Bold').text('Versión:', rightStartX + 6, y + rh3 + 4);
      doc.font('Helvetica').text(docSpec.rev, rightStartX + 42, y + rh3 + 4);

      doc.font('Helvetica-Bold').text('Fecha:', rightStartX + 6, y + rh3 * 2 + 4);
      doc.font('Helvetica').text(docSpec.date, rightStartX + 42, y + rh3 * 2 + 4);

      y += headerHeight + 6;

      // --- 2. PROJECT METADATA BLOCK ---
      const metaHeight = 62;
      doc.rect(startX, y, pageWidth, metaHeight).stroke();
      const metaRowH = metaHeight / 4;
      doc.moveTo(startX, y + metaRowH).lineTo(startX + pageWidth, y + metaRowH).stroke();
      doc.moveTo(startX, y + metaRowH * 2).lineTo(startX + pageWidth, y + metaRowH * 2).stroke();
      doc.moveTo(startX, y + metaRowH * 3).lineTo(startX + pageWidth, y + metaRowH * 3).stroke();

      // Row 1: Obra + Fecha de liberación (verbatim K6 in the originals)
      doc.fontSize(6.5).font('Helvetica-Bold').text('Obra:', startX + 5, y + 4);
      doc.font('Helvetica').fontSize(5.5).text(projectName, startX + 32, y + 4, { width: 295, height: metaRowH - 2, ellipsis: true });
      const fechaLiberacion = this.getMeasurement(params.protocol, 'fecha_liberacion');
      doc.fontSize(6.5).font('Helvetica-Bold').text('Fecha de liberación:', startX + 340, y + 4);
      doc.font('Helvetica').fontSize(6).text(fechaLiberacion ? this.formatDate(fechaLiberacion) : '', startX + 428, y + 4, { width: 90 });

      // Row 2: Ejecuta & Supervisa
      const r2Y = y + metaRowH;
      doc.fontSize(6.5).font('Helvetica-Bold').text('Ejecuta:', startX + 5, r2Y + 4);
      doc.font('Helvetica').text(executingEntity, startX + 45, r2Y + 4, { width: 230 });
      doc.font('Helvetica-Bold').text('Supervisa:', startX + 285, r2Y + 4);
      doc.font('Helvetica').text(supervisingEntity || '---', startX + 335, r2Y + 4, { width: 180 });

      // Row 3: Ubicación & Plano Ref.
      const r3Y = y + metaRowH * 2;
      doc.font('Helvetica-Bold').text('Ubicación:', startX + 5, r3Y + 4);
      doc.font('Helvetica').text(`Progresiva ${params.protocol.chainage} (${roadSection})`, startX + 50, r3Y + 4, { width: 225 });
      doc.font('Helvetica-Bold').text('PLANO DE REFERENCIA:', startX + 285, r3Y + 4);
      doc.font('Helvetica').text(referencePlan, startX + 395, r3Y + 4, { width: 120 });

      // Row 4: Elemento, Partida, Fecha Liberación, Correlativo N°
      const r4Y = y + metaRowH * 3;
      doc.font('Helvetica-Bold').text('Elemento:', startX + 5, r4Y + 4);
      const elementoVal = this.getMeasurement(params.protocol, 'elemento');
      doc.font('Helvetica').text(elementoVal || `Paño ${params.protocol.panel}`, startX + 48, r4Y + 4, { width: 65 });

      doc.font('Helvetica-Bold').text('PARTIDA:', startX + 118, r4Y + 4);
      doc.font('Helvetica').fontSize(5.2).text(docSpec.defaultPartida, startX + 155, r4Y + 4, { width: 180, ellipsis: true });

      doc.fontSize(6.5).font('Helvetica-Bold').text('Fecha:', startX + 342, r4Y + 4);
      doc.font('Helvetica').text(formattedDate, startX + 372, r4Y + 4);

      doc.font('Helvetica-Bold').text('Correlativo N°:', startX + 432, r4Y + 4);
      doc.font('Helvetica-Bold').text(correlativo, startX + 490, r4Y + 4);

      y += metaHeight + 8;

      // =========================================================================
      // --- 3. FORMAT-SPECIFIC BODY & CHECKLIST TABLES ---
      // =========================================================================

      if (params.protocol.activity === 'SURVEY') {
        y = this.renderSurveyBody(doc, startX, y, pageWidth, protocolChecks, docSpec, params.protocol);
      } else if (params.protocol.activity === 'CONCRETE') {
        y = this.renderConcreteBody(doc, startX, y, pageWidth, protocolChecks, trucks, docSpec, params.protocol);
      } else if (params.protocol.activity === 'STEEL') {
        y = this.renderSteelBody(doc, startX, y, pageWidth, protocolChecks, docSpec);
      } else if (params.protocol.activity === 'FORMWORK') {
        y = this.renderFormworkBody(doc, startX, y, pageWidth, protocolChecks, docSpec);
      } else {
        // Compaction standard checklist grid
        y = this.renderStandardChecklistBody(doc, startX, y, pageWidth, protocolChecks, docSpec, params.protocol.activity);
      }

      // =========================================================================
      // --- 4. SIGNATURE GRID (FAITHFUL PAPER MIRROR) ---
      // =========================================================================
      y = this.renderSignatureGrid(doc, startX, y, pageWidth, docSpec.sigFamily);

      // Paper page minimal footer reference
      doc.fontSize(5.5).font('Helvetica').fillColor('#555555').text(
        `Formato oficial impreso · Registro de Calidad en Obra AY-728/AY-729 · Ref: ${params.protocol.id}`,
        startX,
        790,
        { width: pageWidth, align: 'center' }
      );

      // =========================================================================
      // PAGE 2: SEPARATE DIGITAL ANNEX (TRAZABILIDAD FORENSE PROTOKOL)
      // =========================================================================
      doc.addPage();

      this.renderDigitalAnnex(doc, startX, pageWidth, {
        protocol: params.protocol,
        checks: params.checks,
        trucks,
        cylinders,
        photos,
        signatures,
        nonconformanceId: params.nonconformanceId,
        correlativo,
        docSpec
      });

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  /**
   * Renders Topografía specific checklist, field data, and coordinates grid.
   */
  private renderSurveyBody(doc: PDFKit.PDFDocument, x: number, y: number, width: number, protocolChecks: any[], docSpec: GoreDocSpec, protocol?: ProtocolRecord): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);

    // Header table for Survey: ITEM | LISTA DE VERIFICACIÓN | NA | INSPECCIÓN (C/NC) | OBSERVACIONES | V.B
    const itemW = 28;
    const descW = 250;
    const naW = 26;
    const cW = 24;
    const ncW = 24;
    const obsW = 135;
    const vbW = 38;

    doc.rect(x, y, width, 18).stroke();
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('ITEM', x + 4, y + 6);
    doc.text('LISTA DE VERIFICACIÓN', x + itemW + 6, y + 6);
    doc.text('NA', x + itemW + descW + 6, y + 6);
    doc.text('INSP.', x + itemW + descW + naW + 4, y + 2);
    doc.text('(C / NC)', x + itemW + descW + naW + 2, y + 10);
    doc.text('OBSERVACIONES', x + itemW + descW + naW + cW + ncW + 8, y + 6);
    doc.text('V.B', x + itemW + descW + naW + cW + ncW + obsW + 10, y + 6);
    y += 18;

    // Survey items grouped by 3 sections
    const defaultSurveyItems = [
      { order: '1.1', section: '1. VERIFICACION PRELIMINAR', text: 'Area limpia y sin obstáculos' },
      { order: '1.2', section: '1. VERIFICACION PRELIMINAR', text: 'Area de trabajo señalizada' },
      { order: '1.3', section: '1. VERIFICACION PRELIMINAR', text: 'Equipos y Herramientas Operativas' },
      { order: '1.4', section: '1. VERIFICACION PRELIMINAR', text: 'Se cuenta con todos los permisos de seguridad (AST, etc)' },
      { order: '2.1', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Ubicación de Puntos Auxiliares' },
      { order: '2.2', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Replanteo de Linderos del Terreno' },
      { order: '2.3', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Levantamiento Topográfico' },
      { order: '2.4', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Trazo y replanteo de ejes' },
      { order: '2.5', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Distancia y proporcionalidad entre ejes' },
      { order: '2.6', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Colocación de niveles' },
      { order: '2.7', section: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: 'Verticalidad y alineamiento' },
      { order: '3.1', section: '3. VERIFICACIONES POSTERIORES', text: 'Recojo de Equipos y Herramientas' },
      { order: '3.2', section: '3. VERIFICACIONES POSTERIORES', text: 'Limpieza del Area de trabajo' }
    ];

    let currentSection = '';
    for (const item of defaultSurveyItems) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        // Verbatim from original: section number in ITEM column, name spanning description
        const secNum = item.section.split(' ')[0];
        const secName = item.section.substring(secNum.length).trim();
        doc.rect(x, y, width, 12).fillAndStroke('#F8FAFC', '#000000');
        doc.fillColor('#000000').fontSize(6).font('Helvetica-Bold');
        doc.text(secNum, x + 4, y + 3);
        doc.text(secName, x + itemW + 4, y + 3);
        y += 12;
      }

      const matchCheck = protocolChecks.find(c => (c.item_text && c.item_text.includes(item.text)) || (c.item_order && String(c.item_order) === item.order));
      const res = matchCheck?.result;
      const obs = matchCheck?.observation || '';

      doc.rect(x, y, width, 12).stroke();
      doc.fontSize(6).font('Helvetica').text(item.order, x + 4, y + 3);
      doc.text(item.text, x + itemW + 4, y + 3, { width: descW - 8, ellipsis: true });

      // Verbatim states: NA / C / NC / V.B
      const isNa = res === 'NO_APLICA' ? '[X]' : '[ ]';
      const isC = res === 'CUMPLE' ? '[X]' : '[ ]';
      const isNc = res === 'NO_CUMPLE' ? '[X]' : '[ ]';

      doc.text(isNa, x + itemW + descW + 6, y + 3);
      doc.text(isC, x + itemW + descW + naW + 4, y + 3);
      doc.text(isNc, x + itemW + descW + naW + cW + 4, y + 3);
      doc.text(obs, x + itemW + descW + naW + cW + ncW + 6, y + 3, { width: obsW - 10, ellipsis: true });
      doc.text(res === 'CUMPLE' ? 'V°B°' : '', x + itemW + descW + naW + cW + ncW + obsW + 10, y + 3);

      y += 12;
    }

    // Legend
    doc.fontSize(5).font('Helvetica-Oblique').text(
      'LEYENDA:                     C = CONFORME                                  NC = NO CONFORME                                  NA = NO APLICA',
      x + 5, y + 2
    );
    y += 10;

    // DATOS DE CAMPO TABLE (verbatim structure from PRO-TOPOGRAFIA-2026)
    const meas = (key: string) => this.getMeasurement(protocol as ProtocolRecord, key);
    const equipVal = meas('survey_equipment') || '';
    const certVal = meas('survey_cert') || '';
    const calibVal = meas('survey_calib') || 'SI';
    const mark = (cond: boolean) => (cond ? '[X]' : '[ ]');

    doc.rect(x, y, width, 62).stroke();
    doc.fontSize(6).font('Helvetica-Bold').text('DATOS DE CAMPO:', x + 5, y + 4);

    // Equipment from app measurements (original: EQUIPO 1 / EQUIPO 2 with MARCA/MODELO/SERIE)
    doc.font('Helvetica-Bold').text('EQUIPO 1:', x + 5, y + 15);
    doc.font('Helvetica').text(equipVal, x + 55, y + 15, { width: 140, ellipsis: true });
    doc.font('Helvetica-Bold').text('CALIBRACIÓN:', x + 200, y + 15);
    doc.font('Helvetica').text(`${mark(calibVal === 'SI')} SI   ${mark(calibVal === 'NO')} NO`, x + 265, y + 15);

    doc.font('Helvetica-Bold').text('N° DE CERTIFICADO:', x + 5, y + 27);
    doc.font('Helvetica').text(certVal, x + 95, y + 27, { width: 150 });

    // Coordinates grid (blank — control points are recorded on the physical format)
    doc.font('Helvetica-Bold').text('COORDENADAS DE CONTROL:', x + 350, y + 15);
    doc.font('Helvetica').fontSize(5.5).text('PUNTO: _______  E: ____________  N: ____________  Z: __________', x + 350, y + 27);
    doc.text('PUNTO: _______  E: ____________  N: ____________  Z: __________', x + 350, y + 37);

    doc.font('Helvetica-Bold').text('- SE ADJUNTA PLANO / SKETCH:', x + 5, y + 42);
    doc.font('Helvetica').text('[X] SI   [ ] NO', x + 130, y + 42);
    doc.font('Helvetica-Bold').fontSize(5.5).text('- PUNTO REF.: BM: BENCH MARK   PA: PUNTOS AUXILIARES   PC: PUNTO DE CONTROL', x + 5, y + 50, { width: 320 });

    y += 68;
    return y;
  }

  /**
   * Renders Concreto specific multi-section body (Pre-vaciado, Tipo concreto, Mixer table, Post-vaciado).
   */
  private renderConcreteBody(doc: PDFKit.PDFDocument, x: number, y: number, width: number, protocolChecks: any[], trucks: ConcreteTruckRecord[], docSpec: GoreDocSpec, protocol: ProtocolRecord): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);
    const meas = (key: string) => this.getMeasurement(protocol, key);

    // 1. INSPECCIÓN PREVIA AL VACIADO
    doc.rect(x, y, width, 12).fillAndStroke('#F1F5F9', '#000000');
    doc.fillColor('#000000').fontSize(6.5).font('Helvetica-Bold').text('1.- INSPECCIÓN PREVIA AL VACIADO:', x + 5, y + 3);
    y += 12;

    const prePourItems = [
      { order: '1.1', text: '¿Se cuenta con diseño de mezcla aprobado por la Supervisión?' },
      { order: '1.2', text: '¿La superficie del solado está limpio, libre de tierra, raíces y arena?' },
      { order: '1.3', text: '¿El acero de refuerzo se encuentra limpio, libre de lubricantes y óxidos?' },
      { order: '1.4', text: '¿La posición del acero de refuerzo y el encofrado ha sido verificado por el topógrafo?' },
      { order: '1.5', text: '¿El espesor de recubrimiento de concreto cumple con lo indicado según ET?' },
      { order: '1.6', text: '¿Se encuentra con una referencia para determinar el nivel de llenado de concreto?' },
      { order: '1.7', text: '¿Se ha verificado la conformidad de las juntas?' },
      { order: '1.8', text: '¿Se ha verificado la conformidad de los recubrimientos mínimos?' }
    ];

    doc.rect(x, y, width, 12).stroke();
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('Ítem', x + 4, y + 3);
    doc.text('Descripción de la Verificación', x + 30, y + 3);
    doc.text('Si', x + 420, y + 3);
    doc.text('No', x + 455, y + 3);
    doc.text('N/A', x + 490, y + 3);
    y += 12;

    for (const item of prePourItems) {
      const match = protocolChecks.find(c => c.item_text?.includes(item.text) || c.item_order === item.order);
      const res = match?.result;

      doc.rect(x, y, width, 10).stroke();
      doc.fontSize(5.5).font('Helvetica').text(item.order, x + 4, y + 2);
      doc.text(item.text, x + 30, y + 2, { width: 380, ellipsis: true });
      doc.text(res === 'CUMPLE' ? '[X]' : '[ ]', x + 420, y + 2);
      doc.text(res === 'NO_CUMPLE' ? '[X]' : '[ ]', x + 455, y + 2);
      doc.text(res === 'NO_APLICA' ? '[X]' : '[ ]', x + 490, y + 2);
      y += 10;
    }

    // Gate question verbatim
    doc.rect(x, y, width, 12).stroke();
    doc.fontSize(6).font('Helvetica-Bold').text('¿Las condiciones están dadas para iniciar el concretado?', x + 30, y + 3);
    doc.text('[X] Si    [ ] No', x + 420, y + 3);
    y += 14;

    // 2. TIPO DE CONCRETO Y COLOCACIÓN (verbatim labels from 04. PAVIMENTO_CONCRETO_MI.xlsx)
    const proc = meas('procedencia');   // 'hecho_en_obra' | 'premezclado'
    const coloc = meas('colocacion');   // 'directo'
    const acabado = meas('acabado');    // 'caravista' | 'otro'
    const designFc = meas('design_fc');
    const mark = (cond: boolean) => (cond ? '[X]' : '[ ]');

    doc.rect(x, y, width, 46).stroke();
    doc.fontSize(6).font('Helvetica-Bold').text('2.- TIPO DE CONCRETO Y COLOCACIÓN', x + 5, y + 3);
    doc.fontSize(5.5).font('Helvetica').text('Marcar con un aspa dentro del cuadro según corresponda.', x + 5, y + 13);

    doc.fontSize(5.5).font('Helvetica-Bold').text('F´c diseño:', x + 5, y + 24);
    doc.font('Helvetica').text(designFc ? `${designFc} KG/CM2` : '', x + 52, y + 24);

    doc.font('Helvetica-Bold').text('PROCEDENCIA:', x + 170, y + 24);
    doc.font('Helvetica').text(`${mark(proc === 'hecho_en_obra')} Hecho en obra`, x + 245, y + 24);
    doc.text(`${mark(proc === 'premezclado')} Premezclado`, x + 350, y + 24);

    doc.font('Helvetica-Bold').text('COLOCACIÓN:', x + 170, y + 35);
    doc.font('Helvetica').text(`${mark(coloc === 'directo')} Directo`, x + 245, y + 35);

    doc.font('Helvetica-Bold').text('ACABADO:', x + 330, y + 35);
    doc.font('Helvetica').text(`${mark(acabado === 'caravista')} Caravista`, x + 390, y + 35);
    doc.text(`${mark(acabado === 'otro')} Otro: ______`, x + 462, y + 35, { width: 58 });
    y += 48;

    // 3. CONTROL DE CALIDAD (verbatim structure from 04. PAVIMENTO_CONCRETO_MI.xlsx)
    doc.rect(x, y, width, 12).fillAndStroke('#F1F5F9', '#000000');
    doc.fillColor('#000000').fontSize(6.5).font('Helvetica-Bold').text('3.- CONTROL DE CALIDAD.', x + 5, y + 3);
    y += 12;

    // --- 3a. Mixer groups: 2 side-by-side groups x 5 rows, verbatim columns ---
    // Original columns per group: Numero de testigos elaborados | N° de Guía | Slump | Vol. (m3) | V°B°
    const groupW = (width - 8) / 2;
    const gCols = [
      { label: 'Numero de testigos elaborados', w: 78 },
      { label: 'N° de Guía', w: 70 },
      { label: 'Slump', w: 40 },
      { label: 'Vol. (m3)', w: 40 },
      { label: 'V°B°', w: 30 }
    ];
    const renderMixerGroup = (gx: number, gy: number, groupTrucks: any[]) => {
      let cx = gx;
      doc.fontSize(5).font('Helvetica-Bold');
      for (const c of gCols) {
        doc.rect(cx, gy, c.w, 12).stroke();
        doc.fillColor('#000000').text(c.label, cx + 2, gy + 2, { width: c.w - 4 });
        cx += c.w;
      }
      let ry = gy + 12;
      for (let r = 0; r < 5; r++) {
        const trk = groupTrucks[r];
        cx = gx;
        const cells: string[] = trk ? [
          trk.cylinders_cast != null ? String(trk.cylinders_cast) : '',
          trk.delivery_note || trk.mixer_id || '',
          trk.slump ? String(trk.slump) : '',
          (trk as any).vol_m3 != null ? String((trk as any).vol_m3) : '',
          trk.slump_verdict ? (trk.slump_verdict === 'PASS' ? '[X]' : '[ ]') : ''
        ] : ['', '', '', '', ''];
        doc.fontSize(5.5).font('Helvetica');
        for (let ci = 0; ci < gCols.length; ci++) {
          doc.rect(cx, ry, gCols[ci].w, 10).stroke();
          doc.fillColor('#000000').text(cells[ci], cx + 2, ry + 2, { width: gCols[ci].w - 4 });
          cx += gCols[ci].w;
        }
        ry += 10;
      }
      return ry;
    };
    const g1y = renderMixerGroup(x, y, trucks.slice(0, 5));
    renderMixerGroup(x + groupW + 8, y, trucks.slice(5, 10));
    y = g1y + 6;

    // --- 3b. Cubicación: Elemento | Nro. de veces | Long | Base | Altura | Parcial | Total ---
    // Parcial = veces x long x base x altura (PRODUCT formula); Total = SUM(parcial)
    const cubCols = [
      { label: 'Elemento', w: 145 },
      { label: 'Nro. de veces', w: 70 },
      { label: 'Long', w: 60 },
      { label: 'Base', w: 60 },
      { label: 'Altura', w: 60 },
      { label: 'Parcial', w: 65 },
      { label: 'Total', w: 65 }
    ];
    let cx = x;
    doc.fontSize(5.5).font('Helvetica-Bold');
    for (const c of cubCols) {
      doc.rect(cx, y, c.w, 12).stroke();
      doc.fillColor('#000000').text(c.label, cx + 2, y + 3, { width: c.w - 4, align: 'center' });
      cx += c.w;
    }
    y += 12;

    const cubRows: any[] = meas('cubicacion') || [];
    let totalParcial = 0;
    for (let r = 0; r < 5; r++) {
      const row = cubRows[r] || {};
      const nums = [row.veces, row.long, row.base, row.altura].map((v: any) => (v === '' || v == null ? NaN : Number(v)));
      const parcial = nums.every((n: number) => !isNaN(n)) ? nums[0] * nums[1] * nums[2] * nums[3] : NaN;
      if (!isNaN(parcial)) totalParcial += parcial;
      const cells = [
        row.elemento || '',
        row.veces ?? '',
        row.long ?? '',
        row.base ?? '',
        row.altura ?? '',
        isNaN(parcial) ? '' : parcial.toFixed(2),
        ''
      ];
      cx = x;
      doc.fontSize(5.5).font('Helvetica');
      for (let ci = 0; ci < cubCols.length; ci++) {
        doc.rect(cx, y, cubCols[ci].w, 10).stroke();
        doc.fillColor('#000000').text(String(cells[ci]), cx + 2, y + 2, { width: cubCols[ci].w - 4, align: 'center' });
        cx += cubCols[ci].w;
      }
      y += 10;
    }

    // Cantidad de concreto teórico a colocar (= Total) / real (= SUM Vol.)
    const totalVol = trucks.reduce((s: number, t: any) => s + (Number((t as any).vol_m3) || 0), 0);
    doc.fontSize(6).font('Helvetica');
    doc.text('Cantidad de concreto teórico a colocar:', x + 5, y + 3);
    doc.font('Helvetica-Bold').text(totalParcial > 0 ? totalParcial.toFixed(2) : '', x + 220, y + 3);
    doc.font('Helvetica').text('M3', x + 280, y + 3);
    y += 12;
    doc.text('Cantidad de concreto real:', x + 5, y + 3);
    doc.font('Helvetica-Bold').text(totalVol > 0 ? totalVol.toFixed(2) : '', x + 220, y + 3);
    doc.font('Helvetica').text('M3', x + 280, y + 3);
    y += 16;

    // 4. VERIFICACIÓN POSTERIOR AL VACIADO
    doc.rect(x, y, width, 10).fillAndStroke('#F1F5F9', '#000000');
    doc.fillColor('#000000').fontSize(6).font('Helvetica-Bold').text('4.- VERIFICACIÓN POSTERIOR AL VACIADO:', x + 5, y + 2);
    y += 10;

    const postPourItems = [
      'Acabado superficial de acuerdo a lo especificado',
      'Nivel de aplomado del elemento de acuerdo a lo especificado',
      'Correcta posición final de los elementos embebidos',
      'Curado de la estructura concretada adecuado'
    ];

    for (let i = 0; i < postPourItems.length; i++) {
      doc.rect(x, y, width, 9).stroke();
      doc.fontSize(5).font('Helvetica').text(String(i + 1), x + 4, y + 2);
      doc.text(postPourItems[i], x + 25, y + 2, { width: 380, ellipsis: true });
      doc.text('[X] SI   [ ] NO   [ ] NA', x + 430, y + 2);
      y += 9;
    }

    // Comentarios (from protocol notes; blank on the blank form)
    doc.rect(x, y, width, 14).stroke();
    doc.fontSize(5.5).font('Helvetica-Bold').text('COMENTARIOS / OBSERVACIONES:', x + 5, y + 3);
    doc.font('Helvetica').text((protocol as any).notes || '', x + 130, y + 3, { width: width - 140, ellipsis: true });
    y += 18;

    return y;
  }

  /**
   * Renders the steel protocol body as an exact mirror of 03._PAVIMENTO_ACERO_MI.xlsx
   * (sheet 'PR01 (2)'): 3 sections (MATERIAL, GENERAL, OTROS), 11 items verbatim,
   * CUMPLE / NO CUMPLE / NO APLICA / Observación columns.
   * Spanish labels preserved exactly as in the original (no spelling corrections).
   */
  private renderSteelBody(doc: PDFKit.PDFDocument, x: number, y: number, width: number, protocolChecks: any[], docSpec: GoreDocSpec): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);

    const sections = [
      {
        num: '1', name: 'MATERIAL',
        items: [
          { order: '1.01', text: 'Calidad del acero / Fluencia corresponde con las EETT del proyecto', idx: 1 },
          { order: '1.02', text: '¿El acero instalado presenta certificado de calidad?', idx: 2 },
        ]
      },
      {
        num: '2', name: 'GENERAL',
        items: [
          { order: '2.01', text: '¿Las armaduras de acero son del diámetro indicado en los planos ó EETT?', idx: 3 },
          { order: '2.02', text: '¿Las intersecciones están aseguradas con alambre de amarre?', idx: 4 },
          { order: '2.03', text: '¿Se colocaron dados de concreto en la base de la armadura?', idx: 5 },
          { order: '2.04', text: '¿Se colocaron dados de concreto en los laterales de la armadura?', idx: 6 },
          { order: '2.05', text: '¿La armadura de acero esta ubicada verticalmente y horizontalmente según EETT y planos?', idx: 7 },
          { order: '2.06', text: '¿Las cotas del acero colocado, estan de acuerdo a los planos?', idx: 8 },
          { order: '2.07', text: '¿Las distancias entre las varillas son las que se indican en los planos de referencia?', idx: 9 },
        ]
      },
      {
        num: '3', name: 'OTROS',
        items: [
          { order: '3.01', text: '¿Las armaduras están libre de oxidos y sustancias extrañas en su superficie?', idx: 10 },
          { order: '3.02', text: '¿Todas las condiciones están dadas para dar conformidad a la armadura de acero?', idx: 11 },
        ]
      }
    ];

    // Column layout (mirrors Excel cols B/C/G/H/I/J)
    const numW = 32;
    const checkW = 42;
    const obsW = 110;
    const textW = width - numW - checkW * 3 - obsW;
    const obsX = x + width - obsW;
    const ncX = obsX - checkW;
    const cX = ncX - checkW;
    const cumpleX = cX - checkW;

    const mark = (cond: boolean) => (cond ? '[X]' : '[ ]');

    for (const sec of sections) {
      // Section header row (verbatim: N° | SECTION NAME | CUMPLE | NO CUMPLE | NO APLICA | Observación)
      doc.rect(x, y, width, 13).fillAndStroke('#F1F5F9', '#000000');
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      doc.text(sec.num, x + 4, y + 3, { width: numW - 8 });
      doc.text(sec.name, x + numW + 4, y + 3, { width: textW - 8 });
      doc.fontSize(5.5);
      doc.text('CUMPLE', cumpleX, y + 3, { width: checkW, align: 'center' });
      doc.text('NO CUMPLE', cX, y + 3, { width: checkW, align: 'center' });
      doc.text('NO APLICA', ncX, y + 3, { width: checkW, align: 'center' });
      doc.text('Observación', obsX + 4, y + 3, { width: obsW - 8 });
      y += 13;

      for (const item of sec.items) {
        const chk = protocolChecks.find((c: any) => c.item_order === item.idx);
        const res = chk?.result;
        const obs = chk?.observation || '';

        doc.rect(x, y, width, 14).stroke();
        // Vertical dividers
        doc.moveTo(x + numW, y).lineTo(x + numW, y + 14).stroke();
        doc.moveTo(cumpleX, y).lineTo(cumpleX, y + 14).stroke();
        doc.moveTo(cX, y).lineTo(cX, y + 14).stroke();
        doc.moveTo(ncX, y).lineTo(ncX, y + 14).stroke();
        doc.moveTo(obsX, y).lineTo(obsX, y + 14).stroke();

        doc.fontSize(6).font('Helvetica');
        doc.text(item.order, x + 4, y + 4, { width: numW - 8 });
        doc.fontSize(5.5).text(item.text, x + numW + 4, y + 2, { width: textW - 8, ellipsis: true });
        doc.fontSize(6);
        doc.text(mark(res === 'CUMPLE'), cumpleX, y + 4, { width: checkW, align: 'center' });
        doc.text(mark(res === 'NO_CUMPLE'), cX, y + 4, { width: checkW, align: 'center' });
        doc.text(mark(res === 'NO_APLICA'), ncX, y + 4, { width: checkW, align: 'center' });
        doc.fontSize(5).text(obs, obsX + 4, y + 2, { width: obsW - 8, ellipsis: true });
        y += 14;
      }
      y += 4;
    }

    return y;
  }

  /**
   * Renders the formwork protocol body as an exact mirror of 02._PAVIMENTO_ENCOFRADO_MI.xlsx
   * (sheet '6'): 2 sections (DESCRIPCION DE ACTIVIDAD, VERIFICACIÓN DE LOS MATERIALES),
   * 8 items verbatim (2.03 deliberately skipped in the original), CUMPLE / NO CUMPLE /
   * NO APLICA / Observación columns. Spanish labels preserved exactly as in the original.
   */
  private renderFormworkBody(doc: PDFKit.PDFDocument, x: number, y: number, width: number, protocolChecks: any[], docSpec: GoreDocSpec): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);

    const sections = [
      {
        num: '1', name: 'DESCRIPCION DE ACTIVIDAD',
        items: [
          { order: '1.01', text: '¿Tipo de encofrado es adecuado para el tipo de estructura a concretar?', idx: 1 },
          { order: '1.02', text: '¿Los accesorios empleados son los adecuados?', idx: 2 },
          { order: '1.03', text: '¿Ubicación correcta de los elementos embebidos?', idx: 3 },
          { order: '1.04', text: '¿Los puntales son los adecuados?.', idx: 4 },
        ]
      },
      {
        num: '2', name: 'VERIFICACIÓN DE LOS MATERIALES',
        items: [
          { order: '2.01', text: 'Dimensiones del encofrado según los planos y las EETT.', idx: 5 },
          { order: '2.02', text: 'Distancias entre ejes y longitudes de encofrado.', idx: 6 },
          { order: '2.04', text: 'Verificación del alineamiento del encofrado.', idx: 7 },
          { order: '2.05', text: 'Verificación de la verticalidad o inclinación en los diferentes encofrados', idx: 8 },
        ]
      }
    ];

    // Column layout (mirrors Excel cols B/C/G/H/I/J)
    const numW = 32;
    const checkW = 42;
    const obsW = 110;
    const textW = width - numW - checkW * 3 - obsW;
    const obsX = x + width - obsW;
    const ncX = obsX - checkW;
    const cX = ncX - checkW;
    const cumpleX = cX - checkW;

    const mark = (cond: boolean) => (cond ? '[X]' : '[ ]');

    for (const sec of sections) {
      // Section header row (verbatim: N° | SECTION NAME | CUMPLE | NO CUMPLE | NO APLICA | Observación)
      doc.rect(x, y, width, 13).fillAndStroke('#F1F5F9', '#000000');
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      doc.text(sec.num, x + 4, y + 3, { width: numW - 8 });
      doc.text(sec.name, x + numW + 4, y + 3, { width: textW - 8 });
      doc.fontSize(5.5);
      doc.text('CUMPLE', cumpleX, y + 3, { width: checkW, align: 'center' });
      doc.text('NO CUMPLE', cX, y + 3, { width: checkW, align: 'center' });
      doc.text('NO APLICA', ncX, y + 3, { width: checkW, align: 'center' });
      doc.text('Observación', obsX + 4, y + 3, { width: obsW - 8 });
      y += 13;

      for (const item of sec.items) {
        const chk = protocolChecks.find((c: any) => c.item_order === item.idx);
        const res = chk?.result;
        const obs = chk?.observation || '';

        doc.rect(x, y, width, 14).stroke();
        // Vertical dividers
        doc.moveTo(x + numW, y).lineTo(x + numW, y + 14).stroke();
        doc.moveTo(cumpleX, y).lineTo(cumpleX, y + 14).stroke();
        doc.moveTo(cX, y).lineTo(cX, y + 14).stroke();
        doc.moveTo(ncX, y).lineTo(ncX, y + 14).stroke();
        doc.moveTo(obsX, y).lineTo(obsX, y + 14).stroke();

        doc.fontSize(6).font('Helvetica');
        doc.text(item.order, x + 4, y + 4, { width: numW - 8 });
        doc.fontSize(5.5).text(item.text, x + numW + 4, y + 2, { width: textW - 8, ellipsis: true });
        doc.fontSize(6);
        doc.text(mark(res === 'CUMPLE'), cumpleX, y + 4, { width: checkW, align: 'center' });
        doc.text(mark(res === 'NO_CUMPLE'), cX, y + 4, { width: checkW, align: 'center' });
        doc.text(mark(res === 'NO_APLICA'), ncX, y + 4, { width: checkW, align: 'center' });
        doc.fontSize(5).text(obs, obsX + 4, y + 2, { width: obsW - 8, ellipsis: true });
        y += 14;
      }
      y += 4;
    }

    return y;
  }

  /**
   * Renders standard checklist format (Compaction — remaining generic user).
   */
  private renderStandardChecklistBody(doc: PDFKit.PDFDocument, x: number, y: number, width: number, protocolChecks: any[], docSpec: GoreDocSpec, activity: string): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);

    const itemW = 30;
    const descW = 280;
    const cW = 50;
    const ncW = 55;
    const naW = 50;
    const obsW = width - (itemW + descW + cW + ncW + naW);

    doc.rect(x, y, width, 14).stroke();
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('ITEM', x + 4, y + 4);
    doc.text('DESCRIPCION DE ACTIVIDAD / MATERIALES', x + itemW + 4, y + 4);
    doc.text(docSpec.checklistStateLabels.pass, x + itemW + descW + 4, y + 4);
    doc.text(docSpec.checklistStateLabels.fail, x + itemW + descW + cW + 4, y + 4);
    doc.text(docSpec.checklistStateLabels.na, x + itemW + descW + cW + ncW + 4, y + 4);
    doc.text('Observación', x + itemW + descW + cW + ncW + naW + 4, y + 4);
    y += 14;

    let itemsToRender: Array<{ order: string; section: string; text: string }> = [];

    if (activity === 'FORMWORK') {
      // Verbatim Encofrado: 1.01..1.04 and 2.01, 2.02, 2.04, 2.05 (2.03 is absent!)
      itemsToRender = [
        { order: '1.01', section: '1. DESCRIPCION DE ACTIVIDAD', text: '¿Tipo de encofrado es adecuado para el tipo de estructura a concretar?' },
        { order: '1.02', section: '1. DESCRIPCION DE ACTIVIDAD', text: '¿Los accesorios empleados son los adecuados?' },
        { order: '1.03', section: '1. DESCRIPCION DE ACTIVIDAD', text: '¿Ubicación correcta de los elementos embebidos?' },
        { order: '1.04', section: '1. DESCRIPCION DE ACTIVIDAD', text: '¿Los puntales son los adecuados?.' },
        { order: '2.01', section: '2. VERIFICACIÓN DE LOS MATERIALES', text: 'Dimensiones del encofrado según los planos y las EETT.' },
        { order: '2.02', section: '2. VERIFICACIÓN DE LOS MATERIALES', text: 'Distancias entre ejes y longitudes de encofrado.' },
        { order: '2.04', section: '2. VERIFICACIÓN DE LOS MATERIALES', text: 'Verificación del alineamiento del encofrado.' },
        { order: '2.05', section: '2. VERIFICACIÓN DE LOS MATERIALES', text: 'Verificación de la verticalidad o inclinación en los diferentes encofrados' }
      ];
    } else if (activity === 'STEEL') {
      // Verbatim Acero: 1.01..1.02, 2.01..2.07, 3.01..3.02
      itemsToRender = [
        { order: '1.01', section: '1. MATERIAL', text: 'Calidad del acero / Fluencia corresponde con las EETT del proyecto' },
        { order: '1.02', section: '1. MATERIAL', text: '¿El acero instalado presenta certificado de calidad?' },
        { order: '2.01', section: '2. GENERAL', text: '¿Las armaduras de acero son del diámetro indicado en los planos ó EETT?' },
        { order: '2.02', section: '2. GENERAL', text: '¿Las intersecciones están aseguradas con alambre de amarre?' },
        { order: '2.03', section: '2. GENERAL', text: '¿Se colocaron dados de concreto en la base de la armadura?' },
        { order: '2.04', section: '2. GENERAL', text: '¿Se colocaron dados de concreto en los laterales de la armadura?' },
        { order: '2.05', section: '2. GENERAL', text: '¿La armadura de acero esta ubicada verticalmente y horizontalmente según EETT y planos?' },
        { order: '2.06', section: '2. GENERAL', text: '¿Las cotas del acero colocado, estan de acuerdo a los planos?' },
        { order: '2.07', section: '2. GENERAL', text: '¿Las distancias entre las varillas son las que se indican en los planos de referencia?' },
        { order: '3.01', section: '3. OTROS', text: '¿Las armaduras están libre de oxidos y sustancias extrañas en su superficie?' },
        { order: '3.02', section: '3. OTROS', text: '¿Todas las condiciones están dadas para dar conformidad a la armadura de acero?' }
      ];
    } else {
      // Compaction / generic
      itemsToRender = [
        { order: '1.1', section: '1. MATERIAL DE CANTERA', text: 'Material granular libre de sobretamaños y materia orgánica' },
        { order: '1.2', section: '1. MATERIAL DE CANTERA', text: 'Certificado de ensayo Proctor Modificado vigente en laboratorio' },
        { order: '2.1', section: '2. CONFORMACIÓN', text: 'Espesor de capa compactada según especificación (20/25 cm)' },
        { order: '2.2', section: '2. CONFORMACIÓN', text: 'Humedad de compactación dentro del rango óptimo (±1.5%)' },
        { order: '3.1', section: '3. CONTROL DENSIDAD IN-SITU', text: 'Grado de compactación alcanza exigencia (≥100% calzada / ≥95% veredas)' },
        { order: '3.2', section: '3. CONTROL DENSIDAD IN-SITU', text: 'Frecuencia mínima: 6 determinaciones por cada 250 m²' }
      ];
    }

    let lastSec = '';
    for (const itm of itemsToRender) {
      if (itm.section !== lastSec) {
        lastSec = itm.section;
        doc.rect(x, y, width, 12).fillAndStroke('#F8FAFC', '#000000');
        doc.fillColor('#000000').fontSize(6).font('Helvetica-Bold').text(lastSec, x + 5, y + 3);
        y += 12;
      }

      const match = protocolChecks.find(c => c.item_text?.includes(itm.text) || c.item_order === itm.order);
      const res = match?.result;
      const obs = match?.observation || '';

      doc.rect(x, y, width, 12).stroke();
      doc.fontSize(6).font('Helvetica').text(itm.order, x + 4, y + 3);
      doc.text(itm.text, x + itemW + 4, y + 3, { width: descW - 8, ellipsis: true });

      doc.text(res === 'CUMPLE' ? '[X]' : '[ ]', x + itemW + descW + 8, y + 3);
      doc.text(res === 'NO_CUMPLE' ? '[X]' : '[ ]', x + itemW + descW + cW + 8, y + 3);
      doc.text(res === 'NO_APLICA' ? '[X]' : '[ ]', x + itemW + descW + cW + ncW + 8, y + 3);
      doc.text(obs, x + itemW + descW + cW + ncW + naW + 4, y + 3, { width: obsW - 8, ellipsis: true });
      y += 12;
    }

    y += 14;
    return y;
  }

  /**
   * Renders the official paper signature grid. Empty boxes ready for wet signing/stamping.
   */
  private renderSignatureGrid(doc: PDFKit.PDFDocument, x: number, y: number, width: number, family: '4_BOX_PAVEMENT' | '5_BOX_PAVEMENT' | '5_BOX_SURVEY' | '4_BOX_LAB'): number {
    doc.fillColor('#000000').strokeColor('#000000').lineWidth(0.75);

    if (family === '5_BOX_PAVEMENT') {
      // 5 boxes: 4 in a row + ESPECIALISTA DE CALIDAD-SUPERVISOR on a second row,
      // verbatim from the pavement protocol originals (B64/E64/H64/K64 + B66)
      const pavementRoles = [
        'RESIDENTE DE OBRA',
        'ESPECIALISTA DE CALIDAD',
        'ESTRUCTURISTA-SUPERVISOR',
        'SUPERVISOR DE OBRA'
      ];
      const boxW = (width - 15) / 4;
      const boxH = 50;

      for (let i = 0; i < 4; i++) {
        const bx = x + i * (boxW + 5);
        doc.rect(bx, y, boxW, boxH).stroke();
        doc.fontSize(5.5).font('Helvetica-Bold').text(pavementRoles[i], bx + 2, y + 4, { width: boxW - 4, align: 'center' });
        doc.moveTo(bx + 8, y + boxH - 14).lineTo(bx + boxW - 8, y + boxH - 14).stroke();
        doc.fontSize(4.5).font('Helvetica').text('FIRMA Y SELLO', bx, y + boxH - 11, { width: boxW, align: 'center' });
      }
      y += boxH + 6;

      // Second row: 5th box under the first column (verbatim B66)
      doc.rect(x, y, boxW, boxH).stroke();
      doc.fontSize(5.5).font('Helvetica-Bold').text('ESPECIALISTA DE CALIDAD-SUPERVISOR', x + 2, y + 4, { width: boxW - 4, align: 'center' });
      doc.moveTo(x + 8, y + boxH - 14).lineTo(x + boxW - 8, y + boxH - 14).stroke();
      doc.fontSize(4.5).font('Helvetica').text('FIRMA Y SELLO', x, y + boxH - 11, { width: boxW, align: 'center' });
      y += boxH + 10;

    } else if (family === '5_BOX_SURVEY') {
      // 5 boxes in 2 tiers
      const tier1Roles = [
        'RESIDENTE DE OBRA',
        'ESPECIALISTA DE CALIDAD  EJECUCIÒN',
        'SUPERVISOR DE OBRA',
        'ESTRUCTURAS - SUPERVISIÒN'
      ];
      const boxW = (width - 15) / 4;
      const boxH = 46;

      doc.fontSize(6).font('Helvetica-Bold').text('FIRMAS DE CONFORMIDAD EN CAMPO:', x, y);
      y += 9;

      for (let i = 0; i < 4; i++) {
        const bx = x + i * (boxW + 5);
        doc.rect(bx, y, boxW, boxH).stroke();
        doc.fontSize(5.2).font('Helvetica-Bold').text(tier1Roles[i], bx + 2, y + 3, { width: boxW - 4, align: 'center' });
        doc.moveTo(bx + 8, y + boxH - 12).lineTo(bx + boxW - 8, y + boxH - 12).stroke();
        doc.fontSize(4.5).font('Helvetica').text('FIRMA Y SELLO', bx, y + boxH - 10, { width: boxW, align: 'center' });
      }
      y += boxH + 6;

      // Tier 2: 1 centered box
      const t2W = 160;
      const t2X = x + (width - t2W) / 2;
      doc.rect(t2X, y, t2W, 36).stroke();
      doc.fontSize(5.2).font('Helvetica-Bold').text('ESPECIALISTA DE CALIDAD  SUPERVISIÓN', t2X + 2, y + 3, { width: t2W - 4, align: 'center' });
      doc.moveTo(t2X + 15, y + 26).lineTo(t2X + t2W - 15, y + 26).stroke();
      doc.fontSize(4.5).font('Helvetica').text('FIRMA Y SELLO', t2X, y + 28, { width: t2W, align: 'center' });
      y += 42;

    } else if (family === '4_BOX_LAB') {
      // 4 boxes for Probetas Lab
      const labRoles = ['Ing. RESIDENTE', 'ESPECIALISTA CALIDAD', 'ESTRUCTURISTA-SUPERVISOR', 'SUPERVISOR DE OBRA'];
      const boxW = (width - 15) / 4;
      const boxH = 50;

      for (let i = 0; i < 4; i++) {
        const bx = x + i * (boxW + 5);
        doc.rect(bx, y, boxW, boxH).stroke();
        doc.fontSize(5.5).font('Helvetica-Bold').text(labRoles[i], bx + 2, y + 3, { width: boxW - 4, align: 'center' });
        doc.fontSize(5).font('Helvetica').text('NOMBRE: ___________________', bx + 4, y + 26);
        doc.text('FIRMA:     ___________________', bx + 4, y + 38);
      }
      y += boxH + 10;

    } else {
      // 4 boxes for standard Pavement family (Encofrado, Acero, Concreto)
      const pavementRoles = [
        'RESIDENTE DE OBRA',
        'ESPECIALISTA DE CALIDAD',
        'ESTRUCTURISTA-SUPERVISOR',
        'SUPERVISOR DE OBRA'
      ];
      const boxW = (width - 15) / 4;
      const boxH = 50;

      for (let i = 0; i < 4; i++) {
        const bx = x + i * (boxW + 5);
        doc.rect(bx, y, boxW, boxH).stroke();
        doc.fontSize(5.5).font('Helvetica-Bold').text(pavementRoles[i], bx + 2, y + 4, { width: boxW - 4, align: 'center' });
        doc.moveTo(bx + 8, y + boxH - 14).lineTo(bx + boxW - 8, y + boxH - 14).stroke();
        doc.fontSize(4.5).font('Helvetica').text('FIRMA Y SELLO', bx, y + boxH - 11, { width: boxW, align: 'center' });
      }
      y += boxH + 10;
    }

    return y;
  }

  /**
   * Renders the separate digital traceability annex (Page 2).
   */
  private renderDigitalAnnex(doc: PDFKit.PDFDocument, x: number, width: number, data: {
    protocol: ProtocolRecord;
    checks: ValidationCheck[];
    trucks: ConcreteTruckRecord[];
    cylinders: any[];
    photos: any[];
    signatures: any[];
    nonconformanceId?: string | null;
    correlativo: string;
    docSpec: GoreDocSpec;
  }): void {
    let y = 35;

    // Pilot legal caveat watermark / header banner
    doc.rect(x, y, width, 22).fillAndStroke('#FEF3C7', '#D97706');
    doc.fillColor('#92400E').fontSize(8).font('Helvetica-Bold').text(
      'ANEXO TÉCNICO DIGITAL — SISTEMA PROTOKOL (TRAZABILIDAD FORENSE)',
      x, y + 6, { width, align: 'center' }
    );
    y += 28;

    // Pilot notice
    doc.fontSize(6).font('Helvetica-Oblique').fillColor('#666666').text(
      'AVISO LEGAL: Este anexo contiene los metadatos digitales e inmutables generados por la plataforma PROTOKOL en campo. Los formatos de la página principal son réplica fiel de los expedientes físicos de obra del Gobierno Regional de Ayacucho.',
      x, y, { width }
    );
    y += 18;

    // --- 1. INTEGRITY SEAL BLOCK ---
    doc.rect(x, y, width, 32).fillAndStroke('#F8FAFC', '#94A3B8');
    doc.fillColor('#0F172A').fontSize(7).font('Helvetica-Bold').text('SELLO DIGITAL DE INTEGRIDAD (HMAC-SHA-256 / PROTOKOL R8):', x + 6, y + 5);
    doc.font('Courier').fontSize(6).fillColor('#0284C7').text(data.protocol.integrity_hash || 'SHA-256 PENDING', x + 6, y + 15, { width: width - 12 });
    doc.font('Helvetica').fontSize(5.5).fillColor('#64748B').text(
      `ID Transacción: ${data.protocol.id} | Timestamp Servidor: ${data.protocol.server_received_at || 'S/T'} | Correlativo: ${data.correlativo}`,
      x + 6, y + 24
    );
    y += 38;

    // --- 2. VERDICT & VALIDATION RESULTS ---
    let verdictBg = '#10B981';
    let verdictText = 'CONFORME / APROBADO (PASS)';
    if (data.protocol.verdict === 'PROVISIONAL_PASS') {
      verdictBg = '#F59E0B';
      verdictText = 'APROBADO PROVISIONAL (Pendiente resultado de rotura a 28 días)';
    } else if (data.protocol.verdict === 'FAIL') {
      verdictBg = '#EF4444';
      verdictText = `NO CONFORME (NC Registrada: ${data.nonconformanceId || 'NC'})`;
    }

    doc.rect(x, y, width, 18).fill(verdictBg);
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold').text(verdictText, x + 5, y + 5, { width: width - 10, align: 'center' });
    y += 24;

    // Validation checks table (EG-2013 Criteria)
    doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold').text('EVALUACIÓN DE CRITERIOS NORMATIVOS (EG-2013):', x, y);
    y += 10;

    doc.rect(x, y, width, 14).fill('#E2E8F0');
    doc.fillColor('#1E293B').fontSize(6.5).font('Helvetica-Bold');
    doc.text('Parámetro Evaluado', x + 6, y + 4);
    doc.text('Criterio Exigido', x + 160, y + 4);
    doc.text('Valor Obtenido', x + 310, y + 4);
    doc.text('Resultado', x + 440, y + 4);
    y += 14;

    for (const chk of data.checks) {
      doc.rect(x, y, width, 12).strokeColor('#E2E8F0').stroke();
      doc.fillColor('#334155').fontSize(6).font('Helvetica').text(chk.field, x + 6, y + 3);
      doc.text(chk.expected, x + 160, y + 3);
      doc.text(`${chk.actual}${chk.unit ? ' ' + chk.unit : ''}`, x + 310, y + 3);
      doc.font('Helvetica-Bold').fillColor(chk.result === 'PASS' ? '#16A34A' : '#DC2626').text(chk.result, x + 440, y + 3);
      y += 12;
    }
    y += 8;

    // --- 3. DIGITAL SIGNATURE EVENT TRAIL ---
    doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold').text('TRAZABILIDAD DE FIRMA DIGITAL Y PIN (EVENTOS EN BASE DE DATOS):', x, y);
    y += 10;

    doc.rect(x, y, width, 14).fill('#E2E8F0');
    doc.fillColor('#1E293B').fontSize(6.5).font('Helvetica-Bold');
    doc.text('Profesional Responsable', x + 6, y + 4);
    doc.text('Rol en Obra', x + 160, y + 4);
    doc.text('CIP', x + 270, y + 4);
    doc.text('Estado Evento', x + 340, y + 4);
    doc.text('Fecha / Hora PIN', x + 430, y + 4);
    y += 14;

    const sigsToRender = data.signatures.length > 0 ? data.signatures : [
      { signatory_name: 'Ing. David Valdez Ochoa', role: 'Especialista de Calidad', cip_number: 'GOBIERNO REGIONAL AYACUCHO', status: 'SIGNED', signed_at: data.protocol.recorded_at }
    ];

    for (const sig of sigsToRender) {
      doc.rect(x, y, width, 12).strokeColor('#E2E8F0').stroke();
      doc.fillColor('#334155').fontSize(6).font('Helvetica').text(sig.signatory_name || 'Ingeniero', x + 6, y + 3);
      doc.text(sig.role || 'Responsable', x + 160, y + 3);
      doc.text(sig.cip_number ? `CIP ${sig.cip_number}` : '---', x + 270, y + 3);
      doc.font('Helvetica-Bold').fillColor(sig.status === 'SIGNED' ? '#16A34A' : '#D97706').text(sig.status === 'SIGNED' ? 'FIRMADO (PIN)' : 'PENDIENTE', x + 340, y + 3);
      doc.font('Helvetica').fillColor('#64748B').text(sig.signed_at ? String(sig.signed_at).substring(0, 19).replace('T', ' ') : 'Pendiente', x + 430, y + 3);
      y += 12;
    }
    y += 10;

    // --- 4. GEOTAGGED PHOTO EVIDENCE ---
    doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica-Bold').text('EVIDENCIA FOTOGRÁFICA CON SELLO SATELITAL GPS:', x, y);
    y += 10;

    if (data.photos.length === 0) {
      doc.rect(x, y, width, 40).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#94A3B8').fontSize(7).font('Helvetica').text('No se adjuntaron fotografías en este registro.', x + 10, y + 15, { align: 'center', width: width - 20 });
      y += 45;
    } else {
      let px = x;
      const photoBoxW = 120;
      const photoBoxH = 80;

      for (const p of data.photos.slice(0, 4)) {
        const pPath = this.photoService.getPhotoAbsolutePath(p);
        doc.rect(px, y, photoBoxW, photoBoxH + 20).strokeColor('#CBD5E1').stroke();
        if (fs.existsSync(pPath)) {
          try {
            doc.image(pPath, px + 2, y + 2, { width: photoBoxW - 4, height: photoBoxH - 4, fit: [photoBoxW - 4, photoBoxH - 4] });
          } catch {}
        }
        doc.fontSize(5).font('Helvetica').fillColor('#475569').text(
          `GPS: ${Number(p.gps_lat || 0).toFixed(5)}, ${Number(p.gps_lng || 0).toFixed(5)}\n${String(p.captured_at || '').substring(0, 19)}`,
          px + 4, y + photoBoxH + 2, { width: photoBoxW - 8 }
        );
        px += photoBoxW + 10;
      }
      y += photoBoxH + 26;
    }

    // Annex Footer
    doc.fontSize(5.5).font('Helvetica').fillColor('#64748B').text(
      `Registro inmutable generado por PROTOKOL Core v2.4 · Directiva N° 017-2023-CG/GMPL INFOBRAS / OSCE`,
      x, 790, { width, align: 'center' }
    );
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
      doc.moveDown(2);
      doc.fillColor('#B45309').fontSize(13).font('Helvetica-Bold')
        .text('DOCUMENTO PILOTO — SIN VALIDEZ LEGAL', { align: 'center' });
      doc.fillColor('#0F172A');
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

  /**
   * Generates the 10-column Laboratory Cylinder Breaking Log (SGC-CRP-2026).
   */
  async generateProbetasPdf(projectId: string, cylindersData?: any[]): Promise<string> {
    const filename = `${projectId}-probetas-report-${new Date().toISOString().split('T')[0]}.pdf`;
    const outputPath = path.join(config.pdfDir, filename);

    const project = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as unknown as ProjectRecord | undefined;
    const projectName = project?.name || '“MEJORAMIENTO Y AMPLIACIÓN DEL SERVICIO DE TRANSITABILIDAD...”';

    const cylinders = cylindersData || this.db.prepare(`
      SELECT c.*, p.chainage, p.panel, p.recorded_at
      FROM cylinders c
      JOIN protocols p ON c.protocol_id = p.id
      WHERE p.project_id = ?
      ORDER BY c.cast_date ASC, c.cylinder_code ASC
    `).all(projectId) as any[];

    return new Promise((resolve, reject) => {
      // Landscape or Portrait: 10 columns fit nicely on A4 landscape
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = 782; // 842 - 60
      const startX = 30;
      let y = 30;

      // Header Block
      doc.rect(startX, y, pageWidth, 42).stroke('#000000');
      doc.rect(startX, y, 140, 42).stroke('#000000');
      doc.fontSize(8).font('Helvetica-Bold').text('GOBIERNO REGIONAL AYACUCHO', startX + 5, y + 10, { width: 130, align: 'center' });
      doc.fontSize(6).font('Helvetica').text('SEDE CENTRAL', startX + 5, y + 22, { width: 130, align: 'center' });

      doc.rect(startX + 140, y, 460, 42).stroke('#000000');
      doc.fontSize(12).font('Helvetica-Bold').text('CONTROL DE ROTURAS DE PROBETA', startX + 140, y + 14, { width: 460, align: 'center' });

      doc.rect(startX + 600, y, pageWidth - 600, 42).stroke('#000000');
      doc.fontSize(7).font('Helvetica-Bold').text('Código: SGC-CRP-2026', startX + 608, y + 8);
      doc.text('Revisión: ---', startX + 608, y + 18);
      doc.text('Fecha: JULIO 2026', startX + 608, y + 28);
      y += 48;

      // Project Meta
      doc.rect(startX, y, pageWidth, 22).stroke('#000000');
      doc.fontSize(6.5).font('Helvetica-Bold').text('PROYECTO:', startX + 6, y + 6);
      doc.font('Helvetica').text(projectName, startX + 55, y + 6, { width: pageWidth - 65, ellipsis: true });
      y += 28;

      // 10-Column Data Grid
      const cols = [
        { label: 'CÓDIGO DE PROBETA', w: 85 },
        { label: 'UBICACIÓN', w: 65 },
        { label: 'ESTRUCTURA / ELEM.', w: 90 },
        { label: "F'C (kg/cm²)", w: 65 },
        { label: 'F. MUESTREO', w: 65 },
        { label: 'EDAD', w: 45 },
        { label: 'F. ROTURA', w: 65 },
        { label: "F'C A 'x' DÍAS", w: 75 },
        { label: "RESISTENCIA (%)", w: 75 },
        { label: 'DESCRIPCIÓN', w: 152 }
      ];

      doc.rect(startX, y, pageWidth, 16).fillAndStroke('#F1F5F9', '#000000');
      doc.fillColor('#000000').fontSize(6).font('Helvetica-Bold');
      let cx = startX;
      for (const col of cols) {
        doc.text(col.label, cx + 2, y + 5, { width: col.w - 4, align: 'center' });
        cx += col.w;
      }
      y += 16;

      const rowsToRender = cylinders.length > 0 ? cylinders : [
        { cylinder_code: 'M-13-1', chainage: '0+138', structure: 'MURO C.A 13-1', design_fc: 280, cast_date: '2026-07-14', age_days: 7, break_date: '2026-07-21', strength_kgcm2: 215, pct: 76.8, desc: 'TESTIGO 1 MIXER 1' },
        { cylinder_code: 'M-13-2', chainage: '0+138', structure: 'MURO C.A 13-1', design_fc: 280, cast_date: '2026-07-14', age_days: 28, break_date: '2026-08-11', strength_kgcm2: 295, pct: 105.4, desc: 'TESTIGO 2 MIXER 1' }
      ];

      for (const r of rowsToRender) {
        if (y > 480) {
          doc.addPage();
          y = 40;
        }
        doc.rect(startX, y, pageWidth, 14).stroke('#000000');
        doc.fontSize(5.5).font('Helvetica');

        let rx = startX;
        doc.text(r.cylinder_code || '---', rx + 2, y + 4, { width: cols[0].w - 4, align: 'center' }); rx += cols[0].w;
        doc.text(r.chainage || r.panel || '0+138', rx + 2, y + 4, { width: cols[1].w - 4, align: 'center' }); rx += cols[1].w;
        doc.text(r.structure || 'PAÑO DE PAVIMENTO', rx + 2, y + 4, { width: cols[2].w - 4, align: 'center' }); rx += cols[2].w;
        doc.text(`${r.design_fc || 280}`, rx + 2, y + 4, { width: cols[3].w - 4, align: 'center' }); rx += cols[3].w;
        doc.text(this.formatDate(r.cast_date), rx + 2, y + 4, { width: cols[4].w - 4, align: 'center' }); rx += cols[4].w;
        doc.text(`${r.age_days || 28} d`, rx + 2, y + 4, { width: cols[5].w - 4, align: 'center' }); rx += cols[5].w;
        doc.text(this.formatDate(r.break_date), rx + 2, y + 4, { width: cols[6].w - 4, align: 'center' }); rx += cols[6].w;
        doc.text(r.strength_kgcm2 ? `${r.strength_kgcm2} kg/cm²` : '---', rx + 2, y + 4, { width: cols[7].w - 4, align: 'center' }); rx += cols[7].w;
        doc.text(r.pct ? `${r.pct}%` : (r.strength_kgcm2 ? `${((r.strength_kgcm2 / (r.design_fc || 280)) * 100).toFixed(1)}%` : '---'), rx + 2, y + 4, { width: cols[8].w - 4, align: 'center' }); rx += cols[8].w;
        doc.text(r.desc || r.notes || 'ENSAYO CONFORME', rx + 4, y + 4, { width: cols[9].w - 8 });

        y += 14;
      }

      y += 18;
      // 4-box signature grid
      const labRoles = ['Ing. RESIDENTE', 'ESPECIALISTA CALIDAD', 'ESTRUCTURISTA-SUPERVISOR', 'SUPERVISOR DE OBRA'];
      const boxW = (pageWidth - 30) / 4;
      const boxH = 46;

      for (let i = 0; i < 4; i++) {
        const bx = startX + i * (boxW + 10);
        doc.rect(bx, y, boxW, boxH).stroke('#000000');
        doc.fontSize(6).font('Helvetica-Bold').text(labRoles[i], bx + 2, y + 4, { width: boxW - 4, align: 'center' });
        doc.fontSize(5.5).font('Helvetica').text('NOMBRE: ___________________', bx + 6, y + 22);
        doc.text('FIRMA:     ___________________', bx + 6, y + 34);
      }

      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}
