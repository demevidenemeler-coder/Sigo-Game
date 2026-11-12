// Lieder und Instrument-Klänge der Tier-Band (Seite 1).
//
// Jede Runde spielt die Band ein anderes kleines Stück (Tempo, Takt, Tonart, Lichtfarbe). Ein Stück beschreibt nur
// die ROLLEN (Rhythmus, Begleitung, Melodie, Bass, Rassel); wie eine Rolle klingt, entscheidet das Instrument, das
// sich das Tier diese Runde gewünscht hat (KLANG). Alle Stimmen eines Stücks passen zueinander (Dur, fast nur
// Fünftonleiter) – jedes Zusammenspiel klingt, auch wenn nur zwei Tiere spielen.
//
// Schreibweise je Rolle: { schritt: wert }  (Schritt = Achtel im Muster, 0 … laenge-1)
//   rhythmus:   1 = kräftiger Schlag, 2 = leichter Schlag
//   begleitung: MIDI-Ton (gezupft)
//   melodie:    [MIDI, Dauer in Sekunden]
//   bass:       [MIDI, Dauer in Sekunden]
//   rassel:     Lautstärke

import { note } from '../../engine/index.js';

export const LIEDER = [
  {
    id: 'tanz', bpm: 84, laenge: 16, farbe: 0xfff0b8,
    rhythmus: { 0: 1, 2: 2, 4: 1, 6: 2, 8: 1, 10: 2, 12: 1, 13: 2, 14: 2 },
    begleitung: { 1: 67, 3: 72, 5: 76, 7: 72, 9: 69, 11: 72, 13: 69, 15: 67 },
    melodie: { 0: [67, 0.22], 2: [67, 0.22], 4: [64, 0.7], 8: [69, 0.22], 10: [69, 0.22], 12: [72, 0.5], 14: [67, 0.3] },
    bass: { 0: [48, 0.5], 2: [55, 0.4], 4: [52, 0.4], 6: [55, 0.4], 8: [53, 0.5], 10: [57, 0.4], 12: [60, 0.4], 14: [57, 0.4] },
    rassel: { 1: 0.3, 3: 0.3, 5: 0.3, 7: 0.36, 9: 0.3, 11: 0.3, 13: 0.3, 15: 0.36 },
    schluss: { bass: [48, 0.9], melodie: [72, 0.8], begleitung: 76 },
  },
  {
    id: 'marsch', bpm: 100, laenge: 16, farbe: 0xffd2a6,
    rhythmus: { 0: 1, 2: 2, 4: 1, 6: 2, 8: 1, 10: 2, 12: 1, 14: 2 },
    begleitung: { 2: 72, 6: 76, 10: 74, 14: 71 },
    melodie: { 0: [60, 0.25], 2: [64, 0.25], 4: [67, 0.5], 8: [67, 0.25], 10: [71, 0.25], 12: [74, 0.3], 14: [67, 0.4] },
    bass: { 0: [48, 0.4], 4: [55, 0.4], 8: [43, 0.4], 12: [50, 0.4] },
    rassel: { 1: 0.25, 3: 0.3, 5: 0.25, 7: 0.3, 9: 0.25, 11: 0.3, 13: 0.25, 15: 0.3 },
    schluss: { bass: [48, 0.9], melodie: [72, 0.8], begleitung: 76 },
  },
  {
    // Dreivierteltakt: zwei Takte zu je sechs Achteln
    id: 'walzer', bpm: 92, laenge: 12, farbe: 0xffcfe0,
    rhythmus: { 0: 1, 2: 2, 4: 2, 6: 1, 8: 2, 10: 2 },
    begleitung: { 2: 76, 4: 72, 8: 77, 10: 72 },
    melodie: { 0: [64, 0.6], 4: [67, 0.25], 6: [65, 0.6], 10: [69, 0.25] },
    bass: { 0: [48, 0.6], 6: [53, 0.6] },
    rassel: { 2: 0.3, 4: 0.3, 8: 0.3, 10: 0.3 },
    schluss: { bass: [48, 0.9], melodie: [64, 0.8], begleitung: 72 },
  },
  {
    // Wiegenlied: langsam und leise
    id: 'wiege', bpm: 66, laenge: 16, farbe: 0xcfe0ff,
    rhythmus: { 0: 2, 8: 2 },
    begleitung: { 0: 65, 2: 69, 4: 72, 6: 69, 8: 64, 10: 67, 12: 72, 14: 67 },
    melodie: { 0: [69, 0.9], 4: [67, 0.4], 6: [65, 0.4], 8: [64, 0.9], 12: [67, 0.9] },
    bass: { 0: [41, 0.9], 8: [48, 0.9] },
    rassel: { 6: 0.2, 14: 0.2 },
    schluss: { bass: [41, 1], melodie: [65, 0.9], begleitung: 69 },
  },
  {
    id: 'huepfen', bpm: 108, laenge: 16, farbe: 0xd2f2bc,
    rhythmus: { 0: 1, 3: 2, 4: 1, 6: 2, 8: 1, 11: 2, 12: 1, 14: 2 },
    begleitung: { 1: 67, 3: 71, 5: 74, 7: 71, 9: 72, 11: 76, 13: 79, 15: 76 },
    melodie: { 0: [67, 0.2], 2: [71, 0.2], 4: [74, 0.4], 8: [72, 0.2], 10: [76, 0.2], 12: [72, 0.4] },
    bass: { 0: [43, 0.3], 4: [50, 0.3], 8: [48, 0.3], 12: [55, 0.3] },
    rassel: { 1: 0.28, 3: 0.28, 5: 0.28, 7: 0.28, 9: 0.28, 11: 0.28, 13: 0.28, 15: 0.28 },
    schluss: { bass: [43, 0.9], melodie: [67, 0.8], begleitung: 74 },
  },
  {
    // Regentropfen: helle Zupftöne, ruhiger Schlag
    id: 'tropfen', bpm: 80, laenge: 16, farbe: 0xe2d6ff,
    rhythmus: { 0: 2, 6: 2, 8: 2, 14: 2 },
    begleitung: { 0: 72, 2: 79, 3: 76, 5: 79, 8: 74, 10: 79, 11: 71, 13: 74 },
    melodie: { 0: [72, 0.3], 2: [69, 0.3], 4: [67, 0.6], 8: [67, 0.3], 10: [69, 0.3], 12: [71, 0.3], 14: [74, 0.5] },
    bass: { 0: [48, 0.6], 8: [43, 0.6] },
    rassel: { 2: 0.25, 6: 0.25, 10: 0.25, 14: 0.25 },
    schluss: { bass: [48, 0.9], melodie: [72, 0.8], begleitung: 79 },
  },
];

