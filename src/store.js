// What the shop owner set up in edit.html: photos and words, kept in this browser (IndexedDB).
// The shop itself only reads from here; nothing is uploaded while someone is looking around.

import { ROLLS, LETTER } from './content.js';

const DB = 'four-rolls-shop';
const KV = 'kv';
const MAX_EDGE = 2400;

let dbp = null;
function db() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KV);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(KV, mode);
    const out = fn(t.objectStore(KV));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export const get = (key) => tx('readonly', (s) => s.get(key));
export const put = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const del = (key) => tx('readwrite', (s) => s.delete(key));
export const clearAll = () => tx('readwrite', (s) => s.clear());
async function entries() {
  const d = await db();
  return new Promise((resolve, reject) => {
    const out = [];
    const req = d.transaction(KV).objectStore(KV).openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      out.push([c.key, c.value]);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export const frameKey = (roll, i) => `frame:${roll}:${i}`;

/**
 * An image file → an upright JPEG no longer than 2400px, plus its shape.
 * Phone photos are turned by their EXIF orientation; `turns` adds quarter turns clockwise.
 */
export async function preparePhoto(file, turns = 0) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const side = turns % 2 === 1;
  const c = document.createElement('canvas');
  c.width = side ? h : w;
  c.height = side ? w : h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.translate(c.width / 2, c.height / 2);
  g.rotate((turns % 4) * (Math.PI / 2));
  g.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return { blob, wide: c.width > c.height };
}

/** Everything the owner changed, laid over the defaults in content.js. Call before the shop opens. */
export async function applySaved() {
  let all;
  try {
    all = await entries();
  } catch {
    return false; // private mode or no IndexedDB: the shop opens with the sample rolls
  }
  for (const [key, v] of all) {
    if (key === 'letter') {
      if (v.to != null) LETTER.to = v.to;
      if (v.body != null) LETTER.paragraphs = v.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      if (v.sign != null) LETTER.sign = v.sign;
      continue;
    }
    const m = /^frame:(\d):(\d+)$/.exec(key);
    const f = m && ROLLS[+m[1]]?.frames[+m[2]];
    if (!f) continue;
    for (const k of ['title', 'date', 'note', 'place', 'line']) if (v[k] != null) f[k] = v[k];
    if (v.km != null) f.km = Number(v.km) || 0;
    if (v.photo instanceof Blob) {
      f.photo = URL.createObjectURL(v.photo);
      f.wide = !!v.wide;
    } else if (v.photo === null) {
      f.photo = null;
      f.wide = false;
    }
  }
  return all.length > 0;
}
