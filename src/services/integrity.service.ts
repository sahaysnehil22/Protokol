import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Generates a salted SHA-256 hash for a technician PIN.
 * Salt comes from config (PIN_SALT env); the literal fallback below only
 * applies when config itself fell back (dev). Never hardcode a new default here.
 */
export function hashPin(pin: string, salt: string = config.pinSalt): string {
  return crypto.createHmac('sha256', salt).update(pin).digest('hex');
}

/**
 * Verifies a provided PIN against the stored hash.
 */
export function verifyPin(pin: string, storedHash: string, salt: string = config.pinSalt): boolean {
  const computed = hashPin(pin, salt);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

/**
 * Computes an immutable SHA-256 HMAC integrity hash over the protocol core fields.
 * Associates: technician, device, timestamp, GPS, measurements, panel, chainage.
 */
export function computeProtocolIntegrityHash(payload: {
  protocol_id: string;
  project_id: string;
  activity: string;
  recorded_at: string;
  gps_lat: number;
  gps_lng: number;
  /** GPS provenance sealed into the hash (C-04/D-03): 'DEVICE_GPS' | 'PILOT_DEFAULT'. */
  gps_source?: string;
  panel: string;
  chainage: string;
  measurements: Record<string, any>;
  technician_id: string;
  device_token: string;
}): string {
  // Deterministic serialization of measurements to ensure consistent hashing
  const sortedMeasurements = Object.keys(payload.measurements)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload.measurements[key];
      return acc;
    }, {} as Record<string, any>);

  const dataToSign = [
    payload.protocol_id,
    payload.project_id,
    payload.activity,
    payload.recorded_at,
    payload.gps_lat.toFixed(6),
    payload.gps_lng.toFixed(6),
    payload.gps_source || 'UNKNOWN',
    payload.panel,
    payload.chainage,
    JSON.stringify(sortedMeasurements),
    payload.technician_id,
    payload.device_token
  ].join('|');

  return crypto.createHmac('sha256', config.hmacSecret).update(dataToSign).digest('hex');
}

/**
 * Computes a SHA-256 checksum of an image buffer.
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generates an opaque photo ID: ph_<16_hex_chars>
 */
export function generatePhotoId(): string {
  return `ph_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generates an opaque device token: dvc_<16_hex_chars>
 */
export function generateDeviceToken(): string {
  return `dvc_${crypto.randomBytes(8).toString('hex')}`;
}
