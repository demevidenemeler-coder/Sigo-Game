// Leise, fröhliche Xylophon-Hintergrundmusik – live erzeugt, endlos, ohne Dateien.
// Aufbau: Teil A (Melodie, 8 Takte) und Teil B (ruhige Begleitung, 8 Takte) wechseln sich ab,
// damit es nicht nervt.

import { audioContext, busses, setChannelVolume } from './audio.js';

const TEMPO = 100; // Schläge pro Minute
const EIGHTH = 60 / TEMPO / 2;

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(name) {
  const n = NOTE[name[0]] + (name[1] === '#' ? 1 : 0);
  const octave = +name[name.length - 1];
  return 440 * 2 ** ((n + (octave - 4) * 12 - 9) / 12);
}

// Je Takt 8 Achtel; '-' = Pause
const MELODY = [
  'E5 G5 A5 G5 E5 - C5 -',
  'D5 E5 D5 B4 G4 - - -',
  'C5 E5 A5 G5 E5 - C5 -',
  'F5 E5 D5 C5 A4 - - -',
  'G4 C5 E5 G5 A5 G5 E5 C5',
  'A5 - G5 - F5 E5 D5 -',
  'B4 D5 G5 F5 E5 D5 B4 -',
  'C5 - E5 - C5 - - -',
].map((bar) => bar.split(' '));

const CHORDS = ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C'];
const CHORD_NOTES = {
  C: ['C4', 'E4', 'G4'],
  G: ['G3', 'B3', 'D4'],
  Am: ['A3', 'C4', 'E4'],
  F: ['F3', 'A3', 'C4'],
};
const BASS = { C: ['C3', 'G2'], G: ['G2', 'D3'], Am: ['A2', 'E3'], F: ['F2', 'C3'] };

export class Music {
  constructor() {
    this.timer = null;
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
    while (this.next < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.next);
      this.step = (this.step + 1) % (16 * 8);
      this.next += EIGHTH;
    }
  }

  playStep(step, t) {
    const bar = Math.floor(step / 8) % 8;
    const beat = step % 8;
    const partB = step >= 64;
    const chord = CHORDS[bar];

    // Bass auf Schlag 1 und 3
    if (beat === 0 || beat === 4) bass(freq(BASS[chord][beat === 0 ? 0 : 1]), t);

    if (!partB) {
      const n = MELODY[bar][beat];
      if (n !== '-') xylo(freq(n), t, beat % 2 === 0 ? 0.32 : 0.24);
    } else if (beat % 2 === 0) {
      // Teil B: sanft gebrochene Akkorde
      const notes = CHORD_NOTES[chord];
      xylo(freq(notes[(beat / 2) % 3]) * 2, t, 0.17);
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
