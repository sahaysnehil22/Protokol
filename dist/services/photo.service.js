import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { computeFileHash, generatePhotoId } from './integrity.service.js';
export class PhotoService {
    db;
    constructor(db) {
        this.db = db;
        if (!fs.existsSync(config.uploadDir)) {
            fs.mkdirSync(config.uploadDir, { recursive: true });
        }
    }
    /**
     * Saves a photo buffer to local storage and creates an opaque database record.
     */
    savePhoto(params) {
        const photoId = generatePhotoId();
        const fileHash = computeFileHash(params.buffer);
        const ext = params.mimeType.includes('png') ? '.png' : '.jpg';
        const filename = `${photoId}_${fileHash.substring(0, 8)}${ext}`;
        const storageKey = path.join('photos', filename);
        const absoluteFilePath = path.join(config.uploadDir, filename);
        fs.writeFileSync(absoluteFilePath, params.buffer);
        const capturedAt = params.capturedAt || new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO photos (id, protocol_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(photoId, storageKey, params.gpsLat ?? null, params.gpsLng ?? null, capturedAt, fileHash, params.mimeType, params.buffer.length);
        return {
            id: photoId,
            protocol_id: null,
            storage_key: storageKey,
            gps_lat: params.gpsLat ?? null,
            gps_lng: params.gpsLng ?? null,
            captured_at: capturedAt,
            file_hash: fileHash,
            mime_type: params.mimeType,
            file_size_bytes: params.buffer.length,
            created_at: new Date().toISOString()
        };
    }
    /**
     * Links photo IDs to a completed protocol.
     */
    linkPhotosToProtocol(protocolId, photoIds) {
        if (!photoIds || photoIds.length === 0)
            return;
        const stmt = this.db.prepare(`
      UPDATE photos
      SET protocol_id = ?
      WHERE id = ?
    `);
        for (const pid of photoIds) {
            stmt.run(protocolId, pid);
        }
    }
    /**
     * Retrieves a photo record by opaque ID.
     */
    getPhoto(photoId) {
        const stmt = this.db.prepare(`
      SELECT id, protocol_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE id = ?
    `);
        const record = stmt.get(photoId);
        return record || null;
    }
    /**
     * Resolves the absolute filesystem path for a photo.
     */
    getPhotoAbsolutePath(photoRecord) {
        const filename = path.basename(photoRecord.storage_key);
        return path.join(config.uploadDir, filename);
    }
    /**
     * Retrieves all photos associated with a protocol.
     */
    getPhotosForProtocol(protocolId) {
        const stmt = this.db.prepare(`
      SELECT id, protocol_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE protocol_id = ?
    `);
        return stmt.all(protocolId);
    }
}
