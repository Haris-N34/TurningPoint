// Recordings stay in the browser (IndexedDB). Nothing is uploaded in the demo build.
const DB = "turning-point";
const STORE = "media";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const media = {
  put: (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).then(() => key),
  get: (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key)),
  delete: (key: string) => tx("readwrite", (s) => s.delete(key)).then(() => undefined),
  clear: () => tx("readwrite", (s) => s.clear()).then(() => undefined),
  keys: () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((ks) => ks.map(String)),
  /** Delete every recording of one attempt (keys are `<attemptId>/<checkpointId>`). */
  async deletePrefix(prefix: string) {
    for (const k of await media.keys()) if (k.startsWith(prefix)) await media.delete(k);
  },
  /** Object URL for playback. Caller revokes it when done. */
  async url(key: string) {
    const b = await media.get(key);
    return b ? URL.createObjectURL(b) : undefined;
  },
};
