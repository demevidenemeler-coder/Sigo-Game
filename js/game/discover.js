// Entdecker-Album: In der Landschaft verstecken sich Tiere (Fuchs im Wald, Storch auf der Kirche, Fisch im Fluss …).
// Kleine Spuren sind immer zu sehen (Erdhügel, Nest, Baumstumpf, Biberdamm). Kommt der Zug in die Nähe, schaut das Tier
// heraus. Antippen → es freut sich, sagt seinen Namen, und ein Sticker fliegt ins Album (📖).

import * as THREE from 'three';
import { buildFigure } from './figures.js';
import { renderThumbnails } from './thumbs.js';

const KEY = 'sigo.album.v1';
const NEAR = 15; // so nah muss der Zug kommen
const FAR = 21; // ab hier versteckt es sich wieder

// Reihenfolge = Reihenfolge im Album. where: Hinweis-Symbol im Album für noch nicht gefundene Tiere
export const DISCOVERIES = [
  { id: 'fuchs', where: '🌲' }, { id: 'igel', where: '🍂' }, { id: 'eichhoernchen', where: '🌲' }, { id: 'storch', where: '⛪' },
  { id: 'fisch', where: '🌊' }, { id: 'maulwurf', where: '🌼' }, { id: 'reh', where: '🌲' }, { id: 'eule', where: '🌙' },
  { id: 'schnecke', where: '🥬' }, { id: 'biber', where: '🌊' },
];

function loadFound() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}
function saveFound(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch { /* ohne Speicher geht es trotzdem */ }
}

