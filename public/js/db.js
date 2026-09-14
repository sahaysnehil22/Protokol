// PROTOKOL — Client-Side IndexedDB Storage Module
const DB_NAME = 'protokol_field_db';
const DB_VERSION = 1;

let dbPromise = null;

export function openLocalDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store 1: Offline submissions queue
      if (!db.objectStoreNames.contains('submissions')) {
        const store = db.createObjectStore('submissions', { keyPath: 'idempotency_key' });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }

      // Store 2: Offline photo blobs
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: 'client_photo_id' });
      }

      // Store 3: Cached criteria
      if (!db.objectStoreNames.contains('criteria')) {
        db.createObjectStore('criteria', { keyPath: 'id' });
      }

      // Store 4: Session & Device configuration
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Queue a protocol submission offline
export async function queueSubmission(payload) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    const record = {
      ...payload,
      status: 'PENDING_SYNC',
      queued_at: new Date().toISOString(),
      retry_count: 0
    };
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

// Retrieve pending submissions
export async function getPendingSubmissions() {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readonly');
    const store = tx.objectStore('submissions');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.filter(r => r.status === 'PENDING_SYNC'));
    req.onerror = () => reject(req.error);
  });
}

// Update or remove submission after sync
export async function removeSubmission(idempotencyKey) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('submissions', 'readwrite');
    const store = tx.objectStore('submissions');
    const req = store.delete(idempotencyKey);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Store photo blob locally
export async function storeLocalPhoto(clientPhotoId, blob, metadata) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    const req = store.put({ client_photo_id: clientPhotoId, blob, metadata, status: 'PENDING' });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Retrieve local photo
export async function getLocalPhoto(clientPhotoId) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const req = store.get(clientPhotoId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Cache project criteria
export async function cacheCriteria(criteriaList) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('criteria', 'readwrite');
    const store = tx.objectStore('criteria');
    store.clear();
    for (const c of criteriaList) {
      store.put(c);
    }
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// Get cached criteria
export async function getCachedCriteria(activity) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('criteria', 'readonly');
    const store = tx.objectStore('criteria');
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result;
      resolve(activity ? all.filter(c => c.activity === activity) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

// Session store helpers
export async function setConfigItem(key, value) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readwrite');
    const store = tx.objectStore('config');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getConfigItem(key) {
  const db = await openLocalDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readonly');
    const store = tx.objectStore('config');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}
