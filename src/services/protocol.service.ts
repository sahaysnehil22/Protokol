import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import {
  ProtocolSubmissionRequest,
  ProtocolSubmissionResponse,
  CylinderResultRequest,
  CylinderResultResponse,
  ProjectStatusResponse,
  DossierResponse,
  ProtocolRecord,
  ValidationCheck,
  ProtocolVerdict
} from '../types.js';
import { ValidationService } from './validation.service.js';
import { PhotoService } from './photo.service.js';
import { NotificationService } from './notification.service.js';
import { PdfService } from './pdf.service.js';
import { computeProtocolIntegrityHash, verifyPin } from './integrity.service.js';

export class ProtocolService {
  private validationService: ValidationService;
  private photoService: PhotoService;
  private notificationService: NotificationService;
  private pdfService: PdfService;

  constructor(private db: DatabaseSync) {
    this.validationService = new ValidationService(db);
    this.photoService = new PhotoService(db);
    this.notificationService = new NotificationService(db);
    this.pdfService = new PdfService(db);
  }

  /**
   * Submits and validates a quality protocol (Contract 8.1 POST /protocols).
   * Persists immutable record and returns verdict within 5 seconds (Requirement R1).
   */
  async submitProtocol(request: ProtocolSubmissionRequest): Promise<ProtocolSubmissionResponse> {
    // 1. Idempotency Check: Prevent duplicate offline sync submissions (Requirement R3)
    if (request.idempotency_key) {
      const existing = this.db.prepare(`
        SELECT * FROM protocols WHERE idempotency_key = ?
      `).get(request.idempotency_key) as any;

      if (existing) {
        return this.buildSubmissionResponse(existing);
      }
    }

    // 2. Identity Verification: Validate Technician PIN & Device
    const tech = this.db.prepare(`
      SELECT id, name, role, pin_hash, device_token
      FROM technicians
      WHERE project_id = ? AND (device_token = ? OR id = ?)
    `).get(request.project_id, request.device_token, request.device_token) as any;

    // Fallback: If technician found by project and PIN matches
    let verifiedTech = tech;
    if (!verifiedTech) {
      const allProjectTechs = this.db.prepare(`
        SELECT id, name, role, pin_hash, device_token FROM technicians WHERE project_id = ?
      `).all(request.project_id) as any[];

      verifiedTech = allProjectTechs.find(t => verifyPin(request.technician_pin, t.pin_hash));
    } else if (!verifyPin(request.technician_pin, verifiedTech.pin_hash)) {
      throw new Error('AUTH_FAILED: PIN de técnico inválido.');
    }

    if (!verifiedTech) {
      throw new Error('AUTH_FAILED: Técnico no autorizado para este proyecto o PIN incorrecto.');
    }

    // 3. Deterministic Validation against Database Criteria (Criteria as Data)
    const valResult = this.validationService.validateMeasurements(
      request.project_id,
      request.activity,
      request.measurements
    );

    // 4. Determine Verdict according to Domain State Machine
    let verdict: ProtocolVerdict;
    if (!valResult.allPassed) {
      verdict = 'FAIL';
    } else if (request.activity === 'CONCRETE') {
      verdict = 'PROVISIONAL_PASS'; // Mandatory domain state until 28-day cylinder break
    } else {
      verdict = 'PASS';
    }

    // 5. Timestamps: Client recorded_at with offset + Server received time (Requirement R6)
    const serverReceivedAt = new Date().toISOString();
    const recordedAt = request.recorded_at || serverReceivedAt;
    const timezoneOffset = request.recorded_at && request.recorded_at.includes('-')
      ? request.recorded_at.slice(-6)
      : config.projectTimezoneOffset;

    // 6. Generate Unique Protocol ID: PRT-YYYYMMDD-HHMM-PANEL
    const datePart = recordedAt.split('T')[0].replace(/-/g, '');
    const timePart = (recordedAt.split('T')[1] || '00:00').substring(0, 5).replace(':', '');
    const panelPadded = request.panel.padStart(3, '0');
    const protocolId = `PRT-${datePart}-${timePart}-${panelPadded}`;

    // 7. Calculate Cryptographic Integrity Hash (Requirement ADR-003)
    const integrityHash = computeProtocolIntegrityHash({
      protocol_id: protocolId,
      project_id: request.project_id,
      activity: request.activity,
      recorded_at: recordedAt,
      gps_lat: request.gps.lat,
      gps_lng: request.gps.lng,
      panel: request.panel,
      chainage: request.chainage,
      measurements: request.measurements,
      technician_id: verifiedTech.id,
      device_token: request.device_token
    });

    // 8. Insert Immutable Protocol Record
    const insertProtocol = this.db.prepare(`
      INSERT INTO protocols (
        id, project_id, activity, recorded_at, server_received_at, timezone_offset,
        gps_lat, gps_lng, panel, chainage, measurements, verdict,
        technician_id, device_token, integrity_hash, notes, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProtocol.run(
      protocolId,
      request.project_id,
      request.activity,
      recordedAt,
      serverReceivedAt,
      timezoneOffset,
      request.gps.lat,
      request.gps.lng,
      request.panel,
      request.chainage,
      JSON.stringify(request.measurements),
      verdict,
      verifiedTech.id,
      request.device_token,
      integrityHash,
      request.notes || '',
      request.idempotency_key || null
    );

    // 9. Associate Evidence Photos (Opaque References)
    if (request.photo_ids && request.photo_ids.length > 0) {
      this.photoService.linkPhotosToProtocol(protocolId, request.photo_ids);
    }

    // 10. Non-Conformance Handling on Failure (Requirement R2)
    let nonconformanceId: string | null = null;
    if (verdict === 'FAIL') {
      for (const failedCheck of valResult.failedChecks) {
        nonconformanceId = `NC-${datePart}-${timePart}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const insertNc = this.db.prepare(`
          INSERT INTO nonconformances (
            id, protocol_id, field, expected_value, actual_value, description, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
        `);

        insertNc.run(
          nonconformanceId,
          protocolId,
          failedCheck.field,
          failedCheck.expected,
          String(failedCheck.actual),
          `Criterio no cumplido en ${failedCheck.field}: obtenido ${failedCheck.actual}, requerido ${failedCheck.expected}`
        );

        // Notify Quality Specialist within 60 seconds (R2)
        await this.notificationService.notifyNonConformanceOpened({
          projectId: request.project_id,
          protocolId,
          nonconformanceId,
          field: failedCheck.field,
          expected: failedCheck.expected,
          actual: failedCheck.actual,
          chainage: request.chainage,
          panel: request.panel
        });
      }
    }

