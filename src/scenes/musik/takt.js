// Gemeinsamer Takt-Geber für den Musik-Ort.
//
//   const takt = new Takt({ bpm: 84, schritteProSchlag: 2, laenge: 16 });   // 2 Takte 4/4 in Achteln
//   takt.onSchritt = (i) => { … };   // i = 0 … laenge-1, einmal pro Achtel
//   update(dt) { takt.update(dt); }  // jedes Bild
//   takt.schlag                      // Schläge seit dem Start (Kommazahl, für Wippen im Takt)
//
// Die Zeit kommt bevorzugt aus der Ton-Uhr (AudioContext.currentTime): die läuft gleichmäßig, auch wenn die
// Bildrate schwankt. Ist der Ton noch nicht bereit (vor der ersten Berührung, Tab im Hintergrund), zählt dt.
// note() spielt sofort – ein Ton liegt also höchstens ein Bild (≈ 8 ms bei 120 Hz) neben dem Raster.

import { audioState } from '../../engine/index.js';

export class Takt {
  constructor({ bpm = 84, schritteProSchlag = 2, laenge = 16 } = {}) {
    this.bpm = bpm;
    this.schritteProSchlag = schritteProSchlag;
    this.laenge = laenge;
    this.schrittDauer = 60 / bpm / schritteProSchlag;
    this.onSchritt = null;
    this.reset();
  }

  /** Von vorn: der nächste update() spielt sofort Schritt 0 (Einsatz genau beim Antippen). */
  reset() {
    this.pos = 0;            // Schritte seit dem Start (Kommazahl)
    this.letzter = -1;       // zuletzt gespielter Schritt (ganzzahlig, fortlaufend)
    this._audioZeit = null;
  }

  /** Schläge seit dem Start (Kommazahl) */
  get schlag() {
    return this.pos / this.schritteProSchlag;
  }

  /** Stelle im Muster (0 … laenge-1) des zuletzt gespielten Schritts */
  get schritt() {
    return ((this.letzter % this.laenge) + this.laenge) % this.laenge;
  }

  update(dt) {
    let d = dt;
    const k = audioState.kontext;
    if (k && audioState.bereit) {
      const jetzt = k.currentTime;
      if (this._audioZeit !== null) {
        const ad = jetzt - this._audioZeit;
        // Sprünge (Tab war weg, Kontext neu) nicht übernehmen
        if (ad >= 0 && ad < 0.25) d = ad;
      }
      this._audioZeit = jetzt;
    } else {
      this._audioZeit = null;
    }
    d = Math.min(Math.max(d, 0), 0.25);

    // Schritt 0 gleich zu Beginn
    if (this.letzter < 0) {
      this.letzter = 0;
      this._feuere(0);
    }
    this.pos += d / this.schrittDauer;
    const ziel = Math.floor(this.pos);
    if (ziel > this.letzter) {
      // Hing ein Bild sehr lange, nicht mehrere Töne auf einmal nachholen – nur den aktuellen spielen
      this.letzter = ziel;
      this._feuere(ziel % this.laenge);
    }
  }

  _feuere(i) {
    try {
      this.onSchritt?.(i);
    } catch (e) {
      console.error('[musik] Fehler im Takt:', e);
    }
  }
}
