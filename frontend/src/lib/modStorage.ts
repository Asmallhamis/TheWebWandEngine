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
  all_mods?: string[];
  vfs?: Record<string, string>;
  vfs_meta?: Record<string, string>;
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

/**
 * 已解析的当前激活 bundle 缓存。
 * getActiveModBundle 处于评估热路径上，而每次调用都会 getAll() 反序列化
 * 全部历史 bundle（每个可达数 MB）只为取最新一条，造成反复的瞬时内存峰值。
 * 写操作会失效该缓存。
 */
let activeBundleCache: { value: ModBundle | null } | null = null;

export function invalidateModBundleCache(): void {
  activeBundleCache = null;
}

export async function saveModBundle(bundle: ModBundle): Promise<void> {
  const db = await openDB();
  invalidateModBundleCache();
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
  invalidateModBundleCache();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getActiveModBundle(): Promise<ModBundle | null> {
  if (activeBundleCache) return activeBundleCache.value;

  // 用游标按 timestamp 挑出最新一条，只保留该条记录的引用，
  // 避免像 getAll() 那样把全部历史 bundle 同时读入内存。
  const db = await openDB();
  const latest = await new Promise<ModBundle | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    let best: ModBundle | null = null;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(best);
        return;
      }
      const row = cursor.value as ModBundle;
      if (!best || row.timestamp > best.timestamp) best = row;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });

  activeBundleCache = { value: latest };
  return latest;
}
