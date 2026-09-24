import crypto from 'crypto';
import { config } from '../config.js';
/**
 * Generates a salted SHA-256 hash for a technician PIN.
 */
export function hashPin(pin, salt = 'protokol_salt_2026') {
    return crypto.createHmac('sha256', salt).update(pin).digest('hex');
}
/**
 * Verifies a provided PIN against the stored hash.
 */
export function verifyPin(pin, storedHash, salt = 'protokol_salt_2026') {
    const computed = hashPin(pin, salt);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}
/**
 * Computes an immutable SHA-256 HMAC integrity hash over the protocol core fields.
 * Associates: technician, device, timestamp, GPS, measurements, panel, chainage.
 */
export function computeProtocolIntegrityHash(payload) {
    // Deterministic serialization of measurements to ensure consistent hashing
    const sortedMeasurements = Object.keys(payload.measurements)
        .sort()
        .reduce((acc, key) => {
        acc[key] = payload.measurements[key];
        return acc;
    }, {});
    const dataToSign = [
        payload.protocol_id,
        payload.project_id,
        payload.activity,
        payload.recorded_at,
        payload.gps_lat.toFixed(6),
        payload.gps_lng.toFixed(6),
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
export function computeFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}
/**
 * Generates an opaque photo ID: ph_<16_hex_chars>
 */
export function generatePhotoId() {
    return `ph_${crypto.randomBytes(8).toString('hex')}`;
}
/**
 * Generates an opaque device token: dvc_<16_hex_chars>
 */
export function generateDeviceToken() {
    return `dvc_${crypto.randomBytes(8).toString('hex')}`;
}
