// Bauen: Die Kamera steht nah an der Baustelle (buildSite.js), unten liegt die Leiste mit den Bauteilen.
//
// - Obere Reihe: Themen (Haus, Burg, Zirkus, Rakete, Laden, Märchen) · Fächer (Stockwerke, Türen, Fenster,
//   Dächer, Spitzen, Schmuck; der Themen-Knopf links klappt die Auswahl der Themen auf) · ↩ letzten Schritt zurück · 💥 Bagger reißt alles ab · ✅ fertig (Richtfest).
// - Untere Reihe: die Teile des Fachs. Antippen → das Teil wird gebaut. Was gerade nicht passt, ist blass.
// - Finger ziehen = ums Gebäude herum schauen, zwei Finger = näher/weiter. Teil am Gebäude antippen = andere Farbe.

import * as THREE from 'three';
import { THEMES, CATS, catOf, partsOf } from '../buildParts.js';
import { renderThumbnails } from '../thumbs.js';
import { TEMPLATES } from '../buildMore.js';

const THEME_KEY = 'sigo.site.theme';
const ALBUM_KEY = 'sigo.site.album';
const ALBUM_MAX = 12; // so viele eigene Fotos bleiben im Album
const NEXT_CAT = { doors: 'windows', windows: 'roofs', roofs: 'tops', tops: 'decos' };

