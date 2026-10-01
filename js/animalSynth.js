// Nachgebaute Tierstimmen (für Tiere ohne freie Aufnahme): Stimm-Synthese Sample für Sample.
// Eine Stimme = Pulsfolge (Stimmlippen) mit natürlichem Zittern + Atemrauschen,
// gefiltert durch Formanten (Rachen/Maul), leicht übersteuert für Rauheit.
// Reine Rechenfunktionen ohne Browser-Abhängigkeit (lassen sich auch in Node testen).

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// Glatte Zufallskurve (für Zittern der Tonhöhe/Lautstärke)
function wobble(rand, rate, sr) {
  let v = 0;
  let target = rand();
  let left = sr / rate;
  return () => {
    if (--left <= 0) {
      target = rand();
      left = sr / rate;
    }
    v += (target - v) * (rate / sr) * 3;
    return v;
  };
}

// Resonator (2-Pol-Bandpass) für Formanten
function resonator(f, bw, sr) {
  const r = Math.exp((-Math.PI * bw) / sr);
  const a1 = 2 * r * Math.cos((2 * Math.PI * f) / sr);
  const a2 = -r * r;
  const g = 1 - r;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = g * x + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
}

function onePoleLP(f, sr) {
  const a = Math.exp((-2 * Math.PI * f) / sr);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
}

// Kurve aus Stützpunkten [[t, wert], …] (linear)
function curve(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i];
      const [t0, v0] = points[i - 1];
      if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
    return points[points.length - 1][1];
  };
}

// Eine Stimm-Phrase in out[] ab Sample start hineinmischen
function voice(out, sr, start, o) {
  const rand = rng(o.seed ?? 7);
  const jit = wobble(rand, o.jitterRate ?? 30, sr);
  const shim = wobble(rand, o.shimmerRate ?? 40, sr);
  const vib = o.vibrato ?? [0, 0];
  const formants = o.formants.map(([f, bw, gain]) => ({ fil: resonator(f, bw, sr), gain }));
  const breathLP = onePoleLP(o.breathTone ?? 3000, sr);
  const n = Math.floor(o.dur * sr);
  let phase = 0;
  let pulseCount = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / sr;
    const u = t / o.dur;
    let f0 = o.f0(u) * (1 + (o.jitter ?? 0.02) * jit()) + vib[1] * Math.sin(2 * Math.PI * vib[0] * t);
    // Unterton / Rauheit: jeder zweite Puls schwächer (typisch für Brüllen)
    phase += f0 / sr;
    if (phase >= 1) {
      phase -= 1;
      pulseCount++;
    }
    const sub = o.sub && pulseCount % 2 ? 1 - o.sub : 1;
    // Puls: schnell auf, weich ab (wie Stimmlippen)
    const p = phase < 0.4 ? Math.sin((phase / 0.4) * Math.PI) ** 2 : 0;
    const src = (p - 0.25) * sub * (1 + (o.shimmer ?? 0.1) * shim());
    const breath = breathLP(rand()) * (o.breath ?? 0.2) * (0.5 + p);
    const x = src + breath;
    let y = 0;
    for (const fm of formants) y += fm.fil(x) * fm.gain;
    y = Math.tanh(y * (o.drive ?? 1));
    out[start + i] += y * o.amp(u);
  }
}

function normalize(out, peak = 0.9) {
  // Gleichanteil entfernen (Hochpass ~30 Hz)
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < out.length; i++) {
    const y = out[i] - x1 + 0.995 * y1;
    x1 = out[i];
    out[i] = y1 = y;
  }
  let m = 0;
  for (const v of out) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / m;
  // weiches Ein-/Ausblenden gegen Knacksen
  const f = Math.min(400, out.length / 4);
  for (let i = 0; i < f; i++) {
    out[i] *= i / f;
    out[out.length - 1 - i] *= i / f;
  }
  return out;
}

