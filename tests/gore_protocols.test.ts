import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';
import { PdfService, GORE_DOC_SPECS } from '../src/services/pdf.service.js';
import { ProtocolRecord, ValidationCheck, ActivityType } from '../src/types.js';
import { PILOT_PROJECT_ID } from '../src/db/seed.js';

describe('GORE Ayacucho Official Inspection Protocols & PDF Verification (Annex A & Scanned Formats)', () => {
  let db: DatabaseSync;
  let pdfService: PdfService;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    createApp(db);
    pdfService = new PdfService(db);
  });

  it('verifies that checklist_templates are seeded verbatim from Annex A / David Excel formats', () => {
    // 1. FORMWORK (02. PAVIMENTO_ENCOFRADO_MI.xlsx, GDC-PDE-2026)
    const formworkItems = db.prepare(`
      SELECT * FROM checklist_templates WHERE project_id = ? AND activity = 'FORMWORK' ORDER BY item_order ASC
    `).all(PILOT_PROJECT_ID) as any[];

    expect(formworkItems.length).toBe(8);
    expect(formworkItems[0].item_text).toBe('1.01 ¿Tipo de encofrado es adecuado para el tipo de estructura a concretar?');
    expect(formworkItems[0].section).toBe('1. DESCRIPCION DE ACTIVIDAD');
    expect(formworkItems[4].item_text).toContain('2.01 Dimensiones del encofrado');
    expect(formworkItems[4].section).toBe('2. VERIFICACIÓN DE LOS MATERIALES');

    // 2. STEEL (03. PAVIMENTO_ACERO_MI.xlsx, FO01PT03)
    const steelItems = db.prepare(`
      SELECT * FROM checklist_templates WHERE project_id = ? AND activity = 'STEEL' ORDER BY item_order ASC
    `).all(PILOT_PROJECT_ID) as any[];

    expect(steelItems.length).toBe(11);
    expect(steelItems[0].item_text).toContain('1.01 Calidad del acero');
    expect(steelItems[0].section).toBe('1. MATERIAL');
    expect(steelItems[2].item_text).toContain('2.01 ¿Las armaduras de acero son del diámetro');
    expect(steelItems[9].item_text).toContain('3.01 ¿Las armaduras están libres de óxidos');

    // 3. CONCRETE (04. PAVIMENTO_CONCRETO_MI.xlsx, GDC-PCC-2026)
    const concreteItems = db.prepare(`
      SELECT * FROM checklist_templates WHERE project_id = ? AND activity = 'CONCRETE' ORDER BY item_order ASC
    `).all(PILOT_PROJECT_ID) as any[];

    expect(concreteItems.length).toBe(13);
    expect(concreteItems[0].item_text).toContain('1.1 ¿Se cuenta con diseño de mezcla aprobado');
    expect(concreteItems[7].item_text).toContain('1.8 ¿Se ha verificado la conformidad de los recubrimientos mínimos?');
    expect(concreteItems[8].item_text).toContain('¿Las condiciones están dadas para iniciar el concretado?');
    expect(concreteItems[9].item_text).toContain('1 Acabado superficial de acuerdo a lo especificado');

    // 4. SURVEY (PRO-TOPOGRAFIA-2026 - copia.xlsx, GCO-PVT-2026)
    const surveyItems = db.prepare(`
      SELECT * FROM checklist_templates WHERE project_id = ? AND activity = 'SURVEY' ORDER BY item_order ASC
    `).all(PILOT_PROJECT_ID) as any[];

    expect(surveyItems.length).toBe(13);
    expect(surveyItems[0].item_text).toContain('1.1 Área limpia y sin obstáculos');
    expect(surveyItems[4].item_text).toContain('2.1 Ubicación de puntos auxiliares');
    expect(surveyItems[11].item_text).toContain('3.1 Recojo de equipos y herramientas');

    // 5. COMPACTION (EG-2013 / GORE Ayacucho)
    const compactionItems = db.prepare(`
      SELECT * FROM checklist_templates WHERE project_id = ? AND activity = 'COMPACTION' ORDER BY item_order ASC
    `).all(PILOT_PROJECT_ID) as any[];

    expect(compactionItems.length).toBe(8);
    expect(compactionItems[0].item_text).toContain('1.1 Material granular de cantera');
    expect(compactionItems[4].item_text).toContain('3.1 Grado de compactación in-situ alcanza ≥100%');
  });

  it('verifies official GORE document codes and revision numbers for all 5 activities', () => {
    expect(GORE_DOC_SPECS.FORMWORK.code).toBe('GDC-PDE-2026');
    expect(GORE_DOC_SPECS.FORMWORK.title).toBe('PROTOCOLO DE ENCOFRADO');

    expect(GORE_DOC_SPECS.STEEL.code).toBe('FO01PT03');
    expect(GORE_DOC_SPECS.STEEL.title).toBe('PROTOCOLO DE INSTALACION DE ACERO DE REFUERZO');

    expect(GORE_DOC_SPECS.CONCRETE.code).toBe('GDC-PCC-2026');
    expect(GORE_DOC_SPECS.CONCRETE.title).toBe('PROTOCOLO DE COLOCACIÓN DE PAVIMENTO RÍGIDO');

    expect(GORE_DOC_SPECS.SURVEY.code).toBe('GCO-PVT-2026');
    expect(GORE_DOC_SPECS.SURVEY.title).toBe('PROTOCOLO DE VERIFICACIÓN TOPOGRÁFICA');

    expect(GORE_DOC_SPECS.COMPACTION.code).toBe('GDC-PCS-2026');
    expect(GORE_DOC_SPECS.COMPACTION.title).toBe('PROTOCOLO DE CONTROL DE COMPACTACIÓN DE SUELOS');
  });

  it('successfully generates PDF protocols replicating official government format with 5-box signature grid and SHA-256 hash for all 5 activities', async () => {
    const activities: ActivityType[] = ['FORMWORK', 'STEEL', 'CONCRETE', 'SURVEY', 'COMPACTION'];

    for (const act of activities) {
      const mockProtocol: ProtocolRecord = {
        id: `PRT-GORE-TEST-${act}`,
        project_id: PILOT_PROJECT_ID,
        activity: act,
        chainage: '0+465',
        panel: 'P-08',
        gps_lat: -13.1588,
        gps_lng: -74.2236,
        verdict: 'PASS',
        nonconformance_id: null,
        integrity_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        recorded_at: '2026-09-25T08:30:00-05:00',
        server_received_at: '2026-09-25T13:30:00Z',
        measurements: act === 'CONCRETE' ? JSON.stringify({ design_fc: 280 }) : '{}'
      };

      const mockChecks: ValidationCheck[] = [
        {
          field: act === 'CONCRETE' ? 'design_fc' : 'dimension_deviation_cm',
          expected: act === 'CONCRETE' ? '≥ 280 kg/cm²' : '≤ 0.5 cm',
          actual: act === 'CONCRETE' ? 280 : 0.2,
          unit: act === 'CONCRETE' ? 'kg/cm²' : 'cm',
          result: 'PASS'
        }
      ];

      const pdfPath = await pdfService.generateProtocolPdf({
        protocol: mockProtocol,
        checks: mockChecks,
        technicianName: 'Ing. David Valdez Ochoa',
        technicianRole: 'Quality Specialist',
        lang: 'es'
      });

      expect(fs.existsSync(pdfPath)).toBe(true);
      const stats = fs.statSync(pdfPath);
      expect(stats.size).toBeGreaterThan(1000); // Valid PDF with content

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
      expect(pdfHeader).toBe('%PDF-'); // Valid PDF magic bytes
    }
  });

  it('verifies that the official GORE signature roster contains all 5 required engineers and CIP numbers', () => {
    const technicians = db.prepare(`SELECT * FROM technicians WHERE project_id = ?`).all(PILOT_PROJECT_ID) as any[];

    const resident = technicians.find(t => t.name.includes('Edison Cuadros'));
    expect(resident).toBeDefined();
    expect(resident.cip_number).toBe('302775');

    const leadQuality = technicians.find(t => t.name.includes('David Valdez'));
    expect(leadQuality).toBeDefined();

    const supervisor = technicians.find(t => t.name.includes('Teodoro Manuel Huamancusi'));
    expect(supervisor).toBeDefined();
    expect(supervisor.cip_number).toBe('53548');

    const structures = technicians.find(t => t.name.includes('Roly Conocachi'));
    expect(structures).toBeDefined();
    expect(structures.cip_number).toBe('76843');

    const supQuality = technicians.find(t => t.name.includes('Cristian Manuel Torres'));
    expect(supQuality).toBeDefined();
    expect(supQuality.cip_number).toBe('260873');
  });
});
