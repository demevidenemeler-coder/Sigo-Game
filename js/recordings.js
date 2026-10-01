// Eigene Aufnahmen: Eltern sprechen Tierlaute, Namen und Sätze selbst ein.
// Gespeichert wird nur auf dem Gerät (IndexedDB); es wird nichts hochgeladen.
// Schlüssel: "call:kuh" (Tierlaut, sprachunabhängig), "de|name:kuh" (Wort), "de|phrase:station" (Satz).

import { audioContext, busses } from './audio.js';

const DB_NAME = 'sigo-recordings';
const STORE = 'rec';
const MAX_MS = 4500;

let dbPromise = null;
const have = new Map(); // Schlüssel → Blob (alle Aufnahmen sind klein, deshalb im Speicher)
const buffers = new Map(); // Schlüssel → decodierter AudioBuffer
let loaded = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const tx = (mode, fn) => db().then((d) => new Promise((resolve, reject) => {
  const t = d.transaction(STORE, mode);
  const r = fn(t.objectStore(STORE));
  t.oncomplete = () => resolve(r?.result);
  t.onerror = () => reject(t.error);
}));

// Beim Start alle Aufnahmen laden (klein, schnell)
export function loadRecordings() {
  if (!loaded) {
    loaded = db().then((d) => new Promise((resolve) => {
      const out = [];
      const req = d.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          have.set(c.key, c.value);
          out.push(c.key);
          c.continue();
        } else resolve(out);
      };
      req.onerror = () => resolve(out);
    })).catch(() => []);
  }
  return loaded;
}

export const hasRecording = (key) => have.has(key);
export const recordingCount = () => have.size;

async function bufferFor(key) {
  if (buffers.has(key)) return buffers.get(key);
  const blob = have.get(key);
  if (!blob) return null;
  try {
    const arr = await blob.arrayBuffer();
    const buf = await audioContext().decodeAudioData(arr);
    buffers.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

// Spielt die Aufnahme; das Ergebnis ist true, wenn es eine gab (sonst false → normale Stimme)
export async function playRecording(key, { gain = 1.4 } = {}) {
  if (!have.has(key)) return false;
  const buf = await bufferFor(key);
  if (!buf) return false;
  const c = audioContext();
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(busses().sfx);
  src.start();
  await new Promise((r) => setTimeout(r, buf.duration * 1000));
  return true;
}

export async function saveRecording(key, blob) {
  await tx('readwrite', (s) => s.put(blob, key));
  have.set(key, blob);
  buffers.delete(key);
}

export async function deleteRecording(key) {
  await tx('readwrite', (s) => s.delete(key));
  have.delete(key);
  buffers.delete(key);
}

// ---------- Aufnehmen ----------

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

// Schneidet Stille am Anfang/Ende ab und passt die Lautstärke an (Handy-Aufnahmen sind oft leise)
async function polish(blob) {
  try {
    const c = audioContext();
    const buf = await c.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak < 0.003) return { blob, silent: true };
    const th = peak * 0.08;
    let a = 0;
    let b = data.length - 1;
    while (a < b && Math.abs(data[a]) < th) a++;
    while (b > a && Math.abs(data[b]) < th) b--;
    a = Math.max(0, a - Math.floor(buf.sampleRate * 0.06));
    b = Math.min(data.length - 1, b + Math.floor(buf.sampleRate * 0.12));
    const len = b - a + 1;
    const out = new Int16Array(len);
    const k = Math.min(6, 0.9 / peak);
    for (let i = 0; i < len; i++) {
      const fade = Math.min(1, i / 300, (len - 1 - i) / 600);
      out[i] = Math.max(-32767, Math.min(32767, Math.round(data[a + i] * k * fade * 32767)));
    }
    return { blob: wav(out, buf.sampleRate), silent: false };
  } catch {
    return { blob, silent: false };
  }
}

function wav(samples, sr) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  new Int16Array(buf, 44).set(samples);
  return new Blob([buf], { type: 'audio/wav' });
}

// Startet die Aufnahme. Liefert { stop(): Promise<{ blob, silent }>, cancel() }. Endet nach 4,5 s von selbst.
export async function startRecording(onAutoStop) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  let stopped = false;
  const stop = async () => {
    if (!stopped) {
      stopped = true;
      clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
    }
    await finished;
    release();
    const raw = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
    return polish(raw);
  };
  const timer = setTimeout(() => stop().then((r) => onAutoStop?.(r)), MAX_MS);
  return {
    stop,
    cancel() {
      stopped = true;
      clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}
