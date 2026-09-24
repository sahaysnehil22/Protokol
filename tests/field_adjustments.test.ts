import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';

describe('David Valdez Ochoa Field Adjustments (Rulings F1–F12 / SPEC_FOR_SNEHIL.md)', () => {
  let db: DatabaseSync;
  let app: any;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    const instance = createApp(db);
    app = instance.app;
  });

  afterEach(() => {
    db.close();
  });

  // F1: Checklist Templates and Protocol Checks
  it('F1: loads paper checklist templates per activity and records protocol checks (CUMPLE / NO_CUMPLE / NO_APLICA)', async () => {
    // 1. Query checklist templates for CONCRETE
    const tmplRes = await request(app)
      .get('/api/projects/AY-728-001/checklist-templates?activity=CONCRETE');
    expect(tmplRes.status).toBe(200);
    expect(Array.isArray(tmplRes.body)).toBe(true);
    expect(tmplRes.body.length).toBeGreaterThan(0);
    expect(tmplRes.body[0]).toHaveProperty('item_text');
    expect(tmplRes.body[0]).toHaveProperty('section');

    const firstTmpl = tmplRes.body[0];

    // 2. Submit protocol with checks
    const protoRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'CONCRETE',
        chainage: '0+144',
        panel: 'P-05',
        recorded_at: '2026-09-24T10:00:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          design_fc: 280,
          formwork_approved: true,
          concrete_trucks: [
            {
              mixer_id: 'TRUCK-101',
              delivery_note: 'GR-88910',
              supplier: 'Concreto Titan',
              slump: '4"',
              cylinders_cast: 4
            }
          ]
        },
        checks: [
          {
            template_item_id: firstTmpl.id,
            result: 'CUMPLE',
            observation: 'Verificación conforme en campo'
          }
        ]
      });

    expect(protoRes.status).toBe(201);
    const protocolId = protoRes.body.protocol_id;

    // 3. Query saved checks
    const checksRes = await request(app)
      .get(`/api/protocols/${protocolId}/checks`);
    expect(checksRes.status).toBe(200);
    expect(checksRes.body.length).toBe(1);
    expect(checksRes.body[0].result).toBe('CUMPLE');
    expect(checksRes.body[0].observation).toBe('Verificación conforme en campo');
    expect(checksRes.body[0].item_text).toBe(firstTmpl.item_text);
  });

  // F2: Discrete Slump Selector (3.5", 4", 4.5", 5")
  it('F2: evaluates discrete slump selector ("3.5", "4", "4.5", "5") with allowed_values operator IN', async () => {
    // Valid discrete slump: "4.5""
    const validRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'CONCRETE',
        chainage: '0+150',
        panel: 'P-06',
        recorded_at: '2026-09-24T10:30:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          design_fc: 280,
          formwork_approved: true,
          concrete_trucks: [
            {
              mixer_id: 'TRUCK-102',
              delivery_note: 'GR-88911',
              supplier: 'Concreto Titan',
              slump: '4.5"',
              cylinders_cast: 4
            }
          ]
        }
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.verdict).toBe('PROVISIONAL_PASS');

    // Invalid discrete slump: "6"" (out of allowed values)
    const invalidRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'CONCRETE',
        chainage: '0+152',
        panel: 'P-07',
        recorded_at: '2026-09-24T11:00:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          design_fc: 280,
          formwork_approved: true,
          concrete_trucks: [
            {
              mixer_id: 'TRUCK-103',
              delivery_note: 'GR-88912',
              supplier: 'Concreto Titan',
              slump: '6"',
              cylinders_cast: 4
            }
          ]
        }
      });

    expect(invalidRes.status).toBe(201);
    expect(invalidRes.body.verdict).toBe('FAIL');
    expect(invalidRes.body.checks.some((c: any) => c.field.includes('slump') && c.result === 'FAIL')).toBe(true);
  });

  // F4, F6, F8, F9: 5-Box Official Signature Grid with PIN Traceability
  it('F4/F6/F8/F9: auto-creates 5-box signature grid and allows individual signing with PIN', async () => {
    const protoRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'STEEL',
        chainage: '0+160',
        panel: 'P-08',
        recorded_at: '2026-09-24T12:00:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          rebar_diameter_mm: 16,
          spacing_cm: 20,
          concrete_cover_cm: 5
        }
      });

    expect(protoRes.status).toBe(201);
    const protocolId = protoRes.body.protocol_id;

    // 1. Fetch 5 signatures
    const sigRes = await request(app)
      .get(`/api/protocols/${protocolId}/signatures`);
    expect(sigRes.status).toBe(200);
    expect(sigRes.body.length).toBe(5);

    // Box 1 (Calidad Ejecución) was signed by the submitter
    const box1 = sigRes.body.find((s: any) => s.sign_order === 1);
    expect(box1.status).toBe('SIGNED');
    expect(box1.stamp_key).toBeTruthy();

    // Box 3 (Supervisor) is pending
    const box3 = sigRes.body.find((s: any) => s.sign_order === 3);
    expect(box3.status).toBe('PENDING');

    // 2. Supervisor signs with PIN
    const signRes = await request(app)
      .post(`/api/protocols/${protocolId}/sign`)
      .send({
        signatory_id: 'tech_supervisor',
        pin: '1234',
        role: 'Supervisor de Obra'
      });

    expect(signRes.status).toBe(200);
    expect(signRes.body.status).toBe('SIGNED');
    expect(signRes.body.stamp_key).toContain('stamp_');

    // 3. Re-query signatures
    const updatedSigs = await request(app)
      .get(`/api/protocols/${protocolId}/signatures`);
    const updatedBox3 = updatedSigs.body.find((s: any) => s.sign_order === 3);
    expect(updatedBox3.status).toBe('SIGNED');
    expect(updatedBox3.signed_at).toBeTruthy();
  });

  // F5 & F6: Project Setup with Engineers Team & Standard 5-Activity Criteria
  it('F5 & F6: allows creating project with engineers team and custom criteria', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .send({
        id: 'PROJ-AYACUCHO-NEW',
        name: 'Pavimentación Urbana Carmen Alto',
        contract_number: 'N° 99-2026-GRA',
        entity: 'Gobierno Regional de Ayacucho',
        execution_mode: 'Administración Directa',
        location: 'Carmen Alto, Ayacucho',
        road_section: 'km 0+000 a 1+200',
        criteria: [
          {
            activity: 'FORMWORK',
            field: 'surface_clean',
            operator: 'EQ',
            expected_value: 'true',
            unit: 'checklist',
            source_reference: 'EG-2013 Sec. 402'
          }
        ],
        technicians: [
          {
            name: 'Ing. David Valdez Ochoa',
            role: 'Quality Specialist',
            pin: '1234'
          }
        ]
      });

    expect(projRes.status).toBe(201);
    expect(projRes.body.id).toBe('PROJ-AYACUCHO-NEW');

    // Check that criteria were configured
    const critRes = await request(app)
      .get('/api/projects/PROJ-AYACUCHO-NEW/criteria');
    expect(critRes.status).toBe(200);
    expect(critRes.body.length).toBe(1);
    expect(critRes.body[0].activity).toBe('FORMWORK');

    // Check that technicians were saved
    const techRes = await request(app)
      .get('/api/projects/PROJ-AYACUCHO-NEW/technicians');
    expect(techRes.status).toBe(200);
    expect(techRes.body.length).toBe(1);
    expect(techRes.body[0].name).toBe('Ing. David Valdez Ochoa');
  });

  // 5 Protocol Workflows: FORMWORK Activity
  it('handles FORMWORK protocol activity correctly in site sequence', async () => {
    const formworkRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'FORMWORK',
        chainage: '0+170',
        panel: 'P-09',
        recorded_at: '2026-09-24T13:00:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          alignment_deviation_mm: 3.0,
          dimension_deviation_cm: 0.3,
          surface_clean: true,
          release_agent_applied: true,
          tightness_verified: true
        }
      });

    expect(formworkRes.status).toBe(201);
    expect(formworkRes.body.verdict).toBe('PASS');
    const protoInDb = db.prepare(`SELECT * FROM protocols WHERE id = ?`).get(formworkRes.body.protocol_id) as any;
    expect(protoInDb.activity).toBe('FORMWORK');
  });

  // F12: Mixer load with supplier and delivery note (Guía de remisión)
  it('F12: stores mixer delivery note (guía de remisión) and supplier per truck', async () => {
    const protoRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        activity: 'CONCRETE',
        chainage: '0+180',
        panel: 'P-10',
        recorded_at: '2026-09-24T14:00:00-05:00',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        gps: { lat: -13.15, lng: -74.22 },
        measurements: {
          design_fc: 280,
          formwork_approved: true,
          concrete_trucks: [
            {
              mixer_id: 'MIXER-99',
              delivery_note: 'GR-002-99881',
              supplier: 'Concreto Titan Ayacucho',
              slump: '4"',
              cylinders_cast: 4
            }
          ]
        }
      });

    expect(protoRes.status).toBe(201);
    const truckRow = db.prepare(`SELECT * FROM concrete_trucks WHERE protocol_id = ?`).get(protoRes.body.protocol_id) as any;
    expect(truckRow).toBeTruthy();
    expect(truckRow.delivery_note).toBe('GR-002-99881');
    expect(truckRow.supplier).toBe('Concreto Titan Ayacucho');
    expect(truckRow.slump).toBe('4');
  });
});
