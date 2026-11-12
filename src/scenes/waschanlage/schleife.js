// Ein Geräusch als Schleife, das man wieder anhalten kann (Wasserstrahl nur, solange Wasser läuft; Motor nur,
// solange ein Fahrzeug rollt). Der Kern kann mit sfx() nur einmal abspielen – darum dieser kleine Helfer.
//
//   const s = new Schleife('common/wasserstrahl', { vol: 0.6 });
//   s.an();  s.aus(0.4);  s.ende();   // ende() in exit() der Szene
//
// Lautstärke: Der Klang hängt hinter dem Hauptregler des Kerns (audioState.ausgang ist der letzte Knoten) –
// darum wird hier selbst eingerechnet, was der Kern sonst für Geräusche nimmt (Grundpegel × Regler² × Haupt).
// Fehlt der Ton oder ist der Ton-Kern (noch) nicht bereit, bleibt es einfach still.

import { audioState, audioUrls } from '../../engine/index.js';

const GERAEUSCH_BASIS = 0.8 * 0.7;   // wie im Kern: BASIS.sfx × MASTER
const puffer = new Map();            // id → { ctx, versprechen }

function holePuffer(ctx, id) {
  const alt = puffer.get(id);
  if (alt && alt.ctx === ctx) return alt.versprechen;
  const url = audioUrls.get(id);
  if (!url) return Promise.resolve(null);
  const versprechen = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((daten) => (daten ? ctx.decodeAudioData(daten) : null))
    .catch(() => null);
  puffer.set(id, { ctx, versprechen });
  return versprechen;
}

export class Schleife {
  constructor(id, { vol = 0.6 } = {}) {
    this.id = id;
    this.vol = vol;
    this.soll = false;     // soll gerade klingen
    this.quelle = null;
    this.gain = null;
    this.ctx = null;
    this._tot = false;
  }

  _pegel() {
    const g = audioState.einst?.geraeusche ?? 0.9;
    return this.vol * GERAEUSCH_BASIS * g * g;
  }

  /** Weich einblenden (läuft schon: nichts Neues). */
  an(ein = 0.25) {
    if (this._tot) return;
    this.soll = true;
    if (!audioState.bereit) return;
    const ctx = audioState.kontext;
    if (this.quelle && this.ctx === ctx) {
      // läuft noch (evtl. gerade beim Ausblenden): wieder hochziehen
      const t = ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(this._pegel(), t + ein);
      return;
    }
    if (this._laedt) return;
    this._laedt = true;
    holePuffer(ctx, this.id).then((buf) => {
      this._laedt = false;
      if (this._tot || !this.soll || !buf || !audioState.bereit || audioState.kontext !== ctx) return;
      const ziel = audioState.ausgang;
      if (!ziel) return;
      try {
        const q = ctx.createBufferSource();
        q.buffer = buf;
        q.loop = true;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(this._pegel(), t + ein);
        q.connect(g).connect(ziel);
        q.start(t, Math.random() * Math.max(0, buf.duration - 0.5));
        this.quelle = q;
        this.gain = g;
        this.ctx = ctx;
      } catch (e) {
        console.warn('[waschanlage] Schleife', this.id, e);
      }
    });
  }

  /** Weich ausblenden und anhalten. */
  aus(dauer = 0.4) {
    this.soll = false;
    const q = this.quelle;
    const g = this.gain;
    if (!q || !g) return;
    this.quelle = null;
    this.gain = null;
    try {
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + dauer);
      q.stop(t + dauer + 0.05);
      q.onended = () => { try { q.disconnect(); g.disconnect(); } catch { /* schon weg */ } };
    } catch { /* Kontext schon zu */ }
  }

  /** Sofort weich beenden, danach nichts mehr (für exit()). */
  ende() {
    this.aus(0.2);
    this._tot = true;
  }
}
