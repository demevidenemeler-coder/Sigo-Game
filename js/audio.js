// Geräusche werden live mit der Web Audio API erzeugt (keine Dateien, funktioniert offline).
// Sprache kommt aus der Sprachausgabe des Geräts (speechSynthesis).

let ctx = null;
let master = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.35; // bewusst leise
    master.connect(ctx.destination);
  }
  return ctx;
}

// Muss aus einer Berührung heraus aufgerufen werden (Browser-Regel).
export function unlockAudio() {
  const c = ac();
  if (c.state === 'suspended') c.resume();
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}

// ---------- Bausteine ----------

function envelope(gainNode, t0, attack, peak, decay) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone(type, freq, t0, attack, decay, peak = 0.4, dest = master) {
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

function lowpass(freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(master);
  return f;
}

function noise(t0, dur, peak, filterType = 'bandpass', freq = 1000) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  const g = ctx.createGain();
  src.connect(f).connect(g).connect(master);
  envelope(g, t0, 0.01, peak, dur);
  src.start(t0);
  return { src, filter: f, gain: g };
}

const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

// ---------- Geräusche ----------

const SOUNDS = {
  plop(t) {
    const o = tone('sine', 380, t, 0.005, 0.15, 0.35);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.12);
  },
  pop(t) {
    const o = tone('sine', 600, t, 0.005, 0.12, 0.3);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
  },
  poof(t) {
    const n = noise(t, 0.35, 0.3, 'bandpass', 900);
    n.filter.frequency.exponentialRampToValueAtTime(250, t + 0.3);
  },
  klack(t) {
    // Wagen kuppeln an
    noise(t, 0.05, 0.6, 'bandpass', 2200);
    tone('square', 180, t, 0.002, 0.08, 0.15, lowpass(900));
    noise(t + 0.09, 0.04, 0.4, 'bandpass', 1600);
  },
  splash(t) {
    const n = noise(t, 0.3, 0.35, 'lowpass', 2500);
    n.filter.frequency.exponentialRampToValueAtTime(400, t + 0.25);
    const o = tone('sine', 300, t, 0.005, 0.2, 0.2);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.18);
  },
  pling(t) {
    tone('sine', N.E5 * 2, t, 0.002, 0.6, 0.2);
    tone('sine', N.E5 * 2 * 2.76, t, 0.002, 0.2, 0.04);
  },
  chime(t) {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
      tone('sine', f, t + i * 0.16, 0.005, 1.2, 0.22);
      tone('sine', f * 2.76, t + i * 0.16, 0.005, 0.4, 0.04);
    });
  },
  whistle(t) {
    // Dampfpfeife: tuuu-tuuut
    for (const [dt, d] of [[0, 0.35], [0.45, 0.9]]) {
      for (const f of [N.D5, 740, 880]) tone('sine', f, t + dt, 0.06, d, 0.12);
      noise(t + dt, d, 0.05, 'highpass', 3000);
    }
  },
  elhorn(t) {
    // E-Lok: zweitoniges Signalhorn
    [[N.A4, 0, 0.35], [N.E5 * 0.9, 0.4, 0.6]].forEach(([f, dt, d]) => {
      const lp = lowpass(1600);
      tone('sawtooth', f, t + dt, 0.03, d, 0.18, lp);
      tone('sawtooth', f * 1.26, t + dt, 0.03, d, 0.12, lp);
    });
  },
  puff(t) {
    // Dampfstoß: tsch
    noise(t, 0.16, 0.18, 'bandpass', 1800);
  },
  clack(t) {
    // Schienenstoß: ta-tamm
    noise(t, 0.03, 0.22, 'bandpass', 700);
    noise(t + 0.11, 0.03, 0.18, 'bandpass', 650);
  },
  hum(t) {
    const o = tone('sawtooth', 90, t, 0.2, 0.9, 0.08, lowpass(300));
    o.frequency.linearRampToValueAtTime(130, t + 1.0);
  },
  scribble(t) {
    noise(t, 0.08, 0.05, 'bandpass', 3000);
  },
  boing(t) {
    const o = tone('triangle', 220, t, 0.005, 0.35, 0.3);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.3);
  },
};

const SOUND_LENGTH = { whistle: 1.4, elhorn: 1.0, chime: 1.2, poof: 0.4, pop: 0.2, puff: 0.2, clack: 0.2 };

// Spielt ein Geräusch; das Promise endet ungefähr, wenn es verklungen ist.
export function playSound(name) {
  const fn = SOUNDS[name];
  if (!fn) return Promise.resolve();
  const c = ac();
  fn(c.currentTime + 0.02);
  const ms = (SOUND_LENGTH[name] ?? 1.0) * 1000;
  return new Promise((r) => setTimeout(r, ms));
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
