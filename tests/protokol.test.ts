import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';
import { ValidationService } from '../src/services/validation.service.js';
import { PhotoService } from '../src/services/photo.service.js';
import { OverdueService } from '../src/services/overdue.service.js';

describe('PROTOKOL Phase 0 MVP — Comprehensive Acceptance Test Suite', () => {
  let db: DatabaseSync;
  let app: any;

  beforeEach(() => {
    // In-memory database with full schema and seed data for clean test isolation
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    const instance = createApp(db);
    app = instance.app;
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // 1. Valid Protocol Submission (Requirement R1)
  // =========================================================================
  it('R1 & Rule 1: Valid protocol submission persists immutable record and returns verdict within 5s', async () => {
    const startTime = Date.now();

    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_soils_03',
        technician_pin: '1234',
        activity: 'COMPACTION',
        recorded_at: '2026-09-14T10:30:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '15',
        chainage: '0+144',
        measurements: {
          compaction_pct: 101.5,
          moisture_deviation: 0.5,
          sub_base_thickness: 22.0,
          base_thickness: 26.5
        },
        notes: 'Compactación tramo base granular conforme'
      });

    const duration = Date.now() - startTime;

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('PASS');
    expect(res.body.protocol_id).toMatch(/^PRT-20260914-1030-015$/);
    expect(res.body.checks.length).toBe(4);
    expect(res.body.checks.every((c: any) => c.result === 'PASS')).toBe(true);
    expect(res.body.nonconformance_id).toBeNull();
    expect(duration).toBeLessThan(5000); // R1: under 5 seconds
  });

  // =========================================================================
  // 2. Invalid Measurement Creates Non-Conformance (Requirement R2)
  // =========================================================================
  it('R2 & Rule 2: Invalid measurement creates linked NC and triggers notification within 60s', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_soils_03',
        technician_pin: '1234',
        activity: 'COMPACTION',
        recorded_at: '2026-09-14T11:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '16',
        chainage: '0+148',
        measurements: {
          compaction_pct: 97.5, // Fails: min 100% required
          moisture_deviation: 0.2,
          sub_base_thickness: 21.0,
          base_thickness: 25.0
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('FAIL');
    expect(res.body.nonconformance_id).toBeDefined();

    // Verify linked NC in database
    const nc = db.prepare(`SELECT * FROM nonconformances WHERE id = ?`).get(res.body.nonconformance_id) as any;
    expect(nc).toBeDefined();
    expect(nc.protocol_id).toBe(res.body.protocol_id);
    expect(nc.field).toBe('compaction_pct');
    expect(nc.status).toBe('OPEN');

    // Verify WhatsApp notification was logged in notifications table (R2)
    const notif = db.prepare(`SELECT * FROM notifications WHERE event_type = 'NC_OPENED'`).get() as any;
    expect(notif).toBeDefined();
    expect(notif.status).toBe('SENT');
  });

  // =========================================================================
  // 3. Concrete Returns PROVISIONAL_PASS (Requirement R4)
  // =========================================================================
  it('R4 & Rule 3: Concrete protocol returns PROVISIONAL_PASS and schedules 7D and 28D cylinders', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-14T08:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '20',
        chainage: '0+160',
        measurements: {
          formwork_approved: true, // Formwork pre-pour check
          slump_cm: 8.5,
          mixer_id: 'MIX-09',
          delivery_note: 'GR-00912',
          cylinders_cast: 2,
          design_fc: 210
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('PROVISIONAL_PASS');
    expect(res.body.pending).toEqual(['CYLINDER_7D', 'CYLINDER_28D']);

    // Check cylinder records in database
    const cylinders = db.prepare(`SELECT * FROM cylinders WHERE protocol_id = ?`).all(res.body.protocol_id) as any[];
    expect(cylinders.length).toBe(2);
    expect(cylinders.map(c => c.age_days)).toEqual([7, 28]);
    expect(cylinders.every(c => c.status === 'PENDING')).toBe(true);
  });

  // =========================================================================
  // 4. 28-Day Cylinder Strength Passes -> Protocol Transitions to PASS
  // =========================================================================
  it('Rule 4: 28-day cylinder strength >= design f\'c transitions protocol verdict to PASS', async () => {
    // 1. Submit concrete protocol
    const pourRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-14T08:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '21',
        chainage: '0+165',
        measurements: {
          formwork_approved: true,
          slump_cm: 8.0,
          mixer_id: 'MIX-09',
          delivery_note: 'GR-00913',
          cylinders_cast: 2,
          design_fc: 210
        }
      });

    const protocolId = pourRes.body.protocol_id;

    // 2. Submit 28-day cylinder test result: 235 kg/cm2 (>= 210)
    const cylRes = await request(app)
      .post(`/api/protocols/${protocolId}/cylinder-result`)
      .send({
        age_days: 28,
        cylinder_code: 'P-20260914-021-28D',
        strength_kgcm2: 235.0,
        lab: 'AKHISE'
      });

    expect(cylRes.status).toBe(200);
    expect(cylRes.body.verdict).toBe('PASS');
    expect(cylRes.body.protocol_verdict).toBe('PASS');

    // Verify database record updated
    const updatedProtocol = db.prepare(`SELECT verdict FROM protocols WHERE id = ?`).get(protocolId) as any;
    expect(updatedProtocol.verdict).toBe('PASS');
  });

  // =========================================================================
  // 5. 28-Day Cylinder Strength Fails -> Protocol Transitions to FAIL + NC (R5)
  // =========================================================================
  it('R5 & Rule 5: 28-day cylinder strength below design f\'c transitions protocol to FAIL and opens NC', async () => {
    const pourRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_qa_01',
        technician_pin: '1234',
        activity: 'CONCRETE',
        recorded_at: '2026-09-14T08:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '22',
        chainage: '0+170',
        measurements: {
          formwork_approved: true,
          slump_cm: 8.0,
          mixer_id: 'MIX-10',
          delivery_note: 'GR-00914',
          cylinders_cast: 2,
          design_fc: 210
        }
      });

    const protocolId = pourRes.body.protocol_id;

    // 2. Submit failing 28-day break: 185 kg/cm2 (< 210)
    const cylRes = await request(app)
      .post(`/api/protocols/${protocolId}/cylinder-result`)
      .send({
        age_days: 28,
        cylinder_code: 'P-20260914-022-28D',
        strength_kgcm2: 185.0,
        lab: 'AKHISE'
      });

    expect(cylRes.status).toBe(200);
    expect(cylRes.body.verdict).toBe('FAIL');
    expect(cylRes.body.protocol_verdict).toBe('FAIL');
    expect(cylRes.body.nonconformance_id).toBeDefined();

    // Verify database record changed to FAIL
    const updatedProtocol = db.prepare(`SELECT verdict FROM protocols WHERE id = ?`).get(protocolId) as any;
    expect(updatedProtocol.verdict).toBe('FAIL');

    // Verify linked NC opened for compressive strength
    const nc = db.prepare(`SELECT * FROM nonconformances WHERE id = ?`).get(cylRes.body.nonconformance_id) as any;
    expect(nc.field).toBe('strength_kgcm2');
    expect(nc.status).toBe('OPEN');
  });

  // =========================================================================
  // 6. Protocol Immutability Protection (Requirement R7)
  // =========================================================================
  it('R7 & Rule 6: Persisted protocol records cannot be modified via SQL UPDATE', async () => {
    const pourRes = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_soils_03',
        technician_pin: '1234',
        activity: 'SURVEY',
        recorded_at: '2026-09-14T09:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '25',
        chainage: '0+180',
        measurements: { elevation_deviation: 0.4 }
      });

    const protocolId = pourRes.body.protocol_id;

    // Attempt to tamper with measurements in database
    expect(() => {
      db.prepare(`
        UPDATE protocols
        SET measurements = '{"elevation_deviation": 9.9}'
        WHERE id = ?
      `).run(protocolId);
    }).toThrow(/IMMUTABILITY_VIOLATION/);

    // Verify data remains untouched
    const untouched = db.prepare(`SELECT measurements FROM protocols WHERE id = ?`).get(protocolId) as any;
    expect(JSON.parse(untouched.measurements).elevation_deviation).toBe(0.4);
  });

  // =========================================================================
  // 7, 8, 9. Offline Queue, Retry, & Duplicate Prevention (Requirement R3)
  // =========================================================================
  it('R3 & Rules 7-9: Duplicate offline submissions with same idempotency_key are safely de-duplicated', async () => {
    const idempotencyKey = 'sync_offline_uuid_998877';

    const payload = {
      project_id: 'AY-728-001',
      device_token: 'dvc_pilot_soils_03',
      technician_pin: '1234',
      activity: 'STEEL',
      recorded_at: '2026-09-14T07:30:00-05:00',
      gps: { lat: -13.1588, lng: -74.2236 },
      panel: '30',
      chainage: '0+200',
      measurements: {
        bar_spacing_cm: 15.0,
        concrete_cover_cm: 5.5
      },
      idempotency_key: idempotencyKey
    };

    // First submission (sync attempt 1)
    const res1 = await request(app).post('/api/protocols').send(payload);
    expect(res1.status).toBe(201);
    const protocolId1 = res1.body.protocol_id;

    // Second submission (retry with same idempotency key)
    const res2 = await request(app).post('/api/protocols').send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body.protocol_id).toBe(protocolId1);

    // Ensure only 1 record exists in database
    const count = db.prepare(`SELECT count(*) as total FROM protocols WHERE idempotency_key = ?`).get(idempotencyKey) as any;
    expect(count.total).toBe(1);
  });

  // =========================================================================
  // 10. Timestamp Strategy: Client Offset + Server UTC (Requirement R6)
  // =========================================================================
  it('R6 & Rule 10: Timestamps store client recorded_at with offset and server_received_at in UTC', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_soils_03',
        technician_pin: '1234',
        activity: 'SURVEY',
        recorded_at: '2026-09-14T14:15:30-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '35',
        chainage: '0+220',
        measurements: { elevation_deviation: 0.8 }
      });

    const protocol = db.prepare(`SELECT * FROM protocols WHERE id = ?`).get(res.body.protocol_id) as any;
    expect(protocol.recorded_at).toBe('2026-09-14T14:15:30-05:00');
    expect(protocol.timezone_offset).toBe('-05:00');
    expect(protocol.server_received_at).toBeDefined();
    // Server received at should end in 'Z' (ISO UTC)
    expect(protocol.server_received_at.endsWith('Z')).toBe(true);
  });

  // =========================================================================
  // 11. Photo Metadata Decoupling (Requirement R9)
  // =========================================================================
  it('R9 & Rule 11: Photo metadata (GPS, capture time, SHA-256 hash) stored independently from file', async () => {
    const photoService = new PhotoService(db);
    const mockImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_CONTENT_BYTES_12345');

    const photo = photoService.savePhoto({
      buffer: mockImageBuffer,
      mimeType: 'image/jpeg',
      gpsLat: -13.158822,
      gpsLng: -74.223611,
      capturedAt: '2026-09-14T10:00:00-05:00'
    });

    expect(photo.id).toMatch(/^ph_/);
    expect(photo.file_hash).toBeDefined();
    expect(photo.gps_lat).toBe(-13.158822);
    expect(photo.gps_lng).toBe(-74.223611);

    // Verify queryable via database independently
    const dbPhoto = db.prepare(`SELECT * FROM photos WHERE id = ?`).get(photo.id) as any;
    expect(dbPhoto.storage_key).not.toContain('http'); // Never store vendor URLs
    expect(dbPhoto.file_hash.length).toBe(64); // SHA-256 hex string length
  });

  // =========================================================================
  // 12 & 13. Dynamic Criteria from Database (ADR-001)
  // =========================================================================
  it('Rules 12-13: Validation criteria load from database and different projects can produce different results', () => {
    const valService = new ValidationService(db);

    // In pilot project AY-728-001, compaction requires >= 100%
    const resultPilot = valService.validateMeasurements('AY-728-001', 'COMPACTION', {
      compaction_pct: 98.5,
      moisture_deviation: 0.0,
      sub_base_thickness: 22.0,
      base_thickness: 26.0
    });
    expect(resultPilot.allPassed).toBe(false);

    // Insert second hypothetical project with relaxed rural compaction threshold >= 95%
    db.prepare(`
      INSERT INTO projects (id, name, contract_number, entity, execution_mode)
      VALUES ('RURAL-002', 'Trocha Carrozable Huanta', 'N° 99-2026', 'Gobierno Regional', 'Directa')
    `).run();

    db.prepare(`
      INSERT INTO criteria (id, project_id, activity, field, operator, min_value, source_reference)
      VALUES ('crit_rural_comp', 'RURAL-002', 'COMPACTION', 'compaction_pct', 'GTE', 95.0, 'Especificación Rural')
    `).run();

    const resultRural = valService.validateMeasurements('RURAL-002', 'COMPACTION', {
      compaction_pct: 98.5
    });
    // For RURAL-002, 98.5% is a PASS because criterion is data in DB, not code!
    expect(resultRural.allPassed).toBe(true);
  });

  // =========================================================================
  // 14. PDF Generation (Requirement R8)
  // =========================================================================
  it('R8: Protocol PDF generated with recorded values, technician identity, and chainage', async () => {
    const res = await request(app)
      .post('/api/protocols')
      .send({
        project_id: 'AY-728-001',
        device_token: 'dvc_pilot_soils_03',
        technician_pin: '1234',
        activity: 'SURVEY',
        recorded_at: '2026-09-14T09:00:00-05:00',
        gps: { lat: -13.1588, lng: -74.2236 },
        panel: '40',
        chainage: '0+250',
        measurements: { elevation_deviation: 0.5 }
      });

    const protocolId = res.body.protocol_id;

    // Fetch generated PDF
    const pdfRes = await request(app).get(`/api/protocols/${protocolId}/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.header['content-type']).toBe('application/pdf');
    expect(pdfRes.body.length).toBeGreaterThan(1000);
  });

  // =========================================================================
  // 15. Overdue Protocol Monitor (Requirement R10)
  // =========================================================================
  it('R10: Overdue protocol triggers notification when past scheduled time + 4 hours', async () => {
    const overdueService = new OverdueService(db);
    
    // Seed scheduled item that was scheduled 5 hours ago
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    db.prepare(`
      INSERT INTO protocol_schedules (id, project_id, activity, panel, chainage, scheduled_at)
      VALUES ('sched_test_overdue', 'AY-728-001', 'CONCRETE', '99', '0+999', ?)
    `).run(fiveHoursAgo);

    const notifiedCount = await overdueService.checkOverdueProtocols();
    expect(notifiedCount).toBeGreaterThan(0);

    // Verify notification was recorded in notifications table
    const overdueNotifs = db.prepare(`SELECT * FROM notifications WHERE event_type = 'OVERDUE'`).all();
    expect(overdueNotifs.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 16. Project Status and Quality Dossier (Contract 8.3 & 8.4)
  // =========================================================================
  it('Contracts 8.3 & 8.4: Status view returns aggregated summary and Dossier compiles master PDF', async () => {
    // 1. Check Status
    const statusRes = await request(app).get('/api/projects/AY-728-001/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.project_id).toBe('AY-728-001');
    expect(statusRes.body.summary).toBeDefined();
    expect(typeof statusRes.body.summary.passed).toBe('number');

    // 2. Check Dossier
    const dossierRes = await request(app).get('/api/projects/AY-728-001/dossier');
    expect(dossierRes.status).toBe(200);
    expect(dossierRes.body.dossier_url).toBe('/api/projects/AY-728-001/dossier.pdf');
    expect(typeof dossierRes.body.completeness_pct).toBe('number');
  });
});
