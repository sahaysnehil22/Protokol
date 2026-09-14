// PROTOKOL — Synchronization Engine (Offline-First Auto-Sync)
import { getPendingSubmissions, removeSubmission, getLocalPhoto } from './db.js';

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

  const pending = await getPendingSubmissions();
  if (pending.length === 0) {
    notifySyncState({ isSyncing: false, pendingCount: 0 });
    return;
  }

  isSyncing = true;
  notifySyncState({ isSyncing: true, pendingCount: pending.length });

  console.log(`[SYNC] Iniciando sincronización de ${pending.length} protocolos pendientes...`);

  for (const item of pending) {
    try {
      // 1. Synchronize any local photos attached to this protocol
      const serverPhotoIds = [];
      if (item.local_photo_ids && item.local_photo_ids.length > 0) {
        for (const localId of item.local_photo_ids) {
          try {
            const serverId = await syncPhoto(localId);
            if (serverId) serverPhotoIds.push(serverId);
          } catch (e) {
            console.warn(`[SYNC] Error subiendo foto ${localId}:`, e);
          }
        }
      }

      // Merge server photo IDs with any existing photo IDs
      const finalPhotoIds = [...(item.photo_ids || []), ...serverPhotoIds];

      // 2. Submit protocol to server API
      const payload = {
        project_id: item.project_id,
        device_token: item.device_token,
        technician_pin: item.technician_pin,
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
        console.warn(`[SYNC] Error del servidor al sincronizar ${item.idempotency_key}:`, errorJson);
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
