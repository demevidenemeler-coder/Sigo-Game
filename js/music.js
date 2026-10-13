// Leise, fröhliche Hintergrundmusik – live erzeugt, endlos, ohne Dateien.
// Vier kurze Lieder wechseln sich ab. Jedes Lied: Melodie (8 Takte) – ruhiger Zwischenteil nur mit Begleitung
// (8 Takte) – noch einmal die Melodie. Danach kommt das nächste Lied, damit es nicht nervt.

import { audioContext, busses, setChannelVolume } from './audio.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const semi = (name) => NOTE[name[0]] + (name[1] === '#' ? 1 : 0);
const pitch = (s, octave) => 440 * 2 ** ((s + (octave - 4) * 12 - 9) / 12);
const freq = (name) => pitch(semi(name), +name[name.length - 1]);

// Akkord (z. B. 'C', 'Am', 'A#'): drei Töne in mittlerer Lage und zwei Basstöne (Grundton, Quinte)
function chord(name) {
  const minor = name.endsWith('m');
  const s = semi(minor ? name.slice(0, -1) : name);
  const low = s >= 5; // F, G, A, B liegen eine Oktave tiefer, damit alles in derselben Lage bleibt
  const root = pitch(s, low ? 3 : 4);
  const bass = pitch(s, low ? 2 : 3);
  return { notes: [root, root * 2 ** ((minor ? 3 : 4) / 12), root * 2 ** (7 / 12)], bass: [bass, low ? bass * 1.5 : bass * 0.75] };
}

const bars = (list) => list.map((bar) => bar.split(' '));

// Je Takt 8 Achtel; '-' = Pause. lead: Klang der Melodie, comp: Begleitung unter der Melodie
const SONGS = [
  { // Zuglied (das erste Lied des Spiels)
    tempo: 100, lead: 'xylo', comp: 'none',
    chords: ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C'],
    melody: bars([
      'E5 G5 A5 G5 E5 - C5 -',
      'D5 E5 D5 B4 G4 - - -',
      'C5 E5 A5 G5 E5 - C5 -',
      'F5 E5 D5 C5 A4 - - -',
      'G4 C5 E5 G5 A5 G5 E5 C5',
      'A5 - G5 - F5 E5 D5 -',
      'B4 D5 G5 F5 E5 D5 B4 -',
      'C5 - E5 - C5 - - -',
    ]),
  },
  { // Hopser: hüpft die Dreiklänge hinauf und hinunter
    tempo: 116, lead: 'xylo', comp: 'offbeat',
    chords: ['C', 'F', 'G', 'C', 'C', 'F', 'G', 'C'],
    melody: bars([
      'C5 E5 G5 E5 C5 E5 G5 -',
      'A5 F5 A5 F5 C6 - A5 -',
      'G5 B5 D6 B5 G5 - D5 -',
      'E5 G5 C6 G5 E5 - - -',
      'C5 E5 G5 E5 C5 E5 G5 -',
      'A5 C6 A5 F5 A5 - F5 -',
      'G5 F5 E5 D5 G5 - B4 -',
      'C5 - C5 E5 C5 - - -',
    ]),
  },
  { // Sonnenschein: ruhig und hell, wie ein Glockenspiel
    tempo: 96, lead: 'glock', comp: 'arp',
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'D', 'G'],
    melody: bars([
      'D5 - G5 - B5 A5 G5 -',
      'E5 - G5 - B5 - G5 -',
      'E5 G5 C6 - B5 A5 G5 -',
      'A5 - F#5 - D5 - - -',
      'D5 - G5 - B5 A5 G5 -',
      'E5 G5 B5 - G5 - E5 -',
      'D5 F#5 A5 F#5 D5 F#5 A5 -',
      'G5 - B5 - G5 - - -',
    ]),
  },
  { // Zirkusmarsch: flott, mit Tschingderassa-Begleitung
    tempo: 124, lead: 'pluck', comp: 'offbeat',
    chords: ['F', 'A#', 'C', 'F', 'Dm', 'A#', 'C', 'F'],
    melody: bars([
      'F5 - A5 C6 A5 - F5 -',
      'D5 - F5 A#5 F5 - D5 -',
      'E5 G5 C6 G5 E5 G5 C6 -',
      'A5 - F5 - C5 - - -',
      'D5 F5 A5 F5 D5 F5 A5 -',
      'A#5 A5 G5 F5 D5 - F5 -',
      'G5 - E5 - C5 E5 G5 -',
      'F5 - A5 - F5 - - -',
    ]),
  },
];
const SONG_STEPS = 3 * 8 * 8; // Melodie – Zwischenteil – Melodie

