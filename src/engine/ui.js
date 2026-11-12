// Oberfläche für kleine Hände: runde Knöpfe, die Leiste unten (tray), Zähler ohne Ziffern,
// die Zeige-Hand mit Leerlauf-Hinweisen und der Album-Knopf oben rechts.
//
// Alles liegt in der hud-Ebene der aktuellen Szene (Koordinaten 0…stage.W / 0…stage.H) und wird mit der
// Szene aufgeräumt. Tweens gehören automatisch der aktuellen Szene.

import { Circle, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi';
import { stage } from './stage.js';
import { hasTex, tex, meta } from './assets.js';
import { tween, killTweensOf, scaleFeedback } from './tween.js';
import { tap, drag, onInput, isInputLocked } from './input.js';
import { SceneManager } from './scene.js';
import { store } from './store.js';
import { note, sfx } from './audio.js';

const RAND = 70;            // oben/unten frei für Systemgesten
const KERN_HALB = 1066;     // halbe Breite des Kernbereichs

// ---------------------------------------------------------------- Hilfen

function leinwand(w, h, zeichne) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  zeichne(c.getContext('2d'), w, h);
  return Texture.from(c);
}

function aktuelleSzene() {
  const s = SceneManager.current;
  return s && s.alive ? s : null;
}

// tex darf 'pack/name', eine Textur oder ein fertiges Anzeige-Objekt sein. Ergebnis wird auf `groesse` eingepasst.
function bildAus(quelle, groesse) {
  let o;
  if (typeof quelle === 'string') {
    o = new Sprite(tex(quelle));
    o.anchor.set(0.5);
  } else if (quelle instanceof Texture) {
    o = new Sprite(quelle);
    o.anchor.set(0.5);
  } else if (quelle && typeof quelle.addChild === 'function') {
    o = quelle;
  } else {
    o = new Container();
  }
  const b = o.getLocalBounds();
  const gross = Math.max(b.width, b.height) || 1;
  o.scale.set(groesse / gross);
  // Anzeige-Objekte ohne Anker: Mitte auf 0,0 legen
  if (!(o instanceof Sprite)) o.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
  return o;
}

// Weicher runder Schatten (wird gestaucht unter Knöpfe gelegt)
let schattenTex = null;
function schattenTextur() {
  if (schattenTex) return schattenTex;
  schattenTex = leinwand(128, 128, (c, g) => {
    const v = c.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
    v.addColorStop(0, 'rgba(70,50,30,0.32)');
    v.addColorStop(0.6, 'rgba(70,50,30,0.18)');
    v.addColorStop(1, 'rgba(70,50,30,0)');
    c.fillStyle = v;
    c.fillRect(0, 0, g, g);
  });
  return schattenTex;
}

