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
  ProtocolVerdict,
  ProjectRecord,
  ConcreteTruckInput,
  ConcreteTruckRecord,
  SupportedLanguage,
  ChecklistTemplateItem,
  ProtocolCheckItem,
  ProtocolSignatureRecord,
  SignProtocolRequest
} from '../types.js';
import { ValidationService } from './validation.service.js';
import { PhotoService } from './photo.service.js';
import { NotificationService } from './notification.service.js';
import { PdfService } from './pdf.service.js';
import { computeProtocolIntegrityHash, verifyPin } from './integrity.service.js';
import { SupabaseSyncService } from './supabase_sync.service.js';

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
   * Supports 1 to 20+ mixer trucks for CONCRETE activities (v2.4 specification).
   */
  async submitProtocol(request: ProtocolSubmissionRequest, lang: SupportedLanguage = 'es'): Promise<ProtocolSubmissionResponse> {
    // 1. Idempotency Check: Prevent duplicate offline sync submissions (Requirement R3)
    if (request.idempotency_key) {
      const existing = this.db.prepare(`
        SELECT * FROM protocols WHERE idempotency_key = ?
      `).get(request.idempotency_key) as any;

      if (existing) {
        return this.buildSubmissionResponse(existing);
      }
    }

    // 2. Validate Project Existence
    const project = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `).get(request.project_id) as unknown as ProjectRecord | undefined;

    if (!project) {
      throw new Error(`PROJECT_NOT_FOUND: Proyecto ${request.project_id} no registrado en el sistema.`);
    }

    // 3. Identity Verification: Validate Technician PIN & Device for this Project
    const tech = this.db.prepare(`
      SELECT id, name, role, pin_hash, device_token
      FROM technicians
      WHERE project_id = ? AND (device_token = ? OR id = ?)
    `).get(request.project_id, request.device_token, request.device_token) as any;

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

    // 3.5. Enforce Photos-First Rule (§4.3.3): Verify all referenced photos exist on server
    if (Array.isArray(request.photo_ids) && request.photo_ids.length > 0) {
      for (const pid of request.photo_ids) {
        const photoRow = this.db.prepare(`SELECT id FROM photos WHERE id = ?`).get(pid);
        if (!photoRow) {
          throw new Error(`UNKNOWN_PHOTO_REF: Referencia de foto desconocida: ${pid}`);
        }
      }
    }

    // 4. Normalize Multi-Truck Payload for Concrete
    const measurements = { ...request.measurements };
    let concreteTrucks: ConcreteTruckInput[] = [];

    if (request.activity === 'CONCRETE') {
      const incomingTrucks = Array.isArray(measurements.trucks) && measurements.trucks.length > 0
        ? measurements.trucks
        : (Array.isArray(measurements.concrete_trucks) && measurements.concrete_trucks.length > 0 ? measurements.concrete_trucks : null);

      if (incomingTrucks && incomingTrucks.length > 0) {
        concreteTrucks = incomingTrucks.map((t: any, idx: number) => {
          const discreteSlump = t.slump !== undefined && t.slump !== null && String(t.slump).trim() !== ''
            ? String(t.slump).replace(/["'\s]/g, '')
            : (t.slump_cm !== undefined ? String(Math.round((parseFloat(String(t.slump_cm)) / 2.54) * 2) / 2) : '4');
          const numericSlumpCm = t.slump_cm !== undefined
            ? parseFloat(String(t.slump_cm))
            : (discreteSlump ? parseFloat(discreteSlump) * 2.54 : 10.16);

          return {
            truck_number: t.truck_number || idx + 1,
            mixer_id: String(t.mixer_id || `MIX-${String(idx + 1).padStart(2, '0')}`),
            delivery_note: String(t.delivery_note || `GR-${String(idx + 1).padStart(3, '0')}`),
            slump: discreteSlump,
            slump_cm: numericSlumpCm,
            supplier: t.supplier || 'Concreto Titán',
            cylinders_cast: t.cylinders_cast !== undefined ? parseInt(String(t.cylinders_cast), 10) : project.cylinders_per_truck,
            design_fc: t.design_fc !== undefined ? parseFloat(String(t.design_fc)) : (measurements.design_fc ? parseFloat(String(measurements.design_fc)) : project.default_design_fc),
            notes: t.notes || ''
          };
        });
      } else if (measurements.slump !== undefined || measurements.slump_cm !== undefined) {
        // Single truck backward-compatibility format
        const discreteSlump = measurements.slump
          ? String(measurements.slump).replace(/["'\s]/g, '')
          : (measurements.slump_cm ? String(Math.round((parseFloat(String(measurements.slump_cm)) / 2.54) * 2) / 2) : '4');
        const numericSlumpCm = measurements.slump_cm
          ? parseFloat(String(measurements.slump_cm))
          : parseFloat(discreteSlump) * 2.54;

        concreteTrucks = [{
          truck_number: 1,
          mixer_id: String(measurements.mixer_id || 'MIX-01'),
          delivery_note: String(measurements.delivery_note || 'GR-001'),
          slump: discreteSlump,
          slump_cm: numericSlumpCm,
          supplier: measurements.supplier || 'Concreto Titán',
          cylinders_cast: measurements.cylinders_cast !== undefined ? parseInt(String(measurements.cylinders_cast), 10) : project.cylinders_per_truck,
          design_fc: measurements.design_fc !== undefined ? parseFloat(String(measurements.design_fc)) : project.default_design_fc,
          notes: measurements.notes || ''
        }];
      }
      measurements.trucks = concreteTrucks;
    }

    // 5. Deterministic Validation against Database Criteria (Criteria as Data)
    const valResult = this.validationService.validateMeasurements(
      request.project_id,
      request.activity,
      measurements
    );

    // 6. Determine Verdict according to Domain State Machine
    let verdict: ProtocolVerdict;
    if (!valResult.allPassed) {
      verdict = 'FAIL';
    } else if (request.activity === 'CONCRETE') {
      verdict = 'PROVISIONAL_PASS'; // Mandatory domain state until 28-day cylinder break
    } else {
      verdict = 'PASS';
    }

    // Check checklist items if provided, flag verdict on failure
    if (Array.isArray(request.checks)) {
      const hasFailedCheck = request.checks.some(c => c.result === 'NO_CUMPLE');
      if (hasFailedCheck) {
        verdict = 'FAIL';
      }
    }

    // 7. Timestamps: Client recorded_at with offset + Server received time (Requirement R6)
    const serverReceivedAt = new Date().toISOString();
    const recordedAt = request.recorded_at || serverReceivedAt;
    const timezoneOffset = request.recorded_at && request.recorded_at.includes('-')
      ? request.recorded_at.slice(-6)
      : (project.timezone_offset || config.defaultTimezoneOffset);

    // 8. Generate Unique Protocol ID: PRT-YYYYMMDD-HHMM-PANEL
    const datePart = recordedAt.split('T')[0].replace(/-/g, '');
    const timePart = (recordedAt.split('T')[1] || '00:00').substring(0, 5).replace(':', '');
    const panelPadded = request.panel.padStart(3, '0');
    const protocolId = `PRT-${datePart}-${timePart}-${panelPadded}`;

    // 9. Calculate Cryptographic Integrity Hash (ADR-003)
    const integrityHash = computeProtocolIntegrityHash({
      protocol_id: protocolId,
      project_id: request.project_id,
      activity: request.activity,
      recorded_at: recordedAt,
      gps_lat: request.gps.lat,
      gps_lng: request.gps.lng,
      panel: request.panel,
      chainage: request.chainage,
      measurements,
      technician_id: verifiedTech.id,
      device_token: request.device_token
    });

    // 10. Insert Immutable Protocol Record
    const insertProtocol = this.db.prepare(`
      INSERT INTO protocols (
        id, project_id, activity, recorded_at, server_received_at, timezone_offset,
        gps_lat, gps_lng, panel, chainage, measurements, verdict,
        technician_id, device_token, integrity_hash, pdf_key, subcontractor_id, notes, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(measurements),
      verdict,
      verifiedTech.id,
      request.device_token,
      integrityHash,
      `${protocolId}.pdf`,
      null,
      request.notes || '',
      request.idempotency_key || null
    );

    // 11. Concrete Normalized Relational Storage (Trucks & Cylinders)
    const pending: string[] = [];
    const truckRecordMap = new Map<number, string>(); // truck_number -> truck_id

    if (request.activity === 'CONCRETE') {
      const castDate = recordedAt.split('T')[0];
      const slumpCrit = this.validationService.getCriteria(request.project_id, 'CONCRETE').find(c => c.field === 'slump' || c.field === 'slump_cm');

      const insertTruck = this.db.prepare(`
        INSERT INTO concrete_trucks (
          id, protocol_id, truck_number, mixer_id, delivery_note, slump, slump_cm, supplier,
          cylinders_cast, design_fc, slump_verdict, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertCyl = this.db.prepare(`
        INSERT INTO cylinders (
          id, protocol_id, truck_id, truck_number, specimen_number,
          cylinder_code, cast_date, age_days, design_fc, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      for (const truck of concreteTrucks) {
        const truckId = `trk_${protocolId}_T${truck.truck_number}`;
        truckRecordMap.set(truck.truck_number, truckId);

        // Independent truck slump evaluation
        const slumpValToEval = truck.slump !== undefined ? truck.slump : truck.slump_cm;
        const isSlumpPass = slumpCrit
          ? this.validationService.evaluateCriterion(slumpCrit, slumpValToEval)
          : true;

        const truckCylinders = truck.cylinders_cast !== undefined ? truck.cylinders_cast : (project.cylinders_per_truck || 4);
        const truckDesignFc = truck.design_fc !== undefined ? truck.design_fc : (project.default_design_fc || 210);

        insertTruck.run(
          truckId,
          protocolId,
          truck.truck_number,
          truck.mixer_id,
          truck.delivery_note,
          truck.slump || '4',
          truck.slump_cm || (parseFloat(truck.slump || '4') * 2.54),
          truck.supplier || 'Concreto Titán',
          truckCylinders,
          truckDesignFc,
          isSlumpPass ? 'PASS' : 'FAIL',
          truck.notes || ''
        );

        // Schedule individual cylinders for this truck
        for (let c = 1; c <= truckCylinders; c++) {
          const is7Day = c <= Math.max(1, Math.floor(truckCylinders / 2));
          const ageDays = is7Day ? 7 : 28;
          const cylId = `cyl_${protocolId}_T${truck.truck_number}_C${c}`;
          const cylCode = `P-${datePart}-${panelPadded}-T${truck.truck_number}-C${c}`;

          insertCyl.run(
            cylId,
            protocolId,
            truckId,
            truck.truck_number,
            c,
            cylCode,
            castDate,
            ageDays,
            truckDesignFc
          );
        }
      }

      pending.push('CYLINDER_7D', 'CYLINDER_28D');
    }

    // 11.1 Save Checklist Checks (F1: Paper-format Checklist as Data)
    const insertCheck = this.db.prepare(`
      INSERT INTO protocol_checks (id, protocol_id, template_item_id, result, observation)
      VALUES (?, ?, ?, ?, ?)
    `);

    let checklistItemsToSave: Array<{ template_item_id: string; result: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA'; observation?: string }> = [];

    if (Array.isArray(request.checks) && request.checks.length > 0) {
      checklistItemsToSave = request.checks;
    } else {
      // If no explicit checks submitted, look up active template items for this project and activity
      const templateItems = this.db.prepare(`
        SELECT id FROM checklist_templates
        WHERE project_id = ? AND activity = ? AND active = 1
        ORDER BY item_order ASC
      `).all(request.project_id, request.activity) as any[];

      checklistItemsToSave = templateItems.map(item => ({
        template_item_id: item.id,
        result: 'CUMPLE',
        observation: 'Conforme según inspección visual en campo'
      }));
    }

    for (let i = 0; i < checklistItemsToSave.length; i++) {
      const chk = checklistItemsToSave[i];
      const chkId = `chk_${protocolId}_${i + 1}`;
      insertCheck.run(chkId, protocolId, chk.template_item_id, chk.result, chk.observation || '');
    }

    // 11.2 Generate 5-Box Signature Grid (F4, F6, F8, F9)
    const insertSig = this.db.prepare(`
      INSERT INTO signatures (
        id, protocol_id, signatory_id, signatory_name, role, sign_order, cip_number, status, signed_at, signature_key, stamp_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const projectTechs = this.db.prepare(`
      SELECT id, name, role, cip_number FROM technicians WHERE project_id = ?
    `).all(request.project_id) as any[];

    const defaultRoster = [
      { role: 'Especialista de Calidad (Ejecución)', sign_order: 1, fallbackName: 'Ing. David Valdez Ochoa', cip: null },
      { role: 'Especialista de Calidad (Supervisión)', sign_order: 2, fallbackName: 'Ing. Cristian Manuel Torres Salinas', cip: '260873' },
      { role: 'Supervisor de Obra', sign_order: 3, fallbackName: 'Ing. Teodoro Manuel Huamancusi Quispe', cip: '53548' },
      { role: 'Residente de Obra', sign_order: 4, fallbackName: 'Ing. Edison Cuadros García', cip: '302775' },
      { role: 'Especialista de Estructuras (Supervisión)', sign_order: 5, fallbackName: 'Ing. Roly Conocachi Huamaní', cip: '76843' }
    ];

    for (const r of defaultRoster) {
      const matchedTech = projectTechs.find(t =>
        (r.sign_order === 1 && (t.role.toLowerCase().includes('quality') || t.name.toLowerCase().includes('david'))) ||
        (r.sign_order === 2 && (t.role.toLowerCase().includes('quality') && t.role.toLowerCase().includes('supervi'))) ||
        (r.sign_order === 3 && t.role.toLowerCase().includes('supervisor')) ||
        (r.sign_order === 4 && (t.role.toLowerCase().includes('resident') || t.name.toLowerCase().includes('edison'))) ||
        (r.sign_order === 5 && t.role.toLowerCase().includes('struct'))
      );

      const sigId = `sig_${protocolId}_${r.sign_order}`;
      const techId = matchedTech ? matchedTech.id : null;
      const techName = matchedTech ? matchedTech.name : r.fallbackName;
      const techCip = matchedTech?.cip_number || r.cip;

      const isSubmitter = (techId && verifiedTech.id === techId) || (r.sign_order === 1 && verifiedTech.role.toLowerCase().includes('quality'));
      const status = isSubmitter ? 'SIGNED' : 'PENDING';
      const signedAt = isSubmitter ? serverReceivedAt : null;
      const sigKey = isSubmitter ? `sig_${verifiedTech.id}.png` : null;
      const stampKey = isSubmitter ? `stamp_${verifiedTech.id}.png` : null;

      insertSig.run(
        sigId,
        protocolId,
        techId || verifiedTech.id,
        techName,
        r.role,
        r.sign_order,
        techCip,
        status,
        signedAt,
        sigKey,
        stampKey
      );
    }

    // 12. Associate Evidence Photos (Opaque References)
    if (request.photo_ids && request.photo_ids.length > 0) {
      this.photoService.linkPhotosToProtocol(protocolId, request.photo_ids);
    }

    // 13. Non-Conformance Handling on Failure (Requirement R2)
    let primaryNonconformanceId: string | null = null;
    if (verdict === 'FAIL') {
      for (const failedCheck of valResult.failedChecks) {
        const ncId = `NC-${datePart}-${timePart}-${Math.floor(1000 + Math.random() * 9000)}`;
        if (!primaryNonconformanceId) primaryNonconformanceId = ncId;

        // Extract truck number if present in field description
        let linkedTruckId: string | null = null;
        const truckMatch = failedCheck.field.match(/Camión\s+(\d+)/);
        if (truckMatch && truckMatch[1]) {
          const tNum = parseInt(truckMatch[1], 10);
          linkedTruckId = truckRecordMap.get(tNum) || null;
        }

        const insertNc = this.db.prepare(`
          INSERT INTO nonconformances (
            id, protocol_id, truck_id, field, expected_value, actual_value, description, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN')
        `);

        insertNc.run(
          ncId,
          protocolId,
          linkedTruckId,
          failedCheck.field,
          failedCheck.expected,
          String(failedCheck.actual),
          `Criterio no cumplido en ${failedCheck.field}: obtenido ${failedCheck.actual}, requerido ${failedCheck.expected}`
        );

        // Notify Quality Specialist within 60 seconds (R2)
        await this.notificationService.notifyNonConformanceOpened({
          projectId: request.project_id,
          protocolId,
          nonconformanceId: ncId,
          field: failedCheck.field,
          expected: failedCheck.expected,
          actual: String(failedCheck.actual),
          chainage: request.chainage,
          panel: request.panel,
          truckInfo: failedCheck.source_reference
        });
      }
    }

    // 14. Dispatch Protocol Creation Alert to Project Recipient
    await this.notificationService.notifyProtocolCreated({
      projectId: request.project_id,
      protocolId,
      activity: request.activity,
      panel: request.panel,
      chainage: request.chainage,
      verdict,
      technicianName: verifiedTech.name,
      trucksCount: concreteTrucks.length
    });

    // 15. Generate Protocol PDF (Requirement R8)
    const protocolRecord = this.getProtocolById(protocolId)!;
    await this.pdfService.generateProtocolPdf({
      protocol: protocolRecord,
      checks: valResult.checks,
      technicianName: verifiedTech.name,
      technicianRole: verifiedTech.role,
      nonconformanceId: primaryNonconformanceId,
      lang
    });

    // 16. Mirror Protocol to Supabase Cloud if configured
    const savedTrucks = this.db.prepare(`SELECT * FROM concrete_trucks WHERE protocol_id = ?`).all(protocolId);
    const savedCylinders = this.db.prepare(`SELECT * FROM cylinders WHERE protocol_id = ?`).all(protocolId);
    const savedNcs = this.db.prepare(`SELECT * FROM nonconformances WHERE protocol_id = ?`).all(protocolId);
    SupabaseSyncService.pushProtocol(protocolRecord, savedTrucks, savedCylinders, savedNcs).catch(err => {
      console.warn('⚠️ [SUPABASE] Error guardando protocolo:', err.message);
    });

    const sigs = this.getProtocolSignatures(protocolId);
    const checkItems = this.getProtocolChecks(protocolId);

    return {
      protocol_id: protocolId,
      verdict,
      checks: valResult.checks,
      checks_items: checkItems,
      signatures: sigs,
      nonconformance_id: primaryNonconformanceId,
      pdf_url: `/api/protocols/${protocolId}/pdf`,
      pending
    };
  }

  /**
   * Records a deferred concrete cylinder compressive strength test (Contract 8.2).
   * Transitions PROVISIONAL_PASS -> PASS only when ALL 28-day cylinders across all trucks pass design f'c.
   */
  async recordCylinderResult(protocolId: string, result: CylinderResultRequest, lang: SupportedLanguage = 'es'): Promise<CylinderResultResponse> {
    const protocol = this.getProtocolById(protocolId);
    if (!protocol) {
      throw new Error(`PROTOCOL_NOT_FOUND: Protocolo ${protocolId} no encontrado.`);
    }

    if (protocol.activity !== 'CONCRETE') {
      throw new Error(`INVALID_ACTIVITY: Solo protocolos de CONCRETO admiten rotura de probetas.`);
    }

    // Locate target cylinder: by code if provided, otherwise first pending matching age_days
    let cylinder = this.db.prepare(`
      SELECT * FROM cylinders
      WHERE protocol_id = ? AND cylinder_code = ?
    `).get(protocolId, result.cylinder_code) as any;

    if (!cylinder) {
      cylinder = this.db.prepare(`
        SELECT * FROM cylinders
        WHERE protocol_id = ? AND age_days = ? AND status = 'PENDING'
        ORDER BY truck_number ASC, specimen_number ASC
        LIMIT 1
      `).get(protocolId, result.age_days) as any;
    }

    if (!cylinder) {
      throw new Error(`CYLINDER_NOT_FOUND: No se encontró probeta pendiente para edad ${result.age_days}d en protocolo ${protocolId}.`);
    }

    const designFc = cylinder.design_fc || 210;
    const passed = result.strength_kgcm2 >= designFc;
    const testDate = new Date().toISOString().split('T')[0];

    // Update cylinder record
    this.db.prepare(`
      UPDATE cylinders
      SET strength_kgcm2 = ?, lab = ?, report_photo_id = ?, test_date = ?, status = 'TESTED', verdict = ?
      WHERE id = ?
    `).run(
      result.strength_kgcm2,
      result.lab,
      result.report_photo_id || null,
      testDate,
      passed ? 'PASS' : 'FAIL',
      cylinder.id
    );

    let newProtocolVerdict: ProtocolVerdict = protocol.verdict;
    let nonconformanceId: string | null = null;

    // Evaluate 28-day break rules (the contractual compliance gate)
    if (result.age_days === 28) {
      if (!passed) {
        // Requirement R5: ANY 28-day cylinder below design f'c causes FAIL and opens NC
        newProtocolVerdict = 'FAIL';
        const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
        nonconformanceId = `NC-LAB-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

        this.db.prepare(`
          INSERT INTO nonconformances (
            id, protocol_id, truck_id, field, expected_value, actual_value, description, status
          ) VALUES (?, ?, ?, 'strength_kgcm2', ?, ?, ?, 'OPEN')
        `).run(
          nonconformanceId,
          protocolId,
          cylinder.truck_id || null,
          `>= ${designFc} kg/cm²`,
          `${result.strength_kgcm2} kg/cm²`,
          `Resistencia a 28 días (${result.strength_kgcm2} kg/cm²) inferior a f'c (${designFc} kg/cm²) para probeta ${cylinder.cylinder_code}`
        );

        this.db.prepare(`
          UPDATE protocols SET verdict = 'FAIL' WHERE id = ?
        `).run(protocolId);
      } else {
        // Check if ALL 28-day cylinders across all trucks are tested and passing
        const pending28d = this.db.prepare(`
          SELECT count(*) as count FROM cylinders
          WHERE protocol_id = ? AND age_days = 28 AND status = 'PENDING'
        `).get(protocolId) as { count: number };

        const failed28d = this.db.prepare(`
          SELECT count(*) as count FROM cylinders
          WHERE protocol_id = ? AND age_days = 28 AND verdict = 'FAIL'
        `).get(protocolId) as { count: number };

        if (pending28d.count === 0 && failed28d.count === 0) {
          newProtocolVerdict = 'PASS';
          this.db.prepare(`
            UPDATE protocols SET verdict = 'PASS' WHERE id = ?
          `).run(protocolId);
        }
      }
    }

    // Send WhatsApp notification for cylinder test result
    await this.notificationService.notifyCylinderResult({
      projectId: protocol.project_id,
      protocolId,
      cylinderCode: cylinder.cylinder_code,
      ageDays: result.age_days,
      strengthKgcm2: result.strength_kgcm2,
      designFc,
      verdict: passed ? 'PASS' : 'FAIL',
      nonconformanceId
    });

    // Re-generate updated protocol PDF with latest verdict and cylinder breakdown
    const tech = this.db.prepare(`SELECT name, role FROM technicians WHERE id = ?`).get(protocol.technician_id) as any;
    const val = this.validationService.validateMeasurements(protocol.project_id, protocol.activity, protocol.measurements);
    
    await this.pdfService.generateProtocolPdf({
      protocol: { ...protocol, verdict: newProtocolVerdict },
      checks: val.checks,
      technicianName: tech ? tech.name : 'Responsable de Campo',
      technicianRole: tech ? tech.role : 'Especialista',
      nonconformanceId,
      lang
    });

    // Mirror cylinder break update to Supabase Cloud if configured
    const updatedCyl = this.db.prepare(`SELECT * FROM cylinders WHERE id = ?`).get(cylinder.id);
    let createdNc = null;
    if (nonconformanceId) {
      createdNc = this.db.prepare(`SELECT * FROM nonconformances WHERE id = ?`).get(nonconformanceId);
    }
    SupabaseSyncService.pushCylinderResult(updatedCyl, newProtocolVerdict, createdNc).catch(err => {
      console.warn('⚠️ [SUPABASE] Error actualizando probeta:', err.message);
    });

    return {
      protocol_id: protocolId,
      cylinder_code: cylinder.cylinder_code,
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
        SELECT DISTINCT age_days FROM cylinders WHERE protocol_id = ? AND status = 'PENDING'
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

    const schedulesCount = this.db.prepare(`
      SELECT count(*) as count FROM protocol_schedules WHERE project_id = ?
    `).get(projectId) as { count: number };

    const totalExpected = Math.max(protocols.length, schedulesCount.count, 10);
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
      SELECT DISTINCT age_days FROM cylinders WHERE protocol_id = ? AND status = 'PENDING'
    `).all(protocol.id) as Array<{ age_days: number }>;

    const sigs = this.getProtocolSignatures(protocol.id);
    const checkItems = this.getProtocolChecks(protocol.id);

    return {
      protocol_id: protocol.id,
      verdict: protocol.verdict,
      checks: val.checks,
      checks_items: checkItems,
      signatures: sigs,
      nonconformance_id: openNc ? openNc.id : null,
      pdf_url: `/api/protocols/${protocol.id}/pdf`,
      pending: pendingCyl.map(c => `CYLINDER_${c.age_days}D`)
    };
  }

  /**
   * Retrieves all signatures in the 5-box grid for a protocol (F4, F8, F9).
   */
  getProtocolSignatures(protocolId: string): ProtocolSignatureRecord[] {
    return this.db.prepare(`
      SELECT * FROM signatures WHERE protocol_id = ? ORDER BY sign_order ASC
    `).all(protocolId) as ProtocolSignatureRecord[];
  }

  /**
   * Retrieves paper-format checklist items evaluated for a protocol (F1).
   */
  getProtocolChecks(protocolId: string): (ProtocolCheckItem & { item_text?: string; section?: string; item_order?: number })[] {
    return this.db.prepare(`
      SELECT pc.*, ct.item_text, ct.section, ct.item_order
      FROM protocol_checks pc
      LEFT JOIN checklist_templates ct ON pc.template_item_id = ct.id
      WHERE pc.protocol_id = ?
      ORDER BY ct.item_order ASC, pc.id ASC
    `).all(protocolId) as any[];
  }

  /**
   * Retrieves active checklist templates for project and optional activity.
   */
  getChecklistTemplates(projectId: string, activity?: string): ChecklistTemplateItem[] {
    if (activity) {
      return this.db.prepare(`
        SELECT * FROM checklist_templates
        WHERE project_id = ? AND activity = ? AND active = 1
        ORDER BY item_order ASC
      `).all(projectId, activity) as ChecklistTemplateItem[];
    }
    return this.db.prepare(`
      SELECT * FROM checklist_templates
      WHERE project_id = ? AND active = 1
      ORDER BY activity ASC, item_order ASC
    `).all(projectId) as ChecklistTemplateItem[];
  }

  /**
   * Signs a protocol box with user account PIN and stamp_key traceability (F4, F8, F9).
   */
  async signProtocol(protocolId: string, signRequest: SignProtocolRequest): Promise<ProtocolSignatureRecord> {
    const protocol = this.getProtocolById(protocolId);
    if (!protocol) {
      throw new Error(`PROTOCOL_NOT_FOUND: Protocolo ${protocolId} no encontrado.`);
    }

    const tech = this.db.prepare(`
      SELECT * FROM technicians WHERE id = ?
    `).get(signRequest.signatory_id) as any;

    if (!tech) {
      throw new Error(`TECHNICIAN_NOT_FOUND: Firmante con ID ${signRequest.signatory_id} no registrado en el proyecto.`);
    }

    const isPinValid = verifyPin(signRequest.pin, tech.pin_hash);
    if (!isPinValid) {
      throw new Error(`INVALID_PIN: El PIN ingresado no es válido para ${tech.name}.`);
    }

    let sigRecord = this.db.prepare(`
      SELECT * FROM signatures WHERE protocol_id = ? AND (signatory_id = ? OR signatory_name = ?)
    `).get(protocolId, tech.id, tech.name) as any;

    if (!sigRecord) {
      sigRecord = this.db.prepare(`
        SELECT * FROM signatures WHERE protocol_id = ? AND status = 'PENDING'
        ORDER BY sign_order ASC LIMIT 1
      `).get(protocolId) as any;
    }

    const now = new Date().toISOString();
    const sigKey = signRequest.signature_data ? `sig_${protocolId}_${tech.id}.png` : `sig_${tech.id}.png`;
    const stampKey = signRequest.stamp_data ? `stamp_${protocolId}_${tech.id}.png` : (tech.role.toLowerCase().includes('supervi') ? 'stamp_supervision.png' : 'stamp_ejecucion.png');

    if (sigRecord) {
      this.db.prepare(`
        UPDATE signatures
        SET signatory_id = ?, signatory_name = ?, cip_number = ?, status = 'SIGNED', signed_at = ?, signature_key = ?, stamp_key = ?
        WHERE id = ?
      `).run(
        tech.id,
        tech.name,
        tech.cip_number || sigRecord.cip_number,
        now,
        sigKey,
        stampKey,
        sigRecord.id
      );
    } else {
      const newSigId = `sig_${protocolId}_${Date.now()}`;
      this.db.prepare(`
        INSERT INTO signatures (
          id, protocol_id, signatory_id, signatory_name, role, sign_order, cip_number, status, signed_at, signature_key, stamp_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SIGNED', ?, ?, ?)
      `).run(
        newSigId,
        protocolId,
        tech.id,
        tech.name,
        tech.role,
        1,
        tech.cip_number || null,
        now,
        sigKey,
        stampKey
      );
    }

    // Re-generate PDF with newly placed signature
    try {
      const val = this.validationService.validateMeasurements(protocol.project_id, protocol.activity, protocol.measurements);
      await this.pdfService.generateProtocolPdf({
        protocol,
        checks: val.checks,
        technicianName: tech.name,
        technicianRole: tech.role
      });
    } catch (e) {
      console.warn('⚠️ PDF re-generation after signing notice:', e);
    }

    return this.db.prepare(`
      SELECT * FROM signatures WHERE protocol_id = ? AND signatory_id = ?
    `).get(protocolId, tech.id) as ProtocolSignatureRecord;
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
