// Geräusche werden live mit der Web Audio API erzeugt; Tierlaute teils als Aufnahme (sounds/), teils nachgebaut.
// Drei Kanäle: Effekte, Motor (Dampf, Rollen, Schienenstöße) und Musik – getrennt regelbar.
// Sprache kommt aus der Sprachausgabe des Geräts (speechSynthesis).

import { renderAnimal, SYNTH_ANIMALS } from './animalSynth.js';

let ctx = null;
let sfxBus = null;
let engineBus = null;
let musicBus = null;
let noiseBuf = null;
let echoWet = null;
const samples = new Map();

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    // Kompressor: laut genug für Tablet-Lautsprecher, ohne zu übersteuern
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    sfxBus = ctx.createGain();
    engineBus = ctx.createGain();
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    for (const b of [sfxBus, engineBus, musicBus]) b.connect(master);
    // Hall (z. B. im Tunnel): Effekte und Zuggeräusche laufen zusätzlich durch ein Echo
    const echoIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.22;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    echoWet = ctx.createGain();
    echoWet.gain.value = 0;
    echoIn.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(echoWet).connect(master);
    sfxBus.connect(echoIn);
    engineBus.connect(echoIn);
    // Ein Rausch-Puffer für alle Rausch-Geräusche (spart Rechenzeit)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

export function audioContext() {
  return ac();
}

export function busses() {
  ac();
  return { sfx: sfxBus, engine: engineBus, music: musicBus };
}

// Muss aus einer Berührung heraus aufgerufen werden (Browser-Regel).
export function unlockAudio() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

export function setEcho(on) {
  ac();
  echoWet.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.2);
}

// ---------- Echte Aufnahmen (Tiergeräusche) ----------

