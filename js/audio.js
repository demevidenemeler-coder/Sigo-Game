// Alle Geräusche werden live mit der Web Audio API erzeugt (keine Dateien, funktioniert offline).
// Drei Kanäle: Effekte, Motor (Dampf, Rollen, Schienenstöße) und Musik – getrennt regelbar.
// Sprache kommt aus der Sprachausgabe des Geräts (speechSynthesis).

let ctx = null;
let sfxBus = null;
let engineBus = null;
let musicBus = null;
let noiseBuf = null;

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

const SOUND_LENGTH = { whistle: 1.6, elhorn: 1.2, chime: 1.2, poof: 0.4, pop: 0.2, hiss: 1.4 };

// Spielt ein Geräusch; das Promise endet ungefähr, wenn es verklungen ist.
export function playSound(name) {
  const fn = SOUNDS[name];
  if (!fn) return Promise.resolve();
  const c = ac();
  fn(c.currentTime + 0.02);
  const ms = (SOUND_LENGTH[name] ?? 1.0) * 1000;
  return new Promise((r) => setTimeout(r, ms));
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
export function railJoint(strength = 1) {
  const c = ac();
  const t = c.currentTime + 0.01;
  noise(t, 0.035, 0.5 * strength, 'bandpass', 2600, engineBus, 3);
  const o = tone('sine', 95, t, 0.002, 0.09, 0.55 * strength, engineBus);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
}

// Dauerton: Rollen der Räder (+ Brummen der E-Lok), Lautstärke folgt der Geschwindigkeit
export class RollingSound {
  constructor() {
    this.nodes = null;
  }

  start(electric) {
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
    if (electric) {
      const hg = c.createGain();
      hg.gain.value = 0;
      const hl = c.createBiquadFilter();
      hl.type = 'lowpass';
      hl.frequency.value = 500;
      hl.connect(hg).connect(engineBus);
      nodes.hum = [55, 110.5, 220].map((f) => {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(hl);
        o.start();
        return o;
      });
      nodes.hg = hg;
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
      n.hg.gain.setTargetAtTime(0.02 + speed01 * 0.06, t, 0.2);
      n.hum.forEach((o, i) => o.frequency.setTargetAtTime([55, 110.5, 220][i] * (1 + speed01 * 1.2), t, 0.2));
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
