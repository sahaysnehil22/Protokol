import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { computeFileHash, generatePhotoId } from './integrity.service.js';

export interface PhotoRecord {
  id: string;
  protocol_id: string | null;
  storage_key: string;
  gps_lat: number | null;
  gps_lng: number | null;
  captured_at: string;
  file_hash: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export class PhotoService {
  constructor(private db: DatabaseSync) {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  }

  /**
   * Saves a photo buffer to local storage and creates an opaque database record.
   */
  savePhoto(params: {
    buffer: Buffer;
    mimeType: string;
    gpsLat?: number | null;
    gpsLng?: number | null;
    capturedAt?: string | null;
  }): PhotoRecord {
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

    stmt.run(
      photoId,
      storageKey,
      params.gpsLat ?? null,
      params.gpsLng ?? null,
      capturedAt,
      fileHash,
      params.mimeType,
      params.buffer.length
    );

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
  linkPhotosToProtocol(protocolId: string, photoIds: string[]): void {
    if (!photoIds || photoIds.length === 0) return;

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
  getPhoto(photoId: string): PhotoRecord | null {
    const stmt = this.db.prepare(`
      SELECT id, protocol_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE id = ?
    `);
    const record = stmt.get(photoId) as unknown as PhotoRecord | undefined;
    return record || null;
  }

  /**
   * Resolves the absolute filesystem path for a photo.
   */
  getPhotoAbsolutePath(photoRecord: PhotoRecord): string {
    const filename = path.basename(photoRecord.storage_key);
    return path.join(config.uploadDir, filename);
  }

  /**
   * Retrieves all photos associated with a protocol.
   */
  getPhotosForProtocol(protocolId: string): PhotoRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, protocol_id, storage_key, gps_lat, gps_lng, captured_at, file_hash, mime_type, file_size_bytes, created_at
      FROM photos
      WHERE protocol_id = ?
    `);
    return stmt.all(protocolId) as unknown as PhotoRecord[];
  }
}