export class Music {
  constructor() {
    this.timer = null;
    this.song = Math.floor(Math.random() * SONGS.length);
    this.step = 0;
    this.next = 0;
    this.volume = 0.5;
  }

  start(volume = this.volume) {
    this.volume = volume;
    const ctx = audioContext();
    setChannelVolume('music', 0.55 * volume);
    if (this.timer) return;
    this.next = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() {
    if (!this.timer) return;
    setChannelVolume('music', 0);
    clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.timer) setChannelVolume('music', 0.55 * volume);
  }

  schedule() {
    const ctx = audioContext();
    if (ctx.state !== 'running') return; // Ton angehalten (Spiel im Hintergrund): nichts vorausplanen
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05; // nach einer Unterbrechung nicht alles nachholen
    while (this.next < ctx.currentTime + 0.2) {
      const song = SONGS[this.song];
      this.playStep(song, this.step, this.next);
      this.next += 60 / song.tempo / 2;
      this.step += 1;
      if (this.step >= SONG_STEPS) {
        // nächstes Lied, nach einer kleinen Atempause
        this.step = 0;
        this.song = (this.song + 1) % SONGS.length;
        this.next += 1.2;
      }
    }
  }

  playStep(song, step, t) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const part = Math.floor(step / 64); // 0 Melodie, 1 Zwischenteil, 2 Melodie
    const c = chord(song.chords[bar]);

    // Bass auf Schlag 1 und 3
    if (beat === 0 || beat === 4) bass(c.bass[beat === 0 ? 0 : 1], t);

    if (part !== 1) {
      const n = song.melody[bar][beat];
      if (n !== '-') LEADS[song.lead](freq(n), t, beat % 2 === 0 ? 0.32 : 0.24);
      // Begleitung unter der Melodie
      if (song.comp === 'offbeat' && (beat === 2 || beat === 6)) for (const f of c.notes) pad(f, t, 0.06);
      if (song.comp === 'arp' && beat % 2 === 0) xylo(c.notes[(beat / 2) % 3], t, 0.09);
    } else if (beat % 2 === 0) {
      // Zwischenteil: sanft gebrochene Akkorde
      xylo(c.notes[(beat / 2) % 3] * 2, t, 0.17);
    }

    // Leiser „Schienen-Rhythmus“ als Schüttelei
    if (beat % 2 === 1) shaker(t, beat === 7 ? 0.05 : 0.03);
  }
}

// ---------- Instrumente ----------

function voice(type, f, t, attack, decay, peak, dest) {
  const ctx = audioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

// Xylophon: Grundton + typische Obertöne des Holzklangs, kurz und weich
function xylo(f, t, vel) {
  const out = busses().music;
  voice('sine', f, t, 0.003, 0.55, vel, out);
  voice('sine', f * 3.93, t, 0.002, 0.12, vel * 0.25, out);
  voice('sine', f * 9.2, t, 0.001, 0.04, vel * 0.08, out);
}

// Glockenspiel: heller, klingt länger nach
function glock(f, t, vel) {
  const out = busses().music;
  voice('sine', f, t, 0.002, 1.1, vel * 0.8, out);
  voice('sine', f * 2.76, t, 0.002, 0.5, vel * 0.22, out);
  voice('sine', f * 5.4, t, 0.001, 0.2, vel * 0.1, out);
}

// Gezupft: kurzer, runder Ton (wie ein Spielzeug-Banjo)
function pluck(f, t, vel) {
  const ctx = audioContext();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.25);
  lp.connect(busses().music);
  voice('triangle', f, t, 0.004, 0.32, vel * 1.1, lp);
  voice('sine', f * 2, t, 0.003, 0.15, vel * 0.25, lp);
}

const LEADS = { xylo, glock, pluck };

// Akkord-Tupfer der Begleitung: ganz weich
function pad(f, t, vel) {
  voice('sine', f, t, 0.008, 0.22, vel, busses().music);
}

function bass(f, t) {
  const ctx = audioContext();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  lp.connect(busses().music);
  voice('triangle', f, t, 0.01, 0.4, 0.3, lp);
}

let shakerBuf = null;
function shaker(t, vel) {
  const ctx = audioContext();
  if (!shakerBuf) {
    shakerBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = shakerBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = shakerBuf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.value = vel;
  src.connect(hp).connect(g).connect(busses().music);
  src.start(t);
}