    // 11. Concrete Workflow: Schedule Pending Cylinders (Requirement R4)
    const pending: string[] = [];
    if (request.activity === 'CONCRETE') {
      const cylindersCast = parseInt(String(request.measurements.cylinders_cast || '2'), 10);
      const designFc = parseFloat(String(request.measurements.design_fc || '210'));
      const castDate = recordedAt.split('T')[0];

      const insertCyl = this.db.prepare(`
        INSERT INTO cylinders (id, protocol_id, cylinder_code, cast_date, age_days, design_fc, status)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      // 7-day break specimen
      const cyl7Id = `cyl_7d_${protocolId}`;
      const code7 = `P-${datePart}-${panelPadded}-7D`;
      insertCyl.run(cyl7Id, protocolId, code7, castDate, 7, designFc);
      pending.push('CYLINDER_7D');

      // 28-day break specimen (binding compliance gate)
      const cyl28Id = `cyl_28d_${protocolId}`;
      const code28 = `P-${datePart}-${panelPadded}-28D`;
      insertCyl.run(cyl28Id, protocolId, code28, castDate, 28, designFc);
      pending.push('CYLINDER_28D');
    }

    // 12. Dispatch Protocol Creation Alert to Quality Specialist
    await this.notificationService.notifyProtocolCreated({
      projectId: request.project_id,
      protocolId,
      activity: request.activity,
      panel: request.panel,
      chainage: request.chainage,
      verdict,
      technicianName: verifiedTech.name
    });

    // 13. Generate Protocol PDF (Requirement R8)
    const protocolRecord = this.getProtocolById(protocolId)!;
    await this.pdfService.generateProtocolPdf({
      protocol: protocolRecord,
      checks: valResult.checks,
      technicianName: verifiedTech.name,
      technicianRole: verifiedTech.role,
      nonconformanceId
    });

    return {
      protocol_id: protocolId,
      verdict,
      checks: valResult.checks,
      nonconformance_id: nonconformanceId,
      pdf_url: `/api/protocols/${protocolId}/pdf`,
      pending
    };
  }

  /**
   * Records a deferred concrete cylinder compressive strength test (Contract 8.2).
   * Transitions PROVISIONAL_PASS -> PASS (if strength >= design_fc) or FAIL (if strength < design_fc).
   */
  async recordCylinderResult(protocolId: string, result: CylinderResultRequest): Promise<CylinderResultResponse> {
    const protocol = this.getProtocolById(protocolId);
    if (!protocol) {
      throw new Error(`PROTOCOL_NOT_FOUND: Protocolo ${protocolId} no encontrado.`);
    }

    if (protocol.activity !== 'CONCRETE') {
      throw new Error(`INVALID_ACTIVITY: Solo protocolos de CONCRETO admiten rotura de probetas.`);
    }

    // Locate pending cylinder for this age
    const cylinder = this.db.prepare(`
      SELECT * FROM cylinders
      WHERE protocol_id = ? AND age_days = ?
    `).get(protocolId, result.age_days) as any;

    const designFc = cylinder ? cylinder.design_fc : (protocol.measurements.design_fc || 210);
    const passed = result.strength_kgcm2 >= designFc;
    const testDate = new Date().toISOString().split('T')[0];

    // Update cylinder record
    const updateCyl = this.db.prepare(`
      UPDATE cylinders
      SET strength_kgcm2 = ?, lab = ?, report_photo_id = ?, test_date = ?, status = 'TESTED', verdict = ?
      WHERE protocol_id = ? AND age_days = ?
    `);

    updateCyl.run(
      result.strength_kgcm2,
      result.lab,
      result.report_photo_id || null,
      testDate,
      passed ? 'PASS' : 'FAIL',
      protocolId,
      result.age_days
    );

    let newProtocolVerdict: ProtocolVerdict = protocol.verdict;
    let nonconformanceId: string | null = null;

    // At 28 days (contractual compliance gate)
    if (result.age_days === 28) {
      if (passed) {
        newProtocolVerdict = 'PASS';
      } else {
        // Requirement R5: cylinder strength below design f'c results in FAIL and NC
        newProtocolVerdict = 'FAIL';
        const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
        nonconformanceId = `NC-LAB-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

        this.db.prepare(`
          INSERT INTO nonconformances (
            id, protocol_id, field, expected_value, actual_value, description, status
          ) VALUES (?, ?, 'strength_kgcm2', ?, ?, ?, 'OPEN')
        `).run(
          nonconformanceId,
          protocolId,
          `>= ${designFc} kg/cm²`,
          `${result.strength_kgcm2} kg/cm²`,
          `Resistencia a compresión a 28 días (${result.strength_kgcm2} kg/cm²) inferior a f'c de diseño (${designFc} kg/cm²)`
        );
      }

      // Update protocol verdict (explicitly permitted by trigger when OLD.verdict = 'PROVISIONAL_PASS')
      this.db.prepare(`
        UPDATE protocols
        SET verdict = ?
        WHERE id = ?
      `).run(newProtocolVerdict, protocolId);
    }

