/**
 * Mod 环境包存储工具 (使用 IndexedDB)
 */

const DB_NAME = 'twwe_mods_db';
const STORE_NAME = 'mod_bundles';
const DB_VERSION = 1;

export interface ModBundle {
  id: string;
  name: string;
  timestamp: number;
  spells: Record<string, any>;
  appends: Record<string, string>;
  active_mods: string[];
  vfs?: Record<string, string>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveModBundle(bundle: ModBundle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(bundle);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getModBundles(): Promise<ModBundle[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteModBundle(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getActiveModBundle(): Promise<ModBundle | null> {
  const bundles = await getModBundles();
  if (bundles.length === 0) return null;
  // 目前简单起见，取最新的一个，以后可以加切换逻辑
  return bundles.sort((a, b) => b.timestamp - a.timestamp)[0];
}
