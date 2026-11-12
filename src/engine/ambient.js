// Tageszeit und Wetter einer Szene – immer weich.
//
//   ambient.set({zeit: 'tag'|'abend'|'nacht', wetter: 'klar'|'regen'|'schnee'}, {dauer = 2})
//   ambient.zeit, ambient.wetter
//
// Tönung: die günstigste Lösung – ein Farbton (tint) auf den Ebenen bg/world/front der Szene (kein Filter,
// kein zusätzlicher Zeichendurchgang). Abend warm-orange, Nacht blau und dunkler, aber nie finster.
// Der hud (Knöpfe) bleibt unverändert. Wetter: wenige, ruhige Teilchen in der front-Ebene (je höchstens 40,
// Regen fällt gemächlich). Beim Wechsel dünnt das alte Wetter aus (fallende Teilchen kommen nicht nach) und blendet
// weich aus; je Art gibt es höchstens eine Ebene – schnelles Hin- und Herschalten baut nichts doppelt.
// Die Wetter-Teilchen zählen zum gemeinsamen Teilchen-Budget (wetterAnzahl() für fx.js).
// Jeder Wechsel dauert mindestens 1,5 s. Beim Szenenwechsel ist wieder Tag und klar.

import { Container, Sprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { hasTex, tex } from './assets.js';
import { tween } from './tween.js';
import { SceneManager } from './scene.js';
import { sfx } from './audio.js';
import { rand } from './util.js';

const FARBEN = {
  tag: 0xffffff,
  abend: 0xffcfa0,   // warmes Orange
  nacht: 0x8592c9,   // Blau, gedämpft – Dinge bleiben gut erkennbar
};
const MIN_DAUER = 1.5;
const REGEN_ANZAHL = 28;
const SCHNEE_ANZAHL = 40;
const REGEN_TON_DAUER = 8;   // Sekunden: so lange klingt 'common/regen' – vorher nicht neu anstimmen

const zustand = {
  zeit: 'tag',
  wetter: 'klar',
  farbe: [255, 255, 255],
  farbTween: null,
  wetterObj: null,   // laufendes Wetter { c, art, teilchen, zeit, geht, blende }
  gehend: new Set(), // Wetter, das gerade ausdünnt und ausblendet
  regenTonBis: 0,    // performance.now(), bis zu dem der Regen-Ton noch klingt
};

// ---------------------------------------------------------------- Tönung

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const hexAus = ([r, g, b]) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

function toene(szene, farbe) {
  const wert = hexAus(farbe);
  for (const ebene of [szene.bg, szene.world, szene.front]) {
    if (!ebene.destroyed) ebene.tint = wert;
  }
}

function blendeFarbe(szene, ziel, dauer) {
  zustand.farbTween?.kill();
  const von = [...zustand.farbe];
  const nach = rgb(ziel);
  const proxy = { p: 0 };
  zustand.farbTween = tween(proxy, { p: 1 }, dauer, {
    ease: 'sineInOut',
    owner: szene,
    onUpdate: () => {
      if (!szene.alive) return;
      zustand.farbe = von.map((v, i) => v + (nach[i] - v) * proxy.p);
      toene(szene, zustand.farbe);
    },
  });
}

// ---------------------------------------------------------------- Wetter-Texturen

function leinwand(w, h, zeichne) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  zeichne(c.getContext('2d'), w, h);
  return Texture.from(c);
}

let regenTex = null;
let schneeTex = null;

function regenTextur() {
  if (!regenTex) {
    // weicher, kurzer Strich: oben durchsichtig, unten hell
    regenTex = leinwand(12, 96, (c, w, h) => {
      const v = c.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(225,240,255,0)');
      v.addColorStop(1, 'rgba(225,240,255,0.95)');
      c.fillStyle = v;
      c.beginPath();
      c.roundRect(2, 0, w - 4, h, (w - 4) / 2);
      c.fill();
    });
  }
  return regenTex;
}

function schneeTextur() {
  if (hasTex('common/p_schneeflocke')) return tex('common/p_schneeflocke');
  if (!schneeTex) {
    schneeTex = leinwand(48, 48, (c, g) => {
      const v = c.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
      v.addColorStop(0, 'rgba(255,255,255,1)');
      v.addColorStop(0.55, 'rgba(255,255,255,0.9)');
      v.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = v;
      c.fillRect(0, 0, g, g);
    });
  }
  return schneeTex;
}

// ---------------------------------------------------------------- Wetter

function setzeTeilchenNeu(t, art, oben) {
  const W = stage.W;
  t.x = rand(-W / 2 - 100, W / 2 + 100);
  t.y = oben ? rand(-200, -40) : rand(-100, stage.H);
  t.visible = true;
  if (art === 'regen') {
    t.vy = rand(260, 340);
    t.vx = t.vy * 0.12;
    t.scale.set(rand(0.8, 1.15));
    t.alpha = rand(0.3, 0.5);
  } else {
    t.vy = rand(45, 90);
    t.vx = rand(-8, 8);
    t.wiegen = rand(18, 40);
    t.wiegenF = rand(0.35, 0.8);
    t.phase = rand(0, Math.PI * 2);
    t.bx = t.x;
    const g = rand(26, 50);
    t.scale.set(g / Math.max(1, t.texture.width));
    t.rotation = rand(-0.5, 0.5);
    t.alpha = rand(0.75, 0.95);
  }
}