    // Send WhatsApp notification for cylinder test result
    await this.notificationService.notifyCylinderResult({
      projectId: protocol.project_id,
      protocolId,
      cylinderCode: result.cylinder_code,
      ageDays: result.age_days,
      strengthKgcm2: result.strength_kgcm2,
      designFc,
      verdict: passed ? 'PASS' : 'FAIL',
      nonconformanceId
    });

    // Re-generate updated protocol PDF with final verdict
    const tech = this.db.prepare(`SELECT name, role FROM technicians WHERE id = ?`).get(protocol.technician_id) as any;
    const checks = this.validationService.validateMeasurements(protocol.project_id, protocol.activity, protocol.measurements).checks;
    
    // Append cylinder check
    checks.push({
      field: `strength_kgcm2_${result.age_days}d`,
      expected: `>= ${designFc} kg/cm²`,
      actual: result.strength_kgcm2,
      result: passed ? 'PASS' : 'FAIL',
      unit: 'kg/cm²',
      source_reference: `Ensayo de Rotura Lab ${result.lab} (${result.age_days} días)`
    });

    await this.pdfService.generateProtocolPdf({
      protocol: { ...protocol, verdict: newProtocolVerdict },
      checks,
      technicianName: tech ? tech.name : 'Responsable de Campo',
      technicianRole: tech ? tech.role : 'Especialista',
      nonconformanceId
    });

