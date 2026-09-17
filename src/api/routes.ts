import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { config } from '../config.js';
import { ProtocolService } from '../services/protocol.service.js';
import { PhotoService } from '../services/photo.service.js';
import { OverdueService } from '../services/overdue.service.js';
import { generateDeviceToken, hashPin, verifyPin } from '../services/integrity.service.js';
import { ProjectRecord, SupportedLanguage } from '../types.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit for mobile photos
});

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();
  const protocolService = new ProtocolService(db);
  const photoService = new PhotoService(db);
  const overdueService = new OverdueService(db);

  // ==========================================
  // CORE CONTRACT 1: POST /protocols (8.1)
  // ==========================================
  router.post('/protocols', async (req: Request, res: Response) => {
    try {
      const {
        project_id,
        device_token,
        technician_pin,
        activity,
        recorded_at,
        gps,
        panel,
        chainage,
        measurements,
        photo_ids,
        notes,
        idempotency_key,
        lang
      } = req.body;

      if (!project_id || !device_token || !technician_pin || !activity || !gps || !panel || !chainage || !measurements) {
        return res.status(400).json({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'Faltan campos obligatorios en el envío del protocolo.'
        });
      }

      const response = await protocolService.submitProtocol({
        project_id,
        device_token,
        technician_pin,
        activity,
        recorded_at,
        gps,
        panel,
        chainage,
        measurements,
        photo_ids,
        notes,
        idempotency_key
      }, (lang as SupportedLanguage) || 'es');

      return res.status(201).json(response);
    } catch (err: any) {
      if (err.message.includes('AUTH_FAILED')) {
        return res.status(401).json({ error: 'AUTH_FAILED', message: err.message });
      }
      if (err.message.includes('PROJECT_NOT_FOUND')) {
        return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: err.message });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // ==========================================
  // CORE CONTRACT 2: POST /protocols/:id/cylinder-result (8.2)
  // ==========================================
  router.post('/protocols/:id/cylinder-result', async (req: Request, res: Response) => {
    try {
      const protocolId = req.params.id as string;
      const { age_days, cylinder_code, strength_kgcm2, lab, report_photo_id, lang } = req.body;

      if (!age_days || strength_kgcm2 === undefined || !lab) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'age_days, strength_kgcm2 y lab son requeridos.'
        });
      }

      const response = await protocolService.recordCylinderResult(protocolId, {
        age_days: parseInt(String(age_days), 10),
        cylinder_code: cylinder_code || '',
        strength_kgcm2: parseFloat(String(strength_kgcm2)),
        lab,
        report_photo_id
      }, (lang as SupportedLanguage) || 'es');

      return res.status(200).json(response);
    } catch (err: any) {
      if (err.message.includes('NOT_FOUND')) {
        return res.status(404).json({ error: 'NOT_FOUND', message: err.message });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // ==========================================
  // CORE CONTRACT 3: GET /projects/:id/status (8.3)
  // ==========================================
  router.get('/projects/:id/status', (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const status = protocolService.getProjectStatus(projectId);
      return res.status(200).json(status);
    } catch (err: any) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // ==========================================
  // CORE CONTRACT 4: GET /projects/:id/dossier (8.4)
  // ==========================================
  router.get('/projects/:id/dossier', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const dossier = await protocolService.getProjectDossier(projectId);
      return res.status(200).json(dossier);
    } catch (err: any) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // ==========================================
  // PROJECT LIFECYCLE & CONFIGURATION ENDPOINTS
  // ==========================================

  // List all configured projects
  router.get('/projects', (req: Request, res: Response) => {
    try {
      const projects = db.prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all();
      return res.status(200).json(projects);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Get project by ID
  router.get('/projects/:id', (req: Request, res: Response) => {
    try {
      const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id as string);
      if (!project) {
        return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: `Proyecto ${req.params.id} no encontrado.` });
      }
      return res.status(200).json(project);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Create a new Project with dynamic configuration
  router.post('/projects', (req: Request, res: Response) => {
    try {
      const {
        id,
        name,
        contract_number,
        entity,
        execution_mode,
        location,
        road_section,
        timezone,
        timezone_offset,
        whatsapp_recipients,
        sampling_basis,
        cylinders_per_truck,
        default_design_fc,
        criteria,
        technicians
      } = req.body;

      // Validate required project information
      if (!id || !name || !contract_number || !entity || !execution_mode) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'id, name, contract_number, entity, y execution_mode son obligatorios.'
        });
      }

      if (cylinders_per_truck !== undefined && (isNaN(Number(cylinders_per_truck)) || Number(cylinders_per_truck) < 1)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'cylinders_per_truck debe ser un número entero mayor o igual a 1.'
        });
      }

      // Check for existing project
      const existing = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(id);
      if (existing) {
        return res.status(409).json({
          error: 'PROJECT_ALREADY_EXISTS',
          message: `El proyecto con ID ${id} ya está registrado.`
        });
      }

      // Insert Project record
      db.prepare(`
        INSERT INTO projects (
          id, name, contract_number, entity, execution_mode,
          location, road_section, timezone, timezone_offset,
          whatsapp_recipients, sampling_basis, cylinders_per_truck, default_design_fc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        contract_number,
        entity,
        execution_mode,
        location || '',
        road_section || '',
        timezone || 'America/Lima',
        timezone_offset || '-05:00',
        whatsapp_recipients || '',
        sampling_basis || 'PER_TRUCK',
        cylinders_per_truck ? parseInt(String(cylinders_per_truck), 10) : 4,
        default_design_fc ? parseFloat(String(default_design_fc)) : 210
      );

      // Insert custom criteria if provided
      if (Array.isArray(criteria) && criteria.length > 0) {
        const insertCrit = db.prepare(`
          INSERT INTO criteria (id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const c of criteria) {
          const critId = `crit_${id}_${c.activity.toLowerCase()}_${c.field}`;
          insertCrit.run(
            critId,
            id,
            c.activity,
            c.field,
            c.operator,
            c.min_value !== undefined ? c.min_value : null,
            c.max_value !== undefined ? c.max_value : null,
            c.expected_value || null,
            c.unit || null,
            c.source_reference || 'Expediente Técnico',
            c.is_active !== undefined ? c.is_active : 1
          );
        }
      }

      // Insert initial technicians if provided
      if (Array.isArray(technicians) && technicians.length > 0) {
        const insertTech = db.prepare(`
          INSERT INTO technicians (id, project_id, name, pin_hash, device_token, whatsapp, role, cip_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of technicians) {
          const techId = t.id || `tech_${id}_${crypto.randomBytes(4).toString('hex')}`;
          const deviceToken = t.device_token || generateDeviceToken();
          const pinHash = hashPin(t.pin || '1234');
          insertTech.run(
            techId,
            id,
            t.name,
            pinHash,
            deviceToken,
            t.whatsapp || '',
            t.role || 'Quality Specialist',
            t.cip_number || null
          );
        }
      }

      const created = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
      return res.status(201).json(created);
    } catch (err: any) {
      return res.status(500).json({ error: 'CREATE_FAILED', message: err.message });
    }
  });

  // Update Project Configuration
  router.patch('/projects/:id', (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const existing = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
      }

      const {
        name,
        contract_number,
        entity,
        execution_mode,
        location,
        road_section,
        timezone,
        timezone_offset,
        whatsapp_recipients,
        sampling_basis,
        cylinders_per_truck,
        default_design_fc
      } = req.body;

      db.prepare(`
        UPDATE projects
        SET name = ?, contract_number = ?, entity = ?, execution_mode = ?,
            location = ?, road_section = ?, timezone = ?, timezone_offset = ?,
            whatsapp_recipients = ?, sampling_basis = ?, cylinders_per_truck = ?, default_design_fc = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        name !== undefined ? name : existing.name,
        contract_number !== undefined ? contract_number : existing.contract_number,
        entity !== undefined ? entity : existing.entity,
        execution_mode !== undefined ? execution_mode : existing.execution_mode,
        location !== undefined ? location : existing.location,
        road_section !== undefined ? road_section : existing.road_section,
        timezone !== undefined ? timezone : existing.timezone,
        timezone_offset !== undefined ? timezone_offset : existing.timezone_offset,
        whatsapp_recipients !== undefined ? whatsapp_recipients : existing.whatsapp_recipients,
        sampling_basis !== undefined ? sampling_basis : existing.sampling_basis,
        cylinders_per_truck !== undefined ? parseInt(String(cylinders_per_truck), 10) : existing.cylinders_per_truck,
        default_design_fc !== undefined ? parseFloat(String(default_design_fc)) : existing.default_design_fc,
        projectId
      );

      const updated = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
      return res.status(200).json(updated);
    } catch (err: any) {
      return res.status(500).json({ error: 'UPDATE_FAILED', message: err.message });
    }
  });

  // Project Criteria Endpoints
  router.get('/projects/:id/criteria', (req: Request, res: Response) => {
    const stmt = db.prepare(`
      SELECT id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference, is_active
      FROM criteria
      WHERE project_id = ? AND is_active = 1
    `);
    const criteria = stmt.all(req.params.id as string);
    return res.status(200).json(criteria);
  });

  router.post('/projects/:id/criteria', (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const { activity, field, operator, min_value, max_value, expected_value, unit, source_reference } = req.body;

      if (!activity || !field || !operator) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'activity, field, and operator are required.' });
      }

      const critId = `crit_${projectId}_${activity.toLowerCase()}_${field}`;
      db.prepare(`
        INSERT OR REPLACE INTO criteria (id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        critId,
        projectId,
        activity,
        field,
        operator,
        min_value !== undefined ? min_value : null,
        max_value !== undefined ? max_value : null,
        expected_value || null,
        unit || null,
        source_reference || 'Configuración de Proyecto'
      );

      return res.status(201).json({ success: true, id: critId });
    } catch (err: any) {
      return res.status(500).json({ error: 'CRITERIA_SAVE_FAILED', message: err.message });
    }
  });

  router.patch('/projects/:id/criteria/:critId', (req: Request, res: Response) => {
    try {
      const critId = req.params.critId as string;
      const { min_value, max_value, expected_value, operator, unit, is_active } = req.body;

      const existing = db.prepare(`SELECT * FROM criteria WHERE id = ?`).get(critId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'CRITERION_NOT_FOUND' });
      }

      db.prepare(`
        UPDATE criteria
        SET min_value = ?, max_value = ?, expected_value = ?, operator = ?, unit = ?, is_active = ?
        WHERE id = ?
      `).run(
        min_value !== undefined ? min_value : existing.min_value,
        max_value !== undefined ? max_value : existing.max_value,
        expected_value !== undefined ? expected_value : existing.expected_value,
        operator !== undefined ? operator : existing.operator,
        unit !== undefined ? unit : existing.unit,
        is_active !== undefined ? is_active : existing.is_active,
        critId
      );

      return res.status(200).json({ success: true, id: critId });
    } catch (err: any) {
      return res.status(500).json({ error: 'CRITERIA_UPDATE_FAILED', message: err.message });
    }
  });

  // Project Technicians Endpoints
  router.get('/projects/:id/technicians', (req: Request, res: Response) => {
    try {
      const techs = db.prepare(`
        SELECT id, project_id, name, device_token, whatsapp, role, cip_number, created_at
        FROM technicians
        WHERE project_id = ?
        ORDER BY role ASC, name ASC
      `).all(req.params.id as string);
      return res.status(200).json(techs);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  router.post('/projects/:id/technicians', (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const { name, role, pin, device_token, whatsapp, cip_number } = req.body;

      if (!name || !role || !pin) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name, role y pin son obligatorios.' });
      }

      const techId = `tech_${projectId}_${crypto.randomBytes(4).toString('hex')}`;
      const token = device_token || generateDeviceToken();
      const pinHash = hashPin(pin);

      db.prepare(`
        INSERT INTO technicians (id, project_id, name, pin_hash, device_token, whatsapp, role, cip_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(techId, projectId, name, pinHash, token, whatsapp || '', role, cip_number || null);

      return res.status(201).json({
        id: techId,
        project_id: projectId,
        name,
        role,
        device_token: token,
        whatsapp: whatsapp || '',
        cip_number: cip_number || null
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'TECH_CREATE_FAILED', message: err.message });
    }
  });

  // Protocols query for trucks and cylinders
  router.get('/protocols/:id/trucks', (req: Request, res: Response) => {
    const trucks = db.prepare(`SELECT * FROM concrete_trucks WHERE protocol_id = ? ORDER BY truck_number ASC`).all(req.params.id as string);
    return res.status(200).json(trucks);
  });

  router.get('/protocols/:id/cylinders', (req: Request, res: Response) => {
    const cylinders = db.prepare(`SELECT * FROM cylinders WHERE protocol_id = ? ORDER BY truck_number ASC, age_days ASC`).all(req.params.id as string);
    return res.status(200).json(cylinders);
  });

  // ==========================================
  // SUPPORTING ENDPOINTS: Photos, Files & Auth
  // ==========================================

  // Upload Photo (Opaque ID & Hash)
  router.post('/photos', upload.single('photo'), (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'NO_FILE', message: 'No se envió archivo fotográfico.' });
      }

      const gpsLat = req.body.gps_lat ? parseFloat(req.body.gps_lat) : null;
      const gpsLng = req.body.gps_lng ? parseFloat(req.body.gps_lng) : null;
      const capturedAt = req.body.captured_at || new Date().toISOString();

      const photoRecord = photoService.savePhoto({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype || 'image/jpeg',
        gpsLat,
        gpsLng,
        capturedAt
      });

      return res.status(201).json({
        photo_id: photoRecord.id,
        file_hash: photoRecord.file_hash,
        captured_at: photoRecord.captured_at,
        url: `/api/photos/${photoRecord.id}`
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'UPLOAD_FAILED', message: err.message });
    }
  });

  // Serve Photo by Opaque ID
  router.get('/photos/:id', (req: Request, res: Response) => {
    const photo = photoService.getPhoto(req.params.id as string);
    if (!photo) {
      return res.status(404).json({ error: 'PHOTO_NOT_FOUND' });
    }

    const absPath = photoService.getPhotoAbsolutePath(photo);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'FILE_MISSING_ON_DISK' });
    }

    res.setHeader('Content-Type', photo.mime_type);
    return res.sendFile(absPath);
  });

  // Serve Protocol PDF Certificate
  router.get('/protocols/:id/pdf', (req: Request, res: Response) => {
    const filename = `${req.params.id as string}.pdf`;
    const absPath = path.join(config.pdfDir, filename);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'PDF_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.sendFile(absPath);
  });

  // Serve Compiled Quality Dossier PDF
  router.get('/projects/:id/dossier.pdf', (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    const files = fs.readdirSync(config.dossierDir)
      .filter(f => f.startsWith(`${projectId}-dossier`) && f.endsWith('.pdf'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return res.status(404).json({ error: 'DOSSIER_NOT_GENERATED' });
    }

    const absPath = path.join(config.dossierDir, files[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${files[0]}"`);
    return res.sendFile(absPath);
  });

  // Register Device Token
  router.post('/devices/register', (req: Request, res: Response) => {
    const token = generateDeviceToken();
    return res.status(200).json({ device_token: token });
  });

  // Verify Technician PIN for Field Login
  router.post('/technicians/verify-pin', (req: Request, res: Response) => {
    const { project_id, pin } = req.body;
    if (!project_id || !pin) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    const techs = db.prepare(`
      SELECT id, name, role, pin_hash, device_token FROM technicians WHERE project_id = ?
    `).all(project_id) as any[];

    const matched = techs.find(t => verifyPin(pin, t.pin_hash));
    if (!matched) {
      return res.status(401).json({ error: 'INVALID_PIN', message: 'PIN incorrecto.' });
    }

    return res.status(200).json({
      technician_id: matched.id,
      name: matched.name,
      role: matched.role,
      device_token: matched.device_token
    });
  });

  // Close Non-Conformance
  router.patch('/nonconformances/:id/close', (req: Request, res: Response) => {
    try {
      const { corrective_action, technician_id } = req.body;
      if (!corrective_action || !technician_id) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Acción correctiva y técnico requeridos.' });
      }

      protocolService.closeNonConformance(req.params.id as string, corrective_action, technician_id);
      return res.status(200).json({ success: true, message: 'No Conformidad cerrada exitosamente.' });
    } catch (err: any) {
      return res.status(400).json({ error: 'CLOSE_FAILED', message: err.message });
    }
  });

  // Manual or Cron check for overdue activities (R10)
  router.post('/schedules/check-overdue', async (req: Request, res: Response) => {
    try {
      const notified = await overdueService.checkOverdueProtocols();
      return res.status(200).json({ success: true, notified_count: notified });
    } catch (err: any) {
      return res.status(500).json({ error: 'OVERDUE_CHECK_FAILED', message: err.message });
    }
  });

  return router;
}
