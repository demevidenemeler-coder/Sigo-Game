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

// Gezupfte Saite (Karplus-Strong)
function pluck(freq, t0, dur = 1.4, peak = 0.6, damping = 0.996) {
  const sr = ctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const y = buf.getChannelData(0);
  const n = Math.max(2, Math.round(sr / freq));
  for (let i = 0; i < n; i++) y[i] = Math.random() * 2 - 1;
  for (let i = n; i < len; i++) y[i] = damping * 0.5 * (y[i - n] + y[i - n + 1]);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = peak;
  src.connect(g).connect(master);
  src.start(t0);
}

const N = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

// ---------- Geräusche ----------

const SOUNDS = {
  plop(t) {
    const o = tone('sine', 380, t, 0.005, 0.15, 0.35);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.12);
  },
  chime(t) {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
      tone('sine', f, t + i * 0.16, 0.005, 1.2, 0.22);
      tone('sine', f * 2.76, t + i * 0.16, 0.005, 0.4, 0.04);
    });
  },
  drum(t) {
    for (const dt of [0, 0.32, 0.5]) {
      const o = tone('sine', 170, t + dt, 0.003, 0.35, 0.9);
      o.frequency.exponentialRampToValueAtTime(50, t + dt + 0.3);
      noise(t + dt, 0.07, 0.25, 'bandpass', 1500);
    }
  },
  piano(t) {
    [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => {
      tone('triangle', f, t + i * 0.2, 0.004, 1.0, 0.45);
      tone('sine', f * 2, t + i * 0.2, 0.004, 0.5, 0.12);
    });
  },
  guitar(t) {
    [196, 246.94, N.D4, N.G4].forEach((f, i) => pluck(f, t + i * 0.1));
  },
  banjo(t) {
    [N.G4, N.D5, N.G4, N.E5, N.D5].forEach((f, i) => pluck(f, t + i * 0.12, 0.8, 0.5, 0.99));
  },
  trumpet(t) {
    [[N.G4, 0, 0.25], [N.C5, 0.3, 0.6]].forEach(([f, dt, d]) => {
      const lp = lowpass(900, 2);
      lp.frequency.setValueAtTime(900, t + dt);
      lp.frequency.linearRampToValueAtTime(2600, t + dt + 0.08);
      tone('sawtooth', f, t + dt, 0.04, d, 0.3, lp);
    });
  },
  violin(t) {
    const lp = lowpass(2800);
    const o = tone('sawtooth', N.A4, t, 0.25, 1.2, 0.22, lp);
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = 6;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 1.5);
  },
  sax(t) {
    [[N.D4, 0, 0.3], [N.G4, 0.35, 0.7]].forEach(([f, dt, d]) => {
      tone('square', f, t + dt, 0.05, d, 0.18, lowpass(1300, 1.5));
    });
  },
  accordion(t) {
    const lp = lowpass(1800);
    for (const f of [N.C4, N.E4, N.G4]) {
      tone('sawtooth', f, t, 0.08, 1.0, 0.12, lp);
      tone('sawtooth', f * 1.006, t, 0.08, 1.0, 0.12, lp);
    }
  },
  bell(t) {
    [1, 2.76, 5.4, 8.9].forEach((r, i) => tone('sine', 660 * r, t, 0.002, 2.0 / (i + 1), 0.3 / (i + 1)));
  },
  horn(t) {
    for (const dt of [0, 0.3]) {
      const lp = lowpass(1500);
      tone('square', 330, t + dt, 0.01, 0.2, 0.2, lp);
      tone('square', 415, t + dt, 0.01, 0.2, 0.2, lp);
    }
  },
  siren(t) {
    // Tatü-tata: tiefer und hoher Ton im Wechsel
    [N.A4, N.D5, N.A4, N.D5].forEach((f, i) => tone('triangle', f, t + i * 0.42, 0.03, 0.36, 0.35));
  },
  whistle(t) {
    for (const f of [N.D5, N.G5 * 0.75, 880]) tone('sine', f, t, 0.08, 0.9, 0.14);
    noise(t, 0.9, 0.05, 'highpass', 3000);
  },
  engine(t) {
    const lp = lowpass(350);
    const o = tone('sawtooth', 58, t, 0.1, 1.0, 0.5, lp);
    o.frequency.linearRampToValueAtTime(75, t + 0.8);
    const trem = ctx.createOscillator();
    const tg = ctx.createGain();
    trem.frequency.value = 9;
    tg.gain.value = 15;
    trem.connect(tg).connect(o.frequency);
    trem.start(t);
    trem.stop(t + 1.2);
  },
  whoosh(t) {
    const n = noise(t, 1.4, 0.5, 'bandpass', 300);
    n.filter.Q.value = 1.5;
    n.filter.frequency.setValueAtTime(300, t);
    n.filter.frequency.exponentialRampToValueAtTime(2200, t + 0.6);
    n.filter.frequency.exponentialRampToValueAtTime(300, t + 1.3);
  },
  heli(t) {
    for (let i = 0; i < 10; i++) noise(t + i * 0.1, 0.07, 0.4, 'lowpass', 450);
  },
  bikebell(t) {
    for (const dt of [0, 0.22]) {
      tone('sine', 2100, t + dt, 0.002, 0.5, 0.2);
      tone('sine', 2100 * 2.76, t + dt, 0.002, 0.2, 0.05);
    }
  },
  boathorn(t) {
    const lp = lowpass(500);
    tone('sawtooth', 110, t, 0.15, 1.3, 0.35, lp);
    tone('sawtooth', 138.6, t, 0.15, 1.3, 0.25, lp);
  },
};

const SOUND_LENGTH = { siren: 1.7, heli: 1.1, whoosh: 1.4, boathorn: 1.4, chime: 1.2, drum: 0.9, banjo: 0.9 };

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
