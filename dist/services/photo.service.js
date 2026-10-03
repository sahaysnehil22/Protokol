import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { getSupabaseClient } from '../db/supabase.js';
import { computeFileHash, generatePhotoId } from './integrity.service.js';
/** Supabase Storage bucket for field evidence (D-06). Created on first use. */
export const EVIDENCE_BUCKET = 'protokol-evidence';
async function ensureEvidenceBucket(sb) {
    const { data } = await sb.storage.listBuckets();
    if (data?.some(b => b.name === EVIDENCE_BUCKET))
        return;
    const { error } = await sb.storage.createBucket(EVIDENCE_BUCKET, { public: false });
    // Ignore "already exists" races (two instances creating at once).
    if (error && !/already exists/i.test(error.message))
        throw error;
}
export class PhotoService {
    db;
    constructor(db) {
        this.db = db;
        if (!fs.existsSync(config.uploadDir)) {
            fs.mkdirSync(config.uploadDir, { recursive: true });
        }
    }
    /**
     * Saves a photo buffer to local storage (and Supabase Storage when
     * configured, D-06) and creates an opaque database record.
     *
     * Storage model (2026-10-03): local disk is the write-through cache;
     * when Supabase is configured the bytes ALSO go to the `protokol-evidence`
     * bucket (path `photos/<filename>`) and storage_key becomes `sb:...`.
     * If the cloud upload fails we keep the local copy and warn — evidence is
     * never dropped because the network hiccuped.
     */
    async savePhoto(params) {
        const photoId = generatePhotoId();
        const fileHash = computeFileHash(params.buffer);
        const ext = params.mimeType.includes('png') ? '.png' : '.jpg';
        const filename = `${photoId}_${fileHash.substring(0, 8)}${ext}`;
        const absoluteFilePath = path.join(config.uploadDir, filename);
        fs.writeFileSync(absoluteFilePath, params.buffer);
        let storageKey = path.join('photos', filename);
        const sb = getSupabaseClient();
        if (sb) {
            try {
                await ensureEvidenceBucket(sb);
                const { error } = await sb.storage
                    .from(EVIDENCE_BUCKET)
                    .upload(`photos/${filename}`, params.buffer, {
                    contentType: params.mimeType,
                    upsert: false,
                });
                if (error)
                    throw error;
                storageKey = `sb:photos/${filename}`;
            }
            catch (err) {
                console.warn(`⚠️ [STORAGE] Cloud upload failed for ${photoId}, kept local: ${err.message}`);
            }
        }
        const capturedAt = params.capturedAt || new Date().toISOString();
        const stmt = this.db.prepare(`
      INSERT INTO photos (id, protocol_id, project_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(photoId, params.projectId || null, storageKey, params.gpsLat ?? null, params.gpsLng ?? null, capturedAt, fileHash, params.mimeType, params.buffer.length);
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
      SELECT id, protocol_id, project_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE id = ?
    `);
        const record = stmt.get(photoId);
        return record || null;
    }
    /**
     * Resolves the absolute filesystem path for a photo.
     * Only valid for locally-stored photos (storage_key NOT starting with sb:).
     */
    getPhotoAbsolutePath(photoRecord) {
        const filename = path.basename(photoRecord.storage_key.replace(/^sb:/, ''));
        return path.join(config.uploadDir, filename);
    }
    /**
     * Returns a readable stream/buffer source for a photo regardless of backend.
     * Local: filesystem. Cloud (sb:...): downloaded from Supabase Storage.
     */
    async getPhotoBuffer(photoRecord) {
        if (!photoRecord.storage_key.startsWith('sb:')) {
            return fs.readFileSync(this.getPhotoAbsolutePath(photoRecord));
        }
        const sb = getSupabaseClient();
        if (!sb)
            throw new Error('STORAGE_UNAVAILABLE: foto en la nube sin cliente Supabase.');
        const objectPath = photoRecord.storage_key.replace(/^sb:/, '');
        const { data, error } = await sb.storage.from(EVIDENCE_BUCKET).download(objectPath);
        if (error || !data)
            throw new Error(`STORAGE_DOWNLOAD_FAILED: ${error?.message}`);
        return Buffer.from(await data.arrayBuffer());
    }
    /**
     * R-6: deletes orphan photo evidence — uploaded but never linked to a
     * protocol (submit failed and was abandoned). Only touches rows older than
     * `olderThanHours` so in-flight retries are never swept. Returns counts.
     */
    async sweepOrphanPhotos(olderThanHours = 24) {
        const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
        const orphans = this.db.prepare(`
      SELECT * FROM photos WHERE protocol_id IS NULL AND created_at < ?
    `).all(cutoff);
        let files = 0, bytes = 0;
        const sb = getSupabaseClient();
        for (const o of orphans) {
            try {
                if (o.storage_key.startsWith('sb:')) {
                    if (sb)
                        await sb.storage.from(EVIDENCE_BUCKET).remove([o.storage_key.replace(/^sb:/, '')]);
                }
                else {
                    const p = this.getPhotoAbsolutePath(o);
                    if (fs.existsSync(p)) {
                        bytes += fs.statSync(p).size;
                        fs.unlinkSync(p);
                        files++;
                    }
                }
            }
            catch (err) {
                console.warn(`⚠️ [SWEEP] No se pudo borrar evidencia huérfana ${o.id}: ${err.message}`);
            }
        }
        if (orphans.length > 0) {
            this.db.prepare(`DELETE FROM photos WHERE protocol_id IS NULL AND created_at < ?`).run(cutoff);
        }
        return { rows: orphans.length, files, bytes };
    }
    /**
     * Retrieves all photos associated with a protocol.
     */
    getPhotosForProtocol(protocolId) {
        const stmt = this.db.prepare(`
      SELECT id, protocol_id, project_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE protocol_id = ?
    `);
        return stmt.all(protocolId);
    }
}