// Runde Knopf-Platte, weiß/hell (wird mit der Farbe eingefärbt), mit weichem Rand und Glanz
let platteTex = null;
function platteTextur() {
  if (platteTex) return platteTex;
  platteTex = leinwand(256, 256, (c, g) => {
    const m = g / 2;
    const r = g / 2 - 6;
    // Rand (etwas dunkler)
    c.fillStyle = '#d8d0c4';
    c.beginPath();
    c.arc(m, m, r, 0, Math.PI * 2);
    c.fill();
    // Fläche mit sanftem Verlauf von oben
    const v = c.createLinearGradient(0, m - r, 0, m + r);
    v.addColorStop(0, '#ffffff');
    v.addColorStop(1, '#ece6dc');
    c.fillStyle = v;
    c.beginPath();
    c.arc(m, m - 3, r - 12, 0, Math.PI * 2);
    c.fill();
    // Glanz oben links
    const gl = c.createRadialGradient(m - r * 0.35, m - r * 0.45, 0, m - r * 0.35, m - r * 0.45, r * 0.6);
    gl.addColorStop(0, 'rgba(255,255,255,0.7)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    c.beginPath();
    c.arc(m, m - 3, r - 12, 0, Math.PI * 2);
    c.fill();
  });
  return platteTex;
}

// Ist ein Anzeige-Objekt wirklich zu sehen?
function sichtbar(o) {
  if (!o || o.destroyed || !o.parent) return false;
  for (let p = o; p; p = p.parent) {
    if (!p.visible || !p.renderable || p.alpha < 0.05) return false;
  }
  const b = o.getBounds();
  const r = stage.app.screen;
  return b.width > 1 && b.x < r.width && b.y < r.height && b.x + b.width > 0 && b.y + b.height > 0;
}

// Ort in hud-Koordinaten: Anzeige-Objekt → Mitte seiner Fläche; {x, y} → Szenen-Koordinaten
function ortInHud(z, hud) {
  if (!z) return null;
  if (typeof z.getBounds === 'function') {
    if (z.destroyed || !z.parent) return null;
    // Figuren: Mitte des Körpers (ohne Denkblase)
    const teil = z.koerper || z;
    const b = teil.getBounds();
    return hud.toLocal({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  }
  if (typeof z.x === 'number' && typeof z.y === 'number') return { x: z.x + stage.W / 2, y: z.y };
  return null;
}

// hält eine Position aktuell, wenn sich die Bildschirmbreite ändert; endet mit dem Container
function beiGroesse(container, fn) {
  const ab = stage.on('resize', () => { if (!container.destroyed) fn(); });
  container.once('destroyed', ab);
  fn();
}

// ---------------------------------------------------------------- Knopf

/**
 * Runder Knopf: button(tex, {x, y, size=220, onTap, parent, farbe, sound}). tex = 'pack/icon', Textur oder
 * Anzeige-Objekt (z. B. gezeichnete Graphics). Gibt den Container zurück (mit .markiere(an), .setIcon(tex), .off()).
 */
function button(quelle, opt = {}) {
  const size = Math.max(200, opt.size ?? 220);
  const r = size / 2;
  const knopf = new Container({ label: 'knopf' });
  knopf.position.set(opt.x ?? 0, opt.y ?? 0);
  if (opt.z !== undefined) knopf.zIndex = opt.z;

  const schatten = new Sprite(schattenTextur());
  schatten.anchor.set(0.5);
  schatten.width = size * 1.08;
  schatten.height = size * 1.08;
  schatten.y = size * 0.06;
  knopf.addChild(schatten);

  // Leuchtring für „ausgewählt" (weich, kein Blinken)
  const ring = new Graphics().circle(0, 0, r + 10).stroke({ width: 14, color: 0xffd45e, alpha: 0.9 });
  ring.alpha = 0;
  knopf.addChild(ring);

  let platte;
  if (hasTex('common/knopf_rund')) {
    platte = new Sprite(tex('common/knopf_rund'));
    platte.anchor.set(0.5);
    platte.scale.set(size / Math.max(platte.texture.width, platte.texture.height));
  } else {
    platte = new Sprite(platteTextur());
    platte.anchor.set(0.5);
    platte.width = size;
    platte.height = size;
  }
  if (opt.farbe !== undefined) platte.tint = opt.farbe;
  else if (!hasTex('common/knopf_rund')) platte.tint = 0xfff6e6;
  knopf.addChild(platte);

  let icon = bildAus(quelle, size * 0.6);
  knopf.addChild(icon);

  const parent = opt.parent || aktuelleSzene()?.hud;
  parent?.addChild(knopf);

  const h = tap(knopf, (e) => opt.onTap?.(e), {
    hitArea: new Circle(0, 0, r + 25),
    sound: opt.sound === undefined ? 'common/tipp' : opt.sound,
  });

  knopf.markiere = (an) => {
    killTweensOf(ring, ['alpha']);
    tween(ring, { alpha: an ? 1 : 0 }, 0.5, { ease: 'sineInOut' });
  };
  knopf.setIcon = (neu) => {
    const alt = icon;
    icon = bildAus(neu, size * 0.6);
    icon.alpha = 0;
    knopf.addChild(icon);
    tween(icon, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    tween(alt, { alpha: 0 }, 0.4, { ease: 'sineInOut' }).then(() => { if (!alt.destroyed) alt.destroy(); });
  };
  knopf.off = () => h.off();
  return knopf;
}

// ---------------------------------------------------------------- Pfeile (für die Leiste)

function pfeilIcon(richtung) {
  const echt = richtung > 0 ? 'common/icon_pfeil_rechts' : 'common/icon_pfeil_links';
  if (hasTex(echt)) return echt;
  const g = new Graphics();
  g.roundPoly(0, 0, 70, 3, 18, (richtung > 0 ? 0 : Math.PI) + Math.PI / 2).fill(0x8a6a48);
  return g;
}

// ---------------------------------------------------------------- Leiste (tray)

/**
 * Leiste unten mit großen Dingen: tray(scene, {items:[{id, tex, scale}], y, x | versatz, onPick, onTap, onDrop,
 * targets, ziehbar=true, abstand=260}). x = feste hud-Stelle der Mitte; versatz = Abstand zur Bildmitte (bleibt
 * bei anderen Bildschirmbreiten richtig).
 * - Antippen/Herausziehen: Beim Berühren entsteht sofort eine Kopie in scene.front, die am Finger hängt.
 * - Bequem: {targets: () => [...], onDrop(item, target, sprite, ctx)} – ohne Treffer (oder bei Rückgabe false)
 *   gleitet die Kopie zurück in die Leiste und verschwindet; mit Treffer wird sie aufs Ziel gelegt und blendet
 *   weich aus, außer onDrop ruft ctx.behalten() – dann gehört die Kopie der Szene.
 * - Selbst machen: onPick(item, sprite, pointerEvent) – die Szene hängt drag(sprite, …) an; die Leiste reicht die
 *   Berührung danach an die Kopie weiter, so dass das Ziehen sofort weiterläuft.
 * Gibt {container, sprite(id), item(id), blaettern(richtung), off()} zurück.
 */
function tray(scene, opt = {}) {
  const items = opt.items || [];
  const abstand = Math.max(230, opt.abstand ?? 260);
  const fach = Math.min(210, abstand - 30);   // Größe der Dinge
  const hoehe = 250;
  const ziehbar = opt.ziehbar ?? true;

  const c = new Container({ label: 'tray' });
  c.zIndex = 8000;
  scene.hud.addChild(c);
  const brett = new Graphics();
  const inhalt = new Container();
  c.addChild(brett, inhalt);

  // Wie viele passen in den Kernbereich?
  const alle = items.length * abstand + 60 <= 2 * KERN_HALB;
  const n = alle ? items.length : Math.max(1, Math.floor((2 * KERN_HALB - 2 * 240 - 40) / abstand));
  let start = 0;
  const breite = Math.max(1, n) * abstand + 60;

  // Brett: warmes Holz mit weichem Schatten und hellem Streifen oben
  brett
    .roundRect(-breite / 2, -hoehe / 2 + 12, breite, hoehe, 64).fill({ color: 0x5a4630, alpha: 0.16 })
    .roundRect(-breite / 2, -hoehe / 2, breite, hoehe, 64).fill(0xe3bd86).stroke({ width: 8, color: 0xc89a60 })
    .roundRect(-breite / 2 + 18, -hoehe / 2 + 14, breite - 36, hoehe * 0.32, 44).fill({ color: 0xf3d7aa, alpha: 0.55 });
  brett.alpha = 0.96;

  // Fächer
  const faecher = items.map((item, i) => {
    const f = new Container({ label: 'fach:' + item.id });
    const bild = bildAus(item.tex ?? item.id, fach * (item.scale ?? 1));
    f.addChild(bild);
    f.hitArea = new Rectangle(-abstand / 2, -hoehe / 2 - 20, abstand, hoehe + 40);
    f.eventMode = 'static';
    f.cursor = 'pointer';
    inhalt.addChild(f);
    const eintrag = { item, f, bild, unterwegs: 0, index: i };
    f.on('pointerdown', (e) => nimm(e, eintrag));
    return eintrag;
  });

  const xVon = (i) => (i - (n - 1) / 2) * abstand;

  function zeigeSeite(animiert) {
    faecher.forEach((e, i) => {
      const stelle = (i - start + items.length) % items.length;
      const drin = stelle < n;
      e.f.eventMode = drin ? 'static' : 'none';
      killTweensOf(e.f, ['alpha', 'x']);
      if (drin) {
        if (animiert) {
          e.f.x = xVon(stelle) + 60;
          tween(e.f, { alpha: 1, x: xVon(stelle) }, 0.45, { ease: 'sineInOut', delay: 0.15 });
        } else {
          e.f.x = xVon(stelle);
          e.f.alpha = 1;
        }
      } else if (animiert) {
        tween(e.f, { alpha: 0 }, 0.25, { ease: 'sineInOut' });
      } else {
        e.f.alpha = 0;
      }
    });
  }

  function blaettern(richtung = 1) {
    if (alle) return;
    start = (start + richtung * n + items.length * 10) % items.length;
    zeigeSeite(true);
  }

  if (!alle) {
    const pfeilAbstand = breite / 2 + 130;
    button(pfeilIcon(-1), { x: -pfeilAbstand, y: 0, size: 200, parent: c, onTap: () => blaettern(-1) });
    button(pfeilIcon(1), { x: pfeilAbstand, y: 0, size: 200, parent: c, onTap: () => blaettern(1) });
  }
  zeigeSeite(false);

  beiGroesse(c, () => {
    c.x = opt.x ?? stage.W / 2 + (opt.versatz ?? 0);
    c.y = opt.y ?? stage.H - RAND - hoehe / 2 - 10;
  });

  // Ein Ding aus der Leiste nehmen: Kopie in scene.front, die sofort am Finger hängt
  function nimm(e, eintrag) {
    if (isInputLocked() || c.destroyed || !scene.alive) return;
    e.stopPropagation();
    const { item, bild, f } = eintrag;

    if (!ziehbar) {
      sfx('common/tipp');
      tween(bild, { y: -18 }, 0.12, { ease: 'quadOut' }).then(() => tween(bild, { y: 0 }, 0.3, { ease: 'bounceOut' }));
      opt.onTap?.(item, bild);
      return;
    }

    // Kopie mit gleicher Größe und gleichem Ort, aber in der Szene
    const kopie = new Sprite(bild instanceof Sprite ? bild.texture : Texture.WHITE);
    kopie.anchor.set(0.5);
    kopie.label = 'trayKopie:' + item.id;
    kopie.zIndex = 5000;
    const g = bild.getGlobalPosition();
    const lokal = scene.front.toLocal(g);
    kopie.position.set(lokal.x, lokal.y);
    kopie.scale.set(Math.abs(bild.scale.x) * c.scale.x, Math.abs(bild.scale.y) * c.scale.y);
    scene.front.addChild(kopie);

    eintrag.unterwegs++;
    killTweensOf(f, ['alpha']);
    tween(f, { alpha: 0.3 }, 0.25, { ease: 'sineInOut' });
    const zurueckInsFach = () => {
      eintrag.unterwegs = Math.max(0, eintrag.unterwegs - 1);
      if (eintrag.unterwegs === 0 && !f.destroyed) tween(f, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
    };
    sfx('common/tipp');
    opt.onTap?.(item, kopie);

    if (opt.onPick) {
      // Die Szene hängt selbst drag() an; das Fach füllt sich wieder, sobald der Finger loslässt – oder sobald der
      // Finger verloren geht (Fenster verliert den Fokus, Spiel im Hintergrund) oder die Kopie verschwindet.
      // Genau einmal, und danach hängen keine Hörer mehr am Fenster.
      const id = e.pointerId;
      let erledigt = false;
      const fertig = () => {
        if (erledigt) return;
        erledigt = true;
        window.removeEventListener('pointerup', los);
        window.removeEventListener('pointercancel', los);
        window.removeEventListener('blur', fertig);
        document.removeEventListener('visibilitychange', versteckt);
        if (!kopie.destroyed) kopie.off('destroyed', fertig);
        zurueckInsFach();
      };
      const los = (ev) => { if (ev.pointerId === id) fertig(); };
      const versteckt = () => { if (document.hidden) fertig(); };
      window.addEventListener('pointerup', los);
      window.addEventListener('pointercancel', los);
      window.addEventListener('blur', fertig);
      document.addEventListener('visibilitychange', versteckt);
      kopie.once('destroyed', fertig);
      try { opt.onPick(item, kopie, e); } catch (err) { console.error('[sigo] Fehler in onPick:', err); }
      if (!kopie.destroyed && kopie.listenerCount('pointerdown') > 0) kopie.emit('pointerdown', e);
      return;
    }

    const weg = (dauer = 0.35) => {
      killTweensOf(kopie, ['scaleX', 'scaleY', 'scale', 'alpha']);
      return tween(kopie, { scale: Math.abs(kopie.scale.y) * 0.3, alpha: 0 }, dauer, { ease: 'sineInOut' })
        .then(() => { if (!kopie.destroyed) kopie.destroy(); });
    };

    drag(kopie, {
      targets: opt.targets,
      lift: 1.12,
      radius: opt.radius,
      onMove: opt.onMove ? (ziel, ctx) => opt.onMove(item, ziel, kopie, ctx) : undefined,
      onDrop: (ziel, ctx) => {
        zurueckInsFach();
        kopie.eventMode = 'none'; // nach dem Loslassen nicht noch einmal greifbar (sonst doppelt gefüttert)
        let behalten = false;
        ctx.behalten = () => { behalten = true; kopie.eventMode = 'static'; };
        let ergebnis;
        if (ziel) {
          try { ergebnis = opt.onDrop?.(item, ziel, kopie, ctx); } catch (err) { console.error('[sigo] Fehler in onDrop:', err); }
        }
        if (!ziel || ergebnis === false) {
          // zurück in die Leiste gleiten und dort verschwinden
          ctx.back(0.45).then(() => weg(0.25));
          return;
        }
        if (behalten) return;
        if (!ctx.erledigt) ctx.snapTo(ziel, 0.25);
        tween({ t: 0 }, { t: 1 }, 0.2).then(() => weg(0.4));
      },
    });
    kopie.emit('pointerdown', e);
  }

  return {
    container: c,
    /** Das Bild eines Dings in der Leiste (z. B. für die Zeige-Hand) */
    sprite: (id) => faecher.find((e) => e.item.id === id)?.bild || null,
    item: (id) => items.find((it) => it.id === id) || null,
    blaettern,
    off() { if (!c.destroyed) c.destroy({ children: true }); },
  };
}

// ---------------------------------------------------------------- Zähler ohne Ziffern

/**
 * Bild + bis zu 10 kleine Kopien statt Ziffern: counter(tex, {x, y, parent, max=10}) → {container, set(n), add(k), n}
 */
function counter(quelle, opt = {}) {
  const max = opt.max ?? 10;
  const c = new Container({ label: 'zaehler' });
  c.position.set(opt.x ?? 0, opt.y ?? 0);
  c.zIndex = opt.z ?? 8500;
  const icon = bildAus(quelle, opt.size ?? 130);
  c.addChild(icon);
  const reihe = new Container();
  reihe.x = (opt.size ?? 130) * 0.5 + 40;
  c.addChild(reihe);
  (opt.parent || aktuelleSzene()?.hud)?.addChild(c);

  const klein = 46;
  const lueck = 54;
  let n = 0;
  let huepfer = 0; // Marke des letzten Hüpfers (ein neuer löst den alten ab)

  // kleine Kopie des Bildes; bei gezeichneten Bildern ein runder Punkt
  const mini = (i) => {
    const kopierbar = typeof quelle === 'string' || quelle instanceof Texture;
    const m = kopierbar
      ? bildAus(quelle, klein)
      : new Graphics().circle(0, 0, klein / 2 - 6).fill(0xffd45e).stroke({ width: 4, color: 0xe0a93a });
    m.x = i * lueck + klein / 2;
    return m;
  };

  const zaehler = {
    container: c,
    get n() { return n; },
    set(wert) {
      n = Math.max(0, Math.round(wert));
      reihe.removeChildren().forEach((k) => k.destroy());
      for (let i = 0; i < Math.min(n, max); i++) reihe.addChild(mini(i));
      return zaehler;
    },
    add(k = 1) {
      const vorher = n;
      n = Math.max(0, n + k);
      for (let i = vorher; i < Math.min(n, max); i++) {
        const m = mini(i);
        const s = Math.abs(m.scale.y);
        m.scale.set(0);
        reihe.addChild(m);
        tween(m, { scale: s }, 0.45, { ease: 'backOut', delay: (i - vorher) * 0.12 });
      }
      // kleiner Hüpfer des Bildes
      const marke = ++huepfer;
      killTweensOf(icon, ['y']);
      tween(icon, { y: -22 }, 0.16, { ease: 'quadOut' }).then((ok) => {
        if (ok && marke === huepfer && !icon.destroyed) tween(icon, { y: 0 }, 0.35, { ease: 'bounceOut' });
      });
      return zaehler;
    },
  };
  return zaehler.set(opt.n ?? 0);
}

// ---------------------------------------------------------------- Zeige-Hand

let handTex = null;
function handTextur() {
  if (hasTex('common/hand')) return tex('common/hand');
  if (handTex) return handTex;
  // Zeigende Hand, Fingerspitze oben (Anker dort). Erst dicker Rand, dann die Füllung darüber.
  handTex = leinwand(220, 290, (c) => {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const teile = (fn) => {
      c.beginPath(); c.roundRect(86, 16, 52, 160, 26); fn();      // Zeigefinger
      c.beginPath(); c.roundRect(50, 128, 136, 136, 52); fn();    // Handfläche
      c.beginPath(); c.arc(160, 140, 26, 0, Math.PI * 2); fn();  // gebeugte Finger
      c.beginPath(); c.arc(176, 176, 24, 0, Math.PI * 2); fn();
      c.beginPath(); c.arc(176, 212, 22, 0, Math.PI * 2); fn();
      c.beginPath(); c.ellipse(52, 186, 24, 44, -0.45, 0, Math.PI * 2); fn(); // Daumen
    };
    // weicher Schatten
    c.save();
    c.translate(6, 8);
    c.fillStyle = 'rgba(60,40,25,0.18)';
    teile(() => c.fill());
    c.restore();
    c.strokeStyle = '#b77e5c';
    c.lineWidth = 12;
    teile(() => c.stroke());
    c.fillStyle = '#ffe3c9';
    teile(() => c.fill());
    // Fingernagel und Glanz
    c.fillStyle = '#ffd0d6';
    c.beginPath(); c.roundRect(98, 26, 28, 30, 13); c.fill();
    const gl = c.createRadialGradient(92, 160, 0, 92, 160, 70);
    gl.addColorStop(0, 'rgba(255,255,255,0.45)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    c.fillRect(30, 90, 140, 140);
  });
  return handTex;
}

let ringTex = null;
function ringTextur() {
  if (ringTex) return ringTex;
  ringTex = leinwand(128, 128, (c, g) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(g / 2, g / 2, g / 2 - 8, 0, Math.PI * 2);
    c.stroke();
  });
  return ringTex;
}

let aktiveHand = null; // { c, weg(dauer) }

function handWeg(dauer = 0.3) {
  const h = aktiveHand;
  aktiveHand = null;
  if (h) h.weg(dauer);
}

/**
 * Zeige-Hand (nie mehr als eine): hand(ziel) tippt zweimal sanft auf ziel (Anzeige-Objekt oder {x, y} in
 * Szenen-Koordinaten); hand({von, nach}) zeigt eine Ziehbewegung von → nach. Verschwindet danach von selbst
 * und sofort bei jeder Berührung. → Promise (wenn fertig)
 */
function hand(ziel) {
  handWeg(0.25);
  const szene = aktuelleSzene();
  if (!szene || !ziel) return Promise.resolve();
  const hud = szene.hud;
  const ziehen = ziel.von !== undefined && ziel.nach !== undefined;
  const a = ortInHud(ziehen ? ziel.von : ziel, hud);
  const b = ziehen ? ortInHud(ziel.nach, hud) : null;
  if (!a || (ziehen && !b)) return Promise.resolve();

  const c = new Container({ label: 'zeigeHand' });
  c.zIndex = 9800;
  c.eventMode = 'none';
  const t = handTextur();
  const finger = new Sprite(t);
  // Anker an der Fingerspitze (erzeugte Hand) bzw. aus pack.json
  if (hasTex('common/hand')) {
    // echtes Bild zeigt schon nach oben links; Anker an der Fingerspitze (Punkt 'spitze'), sonst Bildmitte
    const m = meta('common/hand');
    const spitze = m.pts?.spitze;
    if (spitze) finger.anchor.set(spitze[0] / m.w, spitze[1] / m.h);
    else finger.anchor.set(m.ax, m.ay);
  } else {
    finger.anchor.set(112 / 220, 18 / 290);
    finger.rotation = -0.35;
  }
  finger.scale.set(230 / Math.max(t.width, t.height));
  const ring = new Sprite(ringTextur());
  ring.anchor.set(0.5);
  ring.alpha = 0;
  c.addChild(ring, finger);
  c.alpha = 0;
  hud.addChild(c);

  let geist = null; // halb durchsichtige Kopie des gezogenen Dings
  let fertig = false;
  const eintrag = {
    c,
    weg(dauer) {
      if (fertig || c.destroyed) return;
      fertig = true;
      killTweensOf(c, ['alpha', 'x', 'y']);
      tween(c, { alpha: 0 }, dauer, { ease: 'sineInOut' }).then(() => {
        if (!c.destroyed) c.destroy({ children: true });
        if (geist && !geist.destroyed) geist.destroy();
      });
      if (geist && !geist.destroyed) tween(geist, { alpha: 0 }, dauer, { ease: 'sineInOut' });
    },
  };
  aktiveHand = eintrag;
  const lebt = () => !fertig && !c.destroyed;

  const druecken = async () => {
    if (!lebt()) return;
    ring.scale.set(0.3);
    ring.alpha = 0;
    tween(finger, { scale: Math.abs(finger.scale.y) * 0.9 }, 0.2, { ease: 'sineInOut' });
    await tween(c, { y: c.y + 10 }, 0.2, { ease: 'sineInOut' });
    if (!lebt()) return;
    // weicher Ring an der Fingerspitze (langsam ein- und ausgeblendet, kein Aufblitzen)
    tween(ring, { alpha: 0.5 }, 0.3, { ease: 'sineInOut' }).then(() => tween(ring, { alpha: 0 }, 0.6, { ease: 'sineInOut' }));
    tween(ring, { scale: 1.3 }, 0.9, { ease: 'quadOut' });
    tween(finger, { scale: Math.abs(finger.scale.y) / 0.9 }, 0.25, { ease: 'sineInOut' });
    await tween(c, { y: c.y - 10 }, 0.25, { ease: 'sineInOut' });
  };

  const ablauf = async () => {
    if (!ziehen) {
      c.position.set(a.x + 90, a.y + 110);
      tween(c, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      await tween(c, { x: a.x, y: a.y }, 0.7, { ease: 'sineInOut' });
      await druecken();
      await tween({ t: 0 }, { t: 1 }, 0.15);
      await druecken();
      await tween({ t: 0 }, { t: 1 }, 0.4);
    } else {
      c.position.set(a.x + 60, a.y + 80);
      tween(c, { alpha: 1 }, 0.4, { ease: 'sineInOut' });
      await tween(c, { x: a.x, y: a.y }, 0.6, { ease: 'sineInOut' });
      if (!lebt()) return;
      await druecken();
      // Geist des Dings, das gezogen werden soll
      const von = ziel.von;
      if (lebt() && von instanceof Sprite && !von.destroyed) {
        geist = new Sprite(von.texture);
        geist.anchor.copyFrom(von.anchor);
        const g = von.getGlobalPosition();
        const l = hud.toLocal(g);
        geist.position.set(l.x, l.y);
        const ws = von.worldTransform;
        const s = Math.hypot(ws.a, ws.b) / (hud.worldTransform.a || 1);
        geist.scale.set(s);
        geist.alpha = 0;
        geist.zIndex = 9810; // über der Hand: die Hand „hält" das Ding
        geist.eventMode = 'none';
        hud.addChild(geist);
        tween(geist, { alpha: 0.55 }, 0.3, { ease: 'sineInOut' });
      }
      const dx = geist ? geist.x - c.x : 0;
      const dy = geist ? geist.y - c.y : 0;
      await tween(c, { x: b.x, y: b.y }, 1.4, {
        ease: 'sineInOut',
        onUpdate: () => { if (geist && !geist.destroyed) geist.position.set(c.x + dx, c.y + dy); },
      });
      await tween({ t: 0 }, { t: 1 }, 0.35);
    }
    if (aktiveHand === eintrag) aktiveHand = null;
    eintrag.weg(0.5);
  };
  return ablauf();
}

// ---------------------------------------------------------------- Leerlauf-Hinweise

let hinweiseAn = false;

/**
 * Nach 6 s ohne Eingabe fragt der Kern scene.hints() und zeigt die Hand, danach alle 8 s wieder (mit dem
 * nächsten Ziel aus der Liste). Nach 3 unbeachteten Hinweisen ist Ruhe bis zur nächsten Berührung.
 * Einmal in main.js aufrufen.
 */
function startHinweise(manager = SceneManager, { erst = 6, dann = 8, hoechstens = 3 } = {}) {
  if (hinweiseAn) return;
  hinweiseAn = true;
  let gezeigt = 0;
  let naechste = erst;
  const zuruecksetzen = () => { gezeigt = 0; naechste = erst; };
  onInput(() => { zuruecksetzen(); handWeg(0.3); });
  manager.onEnter(() => { zuruecksetzen(); aktiveHand = null; });
  manager.onIdle((szene, idle) => {
    // eine Szene darf eine Hand mehr erlauben (SeitenSzene: die letzte zeigt auf den Blätter-Pfeil)
    const max = Number.isFinite(szene.hinweisHaende) ? szene.hinweisHaende : hoechstens;
    if (gezeigt >= max || idle < naechste) return;
    let liste = [];
    try {
      liste = (szene.hints?.() || []).filter((z) => {
        if (!z) return false;
        if (z.von !== undefined) return sichtbar(z.von) && (typeof z.nach.getBounds !== 'function' || sichtbar(z.nach));
        if (typeof z.getBounds === 'function') return sichtbar(z);
        return typeof z.x === 'number';
      });
    } catch (e) {
      console.error('[sigo] Fehler in hints():', e);
    }
    naechste = idle + dann;
    if (!liste.length) return;
    hand(liste[gezeigt % liste.length]);
    gezeigt++;
  }, { after: 0.5 });
}

// ---------------------------------------------------------------- Album-Knopf

let album = null; // { knopf, punkte, szene }

function albumIcon() {
  if (hasTex('common/icon_album')) return 'common/icon_album';
  // Buch mit Stern auf dem Umschlag
  const g = new Graphics();
  g.roundRect(-62, -52, 124, 104, 14).fill(0x7aa7d8).stroke({ width: 6, color: 0x4f7fb5 });
  g.roundRect(-62, -52, 20, 104, 8).fill(0x5d8cc4);
  g.roundRect(52, -44, 8, 88, 3).fill(0xf6efe2);
  g.star(8, 0, 5, 32, 15).fill(0xffd45e).stroke({ width: 4, color: 0xe9b23c });
  return g;
}

function albumAnzahl() {
  const n = Number(store.get('album.sterne', 0));
  return Number.isFinite(n) ? n : 0;
}

function zeichneAlbumPunkte() {
  if (!album || album.punkte.destroyed) return;
  const n = Math.min(10, albumAnzahl());
  const p = album.punkte;
  p.clear();
  for (let i = 0; i < n; i++) {
    // kleine Sterne in einer Reihe mittig unter dem Knopf
    p.star((i - (n - 1) / 2) * 40, 0, 5, 18, 8.5).fill(0xffd45e).stroke({ width: 3, color: 0xe0a93a });
  }
}

/**
 * Album öffnen und dabei sagen, woher das Kind kommt – damit der Zurück-Knopf des Albums genau dorthin führt:
 * go('album', {von: id der Szene, zurück: Startwerte für den Rückweg}). `zurück` sind die Startwerte der Szene
 * (scene.params), ergänzt um ihren jetzigen Stand aus scene.rückkehr() (Seiten-Orte: {seite: n}).
 */
function albumOeffnen(scene) {
  const params = {};
  if (scene && typeof scene.id === 'string') {
    let stand = null;
    try {
      stand = typeof scene.rückkehr === 'function' ? scene.rückkehr() : null;
    } catch (e) {
      console.error('[sigo] Fehler in rückkehr():', e);
    }
    params.von = scene.id;
    params.zurück = { ...(scene.params || {}), ...(stand || {}) };
  }
  return SceneManager.go('album', params);
}

/** Album-Knopf oben rechts in die Szene setzen (Knopf mit Sterne-Zähler; öffnet das Album mit Rückweg). */
function albumKnopf(scene = aktuelleSzene(), opt = {}) {
  if (!scene) return null;
  const knopf = button(albumIcon(), {
    size: 200,
    parent: scene.hud,
    z: 9000,
    onTap: () => {
      if (SceneManager.has('album')) albumOeffnen(scene);
      else opt.onTap?.();
    },
  });
  const punkte = new Graphics();
  punkte.position.set(0, 135);
  knopf.addChild(punkte);
  album = { knopf, punkte, scene };
  knopf.once('destroyed', () => { if (album && album.knopf === knopf) album = null; });
  beiGroesse(knopf, () => knopf.position.set(stage.W - RAND - 100 - 10, RAND + 100 + 10));
  zeichneAlbumPunkte();
  return knopf;
}

/** Ort des Album-Knopfs in hud-Koordinaten (auch ohne Knopf: Ecke oben rechts). */
function albumPos() {
  if (album && !album.knopf.destroyed) return { x: album.knopf.x, y: album.knopf.y };
  return { x: stage.W - RAND - 110, y: RAND + 110 };
}

/** Ein Stern mehr im Album: Zähler +1, Knopf hüpft kurz, leiser Glockenton. → neue Anzahl */
function albumPlus() {
  const n = albumAnzahl() + 1;
  store.set('album.sterne', n);
  note('glocke', 88, { vol: 0.45 });
  if (album && !album.knopf.destroyed) {
    // kurz größer und zurück – über die gemeinsame Ruhe-Größe, verträgt sich also mit dem Antippen
    scaleFeedback(album.knopf, [[1.12, 1.12, 0.16, 'quadOut']], { rueck: [0.45, 'backOut'] });
    zeichneAlbumPunkte();
  }
  return n;
}

// ---------------------------------------------------------------- Ausgang

export const ui = {
  button,
  tray,
  counter,
  hand,
  handWeg,
  startHinweise,
  albumKnopf,
  albumPos,
  albumPlus,
  get albumAnzahl() { return albumAnzahl(); },
};