function baueWetter(szene, art) {
  const c = new Container({ label: 'wetter:' + art });
  c.zIndex = 7000;
  c.eventMode = 'none';
  c.alpha = 0;
  const anzahl = art === 'regen' ? REGEN_ANZAHL : SCHNEE_ANZAHL;
  const textur = art === 'regen' ? regenTextur() : schneeTextur();
  const teilchen = [];
  for (let i = 0; i < anzahl; i++) {
    const t = new Sprite(textur);
    t.anchor.set(0.5, art === 'regen' ? 1 : 0.5);
    if (art === 'regen') t.rotation = -Math.atan(0.12);
    setzeTeilchenNeu(t, art, false);
    c.addChild(t);
    teilchen.push(t);
  }
  szene.front.addChild(c);
  return { c, art, teilchen, zeit: 0, geht: false, blende: null };
}

function wetterSchritt(w, dt) {
  w.zeit += dt;
  const unten = stage.H + 120;
  for (const t of w.teilchen) {
    if (!t.visible) continue;
    if (w.art === 'regen') {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    } else {
      t.bx += t.vx * dt;
      t.y += t.vy * dt;
      t.x = t.bx + Math.sin(t.phase + w.zeit * t.wiegenF * Math.PI * 2) * t.wiegen;
    }
    if (t.y > unten) {
      // Geht das Wetter, kommt nichts nach – es dünnt aus
      if (w.geht) t.visible = false;
      else setzeTeilchenNeu(t, w.art, true);
    }
  }
}

/**
 * Wie viele Wetter-Teilchen gibt es gerade? (zählt zum Teilchen-Budget von fx.js) – auch ein Wetter, das gerade
 * erst einblendet, zählt schon voll mit, damit es beim Einblenden nicht zu viele werden.
 */
export function wetterAnzahl() {
  let n = 0;
  const zaehle = (w) => {
    if (!w || w.c.destroyed) return;
    for (const t of w.teilchen) if (t.visible) n++;
  };
  zaehle(zustand.wetterObj);
  for (const g of zustand.gehend) zaehle(g);
  return n;
}

let tickerAn = false;
function tick(ticker) {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  const w = zustand.wetterObj;
  if (w && !w.c.destroyed) wetterSchritt(w, dt);
  for (const g of zustand.gehend) {
    if (g.c.destroyed) zustand.gehend.delete(g);
    else wetterSchritt(g, dt);
  }
}

// Wetter weich ausdünnen und ausblenden; danach wird die Ebene abgebaut
function lasseGehen(szene, w, dauer) {
  w.geht = true;
  zustand.gehend.add(w);
  w.blende?.stop();
  w.blende = tween(w.c, { alpha: 0 }, dauer, {
    ease: 'sineInOut',
    owner: szene,
    onComplete: () => {
      zustand.gehend.delete(w);
      if (!w.c.destroyed) w.c.destroy({ children: true });
    },
  });
}

function wechsleWetter(szene, art, dauer) {
  const alt = zustand.wetterObj;
  if (alt && !alt.c.destroyed) lasseGehen(szene, alt, dauer);
  zustand.wetterObj = null;
  if (art !== 'regen' && art !== 'schnee') return;

  // Blendet dieses Wetter gerade noch aus? Dann dieselbe Ebene weich zurückholen statt eine neue zu bauen
  let w = [...zustand.gehend].find((g) => g.art === art && !g.c.destroyed);
  if (w) {
    zustand.gehend.delete(w);
    w.geht = false;
    for (const t of w.teilchen) if (!t.visible) setzeTeilchenNeu(t, art, true);
  } else {
    w = baueWetter(szene, art);
  }
  zustand.wetterObj = w;
  w.blende?.stop();
  w.blende = tween(w.c, { alpha: 1 }, dauer, { ease: 'sineInOut', owner: szene });

  // Regen-Ton nur, wenn nicht schon einer klingt (nichts überlagert sich zu Lärm)
  const jetzt = performance.now();
  if (art === 'regen' && jetzt >= zustand.regenTonBis) {
    zustand.regenTonBis = jetzt + REGEN_TON_DAUER * 1000;
    sfx('common/regen', { vol: 0.35 });
  }
  if (!tickerAn && stage.app) {
    tickerAn = true;
    stage.app.ticker.add(tick);
  }
}

// ---------------------------------------------------------------- Szenenwechsel

SceneManager.onExit(() => {
  zustand.farbTween?.kill();
  zustand.farbTween = null;
  zustand.zeit = 'tag';
  zustand.wetter = 'klar';
  zustand.farbe = [255, 255, 255];
  zustand.wetterObj = null; // Container gehen mit der front-Ebene
  zustand.gehend.clear();
});

// ---------------------------------------------------------------- Ausgang

export const ambient = {
  get zeit() { return zustand.zeit; },
  get wetter() { return zustand.wetter; },

  /** Tageszeit und/oder Wetter weich ändern: set({zeit, wetter}, {dauer = 2}). Fehlendes bleibt, wie es ist. */
  set({ zeit, wetter } = {}, { dauer = 2 } = {}) {
    const szene = SceneManager.current;
    if (!szene || !szene.alive) return;
    const d = Math.max(MIN_DAUER, dauer);
    if (zeit && FARBEN[zeit] !== undefined && zeit !== zustand.zeit) {
      zustand.zeit = zeit;
      blendeFarbe(szene, FARBEN[zeit], d);
    }
    if (wetter && wetter !== zustand.wetter && ['klar', 'regen', 'schnee'].includes(wetter)) {
      zustand.wetter = wetter;
      wechsleWetter(szene, wetter, d);
    }
  },
};