export function preloadSamples(names) {
  const c = ac();
  for (const n of names) {
    if (samples.has(n)) continue;
    samples.set(n, fetch(`sounds/${n}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .then((buf) => { samples.set(n, buf); return buf; })
      .catch(() => { samples.set(n, null); return null; }));
  }
}

export async function playSample(name, { gain = 1, rate = 1 } = {}) {
  const c = ac();
  let buf = samples.get(name);
  if (buf === undefined) {
    preloadSamples([name]);
    buf = samples.get(name);
  }
  if (buf instanceof Promise) buf = await buf;
  if (!buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(sfxBus);
  src.start();
  await new Promise((r) => setTimeout(r, (buf.duration / rate) * 1000));
  return true;
}

// Tierlaute: echte Aufnahme, wenn vorhanden, sonst nachgebaut
const ANIMAL_SAMPLES = { kuh: 'kuh', katze: 'katze', hund: 'hund', hahn: 'hahn', huhn: 'huhn', schwein: 'schwein', schaf: 'schaf', frosch: 'frosch' };
// Tiere ohne freie Aufnahme: Stimm-Synthese (animalSynth.js), einmal berechnet und dann zwischengespeichert
const ANIMAL_SYNTH = Object.fromEntries(SYNTH_ANIMALS.map((id) => [id, id]));
const synthBuffers = new Map();
function synthBuffer(id) {
  if (!synthBuffers.has(id)) {
    const c = ac();
    const data = renderAnimal(id, c.sampleRate);
    const buf = c.createBuffer(1, data.length, c.sampleRate);
    buf.copyToChannel(data, 0);
    synthBuffers.set(id, buf);
  }
  return synthBuffers.get(id);
}
export const ANIMAL_SAMPLE_NAMES = [...Object.values(ANIMAL_SAMPLES), 'voegel'];

export function hasAnimalSound(id) {
  return id in ANIMAL_SAMPLES || id in ANIMAL_SYNTH;
}

export async function animalSound(id) {
  if (ANIMAL_SAMPLES[id]) return playSample(ANIMAL_SAMPLES[id], { gain: id === 'schwein' ? 0.6 : 0.9 });
  if (ANIMAL_SYNTH[id]) {
    const c = ac();
    const buf = synthBuffer(id);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = 0.75;
    src.connect(g).connect(sfxBus);
    src.start();
    await new Promise((r) => setTimeout(r, buf.duration * 1000));
    return true;
  }
  return false;
}

export function setChannelVolume(channel, value) {
  const b = busses()[channel];
  b.gain.setTargetAtTime(value, ctx.currentTime, 0.3);
}

// ---------- Bausteine ----------

function envelope(gainNode, t0, attack, peak, decay) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

export function tone(type, freq, t0, attack, decay, peak = 0.4, dest = sfxBus) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(g).connect(dest);
  envelope(g, t0, attack, peak, decay);
  o.start(t0);
  o.stop(t0 + attack + decay + 0.05);
  return o;
}

function filter(type, freq, q = 0.7, dest = sfxBus) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

const lowpass = (freq, q, dest) => filter('lowpass', freq, q, dest);

export function noise(t0, dur, peak, filterType = 'bandpass', freq = 1000, dest = sfxBus, q = 0.7) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  src.connect(f).connect(g).connect(dest);
  envelope(g, t0, 0.005, peak, dur);
  src.start(t0, Math.random() * 1.5, dur + 0.1);
  return { src, filter: f, gain: g };
}

const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

// ---------- Geräusche ----------

const SOUNDS = {
  plop(t) {
    const o = tone('sine', 380, t, 0.005, 0.15, 0.45);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.12);
  },
  pop(t) {
    const o = tone('sine', 600, t, 0.005, 0.12, 0.4);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
  },
  poof(t) {
    const n = noise(t, 0.35, 0.45, 'bandpass', 900);
    n.filter.frequency.exponentialRampToValueAtTime(250, t + 0.3);
  },
  whoosh(t) {
    const n = noise(t, 0.3, 0.3, 'bandpass', 500, sfxBus, 1.2);
    n.filter.frequency.exponentialRampToValueAtTime(2000, t + 0.25);
  },
  klack(t) {
    // Wagen kuppeln an: kräftiges Metall-Klacken
    noise(t, 0.06, 0.8, 'bandpass', 2200, sfxBus, 2);
    tone('square', 160, t, 0.002, 0.1, 0.25, lowpass(800));
    noise(t + 0.1, 0.05, 0.5, 'bandpass', 1500, sfxBus, 2);
  },
  splash(t) {
    const n = noise(t, 0.3, 0.5, 'lowpass', 2500);
    n.filter.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const o = tone('sine', 300, t, 0.005, 0.2, 0.3);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.18);
  },
  pling(t) {
    tone('sine', N.E5 * 2, t, 0.002, 0.6, 0.3);
    tone('sine', N.E5 * 2 * 2.76, t, 0.002, 0.2, 0.06);
  },
  chime(t) {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
      tone('sine', f, t + i * 0.16, 0.005, 1.2, 0.3);
      tone('sine', f * 2.76, t + i * 0.16, 0.005, 0.4, 0.05);
    });
  },
  whistle(t) {
    // Dampfpfeife: tuuu-tuuuut, mit Dampfrauschen
    for (const [dt, d] of [[0, 0.4], [0.5, 1.0]]) {
      for (const f of [N.D5, 740, 880]) tone('sine', f, t + dt, 0.05, d, 0.16);
      tone('triangle', 1175, t + dt, 0.05, d, 0.05);
      noise(t + dt, d, 0.12, 'bandpass', 3500, sfxBus, 1.5);
    }
  },
  elhorn(t) {
    // E-Lok: zweitoniges Signalhorn
    [[N.A4, 0, 0.4], [N.E5 * 0.9, 0.45, 0.7]].forEach(([f, dt, d]) => {
      const lp = lowpass(1800);
      tone('sawtooth', f, t + dt, 0.03, d, 0.25, lp);
      tone('sawtooth', f * 1.26, t + dt, 0.03, d, 0.18, lp);
    });
  },
  bell(t) {
    for (const dt of [0, 0.35]) {
      tone('sine', 1250, t + dt, 0.002, 0.8, 0.25);
      tone('sine', 1250 * 2.4, t + dt, 0.002, 0.3, 0.08);
    }
  },
  hiss(t) {
    // Dampf ablassen beim Anhalten
    const n = noise(t, 1.4, 0.35, 'highpass', 2500);
    n.filter.frequency.linearRampToValueAtTime(4000, t + 1.2);
  },
  scribble(t) {
    noise(t, 0.08, 0.1, 'bandpass', 3000);
  },
  boing(t) {
    const o = tone('triangle', 220, t, 0.005, 0.35, 0.4);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.3);
  },
};

Object.assign(SOUNDS, {
  dieselhorn(t) {
    const lp = lowpass(2200);
    for (const f of [440, 554, 659]) tone('sawtooth', f, t, 0.04, 1.0, 0.14, lp);
  },
  clank(t) {
    // hohler Schienenstoß auf der Brücke
    const o = tone('sine', 150, t, 0.002, 0.3, 0.5);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
    noise(t, 0.08, 0.4, 'bandpass', 900, sfxBus, 4);
  },
  gurgle(t) {
    for (let i = 0; i < 9; i++) {
      const o = tone('sine', 250 + Math.random() * 300, t + i * 0.09, 0.005, 0.08, 0.25);
      o.frequency.exponentialRampToValueAtTime(600 + Math.random() * 300, t + i * 0.09 + 0.07);
    }
  },
  coal(t) {
    for (let i = 0; i < 14; i++) noise(t + i * 0.06 + Math.random() * 0.03, 0.05, 0.3, 'bandpass', 600 + Math.random() * 1200, sfxBus, 2);
  },
  // Kirchenglocken: tiefes „Bim-bam-bim-bam“
  churchbell(t) {
    [392, 330, 392, 330].forEach((f, i) => {
      const at = t + i * 0.55;
      tone('sine', f, at, 0.004, 1.8, 0.28);
      tone('sine', f * 2.01, at, 0.003, 1.1, 0.1);
      tone('sine', f * 2.76, at, 0.002, 0.6, 0.06);
      tone('sine', f * 0.5, at, 0.01, 1.4, 0.1);
    });
  },
  xbell(t) {
    tone('sine', 1760, t, 0.002, 0.25, 0.18);
    tone('sine', 1760 * 2.4, t, 0.002, 0.1, 0.05);
  },
  carhonk(t) {
    for (const dt of [0, 0.2]) tone('square', 480, t + dt, 0.01, 0.13, 0.15, lowpass(1600));
  },
  // Feuerwehr: Tatütata (zweitönig, dreimal)
  siren(t) {
    for (let i = 0; i < 6; i++) {
      const f = i % 2 ? 587 : 440;
      tone('triangle', f, t + i * 0.42, 0.02, 0.4, 0.18);
      tone('sine', f * 2, t + i * 0.42, 0.02, 0.38, 0.05);
    }
  },
  // Traktor springt an: tiefes „Tuck-tuck-tuck“, erst langsam, dann schneller
  tractor(t) {
    let at = t;
    for (let i = 0; i < 12; i++) {
      noise(at, 0.07, 0.5, 'lowpass', 380, sfxBus, 1.5);
      tone('square', 58, at, 0.004, 0.06, 0.16, lowpass(260));
      at += Math.max(0.09, 0.24 - i * 0.02);
    }
  },
  creak(t) {
    const o = tone('sawtooth', 110, t, 0.05, 0.6, 0.18, filter('bandpass', 700, 6));
    o.frequency.linearRampToValueAtTime(170, t + 0.6);
  },
  dingdong(t) {
    tone('sine', 659, t, 0.005, 1.4, 0.3);
    tone('sine', 523, t + 0.55, 0.005, 1.6, 0.3);
  },
  sparkle(t) {
    [1568, 1976, 2349, 3136].forEach((f, i) => tone('sine', f, t + i * 0.07, 0.002, 0.3, 0.12));
  },
  snore(t) {
    // Leises, langsames Atmen: Einatmen (steigend), Ausatmen (fallend)
    const a = noise(t, 1.5, 0.22, 'lowpass', 260, sfxBus, 0.6);
    a.filter.frequency.setValueAtTime(220, t);
    a.filter.frequency.linearRampToValueAtTime(520, t + 0.9);
    a.filter.frequency.linearRampToValueAtTime(240, t + 1.6);
    const o = tone('triangle', 62, t + 1.0, 0.25, 0.9, 0.07, lowpass(300));
    o.frequency.linearRampToValueAtTime(52, t + 2.0);
  },
  lullaby(t) {
    // Spieluhr: ein Wiegenlied (nach Brahms), langsam und weich
    const N = { D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25 };
    const beat = 0.82;
    const song = [
      ['E4', 0.5], ['E4', 0.5], ['G4', 2], ['E4', 0.5], ['E4', 0.5], ['G4', 2], ['E4', 1], ['G4', 1], ['C5', 1], ['B4', 1.5], ['A4', 0.5], ['A4', 1], ['G4', 2],
      ['D4', 0.5], ['E4', 0.5], ['F4', 2], ['D4', 0.5], ['E4', 0.5], ['F4', 2], ['D4', 1], ['F4', 1], ['B4', 1], ['A4', 1.5], ['G4', 0.5], ['G4', 1], ['C5', 3],
    ];
    let at = t + 0.2;
    for (const [n, len] of song) {
      const f = N[n];
      tone('sine', f, at, 0.004, 1.3, 0.2);
      tone('sine', f * 2.76, at, 0.002, 0.25, 0.045);
      tone('sine', f * 5.4, at, 0.001, 0.08, 0.015);
      at += len * beat;
    }
  },
  squeak(t) {
    // Schwamm quietscht auf dem Lack
    const o = tone('sine', 1150 + Math.random() * 300, t, 0.01, 0.12, 0.12);
    o.frequency.exponentialRampToValueAtTime(1700 + Math.random() * 300, t + 0.1);
    noise(t, 0.1, 0.12, 'bandpass', 3200, sfxBus, 3);
  },
  munch(t) {
    // Mampf: zwei kurze, knackige Bisse
    for (const dt of [0, 0.11]) {
      noise(t + dt, 0.07, 0.55, 'bandpass', 1100 + Math.random() * 600, sfxBus, 1.5);
      noise(t + dt, 0.05, 0.35, 'lowpass', 400);
    }
  },
  nope(t) {
    // „Hm-hm“ (nein danke) – zwei weiche, fallende Töne
    for (const [dt, f] of [[0, 420], [0.22, 340]]) {
      const o = tone('triangle', f, t + dt, 0.02, 0.16, 0.22, lowpass(1200));
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t + dt + 0.15);
    }
  },
  splat(t) {
    // Matsch klatscht an den Wagen
    const n = noise(t, 0.18, 0.7, 'lowpass', 1400);
    n.filter.frequency.exponentialRampToValueAtTime(180, t + 0.15);
    const o = tone('sine', 160, t, 0.004, 0.12, 0.35);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
  },
  scrub(t) {
    for (let i = 0; i < 5; i++) noise(t + i * 0.12, 0.1, 0.25, 'bandpass', 1800 + (i % 2) * 900, sfxBus, 2);
  },
});

const SOUND_LENGTH = { dingdong: 2.0, whistle: 1.6, elhorn: 1.2, chime: 1.2, poof: 0.4, pop: 0.2, hiss: 1.4 };

// Spielt ein Geräusch; das Promise endet ungefähr, wenn es verklungen ist.
export function playSound(name) {
  const fn = SOUNDS[name];
  if (!fn) return Promise.resolve();
  const c = ac();
  fn(c.currentTime + 0.02);
  const ms = (SOUND_LENGTH[name] ?? 1.0) * 1000;
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Xylophon (Musik-Brücke) ----------

// Pentatonik (C-Dur ohne F und H): klingt in jeder Reihenfolge schön und passt zur Hintergrundmusik
export const XYLO_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export function xyloNote(index, vel = 0.32) {
  const c = ac();
  const f = XYLO_NOTES[Math.max(0, Math.min(XYLO_NOTES.length - 1, index))];
  const t = c.currentTime + 0.01;
  tone('sine', f, t, 0.003, 0.7, vel);
  tone('sine', f * 3.93, t, 0.002, 0.14, vel * 0.22);
  tone('sine', f * 9.2, t, 0.001, 0.05, vel * 0.07);
}

// ---------- Zug-Geräusche (laufen während der Fahrt) ----------

// Dampfstoß „tsch“ – akzentuiert, damit ein „tschu-tschu-tschu-tschu“-Rhythmus entsteht
export function chuff(accent, speed01) {
  const c = ac();
  const t = c.currentTime + 0.01;
  const dur = 0.2 - speed01 * 0.1;
  noise(t, dur, 0.55 * accent, 'bandpass', 1300 + accent * 400, engineBus, 0.9);
  noise(t, dur * 0.6, 0.45 * accent, 'lowpass', 280, engineBus);
}

// Schienenstoß: jede Achse klackt einzeln über die Lücke – so entsteht „ta-tamm … ta-tamm“
export function railJoint(strength = 1, hollow = false) {
  const c = ac();
  const t = c.currentTime + 0.01;
  if (hollow) {
    const o = tone('sine', 160, t, 0.002, 0.28, 0.5 * strength, engineBus);
    o.frequency.exponentialRampToValueAtTime(115, t + 0.25);
    noise(t, 0.06, 0.35 * strength, 'bandpass', 1100, engineBus, 5);
    return;
  }
  noise(t, 0.035, 0.5 * strength, 'bandpass', 2600, engineBus, 3);
  const o = tone('sine', 95, t, 0.002, 0.09, 0.55 * strength, engineBus);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
}

// Dauerton: Rollen der Räder (+ Brummen der E-Lok), Lautstärke folgt der Geschwindigkeit
export class RollingSound {
  constructor() {
    this.nodes = null;
  }

  // kind: 'steam' | 'electric' | 'diesel'
  start(kind) {
    const c = ac();
    this.stop();
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(engineBus);
    src.start();
    const nodes = { src, lp, g };
    const freqs = kind === 'electric' ? [55, 110.5, 220] : kind === 'diesel' ? [41, 82.5, 124] : null;
    if (freqs) {
      const hg = c.createGain();
      hg.gain.value = 0;
      const hl = c.createBiquadFilter();
      hl.type = 'lowpass';
      hl.frequency.value = kind === 'diesel' ? 320 : 500;
      hl.connect(hg).connect(engineBus);
      nodes.hum = freqs.map((f) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(hl);
        o.start();
        return o;
      });
      nodes.freqs = freqs;
      nodes.hg = hg;
      nodes.base = kind === 'diesel' ? 0.07 : 0.02;
    }
    this.nodes = nodes;
  }

  set(speed01) {
    if (!this.nodes) return;
    const t = ctx.currentTime;
    const n = this.nodes;
    n.g.gain.setTargetAtTime(speed01 > 0.01 ? 0.08 + speed01 * 0.3 : 0, t, 0.15);
    n.lp.frequency.setTargetAtTime(180 + speed01 * 520, t, 0.15);
    if (n.hum) {
      n.hg.gain.setTargetAtTime(n.base + speed01 * 0.06, t, 0.2);
      n.hum.forEach((o, i) => o.frequency.setTargetAtTime(n.freqs[i] * (1 + speed01 * 1.2), t, 0.2));
    }
  }

  stop() {
    if (!this.nodes) return;
    const n = this.nodes;
    const t = ctx.currentTime;
    n.g.gain.setTargetAtTime(0, t, 0.1);
    n.hg?.gain.setTargetAtTime(0, t, 0.1);
    setTimeout(() => {
      n.src.stop();
      n.hum?.forEach((o) => o.stop());
    }, 500);
    this.nodes = null;
  }
}

// Dauergeräusch aus Rauschen (Regen, Waschanlage) – Lautstärke frei regelbar
export class NoiseLoop {
  constructor(filterType, freq, q = 0.7) {
    this.filterType = filterType;
    this.freq = freq;
    this.q = q;
    this.nodes = null;
  }

  set(volume) {
    const c = ac();
    if (!this.nodes && volume > 0) {
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = this.filterType;
      f.frequency.value = this.freq;
      f.Q.value = this.q;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(sfxBus);
      src.start();
      this.nodes = { src, g };
    }
    if (this.nodes) this.nodes.g.gain.setTargetAtTime(volume, c.currentTime, 0.4);
  }

  stop() {
    if (!this.nodes) return;
    const n = this.nodes;
    n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => n.src.stop(), 800);
    this.nodes = null;
  }
}

// ---------- Sprache ----------

function pickVoice(langCode) {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  const base = langCode.slice(0, 2);
  return (
    voices.find((v) => v.lang === langCode && v.localService) ||
    voices.find((v) => v.lang === langCode) ||
    voices.find((v) => v.lang.replace('_', '-').startsWith(base)) ||
    null
  );
}

export function voiceInfo(langCode) {
  const v = pickVoice(langCode);
  return v ? v.name : null;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function speak(text, { lang, rate = 0.85, pitch = 1.1 } = {}) {
  if (!text || !('speechSynthesis' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    let done = false;
    const finish = () => {
      if (!done) { done = true; resolve(); }
    };
    u.onend = finish;
    u.onerror = finish;
    // Android feuert `onend` nicht immer zuverlässig
    setTimeout(finish, 800 + text.length * 120);
    speechSynthesis.speak(u);
  });
}
