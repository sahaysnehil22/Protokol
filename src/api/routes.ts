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
import { SupabaseSyncService } from '../services/supabase_sync.service.js';
import { ProjectRecord, SupportedLanguage } from '../types.js';
import {
  requireAuth,
  assertProjectAccess,
  getSession,
  authLimiter,
  writeLimiter,
} from './auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit for mobile photos
});

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();
  const protocolService = new ProtocolService(db);
  const photoService = new PhotoService(db);
  const overdueService = new OverdueService(db);
  const auth = requireAuth(db);
  // For routes where :id IS a project id: session must belong to that project.
  const requireProject = (req: Request, res: Response, next: any) => {
    const s = (req as any).session;
    if (!s || s.project_id !== (req.params.id as string)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Su sesión no tiene acceso a este proyecto.' });
    }
    next();
  };
  // S-1: resolve a protocol id to its project, 404 when unknown.
  // Returns null after responding (caller must `return`).
  const scopedProtocol = (req: Request, res: Response): string | null => {
    const row = db.prepare(`SELECT project_id FROM protocols WHERE id = ?`)
      .get(req.params.id as string) as any;
    if (!row) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Protocolo no encontrado.' });
      return null;
    }
    if (!assertProjectAccess(db, req, res, row.project_id)) return null;
    return row.project_id;
  };

  // ==========================================
  // CORE CONTRACT 1: POST /protocols (8.1)
  // ==========================================
  router.post('/protocols', auth, writeLimiter, async (req: Request, res: Response) => {
    try {
      const {
        project_id,
        device_token,
        technician_id,
        activity,
        recorded_at,
        gps,
        panel,
        chainage,
        measurements,
        photo_ids,
        checks,
        notes,
        idempotency_key,
        lang
      } = req.body;

      if (!project_id || !device_token || !activity || !gps || !panel || !chainage || !measurements) {
        return res.status(400).json({
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'Faltan campos obligatorios en el envío del protocolo.'
        });
      }

      // S-1: the session (project PIN verified) is the auth; technician_pin is
      // no longer accepted in the payload (C-01: it was hardcoded '1234').
      // technician_id identifies the submitter for box-1 auto-sign.
      if (!assertProjectAccess(db, req, res, project_id)) return;

      // Idempotent retry: if this idempotency key already sealed a protocol,
      // return it with 200 (not 201) — the client learns it was a duplicate.
      if (idempotency_key) {
        const dup = db.prepare(`SELECT id FROM protocols WHERE idempotency_key = ?`).get(idempotency_key) as any;
        if (dup) {
          const response = await protocolService.submitProtocol({
            project_id,
            device_token: ((req as any).session?.device_token as string) || device_token,
            technician_id,
            activity,
            recorded_at,
            gps,
            panel,
            chainage,
            measurements,
            photo_ids,
            checks,
            notes,
            idempotency_key
          }, (lang as SupportedLanguage) || 'es');
          return res.status(200).json(response);
        }
      }

      const response = await protocolService.submitProtocol({
        project_id,
        device_token: ((req as any).session?.device_token as string) || device_token,
        technician_id,
        activity,
        recorded_at,
        gps,
        panel,
        chainage,
        measurements,
        photo_ids,
        checks,
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
  router.post('/protocols/:id/cylinder-result', auth, writeLimiter, async (req: Request, res: Response) => {
    try {
      const protocolId = req.params.id as string;
      const { age_days, cylinder_code, strength_kgcm2, lab, report_photo_id, lang } = req.body;

      if (!age_days || strength_kgcm2 === undefined || !lab) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'age_days, strength_kgcm2 y lab son requeridos.'
        });
      }

      // S-1: scope the protocol to the session's project (IDOR protection)
      const proto = db.prepare(`SELECT project_id FROM protocols WHERE id = ?`).get(protocolId) as any;
      if (!proto) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Protocolo no encontrado.' });
      }
      if (!assertProjectAccess(db, req, res, proto.project_id)) return;

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
      // H-02: finalized verdicts reject lab results with 409, not a 500.
      if (err.message.includes('VERDICT_FINALIZED')) {
        return res.status(409).json({ error: 'VERDICT_FINALIZED', message: err.message });
      }
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // ==========================================
  // CORE CONTRACT 3: GET /projects/:id/status (8.3)
  // ==========================================
  router.get('/projects/:id/status', auth, requireProject, (req: Request, res: Response) => {
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
  router.get('/projects/:id/dossier', auth, requireProject, async (req: Request, res: Response) => {
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
      // Public minimal list (pre-login project picker). Sensitive columns
      // (whatsapp_recipients, PIN hashes, lockout state) are never exposed.
      // ?scope=mine&device_token=… → only owned/joined, non-archived projects.
      // ?archived=true → archived only (dashboard "archived" section).
      const scope = req.query.scope as string | undefined;
      const deviceToken = req.query.device_token as string | undefined;
      const archived = req.query.archived === 'true';

      let rows: any[];
      if (scope === 'mine' && deviceToken) {
        rows = db.prepare(`
          SELECT id, name, entity, location, road_section, is_archived, archived_at, created_at
          FROM projects
          WHERE is_archived = ? AND (
            owner_device_token = ? OR owner_device_token IS NULL OR id IN (
              SELECT project_id FROM project_members WHERE device_token = ?
            )
          )
          ORDER BY created_at DESC
        `).all(archived ? 1 : 0, deviceToken, deviceToken) as any[];
      } else {
        rows = db.prepare(`
          SELECT id, name, entity, location, road_section, is_archived, archived_at, created_at
          FROM projects WHERE is_archived = ? ORDER BY created_at DESC
        `).all(archived ? 1 : 0) as any[];
      }
      return res.status(200).json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Get project by ID — tiered: public callers get a safe subset (enough for
  // the pre-login picker); the full row requires a session for that project.
  router.get('/projects/:id', (req: Request, res: Response) => {
    try {
      const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id as string) as any;
      if (!project) {
        return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: `Proyecto ${req.params.id} no encontrado.` });
      }
      const s = getSession(db, (req as any).cookies?.['protokol_session']);
      if (!s || s.project_id !== project.id) {
        const { id, name, entity, location, road_section, is_archived, created_at } = project;
        return res.status(200).json({ id, name, entity, location, road_section, is_archived, created_at });
      }
      const { access_pin_hash, pin_attempts, pin_locked_until, ...safe } = project;
      return res.status(200).json(safe);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Archive / restore a project. Archive NEVER deletes data — it only hides
  // the project from the default dashboard (user requirement 2026-10-03).
  router.patch('/projects/:id/archive', auth, (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    if (!assertProjectAccess(db, req, res, projectId)) return;
    db.prepare(`UPDATE projects SET is_archived = 1, archived_at = datetime('now') WHERE id = ?`).run(projectId);
    return res.status(200).json({ ok: true, archived: true });
  });

  router.patch('/projects/:id/restore', auth, (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    if (!assertProjectAccess(db, req, res, projectId)) return;
    db.prepare(`UPDATE projects SET is_archived = 0, archived_at = NULL WHERE id = ?`).run(projectId);
    return res.status(200).json({ ok: true, archived: false });
  });

  // Create a new Project with dynamic configuration
  router.post('/projects', writeLimiter, (req: Request, res: Response) => {
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
        technicians,
        access_pin,
        device_token: bodyDeviceToken
      } = req.body;

      // Validate required project information
      if (!id || !name || !contract_number || !entity || !execution_mode) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'id, name, contract_number, entity, y execution_mode son obligatorios.'
        });
      }

      // S-5: project ids end up in filenames/paths — keep them inert.
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id))) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'id del proyecto: solo letras, números, guiones y guion bajo (máx. 64).'
        });
      }

      // Two-tier auth (2026-10-03): every project MUST have a centralized access
      // PIN, set once by the company at creation. No employee change-password.
      if (!access_pin || String(access_pin).length < 4) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'access_pin (mínimo 4 caracteres) es obligatorio: es la clave centralizada del proyecto.'
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

      // Insert Project record (with centralized access PIN + owner device)
      const ownerDeviceToken =
        (req.headers['x-device-token'] as string) || bodyDeviceToken || null;
      db.prepare(`
        INSERT INTO projects (
          id, name, contract_number, entity, execution_mode,
          location, road_section, timezone, timezone_offset,
          whatsapp_recipients, sampling_basis, cylinders_per_truck, default_design_fc,
          access_pin_hash, owner_device_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        default_design_fc ? parseFloat(String(default_design_fc)) : 210,
        hashPin(String(access_pin)),
        ownerDeviceToken
      );

      // Insert custom criteria if provided
      if (Array.isArray(criteria) && criteria.length > 0) {
        const insertCrit = db.prepare(`
          INSERT INTO criteria (id, project_id, activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            c.allowed_values ? (typeof c.allowed_values === 'string' ? c.allowed_values : JSON.stringify(c.allowed_values)) : null,
            c.expected_value || null,
            c.unit || null,
            c.source_reference || 'Expediente Técnico',
            c.hold_point ? 1 : 0,
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

      // Mirror to Supabase Cloud if configured
      const savedCriteria = db.prepare(`SELECT * FROM criteria WHERE project_id = ?`).all(id);
      const savedTechs = db.prepare(`SELECT * FROM technicians WHERE project_id = ?`).all(id);
      SupabaseSyncService.pushProject(created, savedCriteria, savedTechs).catch(err => {
        console.warn('⚠️ [SUPABASE] Error guardando proyecto:', err.message);
      });

      return res.status(201).json(created);
    } catch (err: any) {
      return res.status(500).json({ error: 'CREATE_FAILED', message: err.message });
    }
  });

  // Update Project Configuration
  router.patch('/projects/:id', auth, requireProject, (req: Request, res: Response) => {
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
  router.get('/projects/:id/criteria', auth, requireProject, (req: Request, res: Response) => {
    const stmt = db.prepare(`
      SELECT id, project_id, activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point, is_active
      FROM criteria
      WHERE project_id = ? AND is_active = 1
    `);
    const criteria = stmt.all(req.params.id as string);
    return res.status(200).json(criteria);
  });

  router.post('/projects/:id/criteria', auth, requireProject, (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const { activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point } = req.body;

      if (!activity || !field || !operator) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'activity, field, and operator are required.' });
      }

      const critId = `crit_${projectId}_${activity.toLowerCase()}_${field}`;
      db.prepare(`
        INSERT OR REPLACE INTO criteria (id, project_id, activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        critId,
        projectId,
        activity,
        field,
        operator,
        min_value !== undefined ? min_value : null,
        max_value !== undefined ? max_value : null,
        allowed_values !== undefined ? (typeof allowed_values === 'string' ? allowed_values : JSON.stringify(allowed_values)) : null,
        expected_value || null,
        unit || null,
        source_reference || 'Configuración de Proyecto',
        hold_point ? 1 : 0
      );

      return res.status(201).json({ success: true, id: critId });
    } catch (err: any) {
      return res.status(500).json({ error: 'CRITERIA_SAVE_FAILED', message: err.message });
    }
  });

  router.patch('/projects/:id/criteria/:critId', auth, requireProject, (req: Request, res: Response) => {
    try {
      const critId = req.params.critId as string;
      const { min_value, max_value, allowed_values, expected_value, operator, unit, hold_point, is_active } = req.body;

      const existing = db.prepare(`SELECT * FROM criteria WHERE id = ?`).get(critId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'CRITERION_NOT_FOUND' });
      }

      db.prepare(`
        UPDATE criteria
        SET min_value = ?, max_value = ?, allowed_values = ?, expected_value = ?, operator = ?, unit = ?, hold_point = ?, is_active = ?
        WHERE id = ?
      `).run(
        min_value !== undefined ? min_value : existing.min_value,
        max_value !== undefined ? max_value : existing.max_value,
        allowed_values !== undefined ? (typeof allowed_values === 'string' ? allowed_values : JSON.stringify(allowed_values)) : existing.allowed_values,
        expected_value !== undefined ? expected_value : existing.expected_value,
        operator !== undefined ? operator : existing.operator,
        unit !== undefined ? unit : existing.unit,
        hold_point !== undefined ? (hold_point ? 1 : 0) : existing.hold_point,
        is_active !== undefined ? is_active : existing.is_active,
        critId
      );

      return res.status(200).json({ success: true, id: critId });
    } catch (err: any) {
      return res.status(500).json({ error: 'CRITERIA_UPDATE_FAILED', message: err.message });
    }
  });

  // Project Technicians Endpoints
  // Technician roster — tiered: the pre-login identity picker needs names/roles,
  // but whatsapp/device_token stay behind the session.
  router.get('/projects/:id/technicians', (req: Request, res: Response) => {
    try {
      const techs = db.prepare(`
        SELECT id, project_id, name, device_token, whatsapp, role, cip_number, created_at
        FROM technicians
        WHERE project_id = ?
        ORDER BY role ASC, name ASC
      `).all(req.params.id as string) as any[];
      const s = getSession(db, (req as any).cookies?.['protokol_session']);
      if (!s || s.project_id !== req.params.id) {
        return res.status(200).json(
          techs.map(t => ({ id: t.id, name: t.name, role: t.role, cip_number: t.cip_number }))
        );
      }
      return res.status(200).json(techs);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  router.post('/projects/:id/technicians', auth, requireProject, (req: Request, res: Response) => {
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
  router.get('/protocols/:id/trucks', auth, (req: Request, res: Response) => {
    if (!scopedProtocol(req, res)) return;
    const trucks = db.prepare(`SELECT * FROM concrete_trucks WHERE protocol_id = ? ORDER BY truck_number ASC`).all(req.params.id as string);
    return res.status(200).json(trucks);
  });

  router.get('/protocols/:id/cylinders', auth, (req: Request, res: Response) => {
    if (!scopedProtocol(req, res)) return;
    const cylinders = db.prepare(`SELECT * FROM cylinders WHERE protocol_id = ? ORDER BY truck_number ASC, age_days ASC`).all(req.params.id as string);
    return res.status(200).json(cylinders);
  });

  // Checklist templates endpoint (§3.6 / F1)
  router.get('/projects/:id/checklist-templates', auth, requireProject, (req: Request, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const activity = req.query.activity as string | undefined;
      const templates = protocolService.getChecklistTemplates(projectId, activity);
      return res.status(200).json(templates);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Protocol checks endpoint (F1)
  router.get('/protocols/:id/checks', auth, (req: Request, res: Response) => {
    if (!scopedProtocol(req, res)) return;
    try {
      const checks = protocolService.getProtocolChecks(req.params.id as string);
      return res.status(200).json(checks);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Protocol signatures endpoint (F4, F8, F9)
  router.get('/protocols/:id/signatures', auth, (req: Request, res: Response) => {
    if (!scopedProtocol(req, res)) return;
    try {
      const sigs = protocolService.getProtocolSignatures(req.params.id as string);
      return res.status(200).json(sigs);
    } catch (err: any) {
      return res.status(500).json({ error: 'DB_ERROR', message: err.message });
    }
  });

  // Protocol sign endpoint (F4, F8, F9)
  router.post('/protocols/:id/sign', auth, authLimiter, async (req: Request, res: Response) => {
    if (!scopedProtocol(req, res)) return;
    try {
      const protocolId = req.params.id as string;
      const { signatory_id, pin, signature_data, stamp_data } = req.body;

      if (!signatory_id || !pin) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'signatory_id y pin son requeridos para firmar el protocolo.'
        });
      }

      const sigRecord = await protocolService.signProtocol(protocolId, {
        signatory_id,
        pin,
        signature_data,
        stamp_data
      });

      return res.status(200).json({
        success: true,
        ...sigRecord,
        signature: sigRecord
      });
    } catch (err: any) {
      if (err.message.includes('INVALID_PIN')) {
        return res.status(401).json({ error: 'INVALID_PIN', message: err.message });
      }
      if (err.message.includes('NOT_FOUND')) {
        return res.status(404).json({ error: 'NOT_FOUND', message: err.message });
      }
      return res.status(500).json({ error: 'SIGN_ERROR', message: err.message });
    }
  });

  // ==========================================
  // SUPPORTING ENDPOINTS: Photos, Files & Auth
  // ==========================================

  // Upload Photo (Opaque ID & Hash)
  router.post('/photos', auth, writeLimiter, upload.single('photo'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'NO_FILE', message: 'No se envió archivo fotográfico.' });
      }

      const gpsLat = req.body.gps_lat ? parseFloat(req.body.gps_lat) : null;
      const gpsLng = req.body.gps_lng ? parseFloat(req.body.gps_lng) : null;
      const capturedAt = req.body.captured_at || new Date().toISOString();

      const photoRecord = await photoService.savePhoto({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype || 'image/jpeg',
        gpsLat,
        gpsLng,
        capturedAt,
        projectId: (req as any).session.project_id,
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

  // R-6: maintenance — sweep orphan photo evidence (uploaded, never linked).
  router.post('/maintenance/sweep-orphan-photos', auth, async (req: Request, res: Response) => {
    try {
      const hours = Math.min(Math.max(parseInt(String(req.body?.older_than_hours || '24'), 10) || 24, 1), 720);
      const result = await photoService.sweepOrphanPhotos(hours);
      return res.status(200).json({ ok: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: 'SWEEP_FAILED', message: err.message });
    }
  });

  // Serve Photo by Opaque ID
  router.get('/photos/:id', auth, async (req: Request, res: Response) => {
    const photo = photoService.getPhoto(req.params.id as string);
    if (!photo) {
      return res.status(404).json({ error: 'PHOTO_NOT_FOUND' });
    }
    // S-1: a photo is readable only within its project. Legacy photos without
    // project_id fall back to their protocol's project (or 403 when unlinked).
    const s = (req as any).session;
    let photoProject: string | null = (photo as any).project_id || null;
    if (!photoProject && photo.protocol_id) {
      const prow = db.prepare(`SELECT project_id FROM protocols WHERE id = ?`).get(photo.protocol_id) as any;
      photoProject = prow ? prow.project_id : null;
    }
    if (!photoProject || photoProject !== s.project_id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Su sesión no tiene acceso a esta evidencia.' });
    }

    try {
      const buffer = await photoService.getPhotoBuffer(photo);
      res.setHeader('Content-Type', photo.mime_type);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    } catch (err: any) {
      return res.status(404).json({ error: 'FILE_MISSING', message: err.message });
    }
  });

  // Serve Protocol PDF Certificate
  // S-5: strict id allowlist (path traversal hardening) + session scoping.
  router.get('/protocols/:id/pdf', auth, (req: Request, res: Response) => {
    const rawId = req.params.id as string;
    if (!/^[A-Za-z0-9_-]+$/.test(rawId)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }
    if (!scopedProtocol(req, res)) return;
    const filename = `${rawId}.pdf`;
    const absPath = path.join(config.pdfDir, filename);

    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'PDF_NOT_FOUND' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.sendFile(absPath);
  });

  // Serve Compiled Quality Dossier PDF
  router.get('/projects/:id/dossier.pdf', auth, requireProject, (req: Request, res: Response) => {
    const projectId = req.params.id as string;
    // S-5: project ids are user-supplied at creation; never let one shape a path.
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
      return res.status(400).json({ error: 'INVALID_ID' });
    }
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
  router.post('/devices/register', writeLimiter, (req: Request, res: Response) => {
    const token = generateDeviceToken();
    return res.status(200).json({ device_token: token });
  });

  // Verify Technician PIN for Field Login
  router.post('/technicians/verify-pin', authLimiter, (req: Request, res: Response) => {
    const { project_id, pin, technician_id } = req.body;
    if (!project_id || !pin) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    let techs = db.prepare(`
      SELECT id, name, role, pin_hash, device_token FROM technicians WHERE project_id = ?
    `).all(project_id) as any[];

    if (technician_id) {
      techs = techs.filter(t => t.id === technician_id);
    }

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
  // D-08 (2026-10-03): closing an NC is a legal acceptance act. Requires the
  // session (project PIN verified) PLUS the signer's personal PIN and a
  // supervision/resident role. Previously: zero auth.
  router.patch('/nonconformances/:id/close', auth, authLimiter, (req: Request, res: Response) => {
    try {
      const { corrective_action, signer_id, signer_pin } = req.body;
      if (!corrective_action || !signer_id || !signer_pin) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Acción correctiva, firmante y PIN personal requeridos.' });
      }

      const nc = db.prepare(`SELECT * FROM nonconformances WHERE id = ?`).get(req.params.id as string) as any;
      if (!nc) {
        return res.status(404).json({ error: 'NC_NOT_FOUND', message: 'No conformidad no encontrada.' });
      }
      const proto = db.prepare(`SELECT project_id FROM protocols WHERE id = ?`).get(nc.protocol_id) as any;
      if (!proto || !assertProjectAccess(db, req, res, proto.project_id)) return;

      const signer = db.prepare(`SELECT * FROM technicians WHERE id = ? AND project_id = ?`)
        .get(signer_id, proto.project_id) as any;
      if (!signer) {
        return res.status(404).json({ error: 'SIGNER_NOT_FOUND', message: 'Firmante no pertenece al proyecto.' });
      }
      let pinOk = false;
      try { pinOk = verifyPin(String(signer_pin), signer.pin_hash); } catch { pinOk = false; }
      if (!pinOk) {
        return res.status(401).json({ error: 'INVALID_PIN', message: 'PIN personal incorrecto.' });
      }
      const role = String(signer.role || '').toLowerCase();
      const authorized = role.includes('supervis') || role.includes('resident') || role.includes('quality');
      if (!authorized) {
        return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Solo supervisión, residencia o calidad pueden cerrar NCs.' });
      }

      protocolService.closeNonConformance(req.params.id as string, corrective_action, signer_id);
      return res.status(200).json({ success: true, message: 'No Conformidad cerrada exitosamente.' });
    } catch (err: any) {
      return res.status(400).json({ error: 'CLOSE_FAILED', message: err.message });
    }
  });

  // Manual or Cron check for overdue activities (R10)
  router.post('/schedules/check-overdue', auth, async (req: Request, res: Response) => {
    try {
      const notified = await overdueService.checkOverdueProtocols();
      return res.status(200).json({ success: true, notified_count: notified });
    } catch (err: any) {
      return res.status(500).json({ error: 'OVERDUE_CHECK_FAILED', message: err.message });
    }
  });

  return router;
}
