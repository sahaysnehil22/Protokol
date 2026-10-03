// PROTOKOL — Synchronization Engine (Offline-First Auto-Sync)
import { getPendingSubmissions, removeSubmission, getLocalPhoto, updateSubmissionMeta } from './db.js';

let isSyncing = false;
let syncListeners = [];

export function onSyncStateChange(callback) {
  syncListeners.push(callback);
}

function notifySyncState(state) {
  syncListeners.forEach(cb => cb(state));
}

/**
 * Uploads a locally stored photo blob and returns the server's opaque photo ID.
 */
async function syncPhoto(clientPhotoId) {
  const photoRecord = await getLocalPhoto(clientPhotoId);
  if (!photoRecord) return null;

  const formData = new FormData();
  formData.append('photo', photoRecord.blob, `${clientPhotoId}.jpg`);
  if (photoRecord.metadata?.gps) {
    formData.append('gps_lat', photoRecord.metadata.gps.lat);
    formData.append('gps_lng', photoRecord.metadata.gps.lng);
  }
  formData.append('captured_at', photoRecord.metadata?.captured_at || new Date().toISOString());

  const res = await fetch('/api/photos', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`Photo upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.photo_id;
}

/**
 * Triggers full queue synchronization.
 */
export async function syncOfflineQueue() {
  if (!navigator.onLine || isSyncing) return;

  let pending;
  try {
    pending = await getPendingSubmissions();
  } catch (e) {
    // IndexedDB unavailable (denied storage, private mode, etc.): offline
    // queue simply doesn't exist in this session — stay quiet, stay online.
    console.warn('[SYNC] Cola offline no disponible:', e.message || e);
    return;
  }
  if (pending.length === 0) {
    notifySyncState({ isSyncing: false, pendingCount: 0 });
    return;
  }

  isSyncing = true;
  notifySyncState({ isSyncing: true, pendingCount: pending.length });

  console.log(`[SYNC] Iniciando sincronización de ${pending.length} protocolos pendientes...`);

  for (const item of pending) {
    try {
      // 1. Strict Photos-First Order (§4.3.3): All local photos must be uploaded first
      const serverPhotoIds = [];
      let allPhotosUploaded = true;

      if (item.local_photo_ids && item.local_photo_ids.length > 0) {
        for (const localId of item.local_photo_ids) {
          try {
            const serverId = await syncPhoto(localId);
            if (serverId) {
              serverPhotoIds.push(serverId);
            } else {
              allPhotosUploaded = false;
            }
          } catch (e) {
            console.warn(`[SYNC] Error subiendo foto ${localId}:`, e);
            allPhotosUploaded = false;
            break; // Stop and retry later
          }
        }
      }

      if (!allPhotosUploaded) {
        console.warn(`[SYNC] Protocolo ${item.idempotency_key} postergado: faltan fotos por subir (§4.3.3 Photos-First).`);
        continue;
      }

      // Merge server photo IDs with any existing photo IDs
      const finalPhotoIds = [...(item.photo_ids || []), ...serverPhotoIds];

      // 2. Submit protocol to server API
      const payload = {
        project_id: item.project_id,
        device_token: item.device_token,
        technician_id: item.technician_id,
        activity: item.activity,
        recorded_at: item.recorded_at,
        gps: item.gps,
        panel: item.panel,
        chainage: item.chainage,
        measurements: item.measurements,
        photo_ids: finalPhotoIds,
        notes: item.notes,
        idempotency_key: item.idempotency_key
      };

      const res = await fetch('/api/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Successfully synchronized! Remove from local IndexedDB queue
        await removeSubmission(item.idempotency_key);
        console.log(`[SYNC] Protocolo sincronizado exitosamente: ${item.idempotency_key}`);
      } else {
        const errorJson = await res.json().catch(() => ({}));
        // M-04 dead-letter: a 4xx means the payload itself is invalid and will
        // NEVER succeed — park it as REJECTED instead of retrying forever.
        // 5xx / network errors increment the retry counter; after 10 attempts
        // the item is also parked as REJECTED for manual review.
        const attempts = (item.retry_count || 0) + 1;
        // 401/403 = session expired or wrong project: NOT the payload's fault,
        // keep retrying (user must re-login). 400/404/409/422 = invalid payload.
        const payloadFatal = [400, 404, 409, 422].includes(res.status);
        const fatal = payloadFatal || attempts >= 10;
        await updateSubmissionMeta(item.idempotency_key, {
          retry_count: attempts,
          status: fatal ? 'REJECTED' : 'PENDING_SYNC',
          last_error: errorJson.error || errorJson.message || `HTTP ${res.status}`,
          last_attempt_at: new Date().toISOString(),
        });
        console.warn(`[SYNC] Error del servidor al sincronizar ${item.idempotency_key}:`, errorJson, fatal ? '(REJECTED)' : `(retry ${attempts})`);
      }
    } catch (err) {
      console.error(`[SYNC] Error de red sincronizando ${item.idempotency_key}:`, err);
    }
  }

  isSyncing = false;
  const remaining = await getPendingSubmissions();
  notifySyncState({ isSyncing: false, pendingCount: remaining.length });
}

// Global auto-sync listeners
export function initAutoSync() {
  window.addEventListener('online', () => {
    console.log('[NETWORK] Conexión reestablecida (ONLINE). Disparando auto-sincronización...');
    syncOfflineQueue();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncOfflineQueue();
    }
  });

  // Attempt initial sync on load if online
  if (navigator.onLine) {
    syncOfflineQueue();
  }
}