export function createBuildMode(game) {
  const { services, land, train } = game;
  const site = () => game.buildSite; // entsteht erst nach den Modi
  let theme = 'haus';
  try {
    theme = THEMES[localStorage.getItem(THEME_KEY)] ? localStorage.getItem(THEME_KEY) : 'haus';
  } catch { /* ohne Speicher geht es trotzdem */ }
  let cat = 'levels';
  let picking = false; // untere Reihe zeigt gerade die Themen statt der Teile
  let browsing = false; // untere Reihe zeigt gerade das Album (eigene Fotos und Vorlagen)
  // Album: eigene Gebäude als Beschreibung (Text) – die Bilder dazu werden bei Bedarf neu gerendert
  let album = [];
  try {
    album = (JSON.parse(localStorage.getItem(ALBUM_KEY)) ?? []).filter((j) => typeof j === 'string');
  } catch { /* ohne Speicher geht es trotzdem */ }
  const saveAlbum = () => { try { localStorage.setItem(ALBUM_KEY, JSON.stringify(album)); } catch { /* egal */ } };
  const flash = document.createElement('div');
  flash.className = 'site-flash';
  game.ui.append(flash);
  let active = false;

  // ---------- Leiste ----------
  const panel = document.createElement('div');
  panel.className = 'site-panel hidden';
  const tabs = document.createElement('div');
  tabs.className = 'site-tabs';
  const partsRow = document.createElement('div');
  partsRow.className = 'site-parts';
  panel.append(tabs, partsRow);
  game.ui.append(panel);

  const button = (parent, cls, onTap) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.addEventListener('click', onTap);
    parent.append(b);
    return b;
  };
  // Bewohner nutzen die Figuren-Bilder der Werkstatt, alles andere die Bauteil-Vorschau
  const item = (id) => ({ kind: catOf(id) === 'folk' ? 'cargo' : 'site', id });
  const thumb = (id) => `url(${renderThumbnails([item(id)])[`${item(id).kind}:${id}`]})`;

  function nope(wantCat) {
    services.sfx('nope');
    const b = tabs.querySelector(`[data-cat="${wantCat}"]`);
    if (!b) return;
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }

  function refresh() {
    const s = site();
    // alle Bilder des Themas in einem Durchgang rendern
    renderThumbnails(CATS.flatMap((c) => partsOf(theme, c)).map(item));
    tabs.replaceChildren();
    const group = (cls) => { const d = document.createElement('div'); d.className = `site-group ${cls}`; tabs.append(d); return d; };
    const themes = group('themes');
    button(themes, `site-tab theme${picking ? ' active' : ''}`, () => {
      picking = !picking;
      browsing = false;
      services.sfx('pop');
      refresh();
    }).textContent = THEMES[theme].icon;
    const cats = group('cats');
    for (const c of CATS) {
      const b = button(cats, `site-tab${c === cat && !picking && !browsing ? ' active' : ''}`, () => {
        cat = c;
        picking = false;
        browsing = false;
        services.sfx('pop');
        refresh();
      });
      b.dataset.cat = c;
      b.style.backgroundImage = thumb(partsOf(theme, c)[0]);
    }
    // nächster Bauplatz (es gibt mehrere an der Strecke)
    const sites = game.buildSites;
    button(themes, 'site-tab plot', () => {
      game.buildSite = sites[(sites.indexOf(s) + 1) % sites.length];
      services.sfx('whoosh');
      attach();
    }).textContent = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][sites.indexOf(s)] ?? '➡️';
    const acts = group('acts');
    button(acts, `site-tab act${browsing ? ' active' : ''}`, () => {
      browsing = !browsing;
      picking = false;
      services.sfx('pop');
      refresh();
    }).textContent = '📷';
    button(acts, `site-tab act${s.history.length ? '' : ' off'}`, () => {
      if (s.undo()) refresh();
    }).textContent = '↩️';
    button(acts, `site-tab act${s.empty ? ' off' : ''}`, () => s.demolish()).textContent = '💥';
    button(acts, `site-tab act ok${s.empty ? ' off' : ''}`, () => {
      if (s.celebrate()) resetView(); // von vorne zuschauen, wer einzieht
    }).textContent = '✅';

    partsRow.replaceChildren();
    partsRow.classList.toggle('picking', picking);
    if (browsing) {
      // Album: zuerst „Foto machen“, dann die eigenen Fotos, dann die Vorlagen
      renderThumbnails([...album, ...TEMPLATES].map((id) => ({ kind: 'house', id })));
      const pic = (json) => `url(${renderThumbnails([{ kind: 'house', id: json }])[`house:${json}`]})`;
      const mine = s.snapshot();
      button(partsRow, `site-part pick${s.empty ? ' off' : ''}`, () => {
        if (s.empty) return services.sfx('nope');
        // Foto: kurz weiß aufblitzen, vorne im Album ablegen (gleiche Gebäude nicht doppelt)
        album = [mine, ...album.filter((j) => j !== mine)].slice(0, ALBUM_MAX);
        saveAlbum();
        services.sfx('pling');
        flash.classList.remove('go');
        void flash.offsetWidth;
        flash.classList.add('go');
        refresh();
      }).textContent = '📸';
      const load = (json) => {
        if (!s.loadDesign(json)) return;
        browsing = false;
        cat = 'decos';
        resetView();
        refresh();
      };
      for (const json of album) button(partsRow, `site-part photo${json === mine ? ' active' : ''}`, () => load(json)).style.backgroundImage = pic(json);
      for (const json of TEMPLATES) button(partsRow, 'site-part photo idea', () => load(json)).style.backgroundImage = pic(json);
      game.setBottomInset(panel.offsetHeight);
      return;
    }
    if (picking) {
      // Themen-Auswahl: große Bildknöpfe
      for (const [id, t] of Object.entries(THEMES)) {
        button(partsRow, `site-part pick${id === theme ? ' active' : ''}`, () => {
          theme = id;
          picking = false;
          try { localStorage.setItem(THEME_KEY, id); } catch { /* egal */ }
          services.sfx('pop');
          refresh();
        }).textContent = t.icon;
      }
    }
    for (const id of picking ? [] : partsOf(theme, cat)) {
      const b = button(partsRow, `site-part${s.can(id) ? '' : ' off'}${s.has(id) ? ' active' : ''}`, () => choose(id));
      b.style.backgroundImage = thumb(id);
    }
    game.setBottomInset(panel.offsetHeight);
  }

  function choose(id) {
    const s = site();
    if (s.busy) return;
    if (!s.can(id)) return nope(catOf(id) === 'tops' ? 'roofs' : 'levels'); // zeigt, was vorher fehlt
    const first = s.empty;
    const c = catOf(id);
    const had = s.has(id);
    s.add(id);
    // dem Kind den nächsten Schritt zeigen: erste Mauer → Türen → Fenster → Dächer → Spitzen → Schmuck
    if (c === 'levels' && first) cat = 'doors';
    else if (NEXT_CAT[c] && !had && c !== 'decos') cat = NEXT_CAT[c];
    refresh();
  }

  // ---------- Kamera: kreist um das Gebäude ----------
  const view = { yaw: 0, tilt: 0.3, zoom: 1 };
  const dir = new THREE.Vector3();
  const center = new THREE.Vector3();
  function resetView() {
    view.yaw = site().rot + 0.42;
    view.tilt = 0.3;
    view.zoom = 1;
  }
  function camera() {
    const s = site();
    const h = Math.max(2.4, s.height * 1.15 + 0.5);
    center.copy(s.center).setY(h * 0.42); // etwas unter der Mitte: der Boden mit Zaun und Garten bleibt im Bild
    dir.set(Math.sin(view.yaw) * Math.cos(view.tilt), Math.sin(view.tilt), Math.cos(view.yaw) * Math.cos(view.tilt));
    const wide = s.wide * 0.75; // mit Anbauten mehr Platz links und rechts
    game.fit(center, (game.isPortrait() ? 4.0 : 5.2) + wide, Math.max(2.9, h * 0.66), dir);
    game.cam.tPos.sub(center).multiplyScalar(view.zoom).add(center);
    game.cam.tPos.y = Math.max(0.6, game.cam.tPos.y);
  }

  // ---------- Finger ----------
  const fingers = new Map(); // pointerId → { x, y }
  let down = null;
  let moved = false;
  let pinch = 0;
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function tap(x, y) {
    const s = site();
    // Bewohner zuerst, großzügig für kleine Finger: Tipp in der Nähe einer Figur zählt
    let near = -1;
    let nearD = Math.min(window.innerWidth, window.innerHeight) * 0.075;
    s.figures.forEach((fig, i) => {
      const v = fig.getWorldPosition(new THREE.Vector3());
      v.y += 0.45;
      v.project(game.camera);
      const d = Math.hypot(((v.x + 1) / 2) * window.innerWidth - x, ((1 - v.y) / 2) * window.innerHeight - y);
      if (v.z < 1 && d < nearD) {
        nearD = d;
        near = i;
      }
    });
    if (near >= 0) return s.tapPart(`p:${near}`);
    const hit = game.pick(x, y, [s.house, s.digger, s.plot])[0];
    if (!hit) return;
    let o = hit.object;
    while (o && !o.userData.site) o = o.parent;
    if (!o) return;
    if (o.userData.site === 'digger') return s.demolish();
    if (o.userData.site === 'plot') return services.sfx('pop');
    const key = s.keyOf(hit.object);
    if (key) s.tapPart(key);
  }

  // An den aktuellen Bauplatz (game.buildSite) andocken: Leiste, Kamera, Rückmeldungen
  function attach() {
    const s = site();
    // steht der Zug gerade vor der Baustelle, würde er die Sicht versperren
    const lp = train.loco.getWorldPosition(new THREE.Vector3());
    train.group.visible = Math.hypot(lp.x - s.center.x, lp.z - s.center.z) > 16 + train.length;
    s.markUsed();
    s.onChange = () => {
      if (!active || site() !== s) return;
      if (s.empty) {
        // nach dem Abreißen geht es wieder von vorne los: Thema aussuchen, dann die erste Mauer
        cat = 'levels';
        picking = true;
        browsing = false;
      }
      refresh();
    };
    if (s.empty) cat = 'levels';
    picking = s.empty; // leerer Bauplatz: zuerst ein Thema aussuchen
    browsing = false;
    refresh();
    resetView();
    camera();
  }

  return {
    multiTouch: true,
    enter() {
      active = true;
      game.useScene('land');
      train.placeOnCurve(land.track.curve, land.track.length, game.drive.s);
      panel.classList.remove('hidden');
      attach();
    },
    exit() {
      active = false;
      panel.classList.add('hidden');
      game.setBottomInset(0);
      train.group.visible = true;
      fingers.clear();
    },
    onResize() {
      if (active) game.setBottomInset(panel.offsetHeight);
    },
    update() {
      camera();
    },
    pointerDown(e) {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 1) {
        down = { x: e.clientX, y: e.clientY };
        moved = false;
      } else {
        moved = true;
        pinch = spread();
      }
    },
    pointerMove(e) {
      const f = fingers.get(e.pointerId);
      if (!f) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      f.x = e.clientX;
      f.y = e.clientY;
      if (fingers.size >= 2) {
        const now = spread();
        if (pinch > 0 && now > 0) view.zoom = THREE.MathUtils.clamp((view.zoom * pinch) / now, 0.55, 1.8);
        pinch = now;
        return;
      }
      if (!moved && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14) return;
      moved = true;
      view.yaw -= (dx / window.innerWidth) * Math.PI * 1.5;
      view.tilt = THREE.MathUtils.clamp(view.tilt + (dy / window.innerHeight) * 1.8, 0.05, 1.2);
    },
    pointerUp(e, cancelled) {
      const was = fingers.size;
      fingers.delete(e.pointerId);
      if (was === 1 && !moved && !cancelled && down) tap(e.clientX, e.clientY);
      if (!fingers.size) down = null;
    },
    wheel(e) {
      view.zoom = THREE.MathUtils.clamp(view.zoom * (1 + e.deltaY * 0.001), 0.55, 1.8);
    },
  };
}
