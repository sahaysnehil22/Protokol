import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { PdfService } from '../src/services/pdf.service.js';
import { createApp } from '../src/server.js';
import { PILOT_PROJECT_ID } from '../src/db/seed.js';
import { ProtocolRecord, ValidationCheck, ActivityType } from '../src/types.js';

async function main() {
  console.log('Generating sample PDFs for the 5 canonical GORE Ayacucho formats...');

  // Initialize in-memory or file database with full schema & seed
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  createApp(db);

  const pdfService = new PdfService(db);
  const outDir = path.resolve('pdfs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const activities: ActivityType[] = ['SURVEY', 'FORMWORK', 'STEEL', 'CONCRETE', 'COMPACTION'];

  for (const act of activities) {
    const mockProtocol: ProtocolRecord = {
      id: `SAMPLE-${act}-001`,
      project_id: PILOT_PROJECT_ID,
      activity: act,
      chainage: '0+138',
      panel: '14',
      gps_lat: -13.1588,
      gps_lng: -74.2236,
      verdict: act === 'CONCRETE' ? 'PROVISIONAL_PASS' : 'PASS',
      nonconformance_id: null,
      integrity_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      recorded_at: '2026-09-25T09:30:00-05:00',
      server_received_at: '2026-09-25T14:30:00Z',
      measurements: act === 'CONCRETE' ? JSON.stringify({ design_fc: 280, slump: 4.5 }) : '{}'
    };

    const mockChecks: ValidationCheck[] = [
      {
        field: act === 'CONCRETE' ? "f'c Resistencia de Diseño" : (act === 'SURVEY' ? 'Cota vs Diseño' : 'Alineamiento y Verticalidad'),
        expected: act === 'CONCRETE' ? '≥ 280 kg/cm²' : (act === 'SURVEY' ? '≤ 1 cm' : 'Conforme a planos'),
        actual: act === 'CONCRETE' ? 280 : 0.4,
        unit: act === 'CONCRETE' ? 'kg/cm²' : 'cm',
        result: 'PASS'
      }
    ];

    const pdfPath = await pdfService.generateProtocolPdf({
      protocol: mockProtocol,
      checks: mockChecks,
      technicianName: 'Ing. David Valdez Ochoa',
      technicianRole: 'Especialista de Calidad',
      lang: 'es'
    });

    console.log(`✓ Generated ${act}: ${pdfPath}`);
  }

  // Generate Probetas Lab Report (SGC-CRP-2026)
  const probetasPdf = await pdfService.generateProbetasPdf(PILOT_PROJECT_ID);
  console.log(`✓ Generated PROBETAS (SGC-CRP-2026): ${probetasPdf}`);

  console.log('\nAll sample PDFs successfully generated in:', outDir);
}

main().catch(err => {
  console.error('Error generating sample PDFs:', err);
  process.exit(1);
});
