// Geräusch als Schleife, die man jederzeit weich anhalten kann (z. B. Wasserstrahl nur solange gespritzt wird).
// Der Kern kann (noch) keine Geräusch-Schleifen anhalten: sfx() spielt eine Datei immer bis zum Ende. Darum spielt
// diese kleine Hilfe die Datei selbst über den Audio-Kontext des Kerns und hängt sich an dessen Ausgang.
// Lautstärke folgt dem Geräusche-Regler der Eltern (gleiche Rechnung wie der Kern: Basis 0,8 × Regler² × Master 0,7).
//
//   const s = new TonSchleife('common/wasserstrahl', { vol: 0.6 });
//   s.an();  s.aus();  s.weg();   // weg() in verlassen()/exit() aufrufen

import { audioState, audioUrls } from '../../engine/index.js';

const puffer = new Map(); // `${url}` → { ctx, p: Promise<AudioBuffer|null> }

function ladePuffer(ctx, url) {
  const alt = puffer.get(url);
  if (alt && alt.ctx === ctx) return alt.p;
  const p = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((daten) => (daten ? ctx.decodeAudioData(daten) : null))
    .catch(() => null);
  puffer.set(url, { ctx, p });
  return p;
}

export class TonSchleife {
  constructor(id, { vol = 0.6, ein = 0.15, aus = 0.3 } = {}) {
    this.id = id;
    this.vol = vol;
    this.einZeit = ein;
    this.ausZeit = aus;
    this.soll = false;      // soll gerade klingen?
    this.lauf = null;       // { quelle, gain, ctx }
    this.marke = 0;
  }

  _pegel() {
    const regler = audioState.einst?.geraeusche ?? 0.9;
    return this.vol * 0.8 * regler * regler * 0.7;
  }

  /** Weich einblenden (läuft schon: nichts). */
  an() {
    this.soll = true;
    if (this.lauf) {
      // war gerade beim Ausblenden: wieder hoch
      const { gain, ctx } = this.lauf;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(this._pegel(), t + this.einZeit);
      try { this.lauf.quelle.stop(t + 3600); } catch { /* schon geplant */ }
      return;
    }
    const ctx = audioState.kontext;
    const url = audioUrls.get(this.id);
    if (!ctx || !url || !audioState.bereit || !audioState.ausgang) return;
    const marke = ++this.marke;
    ladePuffer(ctx, url).then((buf) => {
      if (!buf || !this.soll || marke !== this.marke || this.lauf || ctx !== audioState.kontext) return;
      const quelle = ctx.createBufferSource();
      quelle.buffer = buf;
      quelle.loop = true;
      // Stille am Anfang und Ende der Datei nicht mitschleifen
      quelle.loopStart = Math.min(0.15, buf.duration * 0.05);
      quelle.loopEnd = Math.max(quelle.loopStart + 0.5, buf.duration - 0.25);
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(this._pegel(), t + this.einZeit);
      quelle.connect(gain).connect(audioState.ausgang);
      quelle.start(t, Math.random() * Math.max(0, quelle.loopEnd - 1));
      const lauf = { quelle, gain, ctx };
      quelle.onended = () => {
        try { gain.disconnect(); } catch { /* egal */ }
        if (this.lauf === lauf) this.lauf = null;
      };
      this.lauf = lauf;
    });
  }

  /** Weich ausblenden. */
  aus() {
    this.soll = false;
    this.marke++;
    const l = this.lauf;
    if (!l) return;
    const t = l.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + this.ausZeit);
    try { l.quelle.stop(t + this.ausZeit + 0.05); } catch { /* schon beendet */ }
  }

  /** Sofort (aber ohne Knacksen) beenden – beim Verlassen. */
  weg() {
    this.ausZeit = Math.min(this.ausZeit, 0.12);
    this.aus();
  }
}
