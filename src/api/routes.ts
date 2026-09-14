import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { ProtocolService } from '../services/protocol.service.js';
import { PhotoService } from '../services/photo.service.js';
import { OverdueService } from '../services/overdue.service.js';
import { generateDeviceToken, verifyPin } from '../services/integrity.service.js';

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
        idempotency_key
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
      });

      return res.status(201).json(response);
    } catch (err: any) {
      if (err.message.includes('AUTH_FAILED')) {
        return res.status(401).json({ error: 'AUTH_FAILED', message: err.message });
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
      const { age_days, cylinder_code, strength_kgcm2, lab, report_photo_id } = req.body;

      if (!age_days || !cylinder_code || strength_kgcm2 === undefined || !lab) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'age_days, cylinder_code, strength_kgcm2 y lab son requeridos.'
        });
      }

      const response = await protocolService.recordCylinderResult(protocolId, {
        age_days: parseInt(String(age_days), 10),
        cylinder_code,
        strength_kgcm2: parseFloat(String(strength_kgcm2)),
        lab,
        report_photo_id
      });

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
  // SUPPORTING ENDPOINTS: Photos, Files & Offline Criteria
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
    // Find newest dossier file for this project
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

  // Criteria endpoint for PWA offline caching
  router.get('/projects/:id/criteria', (req: Request, res: Response) => {
    const stmt = db.prepare(`
      SELECT id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference
      FROM criteria
      WHERE project_id = ? AND is_active = 1
    `);
    const criteria = stmt.all(req.params.id as string);
    return res.status(200).json(criteria);
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