const RECIPES = {
  // Löwe: tiefes, raues Brüllen mit Anschwellen, danach zwei kurze Grunzer
  loewe(sr) {
    const out = new Float32Array(Math.floor(2.6 * sr));
    voice(out, sr, 0, {
      dur: 1.7, seed: 11,
      f0: curve([[0, 95], [0.15, 170], [0.45, 160], [0.8, 115], [1, 70]]),
      amp: curve([[0, 0], [0.12, 0.8], [0.35, 1], [0.75, 0.85], [1, 0]]),
      formants: [[380, 140, 1.6], [820, 220, 1.1], [1500, 320, 0.45], [2600, 500, 0.2]],
      jitter: 0.06, jitterRate: 45, shimmer: 0.35, shimmerRate: 60, sub: 0.45,
      breath: 0.55, breathTone: 1800, drive: 3.2,
    });
    for (const [at, s] of [[1.85, 21], [2.2, 23]]) {
      voice(out, sr, Math.floor(at * sr), {
        dur: 0.28, seed: s,
        f0: curve([[0, 120], [0.3, 105], [1, 80]]),
        amp: curve([[0, 0], [0.15, 0.7], [0.5, 0.55], [1, 0]]),
        formants: [[330, 120, 1.6], [700, 200, 1.0], [1400, 300, 0.35]],
        jitter: 0.08, shimmer: 0.4, sub: 0.5, breath: 0.6, breathTone: 1500, drive: 3,
      });
    }
    return normalize(out);
  },
  // Elefant: schmetterndes, rauhes Trompeten mit Kiekser nach oben
  elefant(sr) {
    const out = new Float32Array(Math.floor(1.6 * sr));
    voice(out, sr, 0, {
      dur: 1.45, seed: 5,
      f0: curve([[0, 380], [0.12, 520], [0.18, 640], [0.3, 600], [0.7, 560], [1, 470]]),
      amp: curve([[0, 0], [0.06, 0.9], [0.2, 1], [0.8, 0.85], [1, 0]]),
      formants: [[1100, 260, 1.2], [2300, 380, 1.0], [3400, 500, 0.6], [600, 200, 0.4]],
      vibrato: [9, 18], jitter: 0.05, jitterRate: 35, shimmer: 0.4, sub: 0.3,
      breath: 0.85, breathTone: 6000, drive: 5,
    });
    return normalize(out, 0.8);
  },
  // Pferd: hohes, zitterndes Wiehern, abfallend, am Ende Schnauben
  pferd(sr) {
    const out = new Float32Array(Math.floor(1.7 * sr));
    voice(out, sr, 0, {
      dur: 1.3, seed: 9,
      f0: curve([[0, 700], [0.08, 1050], [0.3, 900], [0.7, 600], [1, 420]]),
      amp: curve([[0, 0], [0.05, 1], [0.6, 0.8], [1, 0]]),
      formants: [[900, 200, 1.2], [1800, 300, 1.0], [2800, 400, 0.4]],
      vibrato: [13, 60], jitter: 0.04, shimmer: 0.3, breath: 0.3, breathTone: 4000, drive: 2.2,
    });
    // Schnauben: nur Atem, kein Ton
    voice(out, sr, Math.floor(1.32 * sr), {
      dur: 0.3, seed: 3, f0: () => 60, amp: curve([[0, 0], [0.1, 0.5], [1, 0]]),
      formants: [[700, 500, 1], [1800, 800, 0.6]], breath: 2.2, breathTone: 2500, drive: 1.5, shimmer: 0,
    });
    return normalize(out, 0.8);
  },
  // Ente: zwei nasale „Quaak“
  ente(sr) {
    const out = new Float32Array(Math.floor(0.75 * sr));
    for (const [at, s] of [[0, 4], [0.36, 8]]) {
      voice(out, sr, Math.floor(at * sr), {
        dur: 0.3, seed: s,
        f0: curve([[0, 420], [0.3, 400], [1, 300]]),
        amp: curve([[0, 0], [0.08, 1], [0.6, 0.8], [1, 0]]),
        formants: [[1300, 180, 1.4], [2600, 300, 0.9], [800, 150, 0.4]],
        jitter: 0.03, shimmer: 0.2, sub: 0.3, breath: 0.25, breathTone: 5000, drive: 3,
      });
    }
    return normalize(out, 0.8);
  },
  // Pinguin: kurze, trötende Rufe
  pinguin(sr) {
    const out = new Float32Array(Math.floor(1.1 * sr));
    for (const [at, s, f] of [[0, 2, 520], [0.3, 6, 560], [0.62, 10, 480]]) {
      voice(out, sr, Math.floor(at * sr), {
        dur: 0.26, seed: s,
        f0: curve([[0, f], [0.4, f * 1.08], [1, f * 0.85]]),
        amp: curve([[0, 0], [0.1, 1], [0.7, 0.7], [1, 0]]),
        formants: [[1000, 200, 1.2], [2100, 300, 0.8]],
        vibrato: [20, 15], jitter: 0.03, shimmer: 0.25, sub: 0.25, breath: 0.2, drive: 2.5,
      });
    }
    return normalize(out, 0.75);
  },
};

export const SYNTH_ANIMALS = Object.keys(RECIPES);

export function renderAnimal(id, sr) {
  return RECIPES[id] ? RECIPES[id](sr) : null;
}
