import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.js';
import { authedAgent, createProjectAndLogin } from './helpers.js';

/**
 * PROTOKOL — Production-readiness test suite (2026-10-03).
 * Covers the security/concurrency hardening: two-tier auth, lockout,
 * project isolation, archive, idempotent retries, verdict guard, trigger.
 */
describe('PROTOKOL Production Readiness', () => {
  let db: DatabaseSync;
  let app: any;
  let agent: any;

  beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    const instance = createApp(db);
    app = instance.app;
    agent = await authedAgent(app); // seeded AY-728-001, legacy tech-PIN mode
  });

  afterEach(() => {
    db.close();
  });

  // ------------------------------------------------------------------
  it('S-1: unauthenticated requests to data endpoints are rejected', async () => {
    const anon = request(app);
    const r1 = await anon.get('/api/projects/AY-728-001/status');
    expect(r1.status).toBe(401);
    const r2 = await anon.post('/api/protocols').send({ project_id: 'AY-728-001' });
    expect(r2.status).toBe(401);
    const r3 = await anon.get('/api/projects/AY-728-001/criteria');
    expect(r3.status).toBe(401);
  });

  it('S-1: project list stays public-minimal (no PIN hashes, no phone numbers)', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('pin_hash');
    expect(body).not.toContain('access_pin_hash');
    expect(body).not.toContain('whatsapp_recipients');
  });

  it('C-01: project creation requires a centralized access PIN', async () => {
    const res = await request(app).post('/api/projects').send({
      id: 'PROJ-NOPIN', name: 'X', contract_number: 'N1', entity: 'E', execution_mode: 'Contrata',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('Two-tier: project PIN grants access; wrong PIN counts down and locks', async () => {
    const { projectId } = await createProjectAndLogin(app, { id: 'PROJ-LOCK' });

    // wrong PIN 5 times -> attempts_remaining decreases
    for (let i = 0; i < 4; i++) {
      const r = await request(app)
        .post(`/api/projects/${projectId}/verify-access`)
        .send({ pin: 'wrong', device_token: 'd1' });
      expect(r.status).toBe(401);
      expect(r.body.attempts_remaining).toBe(4 - i);
    }
    // 5th wrong attempt -> still 401, next one is locked
    const r5 = await request(app)
      .post(`/api/projects/${projectId}/verify-access`)
      .send({ pin: 'wrong', device_token: 'd1' });
    expect(r5.status).toBe(401);
    expect(r5.body.attempts_remaining).toBe(0);

    const locked = await request(app)
      .post(`/api/projects/${projectId}/verify-access`)
      .send({ pin: 'test-pin-1234', device_token: 'd1' });
    expect(locked.status).toBe(423);
    expect(locked.body.error).toBe('PIN_LOCKED');
  });

  it('Isolation: a session for project A cannot read project B', async () => {
    const { projectId: projB, agent: agentB } = await createProjectAndLogin(app, { id: 'PROJ-B-ISO' });

    // agent (AY-728-001) tries to read project B status -> 403
    const r = await agent.get(`/api/projects/${projB}/status`);
    expect(r.status).toBe(403);

    // agentB (PROJ-B-ISO) tries to read AY-728-001 -> 403
    const r2 = await agentB.get('/api/projects/AY-728-001/status');
    expect(r2.status).toBe(403);
  });

  it('Archive: archived projects leave the default list, restore brings them back', async () => {
    const { projectId, agent: agentA } = await createProjectAndLogin(app, { id: 'PROJ-ARCH' });

    const arch = await agentA.patch(`/api/projects/${projectId}/archive`);
    expect(arch.status).toBe(200);

    const list = await request(app).get('/api/projects');
    expect(list.body.some((p: any) => p.id === projectId)).toBe(false);

    const archivedList = await request(app).get('/api/projects?archived=true');
    expect(archivedList.body.some((p: any) => p.id === projectId)).toBe(true);

    const restore = await agentA.patch(`/api/projects/${projectId}/restore`);
    expect(restore.status).toBe(200);
    const list2 = await request(app).get('/api/projects');
    expect(list2.body.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('R-1/R-2: duplicate submit with the same idempotency key returns the original', async () => {
    const payload = {
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'SURVEY',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22, source: 'DEVICE_GPS' },
      panel: '99',
      chainage: '9+999',
      measurements: { elevation_dev_mm: 5 },
      idempotency_key: 'idemp_test_dup_001',
    };
    const r1 = await agent.post('/api/protocols').send(payload);
    expect(r1.status).toBe(201);
    const r2 = await agent.post('/api/protocols').send(payload);
    expect(r2.status).toBe(200);
    expect(r2.body.protocol_id).toBe(r1.body.protocol_id);

    const count = db.prepare(`SELECT COUNT(*) as c FROM protocols WHERE idempotency_key = ?`)
      .get('idemp_test_dup_001') as any;
    expect(count.c).toBe(1);
  });

  it('R-3: protocol IDs are unique across rapid submissions', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const r = await agent.post('/api/protocols').send({
        project_id: 'AY-728-001',
        device_token: 'test-device-01',
        activity: 'SURVEY',
        recorded_at: '2026-10-03T10:00:00-05:00',
        gps: { lat: -13.15, lng: -74.22 },
        panel: '77',
        chainage: `7+${i}00`,
        measurements: { elevation_dev_mm: 3 },
        idempotency_key: `idemp_uniq_${i}_${Date.now()}`,
      });
      expect(r.status).toBe(201);
      ids.add(r.body.protocol_id);
    }
    expect(ids.size).toBe(3);
  });

  it('H-02: 28-day break on a finalized protocol is rejected with 409, atomically', async () => {
    // Create a FAIL protocol via out-of-spec measurement
    const r = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'SURVEY',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '88',
      chainage: '8+888',
      measurements: { elevation_dev_mm: 999 }, // way over LTE 10mm -> FAIL
      idempotency_key: 'idemp_h02_fail',
    });
    expect(r.status).toBe(201);
    expect(r.body.verdict).toBe('FAIL');
    const protocolId = r.body.protocol_id;

    // Grab a cylinder of this protocol (SURVEY has none; use a CONCRETE one)
    const rc = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'CONCRETE',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '89',
      chainage: '8+889',
      measurements: { formwork_approved: true, slump: '4', design_fc: 280 },
      idempotency_key: 'idemp_h02_conc',
    });
    const concId = rc.body.protocol_id;
    // Force it to FAIL verdict directly (simulating a sealed FAIL)
    db.prepare(`UPDATE protocols SET verdict = 'FAIL' WHERE id = ?`).run(concId);
    const cyl = db.prepare(`SELECT * FROM cylinders WHERE protocol_id = ? LIMIT 1`).get(concId) as any;

    const res = await agent.post(`/api/protocols/${concId}/cylinder-result`).send({
      age_days: 28, cylinder_code: cyl.cylinder_code, strength_kgcm2: 999, lab: 'Lab X',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('VERDICT_FINALIZED');

    // Atomicity: the cylinder must NOT be marked TESTED
    const after = db.prepare(`SELECT status FROM cylinders WHERE id = ?`).get(cyl.id) as any;
    expect(after.status).not.toBe('TESTED');
    void protocolId;
  });

  it('H-07: sealed columns cannot be mutated post-seal', async () => {
    const r = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'SURVEY',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '66',
      chainage: '6+666',
      measurements: { elevation_dev_mm: 2 },
      idempotency_key: 'idemp_h07',
    });
    const pid = r.body.protocol_id;
    expect(() =>
      db.prepare(`UPDATE protocols SET notes = 'tampered' WHERE id = ?`).run(pid)
    ).toThrow(/IMMUTABILITY_VIOLATION/);
    expect(() =>
      db.prepare(`UPDATE protocols SET device_token = 'evil' WHERE id = ?`).run(pid)
    ).toThrow(/IMMUTABILITY_VIOLATION/);
    // Verdict transition from PROVISIONAL_PASS still works (control case)
    const conc = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'CONCRETE',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '67',
      chainage: '6+667',
      measurements: { formwork_approved: true, slump: '4', design_fc: 280 },
      idempotency_key: 'idemp_h07_conc',
    });
    db.prepare(`UPDATE protocols SET verdict = 'PASS' WHERE id = ?`).run(conc.body.protocol_id);
    const v = db.prepare(`SELECT verdict FROM protocols WHERE id = ?`).get(conc.body.protocol_id) as any;
    expect(v.verdict).toBe('PASS');
  });

  it('H-05/H-06: criteria API round-trips allowed_values/hold_point; IN is strict', async () => {
    const { projectId, agent: agentA } = await createProjectAndLogin(app, { id: 'PROJ-CRIT2' });
    // The project needs at least one technician for box-1 attribution
    await agentA.post(`/api/projects/${projectId}/technicians`).send({
      name: 'Ing. Test', role: 'Quality Specialist', pin: '1234',
    });
    const c = await agentA.post(`/api/projects/${projectId}/criteria`).send({
      activity: 'CONCRETE', field: 'slump', operator: 'IN',
      allowed_values: ['3.5', '4', '4.5', '5'], unit: 'pulgadas',
      hold_point: true, source_reference: 'test',
    });
    expect(c.status).toBe(201);

    const list = await agentA.get(`/api/projects/${projectId}/criteria`);
    const crit = list.body.find((x: any) => x.field === 'slump');
    expect(JSON.parse(crit.allowed_values)).toEqual(['3.5', '4', '4.5', '5']);
    expect(crit.hold_point).toBe(1);

    // Strict IN: '7' is inside the OLD hardcoded band but NOT in allowed_values -> FAIL
    const bad = await agentA.post('/api/protocols').send({
      project_id: projectId,
      device_token: 'test-device-01',
      activity: 'CONCRETE',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '01', chainage: '0+010',
      measurements: { slump: '7', design_fc: 280 },
      idempotency_key: 'idemp_strict_bad',
    });
    expect(bad.body.verdict).toBe('FAIL');

    // '4' is allowed -> not FAIL on slump (verdict may be PROVISIONAL_PASS)
    const good = await agentA.post('/api/protocols').send({
      project_id: projectId,
      device_token: 'test-device-01',
      activity: 'CONCRETE',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '02', chainage: '0+020',
      measurements: { slump: '4', design_fc: 280 },
      idempotency_key: 'idemp_strict_good',
    });
    expect(good.body.verdict).not.toBe('FAIL');
  });

  it('C-04: GPS provenance is sealed into the record', async () => {
    const r = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'SURVEY',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22, source: 'PILOT_DEFAULT' },
      panel: '55', chainage: '5+555',
      measurements: { elevation_dev_mm: 2 },
      idempotency_key: 'idemp_gps_src',
    });
    expect(r.status).toBe(201);
    const row = db.prepare(`SELECT gps_source FROM protocols WHERE id = ?`).get(r.body.protocol_id) as any;
    expect(row.gps_source).toBe('PILOT_DEFAULT');
  });

  it('Access-PIN rotation invalidates all sessions', async () => {
    const { projectId, agent: agentA, access_pin } = await createProjectAndLogin(app, { id: 'PROJ-ROT' });
    // agentA is logged in; rotate the PIN
    const rot = await agentA.post(`/api/projects/${projectId}/access-pin`)
      .send({ current_pin: access_pin, new_pin: 'nuevo-pin-999' });
    expect(rot.status).toBe(200);
    // old session is dead
    const after = await agentA.get(`/api/projects/${projectId}/status`);
    expect(after.status).toBe(401);
    // new PIN works
    const agentB = await authedAgent(app, projectId, 'nuevo-pin-999');
    const ok = await agentB.get(`/api/projects/${projectId}/status`);
    expect(ok.status).toBe(200);
  });

  it('D-08: closing an NC requires the signer personal PIN and a supervisor role', async () => {
    // FAIL protocol opens an NC
    const r = await agent.post('/api/protocols').send({
      project_id: 'AY-728-001',
      device_token: 'test-device-01',
      activity: 'SURVEY',
      recorded_at: '2026-10-03T10:00:00-05:00',
      gps: { lat: -13.15, lng: -74.22 },
      panel: '44', chainage: '4+444',
      measurements: { elevation_dev_mm: 999 },
      idempotency_key: 'idemp_nc_close',
    });
    const ncId = r.body.nonconformance_id;
    expect(ncId).toBeTruthy();

    // No PIN -> 400
    const noPin = await agent.patch(`/api/nonconformances/${ncId}/close`)
      .send({ corrective_action: 'x', signer_id: 'tech_supervisor' });
    expect(noPin.status).toBe(400);

    // Wrong personal PIN -> 401
    const wrongPin = await agent.patch(`/api/nonconformances/${ncId}/close`)
      .send({ corrective_action: 'x', signer_id: 'tech_supervisor', signer_pin: '0000' });
    expect(wrongPin.status).toBe(401);

    // Correct personal PIN + Supervisor role -> 200
    const ok = await agent.patch(`/api/nonconformances/${ncId}/close`)
      .send({ corrective_action: 'Se corrigió la cota', signer_id: 'tech_supervisor', signer_pin: '1234' });
    expect(ok.status).toBe(200);
  });
});