    return {
      protocol_id: protocolId,
      cylinder_code: result.cylinder_code,
      age_days: result.age_days,
      strength_kgcm2: result.strength_kgcm2,
      design_fc: designFc,
      verdict: passed ? 'PASS' : 'FAIL',
      protocol_verdict: newProtocolVerdict,
      nonconformance_id: nonconformanceId
    };
  }

  /**
   * Retrieves overall project status (Contract 8.3 GET /projects/{id}/status).
   */
  getProjectStatus(projectId: string): ProjectStatusResponse {
    const protocols = this.db.prepare(`
      SELECT p.*, 
        (SELECT count(*) FROM nonconformances nc WHERE nc.protocol_id = p.id AND nc.status = 'OPEN') as open_nc_count
      FROM protocols p
      WHERE p.project_id = ?
      ORDER BY p.recorded_at DESC
    `).all(projectId) as any[];

    let passedCount = 0;
    let provisionalCount = 0;
    let failedCount = 0;

    const protocolSummaries = protocols.map(p => {
      if (p.verdict === 'PASS') passedCount++;
      else if (p.verdict === 'PROVISIONAL_PASS') provisionalCount++;
      else if (p.verdict === 'FAIL') failedCount++;

      const pendingCylinders = this.db.prepare(`
        SELECT age_days FROM cylinders WHERE protocol_id = ? AND status = 'PENDING'
      `).all(p.id) as Array<{ age_days: number }>;

      return {
        id: p.id,
        activity: p.activity,
        panel: p.panel,
        chainage: p.chainage,
        verdict: p.verdict as ProtocolVerdict,
        recorded_at: p.recorded_at,
        checks_count: Object.keys(JSON.parse(p.measurements || '{}')).length,
        open_nc: p.open_nc_count > 0,
        pending: pendingCylinders.map(c => `CYLINDER_${c.age_days}D`)
      };
    });

    const pendingCylindersTotal = this.db.prepare(`
      SELECT count(*) as count FROM cylinders c
      JOIN protocols p ON c.protocol_id = p.id
      WHERE p.project_id = ? AND c.status = 'PENDING'
    `).get(projectId) as { count: number };

    const openNcsTotal = this.db.prepare(`
      SELECT count(*) as count FROM nonconformances nc
      JOIN protocols p ON nc.protocol_id = p.id
      WHERE p.project_id = ? AND nc.status = 'OPEN'
    `).get(projectId) as { count: number };

    // Expected protocols based on scheduled activities
    const schedulesCount = this.db.prepare(`
      SELECT count(*) as count FROM protocol_schedules WHERE project_id = ?
    `).get(projectId) as { count: number };

    const totalExpected = Math.max(protocols.length, schedulesCount.count, 84);
    const missingCount = Math.max(0, totalExpected - protocols.length);

    return {
      project_id: projectId,
      as_of: new Date().toISOString(),
      summary: {
        total_expected: totalExpected,
        passed: passedCount,
        provisional: provisionalCount,
        failed: failedCount,
        missing: missingCount,
        pending_cylinders: pendingCylindersTotal.count,
        open_nonconformances: openNcsTotal.count
      },
      protocols: protocolSummaries
    };
  }

  /**
   * Compiles the Quality Dossier package (Contract 8.4 GET /projects/{id}/dossier).
   */
  async getProjectDossier(projectId: string): Promise<DossierResponse> {
    const result = await this.pdfService.generateDossierPdf(projectId);
    
    // Completeness is calculated as (passed protocols / total expected)
    const status = this.getProjectStatus(projectId);
    const completenessPct = status.summary.total_expected > 0
      ? Number(((status.summary.passed / status.summary.total_expected) * 100).toFixed(1))
      : 0;

    return {
      dossier_url: `/api/projects/${projectId}/dossier.pdf`,
      generated_at: new Date().toISOString(),
      protocols_included: result.protocolsCount,
      open_nonconformances: result.openNcCount,
      completeness_pct: completenessPct
    };
  }

  /**
   * Closes an open Non-Conformance with documented corrective action.
   */
  closeNonConformance(ncId: string, correctiveAction: string, technicianId: string): void {
    const stmt = this.db.prepare(`
      UPDATE nonconformances
      SET status = 'CLOSED', corrective_action = ?, closed_at = datetime('now'), closed_by_technician_id = ?
      WHERE id = ? AND status = 'OPEN'
    `);
    const res = stmt.run(correctiveAction, technicianId, ncId);
    if (res.changes === 0) {
      throw new Error(`NC_NOT_FOUND_OR_ALREADY_CLOSED: No se pudo cerrar la No Conformidad ${ncId}.`);
    }
  }

  /**
   * Helper: Builds response for cached or retrieved protocol.
   */
  private buildSubmissionResponse(protocol: any): ProtocolSubmissionResponse {
    const measurements = JSON.parse(protocol.measurements || '{}');
    const val = this.validationService.validateMeasurements(protocol.project_id, protocol.activity, measurements);

    const openNc = this.db.prepare(`
      SELECT id FROM nonconformances WHERE protocol_id = ? AND status = 'OPEN' LIMIT 1
    `).get(protocol.id) as { id: string } | undefined;

    const pendingCyl = this.db.prepare(`
      SELECT age_days FROM cylinders WHERE protocol_id = ? AND status = 'PENDING'
    `).all(protocol.id) as Array<{ age_days: number }>;

    return {
      protocol_id: protocol.id,
      verdict: protocol.verdict,
      checks: val.checks,
      nonconformance_id: openNc ? openNc.id : null,
      pdf_url: `/api/protocols/${protocol.id}/pdf`,
      pending: pendingCyl.map(c => `CYLINDER_${c.age_days}D`)
    };
  }

  /**
   * Retrieves single protocol record by ID.
   */
  getProtocolById(id: string): ProtocolRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM protocols WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      ...row,
      measurements: JSON.parse(row.measurements || '{}')
    };
  }
}