const std = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
function mesh(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- Spuren (immer sichtbar) ----------
const CLUES = {
  bau(g) { // Fuchsbau: Erdhügel mit dunklem Loch
    mesh(g, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#8a6040'), 0, 0, 0).scale.set(1.0, 0.45, 0.8);
    mesh(g, new THREE.CircleGeometry(0.38, 16), std('#2a1d14', 1), 0.55, 0.2, 0).rotation.set(0, Math.PI / 2, 0);
  },
  stumpf(g, h = 0.5) { // Baumstumpf mit Jahresringen
    mesh(g, new THREE.CylinderGeometry(0.42, 0.5, h, 14), std('#8a5a33'), 0, h / 2, 0);
    mesh(g, new THREE.CylinderGeometry(0.4, 0.4, 0.02, 14), std('#e2c08a'), 0, h + 0.005, 0);
  },
  hochstumpf(g) { CLUES.stumpf(g, 1.3); },
  laub(g) { // Laubhaufen
    const cols = ['#e2903a', '#c9572e', '#e8bd3f', '#a8703f'];
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      const r = (i % 4) * 0.12;
      mesh(g, new THREE.SphereGeometry(0.16, 6, 4), std(cols[i % cols.length]), Math.cos(a) * r, 0.08 + (i % 3) * 0.05, Math.sin(a) * r).scale.set(1.4, 0.35, 1);
    }
  },
  huegel(g) { // Maulwurfshügel
    mesh(g, new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#6e4a30'), 0, 0, 0).scale.y = 0.6;
  },
  nest(g) { // Storchennest
    mesh(g, new THREE.TorusGeometry(0.28, 0.12, 6, 14), std('#a0703f'), 0, 0.1, 0).rotation.x = Math.PI / 2;
  },
  damm(g) { // Biberdamm aus Stöcken
    for (let i = 0; i < 7; i++) {
      const st = mesh(g, new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), std(i % 2 ? '#8a5a33' : '#a0703f'), (i - 3) * 0.12, 0.12 + (i % 3) * 0.08, 0);
      st.rotation.set(Math.PI / 2, 0, (i - 3) * 0.15);
    }
  },
};

export class Discoveries {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    this.found = loadFound();
    this.spots = [];
    this.signature = '';
    this.group = new THREE.Group();
    this.land.scene.add(this.group);
    this.makeSpots();
    this.makeUi();
    this.sparks = [];
  }

  // ---------- Plätze ----------
  makeSpots() {
    const f = this.land.features;
    const nearRiver = (x, z) => {
      let best = null;
      f.riverS.pts.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.z - z);
        if (!best || d < best.d) best = { d, i, p };
      });
      const a = f.riverS.pts[Math.max(0, best.i - 1)];
      const b = f.riverS.pts[Math.min(f.riverS.pts.length - 1, best.i + 1)];
      const tx = b.x - a.x;
      const tz = b.z - a.z;
      const L = Math.hypot(tx, tz) || 1;
      return { x: best.p.x, z: best.p.z, nx: -tz / L, nz: tx / L, ang: Math.atan2(-tz, tx) };
    };
    const add = (id, x, z, opts = {}) => {
      const def = DISCOVERIES.find((d) => d.id === id);
      const root = new THREE.Group();
      root.position.set(x, opts.y ?? 0, z);
      if (opts.rot != null) root.rotation.y = opts.rot;
      this.group.add(root);
      if (opts.clue) CLUES[opts.clue](root);
      const fig = buildFigure(id);
      fig.scale.setScalar(0.001);
      fig.position.set(...(opts.at ?? [0, 0, 0]));
      root.add(fig);
      this.spots.push({ ...def, root, fig, size: opts.size ?? 1.7, show: 0, want: 0, t: Math.random() * 5, hinted: false, peekTime: 0,
        night: !!opts.night, fish: !!opts.fish, enabled: true, onChurch: !!opts.onChurch });
    };
    add('fuchs', -59, -30, { clue: 'bau', at: [0.95, 0, 0], rot: 0.4, size: 1.8 });
    add('reh', 62, -32.5, { rot: 2.6, size: 1.6 });
    add('eichhoernchen', -30.5, -17.5, { clue: 'stumpf', at: [0, 0.5, 0], size: 2.0 });
    add('eule', -64, -41, { clue: 'hochstumpf', at: [0, 1.3, 0], size: 2.0, night: true });
    add('igel', -12, 30.5, { clue: 'laub', at: [0.35, 0, 0], size: 2.2 });
    add('maulwurf', 38, -19, { clue: 'huegel', size: 2.2 });
    add('schnecke', -2.5, -38, { size: 2.8 });
    // Storch auf dem Kirchendach (wenn die Kirche steht)
    const ch = this.land.church;
    if (ch) {
      ch.updateMatrixWorld(true);
      const p = new THREE.Vector3(0.9, 3.42, 0).applyMatrix4(ch.matrixWorld);
      add('storch', p.x, p.z, { y: p.y, clue: 'nest', at: [0, 0.12, 0], size: 1.5, onChurch: true });
    }
    const r1 = nearRiver(10, 14);
    add('fisch', r1.x, r1.z, { rot: r1.ang, size: 2.4, fish: true });
    const r2 = nearRiver(-48, -9);
    const off = f.riverWidth / 2 + 0.7;
    add('biber', r2.x + r2.nx * off, r2.z + r2.nz * off, { clue: 'damm', rot: r2.ang, size: 2.0 });
  }

  // Wo Schienen liegen, gibt es kein Versteck (und keine Spur)
  layout() {
    const track = this.land.track;
    const sig = track.length.toFixed(2);
    if (sig === this.signature) return;
    this.signature = sig;
    for (const s of this.spots) {
      let d = Infinity;
      for (const [x, z] of track.samples) d = Math.min(d, Math.hypot(x - s.root.position.x, z - s.root.position.z));
      s.enabled = d > (s.fish ? 1.5 : 2.6);
      s.root.visible = s.enabled;
    }
  }

  // ---------- jedes Bild ----------
  update(dt, time) {
    this.layout();
    const loco = this.game.train.loco;
    const lp = loco?.getWorldPosition(new THREE.Vector3());
    const look = this.game.cam.look;
    const night = this.game.env.night;
    const driving = this.game.modeName === 'drive';
    for (const s of this.spots) {
      if (!s.enabled) continue;
      if (s.onChurch) s.root.visible = this.land.church.visible && this.land.church.scale.x > 0.5;
      const pos = s.root.position;
      const dTrain = lp ? Math.hypot(lp.x - pos.x, lp.z - pos.z) : 99;
      const dLook = Math.hypot(look.x - pos.x, look.z - pos.z);
      const near = Math.min(dTrain, dLook + 3);
      const awake = s.night ? night > 0.5 : true;
      if (driving && awake && s.root.visible && near < NEAR) s.want = 1;
      else if (!awake || !driving || near > FAR) s.want = 0;
      s.t += dt;
      const k = 1 - Math.exp(-dt * (s.want ? 7 : 4));
      s.show += (s.want - s.show) * k;
      let sc = s.show;
      if (s.fish) {
        // Fisch springt immer wieder im Bogen aus dem Wasser
        const period = 2.6;
        const ph = (s.t % period) / 1.1;
        const jumping = s.want && ph < 1;
        s.jumping = jumping;
        sc = jumping ? 1 : 0;
        if (jumping) {
          s.fig.position.set((ph - 0.5) * 1.6, 0.1 + Math.sin(ph * Math.PI) * 1.3, 0);
          s.fig.rotation.z = (0.5 - ph) * 2.2;
        }
      } else {
        // Wackeln vor Freude, schaut zum Zug
        s.fig.position.y = (s.fig.userData.baseY ??= s.fig.position.y) + Math.abs(Math.sin(time * 3 + s.t)) * 0.04 * s.show;
        if (lp && s.show > 0.1) {
          const wp = s.root.getWorldPosition(new THREE.Vector3());
          const want = Math.atan2(-(lp.z - wp.z), lp.x - wp.x) - s.root.rotation.y;
          let diff = want - s.fig.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          s.fig.rotation.y += diff * Math.min(1, dt * 2);
        }
      }
      // kleiner Überschwinger beim Herauskommen
      const pop = s.want ? 1 + Math.sin(Math.min(1, s.show) * Math.PI) * 0.15 : 1;
      s.fig.scale.setScalar(Math.max(0.001, sc * s.size * pop));
      // Herausgekommen: kurzes Geräusch, und wenn er es nach ein paar Sekunden noch nicht gefunden hat, zeigt die Hand hin
      if (s.want && s.show > 0.5 && !s.announced) {
        s.announced = true;
        if (s.fish) this.game.services.sfx('splash');
        this.game.services.animalCall(s.id); // man hört das Tier, bevor man es findet
      }
      if (!s.want && s.show < 0.1) {
        s.announced = false;
        s.hinted = false;
        s.peekTime = 0;
      }
      if (s.show > 0.8 && !this.found.has(s.id)) {
        s.peekTime += dt;
        if (!s.hinted && s.peekTime > 3.5 && (!s.fish || s.jumping)) {
          const sp = this.screenPos(s);
          if (sp) {
            s.hinted = true;
            this.game.hint.tap(sp.x, sp.y);
          }
        }
      }
    }
    this.updateSparks(dt);
  }

  screenPos(s) {
    const v = s.fig.getWorldPosition(new THREE.Vector3());
    v.y += 0.35 * s.size * 0.5;
    v.project(this.game.camera);
    if (v.z > 1) return null;
    const x = ((v.x + 1) / 2) * window.innerWidth;
    const y = ((1 - v.y) / 2) * window.innerHeight;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    return { x, y };
  }

  // Antippen in der Nähe eines herausschauenden Tiers (großzügig für kleine Finger). true = erledigt
  tap(x, y) {
    let best = null;
    for (const s of this.spots) {
      if (!s.enabled || !s.root.visible || s.show < 0.5 || (s.fish && !s.jumping)) continue;
      const sp = this.screenPos(s);
      if (!sp) continue;
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < 90 && (!best || d < best.d)) best = { s, d, sp };
    }
    if (!best) return false;
    const { s, sp } = best;
    this.game.hop(s.fig);
    this.burst(s.fig.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)));
    this.game.services.sayName(s.id);
    if (!this.found.has(s.id)) {
      this.found.add(s.id);
      saveFound(this.found);
      this.game.services.sfx('sparkle');
      this.flySticker(s.id, sp);
    }
    return true;
  }

  // ---------- Glitzer ----------
  burst(at) {
    const geo = this.sparkGeo ??= new THREE.OctahedronGeometry(0.09, 0);
    const colors = ['#ffd23a', '#ffffff', '#f08bb4', '#7fb2f0'];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % 4], transparent: true }));
      m.position.copy(at);
      const a = (i / 12) * Math.PI * 2;
      this.land.scene.add(m);
      this.sparks.push({ m, v: new THREE.Vector3(Math.cos(a) * 2.2, 2.5 + (i % 3), Math.sin(a) * 2.2), life: 0.9 });
    }
  }

  updateSparks(dt) {
    this.sparks = this.sparks.filter((p) => {
      p.life -= dt;
      p.v.y -= dt * 6;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.y += dt * 8;
      p.m.material.opacity = Math.max(0, p.life / 0.9);
      if (p.life > 0) return true;
      this.land.scene.remove(p.m);
      p.m.material.dispose();
      return false;
    });
  }

  // ---------- Album ----------
  makeUi() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'album-btn hidden';
    b.innerHTML = '<span class="album-icon">📖</span><span class="album-count"></span>';
    b.addEventListener('click', () => {
      this.game.services.sfx('pop');
      this.openAlbum();
    });
    this.game.ui.append(b);
    this.button = b;
    this.updateCount();
  }

  updateCount() {
    this.button.querySelector('.album-count').textContent = `${this.found.size}/${DISCOVERIES.length}`;
  }

  // nur in Werkstatt und beim Fahren
  onMode(name) {
    this.button.classList.toggle('hidden', !(name === 'workshop' || name === 'drive'));
    this.closeAlbum();
  }

  thumbs() {
    return renderThumbnails(DISCOVERIES.map(({ id }) => ({ kind: 'album', id })));
  }

  flySticker(id, from) {
    const img = document.createElement('img');
    img.className = 'sticker-fly';
    img.src = this.thumbs()[`album:${id}`];
    img.style.left = `${from.x}px`;
    img.style.top = `${from.y}px`;
    this.game.ui.append(img);
    const r = this.button.getBoundingClientRect();
    requestAnimationFrame(() => {
      img.style.transform = 'translate(-50%, -50%) scale(1.6)';
      setTimeout(() => {
        img.style.left = `${r.left + r.width / 2}px`;
        img.style.top = `${r.top + r.height / 2}px`;
        img.style.transform = 'translate(-50%, -50%) scale(0.35)';
        img.style.opacity = '0.4';
      }, 650);
    });
    setTimeout(() => {
      img.remove();
      this.updateCount();
      this.button.classList.remove('bump');
      void this.button.offsetWidth;
      this.button.classList.add('bump');
      this.game.services.sfx('chime');
    }, 1500);
  }

  openAlbum() {
    this.closeAlbum();
    const thumbs = this.thumbs();
    const el = document.createElement('div');
    el.className = 'album';
    const page = document.createElement('div');
    page.className = 'album-page';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close';
    close.textContent = '✖';
    close.addEventListener('click', () => {
      this.game.services.sfx('pop');
      this.closeAlbum();
    });
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = `📖 ${this.found.size} / ${DISCOVERIES.length}`;
    const grid = document.createElement('div');
    grid.className = 'album-grid';
    for (const d of DISCOVERIES) {
      const card = document.createElement('button');
      card.type = 'button';
      const has = this.found.has(d.id);
      card.className = `album-card${has ? ' found' : ''}`;
      const img = document.createElement('img');
      img.src = thumbs[`album:${d.id}`];
      img.alt = '';
      card.append(img);
      if (!has) {
        const w = document.createElement('span');
        w.className = 'album-where';
        w.textContent = d.where; // Hinweis, wo man suchen kann
        card.append(w);
      }
      card.addEventListener('click', () => {
        if (has) {
          this.game.services.sayName(d.id);
          card.classList.remove('wiggle');
          void card.offsetWidth;
          card.classList.add('wiggle');
        } else {
          this.game.services.sfx('pling');
        }
      });
      grid.append(card);
    }
    page.append(close, title, grid);
    el.append(page);
    el.addEventListener('click', (e) => {
      if (e.target === el) this.closeAlbum();
    });
    this.game.ui.append(el);
    this.albumEl = el;
  }

  closeAlbum() {
    this.albumEl?.remove();
    this.albumEl = null;
  }
}
