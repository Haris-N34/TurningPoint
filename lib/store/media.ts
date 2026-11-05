import { makeMediaLinks, newLinkSecret } from "./signed";

// Recordings stay in the browser (IndexedDB). Nothing is uploaded in the demo build.
// Playback goes only through 1-hour signed links (PV3): media.signedUrl, then media.playbackUrl.
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

const read = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key));

// HMAC secret for playback links: random, per browser tab session, never in code.
let memorySecret: string | undefined;
async function sessionSecret() {
  try {
    const k = "tp:media-link-secret";
    let v = sessionStorage.getItem(k);
    if (!v) sessionStorage.setItem(k, (v = newLinkSecret()));
    return v;
  } catch {
    return (memorySecret ??= newLinkSecret());
  }
}

const links = makeMediaLinks({ get: read, secret: sessionSecret });

export const media = {
  put: (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).then(() => key),
  delete: (key: string) => tx("readwrite", (s) => s.delete(key)).then(() => undefined),
  clear: () => tx("readwrite", (s) => s.clear()).then(() => undefined),
  keys: () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((ks) => ks.map(String)),
  /** Delete every recording of one attempt (keys are `<attemptId>/<checkpointId>`). */
  async deletePrefix(prefix: string) {
    for (const k of await media.keys()) if (k.startsWith(prefix)) await media.delete(k);
  },
  /** A playback link for one recording, valid for 1 hour (PV3). */
  signedUrl: (key: string) => links.sign(key),
  /** Object URL for a signed link. Rejects expired or tampered links. Caller revokes it when done. */
  async playbackUrl(signed: string) {
    const b = await links.open(signed);
    return b ? URL.createObjectURL(b) : undefined;
  },
};
