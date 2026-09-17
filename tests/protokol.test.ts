import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';
import { ValidationService } from '../src/services/validation.service.js';
import { PhotoService } from '../src/services/photo.service.js';
import { OverdueService } from '../src/services/overdue.service.js';
import { t, setLanguage, getLanguage } from '../public/js/i18n.js';

describe('PROTOKOL Phase 0 — v2.4 Architecture & Dynamic Project Configuration Test Suite', () => {
  let db: DatabaseSync;
  let app: any;

  beforeEach(() => {
    // Fresh in-memory database with full schema and seed data for each test
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    const instance = createApp(db);
    app = instance.app;
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // 1. Create a New Project (Requirement 19.1)
  // =========================================================================
  it('19.1: Admin can create a new project with custom configuration', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({
        id: 'PROJ-CUSCO-101',
        name: 'Pavimentación Urbana San Jerónimo',
        contract_number: 'N° 45-2026-MUNICUSCO',
        entity: 'Municipalidad de San Jerónimo',
        execution_mode: 'Contrata',
        location: 'Cusco, Perú',
        road_section: 'Av. Manco Cápac (km 0+000 a 1+500)',
        timezone: 'America/Lima',
        timezone_offset: '-05:00',
        whatsapp_recipients: '+51984000001',
        sampling_basis: 'PER_TRUCK',
        cylinders_per_truck: 6,
        default_design_fc: 245
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('PROJ-CUSCO-101');
    expect(res.body.cylinders_per_truck).toBe(6);
    expect(res.body.default_design_fc).toBe(245);

    // Verify persisted in database
    const saved = db.prepare('SELECT * FROM projects WHERE id = ?').get('PROJ-CUSCO-101') as any;
    expect(saved).toBeDefined();
    expect(saved.contract_number).toBe('N° 45-2026-MUNICUSCO');
    expect(saved.cylinders_per_truck).toBe(6);
  });

  // =========================================================================
  // 2. Configure Criteria for Project (Requirement 19.2)
  // =========================================================================
  it('19.2: Admin can configure custom criteria for a project', async () => {
    // Create project first
    await request(app).post('/api/projects').send({
      id: 'PROJ-TEST-CRIT',
      name: 'Obra de Prueba Criterios',
      contract_number: 'N° 01-2026',
      entity: 'MTC',
      execution_mode: 'Contrata'
    });

    // Add custom slump criteria: 5.0 to 8.0 cm
    const critRes = await request(app)
      .post('/api/projects/PROJ-TEST-CRIT/criteria')
      .send({
        activity: 'CONCRETE',
        field: 'slump_cm',
        operator: 'BETWEEN',
        min_value: 5.0,
        max_value: 8.0,
        unit: 'cm',
        source_reference: 'Mix Design Lab Report C-101'
      });

    expect(critRes.status).toBe(201);

    // Fetch criteria
    const listRes = await request(app).get('/api/projects/PROJ-TEST-CRIT/criteria');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].min_value).toBe(5.0);
    expect(listRes.body[0].max_value).toBe(8.0);
  });

  // =========================================================================
  // 3. Create Technicians for Project (Requirement 19.3)
  // =========================================================================
  it('19.3: Create technicians for a project with PIN hashing', async () => {
    await request(app).post('/api/projects').send({
      id: 'PROJ-TECH-01',
      name: 'Obra Tecnicos',
      contract_number: 'N° 02-2026',
      entity: 'GORE',
      execution_mode: 'Administración Directa'
    });

    const res = await request(app)
      .post('/api/projects/PROJ-TECH-01/technicians')
      .send({
        name: 'Ing. Carlos Mendoza',
        role: 'Quality Specialist',
        pin: '5678',
        whatsapp: '+51950000001',
        cip_number: '298711'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Ing. Carlos Mendoza');
    expect(res.body.cip_number).toBe('298711');
    expect(res.body.pin_hash).toBeUndefined(); // PIN hash not exposed

    // Verify PIN verification endpoint
    const authRes = await request(app)
      .post('/api/technicians/verify-pin')
      .send({ project_id: 'PROJ-TECH-01', pin: '5678' });

    expect(authRes.status).toBe(200);
    expect(authRes.body.name).toBe('Ing. Carlos Mendoza');
  });

  // =========================================================================
  // 4 & 5. Submit Protocol Using Database Criteria (Requirements 19.4 & 19.5)
  // =========================================================================
  it('19.4 & 19.5: Protocol evaluates strictly against database criteria, not code constants', async () => {
    // Project with specific compaction criteria: >= 98.0%
    await request(app).post('/api/projects').send({
      id: 'PROJ-SOILS-98',
      name: 'Proyecto Suelos 98%',
      contract_number: 'N° 98-2026',
      entity: 'Municipalidad',
      execution_mode: 'Contrata',
      criteria: [
        {
          activity: 'COMPACTION',
          field: 'compaction_pct',
          operator: 'GTE',
          min_value: 98.0,
          unit: '%',
          source_reference: 'Expediente Técnico Sanitario'
        }
      ],
      technicians: [
        { name: 'Tec. Manuel', role: 'Soils Specialist', pin: '1234', device_token: 'dvc_soils_98' }
      ]
    });

    // 99.0% should PASS in this project (even though pilot requires 100%)
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'PROJ-SOILS-98',
        device_token: 'dvc_soils_98',
        technician_pin: '1234',
        activity: 'COMPACTION',
        recorded_at: '2026-09-17T10:00:00-05:00',
        gps: { lat: -13.15, lng: -74.22 },
        panel: '01',
        chainage: '0+010',
        measurements: { compaction_pct: 99.0 }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('PASS');
    expect(res.body.checks[0].expected).toBe('>= 98 %');
    expect(res.body.checks[0].result).toBe('PASS');
  });

  // =========================================================================
  // 6 & 7. Second Project with Different Slump Thresholds (Requirements 19.6 & 19.7)
  // =========================================================================
  it('19.6 & 19.7: Two different projects validate independently against their own criteria', async () => {
    // Project A (Pilot): Slump 8.9 - 12.7 cm
    // Project B: Slump 6.0 - 9.0 cm
    await request(app).post('/api/projects').send({
      id: 'PROJ-LOW-SLUMP',
      name: 'Canal de Concreto Seco',
      contract_number: 'N° 05-2026',
      entity: 'ANA',
      execution_mode: 'Contrata',
      sampling_basis: 'PER_TRUCK',
      cylinders_per_truck: 4,
      default_design_fc: 175,
      criteria: [
        {
          activity: 'CONCRETE',
          field: 'formwork_approved',
          operator: 'EQ',
          expected_value: 'true',
          source_reference: 'Checklist Previo'
        },
        {
          activity: 'CONCRETE',
          field: 'slump_cm',
          operator: 'BETWEEN',
          min_value: 6.0,
          max_value: 9.0,
          unit: 'cm',
          source_reference: 'Mezcla Seca 6-9cm'
        }
      ],
      technicians: [
        { name: 'Ing. Supervisor B', role: 'Quality Specialist', pin: '1234', device_token: 'dvc_b' }
      ]
    });

    const testSlump = 7.5; // Within Project B (6.0 - 9.0), Outside Pilot (8.9 - 12.7)

    // 1. Submit to Pilot Project -> Must FAIL (7.5 is below 8.9)
    const pilotRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T09:00:00-05:00',
        gps: { lat: -13.15, lng: -74.22 },
        panel: '10',
        chainage: '0+100',
        measurements: {
          formwork_approved: true,
          slump_cm: testSlump,
          mixer_id: 'MIX-01',
          delivery_note: 'GR-100',
          cylinders_cast: 4,
          design_fc: 280
        }
      });

    expect(pilotRes.body.verdict).toBe('FAIL');

    // 2. Submit same measurement to Project B -> Must PASS (7.5 is within 6.0 - 9.0)
    const projBRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'PROJ-LOW-SLUMP',
        device_token: 'dvc_b',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T09:00:00-05:00',
        gps: { lat: -13.15, lng: -74.22 },
        panel: '01',
        chainage: '0+010',
        measurements: {
          formwork_approved: true,
          slump_cm: testSlump,
          mixer_id: 'MIX-B1',
          delivery_note: 'GR-B01',
          cylinders_cast: 4,
          design_fc: 175
        }
      });

    expect(projBRes.body.verdict).toBe('PROVISIONAL_PASS');
  });

  // =========================================================================
  // 8. Concrete Protocol with 1 Truck (Requirement 19.8)
  // =========================================================================
  it('19.8: Concrete protocol with 1 ready-mix truck validates and stores normalized record', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T08:30:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '15',
        chainage: '0+144',
        measurements: {
          formwork_approved: true,
          trucks: [
            {
              truck_number: 1,
              mixer_id: '6D37',
              delivery_note: 'GR-00412',
              slump_cm: 10.5,
              cylinders_cast: 4,
              design_fc: 280
            }
          ]
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('PROVISIONAL_PASS');

    // Verify concrete_trucks table
    const trucks = db.prepare('SELECT * FROM concrete_trucks WHERE protocol_id = ?').all(res.body.protocol_id) as any[];
    expect(trucks.length).toBe(1);
    expect(trucks[0].mixer_id).toBe('6D37');
    expect(trucks[0].slump_verdict).toBe('PASS');
  });

  // =========================================================================
  // 9. Concrete Protocol with 20 Trucks (Requirement 19.9)
  // =========================================================================
  it('19.9: Concrete protocol with 20 ready-mix trucks handles full pour correctly', async () => {
    const trucksPayload = [];
    for (let i = 1; i <= 20; i++) {
      trucksPayload.push({
        truck_number: i,
        mixer_id: `MIX-${String(i).padStart(2, '0')}`,
        delivery_note: `GR-${String(i).padStart(4, '0')}`,
        slump_cm: 10.0 + (i % 3) * 0.5, // 10.0, 10.5, 11.0 (all pass 8.9 - 12.7)
        cylinders_cast: 4,
        design_fc: 280
      });
    }

    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T08:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '50',
        chainage: '0+500',
        measurements: {
          formwork_approved: true,
          trucks: trucksPayload
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('PROVISIONAL_PASS');

    // 20 trucks in concrete_trucks table
    const storedTrucks = db.prepare('SELECT * FROM concrete_trucks WHERE protocol_id = ?').all(res.body.protocol_id) as any[];
    expect(storedTrucks.length).toBe(20);

    // 80 cylinders in cylinders table (20 trucks * 4 cylinders)
    const storedCylinders = db.prepare('SELECT * FROM cylinders WHERE protocol_id = ?').all(res.body.protocol_id) as any[];
    expect(storedCylinders.length).toBe(80);
  });

  // =========================================================================
  // 10 & 14. Independent Slump Validation & One Truck Failing (Req 19.10 & 19.14)
  // =========================================================================
  it('19.10 & 19.14: Every truck has independent slump validation and failing truck creates linked NC', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T08:45:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '25',
        chainage: '0+250',
        measurements: {
          formwork_approved: true,
          trucks: [
            {
              truck_number: 1,
              mixer_id: 'MIX-01',
              delivery_note: 'GR-001',
              slump_cm: 10.2, // PASS
              cylinders_cast: 4,
              design_fc: 280
            },
            {
              truck_number: 2,
              mixer_id: 'MIX-02',
              delivery_note: 'GR-002',
              slump_cm: 13.5, // FAIL: > 12.7 cm
              cylinders_cast: 4,
              design_fc: 280
            }
          ]
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('FAIL');
    expect(res.body.nonconformance_id).toBeDefined();

    // Verify concrete_trucks slump_verdict
    const trucks = db.prepare('SELECT * FROM concrete_trucks WHERE protocol_id = ? ORDER BY truck_number ASC').all(res.body.protocol_id) as any[];
    expect(trucks[0].slump_verdict).toBe('PASS');
    expect(trucks[1].slump_verdict).toBe('FAIL');

    // Verify linked NC has truck_id
    const nc = db.prepare('SELECT * FROM nonconformances WHERE id = ?').get(res.body.nonconformance_id) as any;
    expect(nc).toBeDefined();
    expect(nc.truck_id).toBe(trucks[1].id);
  });

  // =========================================================================
  // 11. Every Truck Has 4 Cylinders for Pilot Config (Requirement 19.11)
  // =========================================================================
  it('19.11: Every truck has 4 cylinders scheduled for pilot configuration', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-17T09:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '30',
        chainage: '0+300',
        measurements: {
          formwork_approved: true,
          trucks: [
            { truck_number: 1, mixer_id: 'MIX-A', delivery_note: 'GR-A', slump_cm: 10.0 },
            { truck_number: 2, mixer_id: 'MIX-B', delivery_note: 'GR-B', slump_cm: 11.0 }
          ]
        }
      });

    const cylinders = db.prepare('SELECT * FROM cylinders WHERE protocol_id = ?').all(res.body.protocol_id) as any[];
    expect(cylinders.length).toBe(8); // 2 trucks * 4 cylinders = 8

    // Each truck has 2 cylinders at 7D and 2 cylinders at 28D
    const truck1Cyls = cylinders.filter(c => c.truck_number === 1);
    expect(truck1Cyls.length).toBe(4);
    expect(truck1Cyls.filter(c => c.age_days === 7).length).toBe(2);
    expect(truck1Cyls.filter(c => c.age_days === 28).length).toBe(2);
  });

  // =========================================================================
  // 12. 7-Day Cylinder Results (Requirement 19.12)
  // =========================================================================
  it('19.12: 7-day cylinder break recording maintains PROVISIONAL_PASS', async () => {
    const pourRes = await request(app).post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'dvc_pilot_qa_01',
      technician_pin: '1234',
      activity: 'CONCRETE',
      recorded_at: '2026-09-17T08:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '31',
      chainage: '0+310',
      measurements: {
        formwork_approved: true,
        trucks: [{ truck_number: 1, mixer_id: 'MIX-1', delivery_note: 'GR-1', slump_cm: 10.0, cylinders_cast: 4, design_fc: 280 }]
      }
    });

    const protocolId = pourRes.body.protocol_id;

    // Record 7-day cylinder result (215 kg/cm2, ~75% strength)
    const cyl7Res = await request(app)
      .post(`/api/protocols/${protocolId}/cylinder-result`)
      .send({
        age_days: 7,
        strength_kgcm2: 215.0,
        lab: 'AKHISE'
      });

    expect(cyl7Res.status).toBe(200);
    expect(cyl7Res.body.age_days).toBe(7);
    expect(cyl7Res.body.protocol_verdict).toBe('PROVISIONAL_PASS'); // Still provisional until 28D
  });

  // =========================================================================
  // 13. 28-Day Cylinder Results -> Final PASS (Requirement 19.13)
  // =========================================================================
  it('19.13: 28-day cylinder results passing design strength transitions protocol to PASS', async () => {
    const pourRes = await request(app).post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'dvc_pilot_qa_01',
      technician_pin: '1234',
      activity: 'CONCRETE',
      recorded_at: '2026-09-17T08:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '32',
      chainage: '0+320',
      measurements: {
        formwork_approved: true,
        trucks: [{ truck_number: 1, mixer_id: 'MIX-1', delivery_note: 'GR-1', slump_cm: 10.0, cylinders_cast: 4, design_fc: 280 }]
      }
    });

    expect(pourRes.status).toBe(201);
    expect(pourRes.body.verdict).toBe('PROVISIONAL_PASS');
    const protocolId = pourRes.body.protocol_id;

    // Record first 28-day break >= 280 kg/cm2 (specimen 3)
    const cyl28A = await request(app)
      .post(`/api/protocols/${protocolId}/cylinder-result`)
      .send({
        age_days: 28,
        strength_kgcm2: 290.0,
        lab: 'AKHISE'
      });

    expect(cyl28A.status).toBe(200);
    expect(cyl28A.body.verdict).toBe('PASS');
    expect(cyl28A.body.protocol_verdict).toBe('PROVISIONAL_PASS'); // Still 1 pending 28D specimen

    // Record second 28-day break >= 280 kg/cm2 (specimen 4 - completes 28D set)
    const cyl28B = await request(app)
      .post(`/api/protocols/${protocolId}/cylinder-result`)
      .send({
        age_days: 28,
        strength_kgcm2: 295.0,
        lab: 'AKHISE'
      });

    expect(cyl28B.status).toBe(200);
    expect(cyl28B.body.verdict).toBe('PASS');
    expect(cyl28B.body.protocol_verdict).toBe('PASS'); // All 28D passed, transitions protocol to PASS!

    const updated = db.prepare('SELECT verdict FROM protocols WHERE id = ?').get(protocolId) as any;
    expect(updated.verdict).toBe('PASS');
  });

  // =========================================================================
  // 15. Immutability Trigger Protection (Requirement 19.15)
  // =========================================================================
  it('19.15: Strict protocol immutability prevents unauthorized updates via SQL', async () => {
    const pourRes = await request(app).post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'dvc_pilot_qa_01',
      technician_pin: '1234',
      activity: 'SURVEY',
      recorded_at: '2026-09-17T09:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '33',
      chainage: '0+330',
      measurements: { elevation_deviation: 0.5 }
    });

    const protocolId = pourRes.body.protocol_id;

    // Direct SQL update attempt must be aborted by trigger
    expect(() => {
      db.prepare(`UPDATE protocols SET measurements = '{"elevation_deviation": 9.9}' WHERE id = ?`).run(protocolId);
    }).toThrow(/IMMUTABILITY_VIOLATION/);
  });

  // =========================================================================
  // 16. Idempotency & Offline Retry De-duplication (Requirement 19.16)
  // =========================================================================
  it('19.16: Duplicate submissions with same idempotency key are safely de-duplicated', async () => {
    const payload = {
      project_id: 'AY-728-001',
      device_token: 'dvc_pilot_qa_01',
      technician_pin: '1234',
      activity: 'SURVEY',
      recorded_at: '2026-09-17T09:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '34',
      chainage: '0+340',
      measurements: { elevation_deviation: 0.4 },
      idempotency_key: 'idemp_unique_key_101'
    };

    const res1 = await request(app).post('/api/protocols').send(payload);
    const res2 = await request(app).post('/api/protocols').send(payload);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.protocol_id).toBe(res2.body.protocol_id);

    const count = db.prepare('SELECT count(*) as count FROM protocols WHERE idempotency_key = ?').get('idemp_unique_key_101') as any;
    expect(count.count).toBe(1);
  });

  // =========================================================================
  // 17. Photo Metadata Storage (Requirement 19.17)
  // =========================================================================
  it('19.17: Photo metadata stored independently with SHA-256 hash', async () => {
    const photoBuffer = Buffer.from('test_jpeg_data_mock');
    const res = await request(app)
      .post('/api/photos')
      .attach('photo', photoBuffer, 'evidence.jpg')
      .field('gps_lat', '-13.1588')
      .field('gps_lng', '-74.2236');

    expect(res.status).toBe(201);
    expect(res.body.photo_id).toMatch(/^ph_/);
    expect(res.body.file_hash).toBeDefined();

    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(res.body.photo_id) as any;
    expect(photo.gps_lat).toBeCloseTo(-13.1588);
    expect(photo.gps_lng).toBeCloseTo(-74.2236);
  });

  // =========================================================================
  // 18 & 19. Internationalization: English & Spanish UI (Req 19.18 & 19.19)
  // =========================================================================
  it('19.18 & 19.19: i18n module provides complete translations for English and Spanish', () => {
    setLanguage('es');
    expect(getLanguage()).toBe('es');
    expect(t('home.act_concrete_title')).toBe('1. CONCRETO');
    expect(t('concrete.add_truck')).toBe('+ Agregar Camión Mixer');
    expect(t('verdict.pass_title')).toBe('CONFORME / APROBADO');

    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('home.act_concrete_title')).toBe('1. CONCRETE');
    expect(t('concrete.add_truck')).toBe('+ Add Ready-Mix Truck');
    expect(t('verdict.pass_title')).toBe('CONFORMING / APPROVED');

    // Reset back to Spanish
    setLanguage('es');
  });

  // =========================================================================
  // 20. Project Configuration Persistence (Requirement 19.20)
  // =========================================================================
  it('19.20: Project configuration persists and can be updated via API', async () => {
    await request(app).post('/api/projects').send({
      id: 'PROJ-PERSIST',
      name: 'Carretera Andina',
      contract_number: 'N° 77-2026',
      entity: 'GORE Cusco',
      execution_mode: 'Contrata',
      cylinders_per_truck: 4,
      default_design_fc: 210
    });

    // Update configuration
    const patchRes = await request(app)
      .patch('/api/projects/PROJ-PERSIST')
      .send({
        cylinders_per_truck: 5,
        default_design_fc: 245
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.cylinders_per_truck).toBe(5);
    expect(patchRes.body.default_design_fc).toBe(245);

    const query = db.prepare('SELECT * FROM projects WHERE id = ?').get('PROJ-PERSIST') as any;
    expect(query.cylinders_per_truck).toBe(5);
    expect(query.default_design_fc).toBe(245);
  });

  // =========================================================================
  // 21. No Accidental Pilot Configuration Leakage (Requirement 19.21)
  // =========================================================================
  it('19.21: No pilot configuration leaks into newly created projects', async () => {
    // Project with its own slump (3.0 - 5.0 cm) and 8 cylinders
    await request(app).post('/api/projects').send({
      id: 'PROJ-ISOLATED',
      name: 'Pavimento Rígido Especial',
      contract_number: 'N° 99-2026-ESP',
      entity: 'Entidad Privada',
      execution_mode: 'Contrata',
      sampling_basis: 'PER_TRUCK',
      cylinders_per_truck: 8,
      default_design_fc: 350,
      criteria: [
        {
          activity: 'CONCRETE',
          field: 'slump_cm',
          operator: 'BETWEEN',
          min_value: 3.0,
          max_value: 5.0,
          unit: 'cm',
          source_reference: 'Fórmula Especial'
        }
      ],
      technicians: [
        { name: 'Ing. Aislado', role: 'Quality Specialist', pin: '9999', device_token: 'dvc_iso' }
      ]
    });

    // Verify criteria does NOT contain pilot slump criteria (8.9 - 12.7)
    const critRes = await request(app).get('/api/projects/PROJ-ISOLATED/criteria');
    expect(critRes.body.length).toBe(1);
    expect(critRes.body[0].min_value).toBe(3.0);
    expect(critRes.body[0].max_value).toBe(5.0);

    // Verify technicians do not include pilot technicians
    const techRes = await request(app).get('/api/projects/PROJ-ISOLATED/technicians');
    expect(techRes.body.length).toBe(1);
    expect(techRes.body[0].name).toBe('Ing. Aislado');

    // Submit protocol in PROJ-ISOLATED: slump 4.0 should PASS, slump 10.0 (pilot valid) should FAIL
    const passRes = await request(app).post('/api/protocols').send({
      project_id: 'PROJ-ISOLATED',
      device_token: 'dvc_iso',
      technician_pin: '9999',
      activity: 'CONCRETE',
      recorded_at: '2026-09-17T11:00:00-05:00',
      gps: { lat: -13.0, lng: -74.0 },
      panel: '01',
      chainage: '0+000',
      measurements: {
        trucks: [{ truck_number: 1, mixer_id: 'TRK-1', delivery_note: 'GR-1', slump_cm: 4.0 }]
      }
    });
    expect(passRes.body.verdict).toBe('PROVISIONAL_PASS');

    const failRes = await request(app).post('/api/protocols').send({
      project_id: 'PROJ-ISOLATED',
      device_token: 'dvc_iso',
      technician_pin: '9999',
      activity: 'CONCRETE',
      recorded_at: '2026-09-17T11:05:00-05:00',
      gps: { lat: -13.0, lng: -74.0 },
      panel: '02',
      chainage: '0+005',
      measurements: {
        trucks: [{ truck_number: 1, mixer_id: 'TRK-2', delivery_note: 'GR-2', slump_cm: 10.0 }]
      }
    });
    expect(failRes.body.verdict).toBe('FAIL');
  });

  // =========================================================================
  // Supporting Core Tests: Overdue R10, Status & Dossier
  // =========================================================================
  it('R10: Overdue protocol triggers notification when past scheduled time + 4 hours', async () => {
    db.prepare(`
      INSERT OR REPLACE INTO protocol_schedules (id, project_id, activity, panel, chainage, scheduled_at)
      VALUES ('sched_test_overdue', 'AY-728-001', 'CONCRETE', '99', '0+999', ?)
    `).run(new Date(Date.now() - 5 * 3600 * 1000).toISOString());

    const overdueService = new OverdueService(db);
    const notified = await overdueService.checkOverdueProtocols();
    expect(notified).toBeGreaterThanOrEqual(1);

    const notif = db.prepare(`SELECT * FROM notifications WHERE event_type = 'OVERDUE'`).get() as any;
    expect(notif).toBeDefined();
  });

  it('Contracts 8.3 & 8.4: Status view returns aggregated summary and Dossier compiles master PDF', async () => {
    const statusRes = await request(app).get('/api/projects/AY-728-001/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.project_id).toBe('AY-728-001');

    const dossierRes = await request(app).get('/api/projects/AY-728-001/dossier');
    expect(dossierRes.status).toBe(200);
    expect(dossierRes.body.dossier_url).toBe('/api/projects/AY-728-001/dossier.pdf');
  });

  // =========================================================================
  // User Scenario: Save Project with David Valdez Ochoa and Engineer Approval
  // =========================================================================
  it('User Scenario: Save Project with David Valdez Ochoa, verify PIN and submit conforming protocol', async () => {
    // 1. Create project with exact payload sent by project_setup.js
    const slump_min = 8.9;
    const slump_max = 12.7;
    const default_design_fc = 280;
    const cylinders_per_truck = 4;

    const createRes = await request(app)
      .post('/api/projects')
      .send({
        id: 'PROY-2026-01',
        name: 'Mejoramiento Vial Tramo Ayacucho',
        contract_number: 'N° 102-2026-GORE',
        entity: 'Gobierno Regional',
        execution_mode: 'Administración Directa',
        location: 'Huamanga, Ayacucho',
        road_section: 'km 0+000 a 5+200',
        timezone: 'America/Lima',
        timezone_offset: '-05:00',
        whatsapp_recipients: '+5193176825',
        sampling_basis: 'PER_TRUCK',
        cylinders_per_truck,
        default_design_fc,
        criteria: [
          {
            activity: 'CONCRETE',
            field: 'formwork_approved',
            operator: 'EQ',
            expected_value: 'true',
            unit: 'checklist',
            source_reference: 'Checklist Previo de Encofrado'
          },
          {
            activity: 'CONCRETE',
            field: 'slump_cm',
            operator: 'BETWEEN',
            min_value: slump_min,
            max_value: slump_max,
            unit: 'cm',
            source_reference: 'Diseño de Mezclas Acreditado'
          },
          {
            activity: 'CONCRETE',
            field: 'cylinders_cast',
            operator: 'GTE',
            min_value: cylinders_per_truck,
            unit: 'probetas/mixer',
            source_reference: `Regla de Muestreo: ${cylinders_per_truck} probetas por mixer`
          },
          {
            activity: 'CONCRETE',
            field: 'design_fc',
            operator: 'GTE',
            min_value: default_design_fc,
            unit: 'kg/cm²',
            source_reference: 'Especificaciones Técnicas'
          }
        ],
        technicians: [
          {
            name: 'David Valdez Ochoa',
            role: 'Quality Specialist',
            cip_number: '182940',
            pin: '1234',
            whatsapp: '+5193176825'
          }
        ]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe('PROY-2026-01');
    expect(createRes.body.name).toBe('Mejoramiento Vial Tramo Ayacucho');

    // 2. Verify technician is registered
    const techRes = await request(app).get('/api/projects/PROY-2026-01/technicians');
    expect(techRes.status).toBe(200);
    expect(techRes.body.length).toBe(1);
    const tech = techRes.body[0];
    expect(tech.name).toBe('David Valdez Ochoa');
    expect(tech.cip_number).toBe('182940');
    expect(tech.device_token).toBeDefined();

    // 3. Authenticate engineer with PIN 1234
    const authRes = await request(app)
      .post('/api/technicians/verify-pin')
      .send({
        project_id: 'PROY-2026-01',
        pin: '1234',
        technician_id: tech.id
      });
    expect(authRes.status).toBe(200);
    expect(authRes.body.name).toBe('David Valdez Ochoa');
    expect(authRes.body.device_token).toBe(tech.device_token);

    // 4. Submit concrete protocol conforming to the project criteria
    const protoRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'PROY-2026-01',
        device_token: tech.device_token,
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: new Date().toISOString(),
        gps: { lat: -13.163, lng: -74.223, accuracy: 4.5 },
        panel: '01',
        chainage: '0+050',
        measurements: {
          formwork_approved: true,
          trucks: [
            {
              truck_number: 1,
              mixer_id: 'TRK-AYAC-01',
              delivery_ticket: 'GR-1001',
              batch_time: '08:30',
              arrival_time: '09:00',
              discharge_time: '09:15',
              concrete_volume_m3: 8,
              slump_cm: 10.5,
              concrete_temp_c: 21.5,
              ambient_temp_c: 20.0,
              cylinders_cast: 4,
              sample_time: '09:10',
              cylinder_codes: ['C1', 'C2', 'C3', 'C4']
            }
          ]
        },
        idempotency_key: 'idemp-david-01'
      });

    expect(protoRes.status).toBe(201);
    expect(protoRes.body.verdict).toBe('PROVISIONAL_PASS');
    expect(protoRes.body.protocol_id).toBeDefined();

    // 5. Verify status view for the new project reflects the conforming protocol
    const status = await request(app).get('/api/projects/PROY-2026-01/status');
    expect(status.status).toBe(200);
    expect(status.body.protocols.length).toBe(1);
    expect(status.body.summary.provisional).toBe(1);
    expect(status.body.summary.failed).toBe(0);
  });
});