// Wie jedes Instrument seine Rolle spielt. wert = Eintrag aus dem Muster (siehe oben), k = Zähler des Tieres.
// → true, wenn ein Ton erklang (dann zuckt das Instrument sichtbar)
export const KLANG = {
  trommel_gross: (w) => {
    note('trommel', w === 1 ? 36 : 38, { vol: w === 1 ? 0.85 : 0.3 });
    return true;
  },
  bongos: (w) => {
    if (w === 1) {
      note('xylo', 55, { vol: 0.85, dauer: 0.35 });
      note('trommel', 37, { vol: 0.18 });
    } else note('xylo', 62, { vol: 0.6, dauer: 0.3 });
    return true;
  },
  gitarre: (midi) => {
    note('pling', midi, { vol: 0.3 });
    return true;
  },
  tamburin: (midi, k) => {
    note('trommel', 42, { vol: 0.36 });
    if (k % 2 === 0) note('glocke', midi + 12, { vol: 0.06 });
    return true;
  },
  trompete: ([midi, d]) => {
    note('floete', midi, { vol: 0.5, dauer: d });
    return true;
  },
  floete: ([midi, d]) => {
    note('floete', midi + 12, { vol: 0.34, dauer: d });
    return true;
  },
  klavier_klein: ([midi, d]) => {
    note('klavier', midi, { vol: 0.5, dauer: d });
    return true;
  },
  glockenspiel_glocke: ([midi]) => {
    note('glocke', midi + 24, { vol: 0.2 });
    return true;
  },
  rassel: (v) => {
    note('trommel', 42, { vol: v });
    return true;
  },
  // Triangel nur auf jedem zweiten Rassel-Schlag (ein Klingeln auf jedem Achtel wäre zu viel)
  triangel: (v, k) => {
    if (k % 2 !== 0) return false;
    note('glocke', 91, { vol: 0.12 + v * 0.3 });
    return true;
  },
};

// Kurzer Ton beim Bekommen/Einschalten (passt immer: C-Dur)
export const ANSPIEL = {
  trommel_gross: () => note('trommel', 36, { vol: 0.5 }),
  bongos: () => note('xylo', 55, { vol: 0.6, dauer: 0.35 }),
  gitarre: () => note('pling', 72, { vol: 0.3 }),
  tamburin: () => note('trommel', 42, { vol: 0.4 }),
  trompete: () => note('floete', 67, { vol: 0.34, dauer: 0.25 }),
  floete: () => note('floete', 79, { vol: 0.28, dauer: 0.25 }),
  klavier_klein: () => note('klavier', 60, { vol: 0.36, dauer: 0.35 }),
  glockenspiel_glocke: () => note('glocke', 79, { vol: 0.24 }),
  rassel: () => note('trommel', 42, { vol: 0.32 }),
  triangel: () => note('glocke', 88, { vol: 0.22 }),
};

/** Schluss-Akkord eines Stücks für eine Rolle (null = diese Rolle schweigt beim Schluss nur nicht) */
export function schlussWert(lied, rolle) {
  if (rolle === 'rhythmus') return 1;
  if (rolle === 'rassel') return 0.3;
  return lied.schluss[rolle] ?? null;
}
