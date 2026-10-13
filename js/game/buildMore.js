// Noch mehr Themen für die Baustelle: Bauernhof, Piraten, Meer (Leuchtturm und Strand), Schloss, Winter, Dschungel.
// Die Teile tragen sich in die Verzeichnisse von buildParts.js ein; mischen lässt sich weiterhin alles mit allem.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { buildFigure } from './figures.js';
import {
  H, THEMES, PAL, LEVELS, DOORS, ROOFS, TOPS, WINGS, EXTRA, attachFront, onSide,
  std, fix, put, box, cyl, ball, cone, disc, ext, heartShape, starShape, archShape, triShape, tex, WHITE, DARK, GOLD, IRON, STONE, GREEN, glow,
} from './buildParts.js';
import { gableRoof, gableFill } from './zones.js';

Object.assign(PAL, {
  barn: ['#c8453a', '#a63d2f', '#d9663b', '#6f8f6a', '#4f6d8a'],
  sail: ['#f7f1e3', '#e5484d', '#3a3f47', '#f2c832', '#3b7cc9'],
  sand: ['#ecd9a0', '#e3c27f', '#f3e6c0', '#d9b48a'],
  royal: ['#fbeff5', '#f6d5e5', '#e6dcf7', '#dff0fa', '#fff5d6'],
  snow: ['#f4f8fb', '#dcebf5', '#cfe3ee', '#e9e4f7'],
  ice: ['#bfe6ff', '#a8d8f0', '#d6f0ff', '#c9c3f0'],
  bamboo: ['#c9c06a', '#a8b85a', '#d9b85f', '#8fae5e'],
  leaf: ['#5aa34a', '#3f8a4a', '#8fae5e', '#c9a26b', '#d9663b'],
});

const WOOD = () => fix('#a8794e');
const DWOOD = () => fix('#6e4a2e');
const BLUE = () => fix('#6fb6e8', 0.2);
const RED = () => fix('#e5484d', 0.5);
const SNOW = () => fix('#f6fafc', 0.9);
const darker = (color, k = 0.72) => new THREE.Color(color).multiplyScalar(k);
const shade = (m) => { m.castShadow = false; return m; };

// Schmuck: g = Gruppe, f0 = Abstand der Vorderseite, half = halbe Breite, grp() = Untergruppe, anim() = bewegt sich
function deco(id, fn) {
  EXTRA.decos[id] = (ctx) => {
    const g = new THREE.Group();
    const anims = [];
    const fp0 = ctx.fp0;
    const h = {
      g, ctx, fp0, half: fp0.half, f0: fp0.round ? fp0.r : fp0.d / 2,
      grp: (x = 0, y = 0, z = 0, ry = 0) => { const n = new THREE.Group(); n.position.set(x, y, z); n.rotation.y = ry; n.userData.ground = true; g.add(n); return n; },
      anim: (f) => anims.push(f),
    };
    fn(h);
    if (anims.length) g.userData.anim = (t) => anims.forEach((f) => f(t));
    return g;
  };
}
// Dach: fn(g, fp, color, wallColor) gibt { apex, chimney } zurück
function roof(id, def, fn) {
  ROOFS[id] = {
    ...def,
    make(fp, color, wallColor) {
      const g = new THREE.Group();
      const r = fn(g, fp, color, wallColor) ?? {};
      g.userData.apex = r.apex ?? 0.14;
      g.userData.chimney = r.chimney ?? [fp.w * 0.24, 0.5, -fp.d * 0.18];
      return g;
    },
  };
}
const part = (table, id, def, fn) => { table[id] = { ...def, make: (...a) => { const g = new THREE.Group(); const anim = fn(g, ...a); if (anim) g.userData.anim = anim; return g; } }; };

// Palme (Piraten, Meer, Dschungel)
function palm(n) {
  const trunk = new THREE.Group();
  trunk.rotation.z = -0.16;
  n.add(trunk);
  for (let i = 0; i < 6; i++) cyl(trunk, 0.1 - i * 0.008, 0.12 - i * 0.008, 0.36, fix('#a8794e', 0.9), Math.sin(i * 0.4) * 0.05, 0.18 + i * 0.34, 0, 8);
  const top = new THREE.Group();
  top.position.set(0.02, 2.15, 0);
  trunk.add(top);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Group();
    leaf.rotation.y = i * 1.047;
    const l = ball(leaf, 0.5, GREEN(), 0.5, -0.1, 0);
    l.scale.set(1.25, 0.12, 0.38);
    l.rotation.z = -0.45;
    top.add(leaf);
  }
  for (const [x, z] of [[0.12, 0.08], [-0.1, 0.1], [0.02, -0.13]]) ball(top, 0.09, DWOOD(), x, -0.12, z);
  return top;
}

// Papagei (sitzt auf y = 0)
function parrot(n) {
  const b = ball(n, 0.14, RED(), 0, 0.2, 0);
  b.scale.set(0.8, 1.25, 0.8);
  ball(n, 0.1, RED(), 0, 0.42, 0.03);
  cone(n, 0.04, 0.1, fix('#f2c832', 0.5), 0, 0.4, 0.13, 6).rotation.x = Math.PI / 2 + 0.5;
  for (const s of [-1, 1]) {
    const w = ball(n, 0.1, fix('#3b7cc9', 0.5), s * 0.11, 0.2, -0.02);
    w.scale.set(0.35, 1.1, 0.8);
    shade(ball(n, 0.022, DARK(), s * 0.05, 0.45, 0.11));
  }
  const tail = box(n, 0.07, 0.3, 0.03, fix('#3f8a6a', 0.5), 0, 0.02, -0.1);
  tail.rotation.x = 0.4;
}

// Schneemann (steht auf y = 0), s = Größe
function snowman(n, s = 1) {
  ball(n, 0.3 * s, SNOW(), 0, 0.28 * s, 0);
  ball(n, 0.22 * s, SNOW(), 0, 0.68 * s, 0);
  ball(n, 0.16 * s, SNOW(), 0, 0.98 * s, 0);
  cone(n, 0.035 * s, 0.16 * s, fix('#f08a24', 0.6), 0, 0.98 * s, 0.2 * s, 6).rotation.x = Math.PI / 2;
  for (const x of [-0.06, 0.06]) shade(ball(n, 0.022 * s, DARK(), x * s, 1.03 * s, 0.14 * s));
  cyl(n, 0.17 * s, 0.17 * s, 0.03 * s, DARK(), 0, 1.1 * s, 0, 12);
  cyl(n, 0.11 * s, 0.11 * s, 0.18 * s, DARK(), 0, 1.2 * s, 0, 12);
  cyl(n, 0.2 * s, 0.2 * s, 0.07 * s, RED(), 0, 0.84 * s, 0, 12);
}

// ====================================================================================================
// Bauernhof
// ====================================================================================================

LEVELS.scheune = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'barn', c: 0,
  make(color, def) {
    const g = new THREE.Group();
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.05), std(color, 0.85, { map: tex('log', 1, 1) }), 0, H / 2, 0);
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(g, 0.12, H, 0.12, WHITE(), x * (def.w / 2 - 0.03), H / 2, z * (def.d / 2 - 0.03));
    for (const z of [-1, 1]) box(g, def.w, 0.1, 0.05, WHITE(), 0, H - 0.05, z * (def.d / 2 + 0.01), false);
    return g;
  },
};
LEVELS.silo = {
  shape: 'round', r: 0.8, pal: 'metal', c: 1,
  make(color, def) {
    const g = new THREE.Group();
    cyl(g, def.r, def.r, H, std(color, 0.4, { metalness: 0.4 }), 0, H / 2, 0, 24);
    for (const y of [0.2, 0.6, 1.0]) cyl(g, def.r + 0.02, def.r + 0.02, 0.05, IRON(), 0, y, 0, 24);
    return g;
  },
};
part(DOORS, 'd_scheunentor', { pal: 'barn', c: 0 }, (g, color) => {
  box(g, 1.2, 1.06, 0.06, WHITE(), 0, 0.53, 0.02);
  box(g, 1.06, 0.98, 0.08, std(color, 0.7), 0, 0.5, 0.03);
  for (const r of [0.74, -0.74]) box(g, 0.08, 1.38, 0.03, WHITE(), 0, 0.5, 0.08, false).rotation.z = r;
  box(g, 0.05, 0.98, 0.03, WHITE(), 0, 0.5, 0.08, false);
});
EXTRA.windows.f_heuluke = () => {
  const g = new THREE.Group();
  box(g, 0.6, 0.56, 0.05, WOOD(), 0, 0, 0, false);
  box(g, 0.46, 0.42, 0.06, fix('#2b2622', 0.9), 0, 0, 0.01, false);
  const hay = ball(g, 0.2, fix('#e8c45a', 1), 0, -0.1, 0.06);
  hay.scale.set(1.1, 0.7, 0.6);
  return g;
};
roof('r_scheune', { pal: 'roof', c: 6 }, (g, fp, color, wallColor) => {
  // Mansarddach: unten steil, oben flach
  const half = fp.d / 2 + 0.2;
  const h = 1.15;
  const outer = [[-half, 0], [-half * 0.58, h * 0.66], [0, h], [half * 0.58, h * 0.66], [half, 0]];
  const inner = [[half - 0.16, 0], [half * 0.5, h * 0.6], [0, h - 0.17], [-half * 0.5, h * 0.6], [-half + 0.16, 0]];
  const L = fp.w + 0.4;
  const shell = ext(triShape([...outer, ...inner]), L);
  shell.translate(0, 0, -L / 2);
  shell.rotateY(Math.PI / 2);
  put(g, shell, std(color, 0.6), 0, -0.02, 0);
  const fill = ext(triShape(outer.map(([x, y]) => [x * 0.9, y * 0.92])), fp.w - 0.02);
  fill.translate(0, 0, -(fp.w - 0.02) / 2);
  fill.rotateY(Math.PI / 2);
  put(g, fill, std(wallColor, 0.85));
  return { apex: h, chimney: [fp.w * 0.26, h * 0.8, -fp.d * 0.12] };
});
deco('x_heu', ({ grp, half, f0 }) => {
  const n = grp(half + 0.75, 0, f0 + 0.3, -0.3);
  const hay = fix('#e8c45a', 1);
  for (const [x, y, z] of [[0, 0.26, 0], [0.56, 0.26, 0.1], [0.28, 0.72, 0.05]]) cyl(n, 0.26, 0.26, 0.5, hay, x, y, z, 14).rotation.x = Math.PI / 2;
});
deco('x_traktor', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.85), 0, f0 + 0.55, 0.5);
  box(n, 0.8, 0.3, 0.42, RED(), 0, 0.38, 0);
  box(n, 0.36, 0.42, 0.4, RED(), -0.2, 0.72, 0);
  shade(box(n, 0.3, 0.26, 0.42, fix('#9fd0ee', 0.2), -0.2, 0.74, 0));
  cyl(n, 0.03, 0.03, 0.4, DARK(), 0.28, 0.72, 0.1, 6);
  for (const z of [-0.26, 0.26]) {
    cyl(n, 0.3, 0.3, 0.12, DARK(), -0.2, 0.3, z, 14).rotation.x = Math.PI / 2;
    cyl(n, 0.17, 0.17, 0.1, DARK(), 0.34, 0.17, z, 12).rotation.x = Math.PI / 2;
    shade(cyl(n, 0.12, 0.12, 0.13, fix('#f2c832', 0.5), -0.2, 0.3, z, 10)).rotation.x = Math.PI / 2;
  }
});
deco('x_tiere', ({ grp, half, f0, anim }) => {
  const cow = buildFigure('kuh');
  cow.scale.setScalar(1.25);
  const a = grp(half + 1.0, 0, f0 - 0.4, -0.7);
  a.add(cow);
  const hen = buildFigure('huhn');
  hen.scale.setScalar(1.1);
  const b = grp(0.7, 0, f0 + 1.0, 0.6);
  b.add(hen);
  anim((t) => { hen.position.y = Math.max(0, Math.sin(t * 5)) * 0.05; cow.rotation.y = Math.sin(t * 0.6) * 0.15; });
});
deco('x_gemuese', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.95), 0, f0 - 0.4);
  box(n, 1.0, 0.1, 1.3, fix('#7a5236', 1), 0, 0.05, 0);
  for (let i = 0; i < 4; i++) {
    ball(n, 0.13, GREEN(), -0.25, 0.17, -0.48 + i * 0.32).scale.y = 0.8;
    cone(n, 0.06, 0.16, fix('#f08a24', 0.6), 0.25, 0.14, -0.48 + i * 0.32, 6).rotation.x = Math.PI;
    shade(ball(n, 0.06, GREEN(), 0.25, 0.25, -0.48 + i * 0.32));
  }
});
deco('x_trog', ({ grp, f0 }) => {
  const n = grp(-0.95, 0, f0 + 0.6);
  box(n, 0.9, 0.3, 0.4, WOOD(), 0, 0.2, 0);
  shade(box(n, 0.78, 0.04, 0.3, BLUE(), 0, 0.345, 0));
  for (const x of [-0.36, 0.36]) box(n, 0.08, 0.14, 0.44, DWOOD(), x, 0.07, 0);
});
deco('x_kuerbisse', ({ grp, half, f0 }) => {
  [[half + 0.4, f0 + 0.95, 0.24], [half + 0.8, f0 + 1.15, 0.17], [half + 0.2, f0 + 1.35, 0.14]].forEach(([x, z, r]) => {
    const n = grp(x, 0, z);
    ball(n, r, fix('#f08a24', 0.6), 0, r * 0.8, 0).scale.y = 0.78;
    cyl(n, 0.025, 0.035, 0.1, GREEN(), 0, r * 1.5, 0, 6);
  });
});

THEMES.bauernhof = {
  icon: '🚜',
  visitors: ['kuh', 'schwein', 'schaf', 'huhn', 'pferd'],
  levels: ['scheune', 'holz', 'mauer', 'silo'],
  doors: ['d_scheunentor', 'd_eck', 'd_doppel'],
  windows: ['f_heuluke', 'f_eck', 'f_rund'],
  roofs: ['r_scheune', 'r_giebel', 'r_stroh', 'r_kuppel'],
  tops: ['t_hahn', 't_propeller', 't_schornstein', 't_fahne'],
  decos: ['x_heu', 'x_traktor', 'x_tiere', 'x_gemuese', 'x_trog', 'x_kuerbisse', 'x_zaun', 'x_baum', 'x_laterne'],
};

// ====================================================================================================
// Piraten
// ====================================================================================================

LEVELS.rumpf = {
  shape: 'box', w: 2.6, d: 1.5, pal: 'wood', c: 1,
  make(color, def) {
    // Schiffsrumpf: Kasten mit spitzem Bug (rechts) und Heck, goldene Leiste
    const g = new THREE.Group();
    const m = std(color, 0.85, { map: tex('log', 1, 1) });
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.05), m, 0, H / 2, 0);
    const bow = ext(triShape([[0, -def.d / 2], [1.0, 0], [0, def.d / 2]]), H);
    bow.rotateX(-Math.PI / 2);
    put(g, bow, std(color, 0.85), def.w / 2 - 0.02, 0, 0);
    box(g, 0.5, H + 0.3, def.d, std(color, 0.85), -def.w / 2 - 0.2, (H + 0.3) / 2, 0);
    for (const z of [-1, 1]) box(g, def.w + 0.5, 0.08, 0.04, GOLD(), -0.1, H - 0.12, z * (def.d / 2 + 0.01), false);
    return g;
  },
};
LEVELS.kajuete = { shape: 'box', w: 1.5, d: 1.4, pal: 'wood', c: 2, look: 'log' };
part(DOORS, 'd_kajuete', { pal: 'door', c: 0 }, (g, color) => {
  box(g, 0.56, 0.9, 0.08, std(color, 0.6), 0, 0.45, 0.03);
  put(g, new THREE.TorusGeometry(0.13, 0.035, 8, 18), GOLD(), 0, 0.62, 0.08, false);
  disc(g, 0.12, 0.03, fix('#9fd0ee', 0.2), 0, 0.62, 0.07);
  shade(ball(g, 0.04, GOLD(), 0.18, 0.36, 0.08));
  box(g, 0.7, 0.08, 0.24, WOOD(), 0, -0.02, 0.13, false);
});
EXTRA.windows.f_kanone = () => {
  const g = new THREE.Group();
  box(g, 0.5, 0.44, 0.05, DWOOD(), 0, 0, 0, false);
  box(g, 0.36, 0.3, 0.06, fix('#2b2622', 0.9), 0, 0, 0.01, false);
  cyl(g, 0.09, 0.11, 0.4, IRON(), 0, -0.02, 0.2, 12).rotation.x = Math.PI / 2;
  const flap = box(g, 0.44, 0.04, 0.3, DWOOD(), 0, 0.26, 0.14, false);
  flap.rotation.x = -0.5;
  return g;
};
roof('r_deck', { pal: 'wood', c: 2 }, (g, fp, color) => {
  const m = std(color, 0.85, { map: tex('log', 2, 3) });
  box(g, fp.w + 0.2, 0.12, fp.d + 0.2, m, 0, 0.06, 0);
  for (const x of [-1, -0.33, 0.33, 1]) for (const z of [-1, 1]) box(g, 0.07, 0.4, 0.07, DWOOD(), x * (fp.w / 2 + 0.03), 0.3, z * (fp.d / 2 + 0.03));
  for (const z of [-1, 1]) box(g, fp.w + 0.16, 0.06, 0.07, DWOOD(), 0, 0.5, z * (fp.d / 2 + 0.03));
  for (const x of [-1, 1]) box(g, 0.07, 0.06, fp.d + 0.1, DWOOD(), x * (fp.w / 2 + 0.03), 0.5, 0);
  cyl(g, 0.2, 0.2, 0.36, DWOOD(), fp.w * 0.28, 0.3, 0, 12); // Fass
  return { apex: 0.12 };
});
roof('r_segel', { pal: 'sail', c: 0 }, (g, fp, color) => {
  box(g, fp.w + 0.2, 0.12, fp.d + 0.2, std('#c9a26b', 0.85, { map: tex('log', 2, 3) }), 0, 0.06, 0);
  cyl(g, 0.06, 0.08, 2.7, DWOOD(), 0, 1.4, 0, 10);
  for (const y of [0.75, 2.2]) cyl(g, 0.035, 0.035, 1.9, DWOOD(), 0, y, 0.08, 8).rotation.x = Math.PI / 2;
  // geblähtes Segel zwischen den beiden Rahen
  const sail = ball(g, 1, std(color, 0.9), 0, 1.48, 0.12);
  sail.scale.set(0.9, 0.7, 0.2);
  return { apex: 2.75, chimney: [fp.w * 0.3, 0.45, -fp.d * 0.2] };
});
part(TOPS, 't_piratenflagge', {}, (g) => {
  cyl(g, 0.025, 0.025, 1.0, DARK(), 0, 0.5, 0, 8);
  box(g, 0.62, 0.4, 0.03, fix('#22252b', 0.8), 0.33, 0.78, 0, false);
  for (const z of [-0.02, 0.02]) {
    const sk = shade(ball(g, 0.09, WHITE(), 0.33, 0.83, z));
    sk.scale.z = 0.3;
    for (const r of [0.6, -0.6]) shade(box(g, 0.3, 0.035, 0.012, WHITE(), 0.33, 0.7, z)).rotation.z = r;
  }
});
part(TOPS, 't_ausguck', {}, (g) => {
  cyl(g, 0.04, 0.04, 0.9, DWOOD(), 0, 0.45, 0, 8);
  cyl(g, 0.3, 0.24, 0.32, WOOD(), 0, 0.62, 0, 14);
  for (const y of [0.5, 0.74]) cyl(g, 0.3, 0.3, 0.04, IRON(), 0, y, 0, 14);
  cyl(g, 0.02, 0.02, 0.5, DARK(), 0, 1.1, 0, 6);
  box(g, 0.3, 0.18, 0.02, RED(), 0.16, 1.24, 0, false);
});
deco('x_wellen', ({ g, anim }) => {
  shade(put(g, new THREE.RingGeometry(2.3, 3.1, 40).rotateX(-Math.PI / 2), BLUE(), 0, 0.02, 0)).receiveShadow = true;
  const waves = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const w = shade(ball(g, 0.3, fix(i % 2 ? '#8fcbf0' : '#ffffff', 0.3), Math.sin(a) * 2.7, 0.02, Math.cos(a) * 2.7));
    w.scale.set(1.3, 0.35, 0.6);
    w.rotation.y = a;
    waves.push(w);
  }
  anim((t) => waves.forEach((w, i) => { w.position.y = 0.03 + Math.sin(t * 2 + i * 0.9) * 0.05; }));
});
deco('x_anker', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.45), 0, f0 + 0.55, 0.4);
  n.rotation.z = 0.25;
  box(n, 0.08, 0.95, 0.08, IRON(), 0, 0.55, 0);
  box(n, 0.5, 0.07, 0.07, IRON(), 0, 0.9, 0);
  put(n, new THREE.TorusGeometry(0.1, 0.03, 6, 14), IRON(), 0, 1.1, 0);
  put(n, new THREE.TorusGeometry(0.36, 0.045, 6, 16, Math.PI), IRON(), 0, 0.42, 0).rotation.z = Math.PI;
});
deco('x_schatz', ({ grp, half, f0 }) => {
  const n = grp(half + 0.55, 0, f0 + 0.8, -0.5);
  box(n, 0.6, 0.3, 0.4, WOOD(), 0, 0.15, 0);
  const lid = cyl(n, 0.2, 0.2, 0.6, DWOOD(), 0, 0.36, -0.14, 12);
  lid.rotation.z = Math.PI / 2;
  for (const x of [-0.24, 0.24]) box(n, 0.05, 0.32, 0.42, GOLD(), x, 0.16, 0, false);
  for (const [x, y, z] of [[-0.12, 0.33, 0.05], [0.05, 0.36, 0.1], [0.15, 0.33, 0], [0.4, 0.04, 0.3], [-0.38, 0.04, 0.34]]) shade(cyl(n, 0.07, 0.07, 0.03, GOLD(), x, y, z, 10));
});
deco('x_palme', ({ grp, half, f0 }) => { palm(grp(half + 1.15, 0, f0 - 1.2)); });
deco('x_papagei', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 0.75), 0, f0 + 0.2);
  cyl(n, 0.03, 0.04, 1.3, DWOOD(), 0, 0.65, 0, 6);
  box(n, 0.4, 0.04, 0.04, DWOOD(), 0, 1.3, 0);
  const bird = new THREE.Group();
  bird.position.y = 1.32;
  n.add(bird);
  parrot(bird);
  anim((t) => { bird.rotation.z = Math.sin(t * 2.2) * 0.12; });
});
deco('x_steuerrad', ({ g, fp0 }) => {
  const n = onSide(g, new THREE.Group(), fp0, 1, 0.65, 0.06);
  put(n, new THREE.TorusGeometry(0.3, 0.04, 8, 20), WOOD(), 0, 0, 0);
  for (let i = 0; i < 4; i++) box(n, 0.78, 0.04, 0.04, WOOD(), 0, 0, 0).rotation.z = (i * Math.PI) / 4;
  shade(ball(n, 0.07, GOLD(), 0, 0, 0.02));
});
deco('x_planke', ({ g, fp0 }) => {
  const n = onSide(g, new THREE.Group(), fp0, -1, H - 0.08, 0);
  box(n, 0.4, 0.05, 1.3, WOOD(), 0, 0, 0.6);
});
deco('x_hai', ({ grp, anim }) => {
  const n = grp();
  const fin = put(n, ext(triShape([[0, 0], [0.5, 0], [0.12, 0.55]]), 0.06), fix('#7d8a96', 0.4), 2.7, 0, 0);
  anim((t) => { n.rotation.y = t * 0.5; fin.position.y = -0.08 + Math.sin(t * 1.3) * 0.08; });
});

THEMES.piraten = {
  icon: '⚓',
  visitors: ['affe', 'papa', 'kind', 'hund'],
  levels: ['rumpf', 'holz', 'kajuete', 'turmschmal'],
  doors: ['d_kajuete', 'd_bogen', 'd_luke'],
  windows: ['f_bullauge', 'f_kanone', 'f_rund'],
  roofs: ['r_segel', 'r_deck', 'r_zinnen', 'r_spitz'],
  tops: ['t_piratenflagge', 't_ausguck', 't_wimpel', 't_fahne'],
  decos: ['x_wellen', 'x_hai', 'x_schatz', 'x_palme', 'x_papagei', 'x_anker', 'x_steuerrad', 'x_planke', 'x_kanone', 'x_lichter'],
};

// ====================================================================================================
// Meer: Leuchtturm, Strandhaus, Sandburg
// ====================================================================================================

LEVELS.leuchtturm = {
  shape: 'round', r: 0.9, pal: 'bright', c: 0,
  make(color, def) {
    const g = new THREE.Group();
    cyl(g, def.r, def.r, H, WHITE(), 0, H / 2, 0, 24);
    cyl(g, def.r + 0.01, def.r + 0.01, H * 0.5, std(color, 0.6), 0, H * 0.5, 0, 24);
    return g;
  },
};
LEVELS.strandhaus = { shape: 'box', w: 2.4, d: 1.8, pal: 'wall', c: 7, look: 'stripe' };
LEVELS.sand = { shape: 'box', w: 2.4, d: 1.8, pal: 'sand', c: 0 };
LEVELS.sandturm = { shape: 'round', r: 0.75, pal: 'sand', c: 1 };
EXTRA.windows.f_muschel = () => {
  const g = new THREE.Group();
  const fan = new THREE.Shape();
  fan.moveTo(0, -0.26);
  fan.absarc(0, -0.05, 0.34, -0.25, Math.PI + 0.25, false);
  fan.lineTo(0, -0.26);
  const geo = ext(fan, 0.05);
  shade(put(g, geo, fix('#f6c6d0', 0.5), 0, 0, 0));
  for (let i = -2; i <= 2; i++) shade(box(g, 0.02, 0.5, 0.02, fix('#e8a0b4', 0.5), i * 0.07, 0.02, 0.055)).rotation.z = -i * 0.3;
  return g;
};
roof('r_lampe', { pal: 'roof', c: 0, round: true }, (g, fp, color) => {
  // Laternenraum: Umgang mit Geländer, Glashaus mit Lampe, die sich dreht
  const r = fp.half;
  cyl(g, r + 0.3, r + 0.3, 0.1, DARK(), 0, 0.05, 0, 24);
  for (let i = 0; i < 10; i++) cyl(g, 0.025, 0.025, 0.34, DARK(), Math.sin(i * 0.628) * (r + 0.26), 0.27, Math.cos(i * 0.628) * (r + 0.26), 5);
  shade(put(g, new THREE.TorusGeometry(r + 0.26, 0.025, 5, 28).rotateX(Math.PI / 2), DARK(), 0, 0.44, 0));
  shade(cyl(g, r * 0.72, r * 0.72, 0.8, fix('#cfeaff', 0.1, { transparent: true, opacity: 0.55 }), 0, 0.5, 0, 16));
  for (let i = 0; i < 6; i++) box(g, 0.04, 0.8, 0.04, DARK(), Math.sin(i * 1.047) * r * 0.72, 0.5, Math.cos(i * 1.047) * r * 0.72);
  const lamp = new THREE.Group();
  lamp.position.y = 0.5;
  shade(ball(lamp, 0.2, glow('#ffe36b', 2.4), 0, 0, 0));
  const beam = shade(cone(lamp, 0.3, 1.6, fix('#fff3b0', 1, { transparent: true, opacity: 0.35, emissive: '#fff3b0', emissiveIntensity: 1, depthWrite: false }), 0.9, 0, 0, 12));
  beam.rotation.z = Math.PI / 2;
  g.add(lamp);
  cone(g, r * 0.95, 0.6, std(color, 0.55), 0, 1.2, 0, 16);
  g.userData.anim = (t) => { lamp.rotation.y = t * 1.2; };
  return { apex: 1.5, chimney: [r * 0.5, 1.0, -r * 0.3] };
});
roof('r_schirm', { pal: 'bright', c: 0 }, (g, fp, color) => {
  // flaches Dach mit riesigem Sonnenschirm
  box(g, fp.w + 0.2, 0.12, fp.d + 0.2, WHITE(), 0, 0.06, 0);
  cyl(g, 0.05, 0.05, 1.2, DARK(), 0, 0.7, 0, 8);
  const r = Math.max(fp.w, fp.d) / 2 + 0.25;
  for (let i = 0; i < 8; i++) put(g, new THREE.ConeGeometry(r, 0.5, 3, 1, true, (i * Math.PI) / 4, Math.PI / 4), i % 2 ? WHITE() : std(color, 0.6, { side: THREE.DoubleSide }), 0, 1.4, 0);
  return { apex: 1.65 };
});
part(TOPS, 't_moewe', {}, (g) => {
  cyl(g, 0.025, 0.025, 0.4, DARK(), 0, 0.2, 0, 6);
  const bird = new THREE.Group();
  bird.position.y = 0.52;
  g.add(bird);
  ball(bird, 0.13, WHITE(), 0, 0, 0).scale.set(1.5, 0.9, 0.9);
  ball(bird, 0.08, WHITE(), 0.18, 0.1, 0);
  cone(bird, 0.03, 0.1, fix('#f2c832', 0.5), 0.29, 0.09, 0, 6).rotation.z = -Math.PI / 2;
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    box(w, 0.16, 0.03, 0.42, fix('#c9d3da', 0.6), 0, 0, s * 0.22);
    bird.add(w);
    return [w, s];
  });
  return (t) => wings.forEach(([w, s]) => { w.rotation.x = s * (-0.3 + Math.sin(t * 6) * 0.45); });
});
deco('x_boot', ({ grp, half, f0, anim }) => {
  const n = grp(half + 0.95, 0.12, f0 + 0.5, -0.4);
  const hull = ball(n, 0.5, std('#3b7cc9', 0.5), 0, 0.05, 0);
  hull.scale.set(1.5, 0.5, 0.7);
  shade(ball(n, 0.44, WOOD(), 0, 0.13, 0)).scale.set(1.45, 0.3, 0.62);
  box(n, 0.12, 0.05, 0.62, DWOOD(), 0, 0.26, 0);
  for (const s of [-1, 1]) box(n, 0.9, 0.035, 0.05, DWOOD(), 0.1, 0.3, s * 0.36).rotation.y = s * 0.25;
  anim((t) => { n.rotation.z = Math.sin(t * 1.4) * 0.05; });
});
deco('x_schirm', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.85), 0, f0 + 0.6);
  cyl(n, 0.03, 0.03, 1.5, WHITE(), 0, 0.75, 0, 6).rotation.z = 0.12;
  const top = new THREE.Group();
  top.position.set(-0.09, 1.5, 0);
  top.rotation.z = 0.12;
  n.add(top);
  for (let i = 0; i < 8; i++) put(top, new THREE.ConeGeometry(0.8, 0.32, 3, 1, true, (i * Math.PI) / 4, Math.PI / 4), i % 2 ? WHITE() : fix('#3b7cc9', 0.6, { side: THREE.DoubleSide }), 0, 0, 0);
  shade(box(n, 0.5, 0.03, 1.0, fix('#f08bb4', 0.9), 0.5, 0.03, 0.1));
  ball(n, 0.16, fix('#f2c832', 0.4), 0.2, 0.16, 0.75);
});
deco('x_sandburg', ({ grp, half, f0 }) => {
  const n = grp(half + 0.5, 0, f0 + 1.1);
  const sand = fix('#e3c27f', 1);
  for (const [x, z, h] of [[0, 0, 0.42], [0.36, 0.1, 0.3], [-0.32, 0.14, 0.28]]) {
    cyl(n, 0.14, 0.18, h, sand, x, h / 2, z, 10);
    cone(n, 0.16, 0.16, sand, x, h + 0.08, z, 10);
  }
  cyl(n, 0.12, 0.09, 0.18, RED(), 0.7, 0.09, 0.35, 10); // Eimer
  box(n, 0.05, 0.03, 0.36, fix('#3b7cc9', 0.5), -0.6, 0.02, 0.4).rotation.y = 0.6;
});
deco('x_muscheln', ({ grp, f0 }) => {
  const star = ext(starShape(0.15, 0.07), 0.04);
  star.rotateX(-Math.PI / 2);
  [[-0.7, 0.9, '#f08a24'], [0.9, 1.5, '#f08bb4'], [-1.3, 1.5, '#f2c832']].forEach(([x, z, col]) => shade(put(grp(x, 0.04, f0 + z, x), star, fix(col, 0.6))));
  [[0.3, 1.2], [-0.2, 1.7], [1.5, 0.9]].forEach(([x, z]) => {
    const s = shade(ball(grp(x, 0.05, f0 + z), 0.1, fix('#f6e4d4', 0.5), 0, 0, 0));
    s.scale.set(1, 0.5, 0.8);
  });
});
deco('x_rettungsring', ({ g, fp0 }) => {
  const n = onSide(g, new THREE.Group(), fp0, 1, 0.7, 0.05);
  for (let i = 0; i < 8; i++) shade(put(n, new THREE.TorusGeometry(0.24, 0.07, 8, 6, Math.PI / 4), i % 2 ? WHITE() : RED(), 0, 0, 0)).rotation.z = (i * Math.PI) / 4;
});
deco('x_krabbe', ({ grp, f0, anim }) => {
  const n = grp(-0.9, 0, f0 + 1.3);
  ball(n, 0.16, RED(), 0, 0.12, 0).scale.set(1.3, 0.6, 1);
  for (const s of [-1, 1]) {
    ball(n, 0.07, RED(), s * 0.26, 0.2, 0.1);
    shade(ball(n, 0.03, WHITE(), s * 0.07, 0.24, 0.1));
    shade(ball(n, 0.015, DARK(), s * 0.07, 0.25, 0.125));
    for (const z of [-0.08, 0.02]) shade(box(n, 0.16, 0.025, 0.025, RED(), s * 0.24, 0.06, z));
  }
  anim((t) => { n.position.x = -0.9 + Math.sin(t * 0.8) * 0.5; n.position.y = Math.abs(Math.sin(t * 8)) * 0.02; });
});
deco('x_boje', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 1.3), 0, f0 - 0.6);
  cyl(n, 0.2, 0.26, 0.3, RED(), 0, 0.2, 0, 12);
  cyl(n, 0.16, 0.2, 0.22, WHITE(), 0, 0.46, 0, 12);
  cyl(n, 0.02, 0.02, 0.3, DARK(), 0, 0.7, 0, 6);
  shade(ball(n, 0.07, glow('#ff4d4d', 2), 0, 0.88, 0));
  shade(cyl(n, 0.5, 0.5, 0.02, BLUE(), 0, 0.02, 0, 16));
  anim((t) => { n.rotation.z = Math.sin(t * 1.6) * 0.12; n.rotation.x = Math.sin(t * 1.1) * 0.08; });
});

THEMES.meer = {
  icon: '⛵',
  visitors: ['pinguin', 'kind', 'oma', 'ente'],
  levels: ['leuchtturm', 'strandhaus', 'sand', 'sandturm'],
  doors: ['d_bogen', 'd_rund', 'd_kajuete'],
  windows: ['f_bullauge', 'f_muschel', 'f_rund', 'f_bogen'],
  roofs: ['r_lampe', 'r_schirm', 'r_zinnen', 'r_kegel', 'r_stroh'],
  tops: ['t_moewe', 't_fahne', 't_wimpel', 't_kugel'],
  decos: ['x_wellen', 'x_boot', 'x_schirm', 'x_sandburg', 'x_muscheln', 'x_krabbe', 'x_rettungsring', 'x_boje', 'x_palme', 'x_wimpel'],
};

// ====================================================================================================
// Schloss
// ====================================================================================================

const royal = (id, shape, size) => {
  LEVELS[id] = {
    shape, ...size, pal: 'royal', c: 0,
    make(color, def) {
      const g = new THREE.Group();
      const m = std(color, 0.7);
      if (shape === 'box') {
        put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.05), m, 0, H / 2, 0);
        box(g, def.w + 0.08, 0.09, def.d + 0.08, GOLD(), 0, H - 0.045, 0);
        box(g, def.w + 0.06, 0.16, def.d + 0.06, std(darker(color, 0.88), 0.7), 0, 0.08, 0);
      } else {
        cyl(g, def.r, def.r, H, m, 0, H / 2, 0, 28);
        cyl(g, def.r + 0.04, def.r + 0.04, 0.09, GOLD(), 0, H - 0.045, 0, 28);
        cyl(g, def.r + 0.03, def.r + 0.03, 0.16, std(darker(color, 0.88), 0.7), 0, 0.08, 0, 28);
      }
      return g;
    },
  };
};
royal('schloss', 'box', { w: 2.4, d: 1.8 });
royal('schlossschmal', 'box', { w: 1.5, d: 1.4 });
royal('schlossturm', 'round', { r: 1.05 });
royal('schlossturmschmal', 'round', { r: 0.72 });
part(DOORS, 'd_goldtor', { pal: 'bright', c: 4 }, (g, color) => {
  put(g, ext(archShape(1.0, 1.1), 0.07), GOLD(), 0, 0, 0, false);
  put(g, ext(archShape(0.84, 1.0), 0.08), std(color, 0.5), 0, 0, 0.02, false);
  shade(box(g, 0.03, 0.98, 0.03, GOLD(), 0, 0.49, 0.1));
  for (const x of [-0.24, 0.24]) for (const y of [0.25, 0.55]) shade(ball(g, 0.035, GOLD(), x, y, 0.1));
  for (const x of [-0.08, 0.08]) shade(put(g, new THREE.TorusGeometry(0.05, 0.015, 5, 10), GOLD(), x, 0.42, 0.11));
  box(g, 1.2, 0.08, 0.3, WHITE(), 0, -0.02, 0.16, false);
});
EXTRA.windows.f_balkon = (glass) => {
  const g = new THREE.Group();
  const a = ext(archShape(0.46, 0.7), 0.05);
  a.center();
  shade(put(g, a, WHITE(), 0, 0.04, 0));
  const b = ext(archShape(0.46, 0.7), 0.05);
  b.center();
  shade(put(g, b, glass, 0, 0.04, 0.02)).scale.set(0.76, 0.76, 1);
  box(g, 0.66, 0.05, 0.26, WHITE(), 0, -0.34, 0.14);
  for (let i = 0; i < 5; i++) shade(box(g, 0.03, 0.2, 0.03, GOLD(), -0.28 + i * 0.14, -0.22, 0.25));
  shade(box(g, 0.66, 0.035, 0.035, GOLD(), 0, -0.12, 0.25));
  return g;
};
roof('r_krone', { pal: 'bright', c: 4, round: true }, (g, fp, color) => {
  // Kronendach: goldener Reif mit Zacken, darin ein Samtkissen
  const r = fp.half + 0.1;
  put(g, new THREE.CylinderGeometry(r + 0.06, r, 0.5, 24, 1, true), fix('#f7c531', 0.35, { metalness: 0.3, side: THREE.DoubleSide }), 0, 0.25, 0);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785;
    cone(g, 0.16, 0.42, GOLD(), Math.sin(a) * (r + 0.04), 0.7, Math.cos(a) * (r + 0.04), 8);
    shade(ball(g, 0.07, fix(['#e5484d', '#3b7cc9', '#3f8a6a'][i % 3], 0.3), Math.sin(a) * (r + 0.08), 0.26, Math.cos(a) * (r + 0.08)));
  }
  const cushion = put(g, new THREE.SphereGeometry(r * 0.94, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(color, 0.9), 0, 0.2, 0);
  cushion.scale.y = 0.8;
  return { apex: 0.2 + r * 0.75, chimney: [r * 0.4, 0.6, -r * 0.3] };
});
deco('x_rosen', ({ grp, half, f0 }) => {
  for (const s of [-1, 1]) {
    const n = grp(s * (half + 0.35), 0, f0 + 0.35);
    ball(n, 0.34, GREEN(), 0, 0.3, 0);
    ball(n, 0.24, GREEN(), s * 0.22, 0.5, 0.08);
    [[0.1, 0.56, 0.2], [-0.18, 0.4, 0.24], [0.26, 0.34, 0.18], [0.02, 0.24, 0.31], [s * 0.3, 0.68, 0.16]].forEach(([x, y, z], i) => shade(ball(n, 0.07, fix(i % 2 ? '#f08bb4' : '#e5484d', 0.5), x, y, z)));
  }
});
deco('x_brunnen', ({ grp, half, f0, anim }) => {
  const n = grp(half + 0.9, 0, f0 + 0.75);
  cyl(n, 0.55, 0.6, 0.26, STONE(), 0, 0.13, 0, 18);
  shade(cyl(n, 0.47, 0.47, 0.03, BLUE(), 0, 0.26, 0, 18));
  cyl(n, 0.08, 0.1, 0.7, STONE(), 0, 0.6, 0, 10);
  cyl(n, 0.26, 0.1, 0.1, STONE(), 0, 0.95, 0, 14);
  const drops = [];
  for (let i = 0; i < 6; i++) drops.push(shade(ball(n, 0.045, BLUE(), 0, 1, 0)));
  anim((t) => drops.forEach((d, i) => {
    const u = (t * 0.9 + i / 6) % 1;
    const a = i * 1.047;
    d.position.set(Math.sin(a) * u * 0.36, 1.0 + u * 0.5 - u * u * 1.2, Math.cos(a) * u * 0.36);
  }));
});
deco('x_teppich', ({ g, f0 }) => {
  shade(box(g, 0.8, 0.03, 1.9, fix('#b0283a', 0.9), 0, 0.02, f0 + 1.05)).receiveShadow = true;
  for (const x of [-0.37, 0.37]) shade(box(g, 0.05, 0.035, 1.9, GOLD(), x, 0.022, f0 + 1.05));
});
deco('x_kutsche', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.85), 0, f0 + 0.7, 0.35);
  ball(n, 0.42, fix('#f6d5e5', 0.4), 0, 0.62, 0).scale.set(1.15, 0.95, 0.85);
  shade(box(n, 0.3, 0.3, 0.74, fix('#9fd0ee', 0.2), 0, 0.68, 0));
  shade(put(n, new THREE.TorusGeometry(0.44, 0.03, 6, 20), GOLD(), 0, 0.62, 0)).rotation.y = Math.PI / 2;
  cone(n, 0.1, 0.2, GOLD(), 0, 1.1, 0, 8);
  for (const x of [-0.36, 0.36]) for (const z of [-0.36, 0.36]) {
    shade(put(n, new THREE.TorusGeometry(0.2, 0.035, 6, 14), GOLD(), x, 0.22, z));
    shade(box(n, 0.38, 0.025, 0.02, GOLD(), x, 0.22, z));
    shade(box(n, 0.025, 0.38, 0.02, GOLD(), x, 0.22, z));
  }
});

THEMES.schloss = {
  icon: '👑',
  visitors: ['kind', 'oma', 'katze', 'pferd'],
  levels: ['schloss', 'schlossturm', 'schlossschmal', 'schlossturmschmal'],
  doors: ['d_goldtor', 'd_bogen', 'd_doppel'],
  windows: ['f_balkon', 'f_bogen', 'f_herz', 'f_stern'],
  roofs: ['r_kegel', 'r_krone', 'r_zwiebel', 'r_zinnen', 'r_kuppel'],
  tops: ['t_krone', 't_herz', 't_stern', 't_wimpel', 't_fahne'],
  decos: ['x_ecktuerme', 'x_rosen', 'x_brunnen', 'x_teppich', 'x_kutsche', 'x_banner', 'x_lichter', 'x_sterne', 'x_regenbogen'],
};

// ====================================================================================================
// Winter
// ====================================================================================================

LEVELS.iglu = { shape: 'round', r: 1.05, pal: 'snow', c: 0, look: 'stone' };
LEVELS.eis = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'ice', c: 0,
  make(color, def) {
    const g = new THREE.Group();
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 3, 0.1), std(color, 0.1, { transparent: true, opacity: 0.82, metalness: 0.1 }), 0, H / 2, 0);
    return g;
  },
};
LEVELS.lebkuchen = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'wood', c: 1,
  make(color, def) {
    // Lebkuchenhaus: Zuckerguss oben, bunte Bonbons
    const g = new THREE.Group();
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.05), std(color, 0.95), 0, H / 2, 0);
    for (let i = 0; i < 9; i++) for (const z of [-1, 1]) shade(ball(g, 0.11, SNOW(), -def.w / 2 + 0.15 + i * ((def.w - 0.3) / 8), H - 0.08, z * def.d / 2)).scale.z = 0.5;
    ['#e5484d', '#f2c832', '#3f8a6a', '#3b7cc9', '#f08bb4'].forEach((col, i) => shade(ball(g, 0.06, fix(col, 0.4), -0.98 + i * 0.49, 0.16, def.d / 2 + 0.01)));
    return g;
  },
};
roof('r_schnee', { pal: 'roof', c: 0 }, (g, fp, color, wallColor) => {
  const h = 1.05 * (fp.w < 2 ? 0.8 : 1);
  put(g, gableFill(fp.w, fp.d, h), std(wallColor, 0.85));
  put(g, gableRoof(fp.w, fp.d, h), std(color, 0.55), 0, -0.02, 0);
  // Schneedecke obendrauf und Eiszapfen an der Traufe
  const snow = put(g, gableRoof(fp.w, fp.d, h), SNOW(), 0, 0.2, 0);
  snow.scale.set(0.96, 0.84, 0.86);
  for (let i = 0; i < 8; i++) for (const z of [-1, 1]) {
    cone(g, 0.035, 0.14 + (i % 3) * 0.06, fix('#d6f0ff', 0.1), -fp.w / 2 + 0.1 + i * ((fp.w - 0.2) / 7), -0.1 - (i % 3) * 0.03, z * (fp.d / 2 + 0.2), 5).rotation.x = Math.PI;
  }
  return { apex: h + 0.05, chimney: [fp.w * 0.26, h * 0.68, -fp.d * 0.17] };
});
roof('r_iglu', { pal: 'snow', c: 0, round: true }, (g, fp, color) => {
  const r = fp.half + 0.04;
  const dome = put(g, new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(color, 0.9, { map: tex('stone', 6, 2) }));
  dome.scale.set(1, 0.9, fp.d / fp.w);
  return { apex: r * 0.9, chimney: [r * 0.45, r * 0.55, -r * 0.3] };
});
part(TOPS, 't_schneemann', {}, (g) => { snowman(g, 0.75); });
deco('x_schneemann', ({ grp, half, f0 }) => { snowman(grp(half + 0.7, 0, f0 + 0.7, -0.4), 1.15); });
deco('x_tanne', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 0.95), 0, f0 - 0.2);
  cyl(n, 0.1, 0.12, 0.4, DWOOD(), 0, 0.2, 0, 8);
  const lights = [];
  [[0.75, 0.9, 0.75], [0.58, 0.8, 1.3], [0.4, 0.7, 1.8]].forEach(([r, h, y], k) => {
    cone(n, r, h, fix('#3f8a4a', 0.9), 0, y, 0, 12);
    shade(cone(n, r * 0.5, h * 0.4, SNOW(), 0, y + h * 0.32, 0, 12));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + k;
      lights.push(shade(ball(n, 0.055, std(PAL.bright[(i + k) % 7], 0.3, { emissive: PAL.bright[(i + k) % 7], emissiveIntensity: 1 }), Math.sin(a) * r * 0.78, y - h * 0.32, Math.cos(a) * r * 0.78)));
    }
  });
  const star = ext(starShape(0.16, 0.07), 0.05);
  star.center();
  put(n, star, GOLD(), 0, 2.28, 0);
  anim((t) => lights.forEach((l, i) => { l.material.emissiveIntensity = 0.8 + Math.sin(t * 3 + i * 1.9) * 0.7; }));
});
deco('x_schlitten', ({ grp, half, f0 }) => {
  const n = grp(-(half + 0.3), 0, f0 + 1.0, 0.5);
  for (const z of [-0.18, 0.18]) {
    box(n, 0.9, 0.04, 0.04, RED(), 0, 0.04, z);
    for (const x of [-0.28, 0.28]) box(n, 0.04, 0.2, 0.04, RED(), x, 0.14, z);
  }
  for (let i = 0; i < 4; i++) box(n, 0.8, 0.03, 0.09, WOOD(), 0, 0.25, -0.17 + i * 0.113);
});
deco('x_geschenke', ({ grp, f0 }) => {
  [[0.75, 0.75, 0.34, '#e5484d'], [1.15, 1.0, 0.26, '#3b7cc9'], [0.6, 1.2, 0.22, '#3f8a6a']].forEach(([x, z, s, col], i) => {
    const n = grp(x, 0, f0 + z, i * 0.5);
    box(n, s, s, s, fix(col, 0.6), 0, s / 2, 0);
    shade(box(n, s + 0.01, s + 0.01, s * 0.2, GOLD(), 0, s / 2, 0));
    shade(box(n, s * 0.2, s + 0.01, s + 0.01, GOLD(), 0, s / 2, 0));
    shade(ball(n, s * 0.16, GOLD(), 0, s + s * 0.1, 0));
  });
});
deco('x_eiszapfen', ({ g, fp0, half }) => {
  for (let i = 0; i < 9; i++) {
    const n = attachFront(g, new THREE.Group(), fp0, (i / 8 - 0.5) * half * 1.8, H - 0.02, 0.03);
    shade(cone(n, 0.04, 0.16 + (i % 3) * 0.08, fix('#d6f0ff', 0.1), 0, -0.08 - (i % 3) * 0.04, 0, 5)).rotation.x = Math.PI;
  }
});
deco('x_flocken', ({ g, ctx, anim }) => {
  const flakes = [];
  const top = ctx.apexY + 1.2;
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4;
    const r = 1.2 + ((i * 7) % 10) / 6;
    flakes.push([shade(ball(g, 0.045, SNOW(), Math.sin(a) * r, 0, Math.cos(a) * r)), i / 16]);
  }
  anim((t) => flakes.forEach(([f, o]) => { f.position.y = top * (1 - ((t * 0.12 + o) % 1)); }));
});
deco('x_zuckerstangen', ({ g, fp0, half }) => {
  for (const s of [-1, 1]) {
    const n = attachFront(g, new THREE.Group(), fp0, s * 0.68 * (half < 0.95 ? 0.8 : 1), 0, 0.2);
    for (let i = 0; i < 8; i++) cyl(n, 0.045, 0.045, 0.1, i % 2 ? WHITE() : RED(), 0, 0.05 + i * 0.1, 0, 8);
    for (let i = 0; i < 5; i++) shade(put(n, new THREE.TorusGeometry(0.11, 0.045, 6, 4, Math.PI / 5), i % 2 ? RED() : WHITE(), -s * 0.11, 0.8, 0)).rotation.set(0, s > 0 ? 0 : Math.PI, (i * Math.PI) / 5);
  }
});

THEMES.winter = {
  icon: '⛄',
  visitors: ['pinguin', 'kind', 'teddy', 'hase'],
  levels: ['iglu', 'lebkuchen', 'eis', 'holz'],
  doors: ['d_rund', 'd_bogen', 'd_eck'],
  windows: ['f_rund', 'f_herz', 'f_eck', 'f_stern'],
  roofs: ['r_schnee', 'r_iglu', 'r_spitz', 'r_zwiebel'],
  tops: ['t_schneemann', 't_schornstein', 't_stern', 't_kugel', 't_fahne'],
  decos: ['x_schneemann', 'x_tanne', 'x_geschenke', 'x_schlitten', 'x_zuckerstangen', 'x_eiszapfen', 'x_flocken', 'x_lichter', 'x_laterne'],
};

// ====================================================================================================
// Dschungel
// ====================================================================================================

LEVELS.bambus = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'bamboo', c: 0,
  make(color, def) {
    const g = new THREE.Group();
    const m = std(color, 0.7);
    box(g, def.w - 0.12, H, def.d - 0.12, std(darker(color, 0.75), 0.9), 0, H / 2, 0);
    for (let i = 0; i < 11; i++) for (const z of [-1, 1]) cyl(g, 0.11, 0.11, H, m, -def.w / 2 + 0.11 + i * ((def.w - 0.22) / 10), H / 2, z * (def.d / 2 - 0.08), 8);
    for (let i = 1; i < 7; i++) for (const x of [-1, 1]) cyl(g, 0.11, 0.11, H, m, x * (def.w / 2 - 0.11), H / 2, -def.d / 2 + 0.08 + i * ((def.d - 0.16) / 7), 8);
    for (const y of [0.25, 0.95]) box(g, def.w + 0.04, 0.06, def.d + 0.06, DWOOD(), 0, y, 0);
    return g;
  },
};
LEVELS.stamm = { shape: 'round', r: 0.78, pal: 'wood', c: 1, look: 'bark' };
LEVELS.ruine = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'stone', c: 4,
  make(color, def) {
    // alte Tempelmauer mit Moos
    const g = new THREE.Group();
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.05), std(color, 0.9, { map: tex('stone', 2, 1) }), 0, H / 2, 0);
    [[-0.9, 1.1, 0.3], [0.5, 1.15, 0.24], [1.05, 0.2, 0.26], [-0.3, 0.12, 0.2]].forEach(([x, y, r]) => shade(ball(g, r, GREEN(), x, y, def.d / 2)).scale.set(1, 0.6, 0.3));
    return g;
  },
};
part(DOORS, 'd_perlen', { pal: 'bright', c: 3 }, (g, color) => {
  box(g, 0.8, 0.98, 0.05, fix('#2b2622', 0.9), 0, 0.49, 0.02, false);
  box(g, 0.94, 0.09, 0.1, WOOD(), 0, 1.0, 0.05, false);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 7; k++) {
    shade(ball(g, 0.045, k % 2 ? fix(PAL.bright[(i + k) % 7], 0.4) : std(color, 0.4), -0.33 + i * 0.132, 0.9 - k * 0.13, 0.07));
  }
});
EXTRA.windows.f_blatt = (glass) => {
  const g = new THREE.Group();
  const leaf = new THREE.Shape();
  leaf.moveTo(0, -0.36);
  leaf.quadraticCurveTo(0.42, 0, 0, 0.36);
  leaf.quadraticCurveTo(-0.42, 0, 0, -0.36);
  shade(put(g, ext(leaf, 0.05), GREEN(), 0, 0, 0));
  shade(put(g, ext(leaf, 0.05), glass, 0, 0, 0.02)).scale.set(0.7, 0.72, 1);
  return g;
};
roof('r_blatt', { pal: 'leaf', c: 0, round: true }, (g, fp, color) => {
  // Dach aus großen Blättern, die von der Mitte herabhängen
  const r = Math.max(fp.w, fp.d) / 2 + 0.45;
  const m = std(color, 0.85);
  for (let i = 0; i < 10; i++) {
    const n = new THREE.Group();
    n.rotation.y = i * 0.628;
    const l = ball(n, 0.5, i % 2 ? m : std(darker(color, 0.85), 0.85), r * 0.5, 0.45, 0);
    l.scale.set(r / 0.5 * 0.56, 0.1, 0.62);
    l.rotation.z = -0.62;
    g.add(n);
  }
  ball(g, 0.16, DWOOD(), 0, 0.92, 0);
  return { apex: 0.95, chimney: [r * 0.3, 0.6, -r * 0.2] };
});
roof('r_baumkrone', { pal: 'leaf', c: 0, round: true }, (g, fp, color) => {
  const r = fp.half;
  const m = std(color, 0.9);
  ball(g, r * 1.25, m, 0, r * 0.75, 0);
  for (const [x, y, z, s] of [[0.8, 0.5, 0.3, 0.8], [-0.75, 0.55, 0.2, 0.85], [0.1, 0.6, -0.8, 0.8], [0.2, 1.35, 0.1, 0.7], [-0.2, 0.5, 0.8, 0.7]]) ball(g, r * s, m, x * r, y * r + 0.2, z * r);
  for (const [x, y, z] of [[0.9, 0.9, 0.9], [-1.0, 1.0, 0.6], [0.2, 1.9, 0.5], [0.3, 0.5, 1.35]]) shade(ball(g, 0.09, fix('#f08a24', 0.5), x * r, y * r, z * r));
  return { apex: r * 2.0, chimney: [r * 0.6, r * 1.3, -r * 0.4] };
});
part(TOPS, 't_papagei', {}, (g) => {
  cyl(g, 0.025, 0.025, 0.3, DWOOD(), 0, 0.15, 0, 6);
  box(g, 0.34, 0.035, 0.035, DWOOD(), 0, 0.3, 0);
  const bird = new THREE.Group();
  bird.position.y = 0.32;
  g.add(bird);
  parrot(bird);
  return (t) => { bird.rotation.z = Math.sin(t * 2.2) * 0.12; };
});
part(TOPS, 't_bananen', {}, (g) => {
  cyl(g, 0.03, 0.03, 0.3, DWOOD(), 0, 0.15, 0, 6);
  for (let i = 0; i < 5; i++) {
    const n = new THREE.Group();
    n.position.y = 0.34;
    n.rotation.y = i * 1.257;
    put(n, new THREE.TorusGeometry(0.3, 0.07, 6, 10, 1.5), fix('#f2c832', 0.5), 0.3, 0.02, 0).rotation.z = Math.PI - 0.2;
    g.add(n);
  }
});
deco('x_lianen', ({ g, ctx, anim }) => {
  const vines = [];
  const fp = ctx.fpTop;
  [-0.85, -0.3, 0.45, 0.9].forEach((u, i) => {
    const pivot = attachFront(g, new THREE.Group(), fp, u * fp.half, ctx.topY, 0.08);
    const len = Math.min(ctx.topY - 0.2, 0.9 + (i % 3) * 0.5);
    shade(cyl(pivot, 0.025, 0.025, len, GREEN(), 0, -len / 2, 0, 5));
    for (let y = 0.2; y < len; y += 0.24) shade(ball(pivot, 0.08, GREEN(), (y * 7) % 0.1 - 0.05, -y, 0.03)).scale.set(1.2, 0.6, 0.4);
    vines.push(pivot);
  });
  anim((t) => vines.forEach((v, i) => { v.rotation.z = Math.sin(t * 1.2 + i * 1.3) * 0.07; }));
});
deco('x_rutsche', ({ grp, half, f0 }) => {
  const n = grp(half + 0.1, 0, f0 * 0.2);
  const chute = box(n, 1.9, 0.06, 0.5, fix('#f2c832', 0.4), 0.82, 0.62, 0);
  chute.rotation.z = -0.62;
  for (const z of [-0.26, 0.26]) box(n, 1.9, 0.14, 0.04, RED(), 0.82, 0.68, z).rotation.z = -0.62;
  box(n, 0.5, 0.05, 0.5, fix('#f2c832', 0.4), 1.75, 0.06, 0);
});
deco('x_schaukel', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 0.95), 0, f0 + 0.3);
  cyl(n, 0.06, 0.08, 1.9, DWOOD(), -0.4, 0.95, 0, 8);
  box(n, 1.0, 0.07, 0.07, DWOOD(), 0, 1.85, 0);
  const sw = new THREE.Group();
  sw.position.set(0.3, 1.82, 0);
  n.add(sw);
  shade(cyl(sw, 0.012, 0.012, 1.1, DARK(), 0, -0.55, 0, 4));
  put(sw, new THREE.TorusGeometry(0.24, 0.09, 8, 16), DARK(), 0, -1.3, 0).rotation.y = Math.PI / 2;
  anim((t) => { sw.rotation.x = Math.sin(t * 1.8) * 0.35; });
});
deco('x_affe', ({ grp, half, f0, anim }) => {
  const n = grp(half + 0.6, 0, f0 + 0.9, -0.6);
  const m = buildFigure('affe');
  m.scale.setScalar(1.3);
  n.add(m);
  anim((t) => { m.position.y = Math.max(0, Math.sin(t * 3)) * 0.12; });
});
deco('x_bruecke', ({ grp, half, f0 }) => {
  // Hängebrücke vom Haus nach vorne
  const n = grp(-0.9, 0, f0 + 0.2);
  for (let i = 0; i < 7; i++) box(n, 0.5, 0.04, 0.16, WOOD(), 0, 0.28 - Math.sin((i / 6) * Math.PI) * 0.12, 0.15 + i * 0.22);
  for (const x of [-0.28, 0.28]) {
    for (const z of [0.1, 1.6]) cyl(n, 0.04, 0.05, 0.75, DWOOD(), x, 0.37, z, 6);
    shade(box(n, 0.025, 0.025, 1.5, fix('#c9a26b'), x, 0.62, 0.85));
  }
});
deco('x_blueten', ({ grp, half, f0 }) => {
  [[half + 0.5, 0.4, '#e5484d'], [-(half + 0.5), 0.9, '#f08bb4'], [0.9, 1.3, '#f08a24'], [-(half + 1.0), 0.1, '#8b5bb5']].forEach(([x, z, col], k) => {
    const n = grp(x, 0, f0 + z, k);
    cyl(n, 0.025, 0.03, 0.4, GREEN(), 0, 0.2, 0, 5);
    for (let i = 0; i < 5; i++) {
      const p = shade(ball(n, 0.13, fix(col, 0.5), Math.sin(i * 1.257) * 0.14, 0.44, Math.cos(i * 1.257) * 0.14));
      p.scale.y = 0.4;
    }
    shade(ball(n, 0.07, fix('#f2c832', 0.5), 0, 0.46, 0));
    for (const s of [-1, 1]) shade(ball(n, 0.16, GREEN(), s * 0.16, 0.08, 0)).scale.set(1, 0.25, 0.5);
  });
});
deco('x_trommeln', ({ grp, f0 }) => {
  [[0.75, 0.75, 0.24, 0.42], [1.2, 0.95, 0.18, 0.32]].forEach(([x, z, r, h]) => {
    const n = grp(x, 0, f0 + z);
    cyl(n, r, r * 0.8, h, fix('#b0283a', 0.6), 0, h / 2, 0, 14);
    shade(cyl(n, r + 0.01, r + 0.01, 0.04, fix('#f3ead8', 0.8), 0, h, 0, 14));
    shade(cyl(n, r * 0.82, r * 0.82, 0.04, GOLD(), 0, 0.03, 0, 14));
  });
});

THEMES.dschungel = {
  icon: '🌴',
  visitors: ['affe', 'loewe', 'elefant', 'frosch'],
  levels: ['bambus', 'stamm', 'ruine', 'holz'],
  doors: ['d_perlen', 'd_rund', 'd_bogen'],
  windows: ['f_blatt', 'f_rund', 'f_bogen'],
  roofs: ['r_blatt', 'r_baumkrone', 'r_stroh', 'r_kegel'],
  tops: ['t_papagei', 't_bananen', 't_fahne', 't_kugel'],
  decos: ['x_palme', 'x_lianen', 'x_affe', 'x_rutsche', 'x_schaukel', 'x_bruecke', 'x_blueten', 'x_trommeln', 'x_fackeln', 'x_efeu'],
};

// ====================================================================================================
// Noch mehr Teile für alle Themen (werden unten in die Themen-Listen einsortiert)
// ====================================================================================================

PAL.pumpkin = ['#f08a24', '#e8672c', '#f2c832', '#9bc15a'];

// ---------- Stockwerke ----------

LEVELS.glas = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'ice', c: 0,
  make(color, def) {
    // Glashaus: durchsichtige Wände in weißem Rahmen
    const g = new THREE.Group();
    shade(box(g, def.w - 0.06, H - 0.04, def.d - 0.06, std(color, 0.1, { transparent: true, opacity: 0.55 }), 0, H / 2, 0));
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(g, 0.09, H, 0.09, WHITE(), x * (def.w / 2 - 0.045), H / 2, z * (def.d / 2 - 0.045));
    for (const y of [0.05, H - 0.05]) {
      for (const z of [-1, 1]) box(g, def.w, 0.1, 0.09, WHITE(), 0, y, z * (def.d / 2 - 0.045));
      for (const x of [-1, 1]) box(g, 0.09, 0.1, def.d, WHITE(), x * (def.w / 2 - 0.045), y, 0);
    }
    return g;
  },
};
LEVELS.fachwerk = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'wall', c: 0,
  make(color, def) {
    // Fachwerk: helle Wand mit dunklen Balken
    const g = new THREE.Group();
    put(g, new RoundedBoxGeometry(def.w, H, def.d, 2, 0.04), std(color, 0.9), 0, H / 2, 0);
    const beam = fix('#5b3d28', 0.9);
    for (const z of [-1, 1]) {
      const zz = z * (def.d / 2 + 0.005);
      for (const y of [0.05, H - 0.05]) shade(box(g, def.w + 0.02, 0.1, 0.03, beam, 0, y, zz));
      for (const x of [-1.15, -0.4, 0.4, 1.15]) shade(box(g, 0.09, H, 0.03, beam, x, H / 2, zz));
      for (const s of [-1, 1]) shade(box(g, 0.08, 1.3, 0.03, beam, s * 0.78, H / 2, zz)).rotation.z = s * 0.58;
    }
    for (const x of [-1, 1]) {
      const xx = x * (def.w / 2 + 0.005);
      for (const y of [0.05, H - 0.05]) shade(box(g, 0.03, 0.1, def.d + 0.02, beam, xx, y, 0));
      for (const z of [-0.85, 0, 0.85]) shade(box(g, 0.03, H, 0.09, beam, xx, H / 2, z));
    }
    return g;
  },
};
LEVELS.container = {
  shape: 'box', w: 2.4, d: 1.8, pal: 'bright', c: 1,
  make(color, def) {
    // Blechcontainer mit Rippen
    const g = new THREE.Group();
    const m = std(color, 0.5, { metalness: 0.2 });
    box(g, def.w, H, def.d, m, 0, H / 2, 0);
    for (let i = 0; i < 12; i++) for (const z of [-1, 1]) shade(box(g, 0.07, H - 0.16, 0.03, m, -def.w / 2 + 0.16 + i * ((def.w - 0.32) / 11), H / 2, z * (def.d / 2 + 0.012)));
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(g, 0.1, H + 0.01, 0.1, std(darker(color, 0.7), 0.5), x * (def.w / 2 - 0.03), H / 2, z * (def.d / 2 - 0.03));
    return g;
  },
};
LEVELS.wolke = {
  shape: 'round', r: 1.0, pal: 'snow', c: 0,
  make(color, def) {
    // Wolkenhaus: weiche weiße Bäusche
    const g = new THREE.Group();
    const m = std(color, 1);
    cyl(g, def.r - 0.02, def.r - 0.02, H, m, 0, H / 2, 0, 24);
    for (let i = 0; i < 12; i++) {
      const a = i * 0.5236;
      ball(g, 0.3, m, Math.sin(a) * 0.7, i % 2 ? 0.32 : 0.86, Math.cos(a) * 0.7);
    }
    return g;
  },
};
LEVELS.kuerbis = {
  shape: 'round', r: 1.0, pal: 'pumpkin', c: 0,
  make(color, def) {
    // Kürbishaus: dicke Rippen rundherum
    const g = new THREE.Group();
    const m = std(color, 0.7);
    cyl(g, def.r - 0.08, def.r - 0.08, H, m, 0, H / 2, 0, 20);
    for (let i = 0; i < 10; i++) {
      const a = i * 0.628 + 0.314;
      const rib = ball(g, 0.4, i % 2 ? m : std(darker(color, 0.9), 0.7), Math.sin(a) * 0.62, H / 2, Math.cos(a) * 0.62);
      rib.scale.set(1, 1.5, 1);
    }
    return g;
  },
};

// ---------- Türen ----------

part(DOORS, 'd_herz', { pal: 'bright', c: 0 }, (g, color) => {
  const back = ext(heartShape(0.72), 0.06);
  back.center();
  shade(put(g, back, WHITE(), 0, 0.52, 0.03));
  const front = ext(heartShape(0.6), 0.08);
  front.center();
  shade(put(g, front, std(color, 0.5), 0, 0.52, 0.045));
  shade(ball(g, 0.045, GOLD(), 0.14, 0.46, 0.14));
  box(g, 0.7, 0.08, 0.24, STONE(), 0, -0.02, 0.13, false);
});
part(DOORS, 'd_saloon', { pal: 'wood', c: 2 }, (g, color) => {
  // Schwingtür: zwei halbe Flügel vor einer dunklen Öffnung
  box(g, 0.94, 1.0, 0.05, fix('#2b2622', 0.9), 0, 0.5, 0.02, false);
  const m = std(color, 0.7);
  for (const s of [-1, 1]) {
    const leaf = box(g, 0.44, 0.5, 0.05, m, s * 0.235, 0.52, 0.09);
    leaf.rotation.y = s * -0.25;
    for (let i = 0; i < 3; i++) shade(box(g, 0.36, 0.03, 0.02, DWOOD(), s * 0.235, 0.4 + i * 0.12, 0.125)).rotation.y = s * -0.25;
    box(g, 0.07, 1.04, 0.09, DWOOD(), s * 0.5, 0.52, 0.05);
  }
});
part(DOORS, 'd_tunnel', { pal: 'snow', c: 0 }, (g, color) => {
  // Eingangstunnel wie beim Iglu
  const arch = put(g, new THREE.CylinderGeometry(0.52, 0.52, 0.75, 18, 1, false, -Math.PI / 2, Math.PI), std(color, 0.9, { map: tex('stone', 3, 1) }), 0, 0, 0.36);
  arch.rotation.x = -Math.PI / 2; // Bogen nach oben, Röhre nach vorne
  const hole = put(g, new THREE.CylinderGeometry(0.38, 0.38, 0.02, 18, 1, false, -Math.PI / 2, Math.PI), fix('#2b2622', 0.9), 0, 0, 0.74, false);
  hole.rotation.x = -Math.PI / 2;
});

// ---------- Fenster ----------

EXTRA.windows.f_blume = (glass) => {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) disc(g, 0.15, 0.05, fix('#f6a5c0', 0.5), Math.cos(i * 1.047) * 0.2, Math.sin(i * 1.047) * 0.2, 0);
  disc(g, 0.17, 0.06, glass, 0, 0, 0.012);
  return g;
};
EXTRA.windows.f_laden = (glass) => {
  // Fenster mit grünen Fensterläden
  const g = new THREE.Group();
  box(g, 0.5, 0.52, 0.06, WHITE(), 0, 0, 0, false);
  box(g, 0.38, 0.4, 0.06, glass, 0, 0, 0.02, false);
  box(g, 0.03, 0.42, 0.07, WHITE(), 0, 0, 0.025, false);
  for (const s of [-1, 1]) {
    box(g, 0.2, 0.52, 0.04, fix('#3f8a6a', 0.7), s * 0.36, 0, 0.01, false);
    for (let i = 0; i < 4; i++) box(g, 0.16, 0.02, 0.05, fix('#2f6b52', 0.7), s * 0.36, -0.18 + i * 0.12, 0.012, false);
  }
  return g;
};
EXTRA.windows.f_bunt = () => {
  // buntes Glasfenster
  const g = new THREE.Group();
  shade(put(g, (() => { const a = ext(archShape(0.52, 0.76), 0.05); a.center(); return a; })(), fix('#4a4038', 0.6), 0, 0, 0));
  [['#e5484d', -0.11, 0.14], ['#3b7cc9', 0.11, 0.14], ['#f2c832', -0.11, -0.14], ['#3f8a6a', 0.11, -0.14]].forEach(([col, x, y]) => {
    box(g, 0.19, 0.25, 0.06, fix(col, 0.2, { emissive: col, emissiveIntensity: 0.35 }), x, y - 0.03, 0.012, false);
  });
  return g;
};
EXTRA.windows.f_mond = () => {
  const g = new THREE.Group();
  const moon = new THREE.Shape();
  moon.moveTo(0, 0.32);
  moon.absarc(0, 0, 0.32, Math.PI / 2, Math.PI * 1.5, false);
  moon.quadraticCurveTo(-0.26, 0, 0, 0.32);
  const geo = ext(moon, 0.05);
  geo.translate(0.14, 0, 0);
  shade(put(g, geo, fix('#f7d76b', 0.3, { emissive: '#f7d76b', emissiveIntensity: 0.6 }), 0, 0, 0));
  const star = ext(starShape(0.09, 0.04), 0.04);
  star.center();
  shade(put(g, star, GOLD(), 0.2, 0.16, 0.01));
  return g;
};

// ---------- Dächer ----------

roof('r_pagode', { pal: 'roof', c: 0 }, (g, fp, color, wallColor) => {
  // Pagode: zwei geschwungene Dächer übereinander
  const m = std(color, 0.55);
  const tier = (k, y, h) => {
    const r = put(g, new THREE.ConeGeometry(1, h, 4).rotateY(Math.PI / 4), m, 0, y + h / 2, 0);
    r.scale.set(((fp.w + 0.9) * k) / Math.SQRT2, 1, ((fp.d + 0.9) * k) / Math.SQRT2);
  };
  tier(1, 0, 0.5);
  box(g, fp.w * 0.55, 0.4, fp.d * 0.55, std(wallColor, 0.85), 0, 0.55, 0);
  tier(0.68, 0.72, 0.6);
  ball(g, 0.09, GOLD(), 0, 1.4, 0);
  return { apex: 1.45, chimney: [fp.w * 0.3, 0.3, -fp.d * 0.2] };
});
roof('r_garten', { pal: 'leaf', c: 0 }, (g, fp, color) => {
  // Dachgarten: Wiese mit Blumen, Busch und Bäumchen
  box(g, fp.w + 0.24, 0.12, fp.d + 0.24, STONE(), 0, 0.06, 0);
  box(g, fp.w + 0.1, 0.08, fp.d + 0.1, std(color, 0.95), 0, 0.15, 0);
  [[-0.7, 0.4, '#f08bb4'], [-0.3, -0.5, '#f2c832'], [0.2, 0.5, '#e5484d'], [0.8, -0.1, '#ffffff'], [0.5, 0.55, '#8b5bb5']].forEach(([x, z, col]) => {
    const fx = x * fp.w * 0.42;
    const fz = z * fp.d * 0.42;
    shade(cyl(g, 0.012, 0.012, 0.2, GREEN(), fx, 0.28, fz, 4));
    shade(ball(g, 0.07, fix(col, 0.5), fx, 0.4, fz));
  });
  ball(g, 0.26, GREEN(), -fp.w * 0.3, 0.38, -fp.d * 0.15);
  cyl(g, 0.05, 0.06, 0.5, DWOOD(), fp.w * 0.28, 0.44, -fp.d * 0.2, 6);
  ball(g, 0.34, GREEN(), fp.w * 0.28, 0.9, -fp.d * 0.2);
  return { apex: 0.2, chimney: [0, 0.5, fp.d * 0.25] };
});
roof('r_solar', { pal: 'roof', c: 6 }, (g, fp, color, wallColor) => {
  const h = 1.05 * (fp.w < 2 ? 0.8 : 1);
  put(g, gableFill(fp.w, fp.d, h), std(wallColor, 0.85));
  put(g, gableRoof(fp.w, fp.d, h), std(color, 0.55), 0, -0.02, 0);
  // Solarplatten auf der vorderen Dachfläche
  const run = fp.d / 2 + 0.22;
  const slope = Math.atan2(h, run);
  const n = fp.w < 2 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const p = shade(box(g, (fp.w * 0.8) / n - 0.06, 0.04, Math.hypot(h, run) * 0.6, fix('#27406b', 0.2, { metalness: 0.4 }), (i - (n - 1) / 2) * ((fp.w * 0.8) / n), h * 0.5 + 0.05, run * 0.5));
    p.rotation.x = slope;
  }
  return { apex: h, chimney: [fp.w * 0.26, h * 0.68, -fp.d * 0.17] };
});
roof('r_glaskuppel', { pal: 'ice', c: 0, round: true }, (g, fp, color) => {
  const r = fp.half + 0.02;
  cyl(g, r + 0.08, r + 0.08, 0.1, WHITE(), 0, 0.05, 0, 24);
  const dome = shade(put(g, new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(color, 0.05, { transparent: true, opacity: 0.45 }), 0, 0.1, 0));
  dome.scale.z = fp.d / fp.w;
  cyl(g, 0.16, 0.12, 0.2, fix('#c8744a', 0.9), 0, 0.2, 0, 10);
  ball(g, 0.26, GREEN(), 0, 0.5, 0);
  ball(g, 0.16, GREEN(), 0.2, 0.42, 0.08);
  return { apex: r + 0.1, chimney: [r * 0.6, 0.3, -r * 0.4] };
});
roof('r_stufen', { pal: 'stone', c: 2 }, (g, fp, color) => {
  // Stufenpyramide
  const m = std(color, 0.9, { map: tex('stone', 2, 1) });
  for (let i = 0; i < 3; i++) box(g, (fp.w + 0.3) * (1 - i * 0.28), 0.32, (fp.d + 0.3) * (1 - i * 0.28), m, 0, 0.16 + i * 0.32, 0);
  return { apex: 0.96, chimney: [fp.w * 0.34, 0.2, -fp.d * 0.25] };
});

// ---------- Spitzen ----------

part(TOPS, 't_uhr', {}, (g) => {
  // Uhrtürmchen: die Zeiger laufen
  box(g, 0.56, 0.56, 0.56, WHITE(), 0, 0.3, 0);
  cone(g, 0.5, 0.36, RED(), 0, 0.76, 0, 4).rotation.y = Math.PI / 4;
  const hands = [];
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Group();
    face.rotation.y = (i * Math.PI) / 2;
    disc(face, 0.22, 0.02, fix('#fff7e0', 0.5), 0, 0.3, 0.285);
    const big = new THREE.Group();
    big.position.set(0, 0.3, 0.3);
    shade(box(big, 0.03, 0.18, 0.012, DARK(), 0, 0.08, 0));
    const small = new THREE.Group();
    small.position.set(0, 0.3, 0.305);
    shade(box(small, 0.035, 0.12, 0.012, RED(), 0, 0.05, 0));
    face.add(big, small);
    hands.push([big, small]);
    g.add(face);
  }
  return (t) => hands.forEach(([b, s]) => { b.rotation.z = -t * 0.8; s.rotation.z = -t * 0.07; });
});
part(TOPS, 't_glocke', {}, (g) => {
  for (const x of [-0.26, 0.26]) box(g, 0.06, 0.7, 0.06, DWOOD(), x, 0.35, 0);
  box(g, 0.66, 0.07, 0.1, DWOOD(), 0, 0.72, 0);
  const bell = new THREE.Group();
  bell.position.y = 0.68;
  cyl(bell, 0.08, 0.2, 0.3, GOLD(), 0, -0.2, 0, 14);
  ball(bell, 0.05, DARK(), 0, -0.38, 0);
  g.add(bell);
  return (t) => { bell.rotation.z = Math.sin(t * 3.2) * 0.4; };
});
part(TOPS, 't_windsack', {}, (g) => {
  cyl(g, 0.025, 0.025, 1.0, DARK(), 0, 0.5, 0, 8);
  const sock = new THREE.Group();
  sock.position.y = 0.95;
  for (let i = 0; i < 5; i++) {
    const seg = put(sock, new THREE.CylinderGeometry(0.15 - i * 0.022, 0.13 - i * 0.022, 0.17, 12, 1, true), fix(i % 2 ? '#ffffff' : '#f0662c', 0.7, { side: THREE.DoubleSide }), 0.1 + i * 0.165, 0, 0);
    seg.rotation.z = Math.PI / 2;
  }
  g.add(sock);
  return (t) => { sock.rotation.y = Math.sin(t * 0.8) * 0.5; sock.rotation.z = -0.12 + Math.sin(t * 2.3) * 0.08; };
});
part(TOPS, 't_drache', { pal: 'bright', c: 0 }, (g, color) => {
  // Drachen an der Schnur
  const kite = new THREE.Group();
  kite.position.set(0.9, 1.7, 0);
  const geo = ext(triShape([[0, 0.34], [0.24, 0], [0, -0.42], [-0.24, 0]]), 0.02);
  shade(put(kite, geo, std(color, 0.6, { side: THREE.DoubleSide })));
  shade(box(kite, 0.02, 0.76, 0.03, DARK(), 0, -0.04, 0.012));
  shade(box(kite, 0.48, 0.02, 0.03, DARK(), 0, 0, 0.012));
  for (let i = 0; i < 3; i++) shade(ball(kite, 0.05, fix(PAL.bright[(i + 2) % 7], 0.5), -0.06 - i * 0.1, -0.52 - i * 0.14, 0));
  kite.rotation.z = -0.5;
  g.add(kite);
  const line = shade(cyl(g, 0.006, 0.006, 1, DARK(), 0, 0, 0, 4));
  return (t) => {
    kite.position.set(0.9 + Math.sin(t * 0.9) * 0.25, 1.7 + Math.sin(t * 1.7) * 0.15, Math.sin(t * 0.6) * 0.2);
    const p = kite.position;
    const len = p.length();
    line.position.copy(p).multiplyScalar(0.5);
    line.scale.y = len;
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  };
});
part(TOPS, 't_ufo', {}, (g) => {
  const ufo = new THREE.Group();
  ufo.position.y = 0.5;
  const body = ball(ufo, 0.5, fix('#c7d3dc', 0.3, { metalness: 0.5 }), 0, 0, 0);
  body.scale.y = 0.22;
  shade(put(ufo, new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), fix('#bfe6ff', 0.1, { transparent: true, opacity: 0.7 }), 0, 0.05, 0));
  shade(ball(ufo, 0.09, fix('#7ee081', 0.6), 0, 0.12, 0));
  for (let i = 0; i < 8; i++) shade(ball(ufo, 0.045, glow(PAL.bright[i % 7], 2), Math.sin(i * 0.785) * 0.4, -0.03, Math.cos(i * 0.785) * 0.4));
  g.add(ufo);
  return (t) => { ufo.rotation.y = t * 1.5; ufo.position.y = 0.5 + Math.sin(t * 2) * 0.08; ufo.rotation.z = Math.sin(t * 1.3) * 0.08; };
});
part(TOPS, 't_vogelnest', {}, (g) => {
  put(g, new THREE.TorusGeometry(0.22, 0.09, 8, 16).rotateX(Math.PI / 2), fix('#a8794e', 1), 0, 0.1, 0);
  for (const [x, z] of [[-0.07, 0.03], [0.08, -0.04]]) shade(ball(g, 0.06, fix('#dff0fa', 0.5), x, 0.14, z)).scale.y = 1.25;
  const bird = new THREE.Group();
  bird.position.set(0.02, 0.24, 0);
  ball(bird, 0.11, fix('#3b7cc9', 0.6), 0, 0, 0).scale.set(1.2, 0.9, 0.9);
  ball(bird, 0.07, fix('#3b7cc9', 0.6), 0.11, 0.09, 0);
  cone(bird, 0.025, 0.07, fix('#f2c832', 0.5), 0.19, 0.08, 0, 6).rotation.z = -Math.PI / 2;
  g.add(bird);
  return (t) => { bird.position.y = 0.24 + Math.max(0, Math.sin(t * 4)) * 0.04; bird.rotation.y = Math.sin(t * 0.9) * 0.8; };
});

// ---------- Schmuck ----------

deco('x_teich', ({ grp, half, f0, anim }) => {
  const n = grp(half + 1.1, 0, f0 + 0.5);
  const water = shade(cyl(n, 0.8, 0.8, 0.04, BLUE(), 0, 0.03, 0, 24));
  water.scale.z = 0.75;
  for (let i = 0; i < 9; i++) ball(n, 0.1, STONE(), Math.sin(i * 0.7) * 0.82, 0.04, Math.cos(i * 0.7) * 0.62).scale.y = 0.6;
  shade(cyl(n, 0.16, 0.16, 0.02, GREEN(), -0.3, 0.06, 0.2, 10));
  shade(ball(n, 0.05, fix('#f08bb4', 0.5), -0.3, 0.1, 0.2));
  const duck = buildFigure('ente');
  duck.scale.setScalar(0.75);
  const sw = new THREE.Group();
  sw.add(duck);
  duck.position.x = 0.3;
  n.add(sw);
  anim((t) => { sw.rotation.y = t * 0.6; duck.position.y = 0.02 + Math.sin(t * 3) * 0.015; });
});
deco('x_sandkasten', ({ grp, half, f0 }) => {
  const n = grp(-(half + 1.0), 0, f0 + 0.6, 0.2);
  for (const [x, z, w, d] of [[0, 0.5, 1.1, 0.1], [0, -0.5, 1.1, 0.1], [0.5, 0, 0.1, 1.1], [-0.5, 0, 0.1, 1.1]]) box(n, w, 0.16, d, WOOD(), x, 0.08, z);
  shade(box(n, 0.95, 0.08, 0.95, fix('#ecd9a0', 1), 0, 0.07, 0));
  cyl(n, 0.11, 0.08, 0.16, RED(), 0.2, 0.2, 0.15, 10);
  cone(n, 0.14, 0.16, fix('#e3c27f', 1), -0.2, 0.19, -0.15, 10);
  box(n, 0.05, 0.03, 0.32, fix('#3b7cc9', 0.5), -0.15, 0.13, 0.25).rotation.y = 0.7;
});
deco('x_hundehuette', ({ grp, half, f0, anim }) => {
  const n = grp(half + 0.85, 0, f0 + 0.1, -0.5);
  box(n, 0.7, 0.5, 0.8, RED(), 0, 0.25, 0);
  put(n, gableFill(0.7, 0.8, 0.34), RED(), 0, 0.5, 0);
  put(n, gableRoof(0.7, 0.8, 0.34, 0.1), fix('#4a4038', 0.6), 0, 0.49, 0);
  shade(put(n, ext(archShape(0.3, 0.38), 0.02), fix('#2b2622', 0.9), 0, 0, 0.4));
  const dog = buildFigure('hund');
  dog.scale.setScalar(0.85);
  dog.position.set(0.1, 0, 0.9);
  n.add(dog);
  anim((t) => { dog.position.y = Math.max(0, Math.sin(t * 2.5)) * 0.06; });
});
deco('x_waescheleine', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 1.0), 0, f0 - 0.9);
  for (const x of [-0.75, 0.75]) cyl(n, 0.03, 0.04, 1.3, DWOOD(), x, 0.65, 0, 6);
  shade(box(n, 1.5, 0.012, 0.012, DARK(), 0, 1.25, 0));
  const clothes = [['#e5484d', 0.3, 0.34], ['#ffffff', 0.24, 0.26], ['#3b7cc9', 0.3, 0.4], ['#f2c832', 0.2, 0.22]].map(([col, w, h], i) => {
    const c = new THREE.Group();
    c.position.set(-0.52 + i * 0.35, 1.24, 0);
    shade(box(c, w, h, 0.02, fix(col, 0.9), 0, -h / 2, 0));
    n.add(c);
    return c;
  });
  anim((t) => clothes.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.8 + i) * 0.22; }));
});
deco('x_fahrrad', ({ grp, f0 }) => {
  const n = grp(1.0, 0, f0 + 0.22);
  n.rotation.x = -0.14;
  for (const x of [-0.3, 0.3]) put(n, new THREE.TorusGeometry(0.2, 0.025, 6, 16), DARK(), x, 0.22, 0);
  const bar = (x1, y1, x2, y2) => {
    const b = shade(box(n, Math.hypot(x2 - x1, y2 - y1), 0.03, 0.03, RED(), (x1 + x2) / 2, (y1 + y2) / 2, 0));
    b.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  };
  bar(-0.3, 0.22, -0.05, 0.5);
  bar(-0.05, 0.5, 0.24, 0.5);
  bar(-0.05, 0.5, 0.02, 0.22);
  bar(0.02, 0.22, -0.3, 0.22);
  bar(0.24, 0.5, 0.3, 0.22);
  bar(0.24, 0.5, 0.22, 0.62);
  shade(box(n, 0.14, 0.03, 0.06, DARK(), -0.07, 0.54, 0));
  shade(box(n, 0.04, 0.03, 0.24, DARK(), 0.22, 0.63, 0));
});
deco('x_auto', ({ grp, half, f0 }) => {
  const n = grp(half + 1.0, 0, f0 + 1.2, 0.3);
  box(n, 1.0, 0.26, 0.5, RED(), 0, 0.26, 0);
  box(n, 0.54, 0.24, 0.46, RED(), -0.05, 0.5, 0);
  shade(box(n, 0.46, 0.17, 0.47, fix('#9fd0ee', 0.2), -0.05, 0.51, 0));
  for (const x of [-0.32, 0.32]) for (const z of [-0.25, 0.25]) cyl(n, 0.13, 0.13, 0.08, DARK(), x, 0.13, z, 12).rotation.x = Math.PI / 2;
  for (const z of [-0.16, 0.16]) shade(ball(n, 0.05, glow('#fff3b0', 1), 0.5, 0.28, z));
});
deco('x_hecke', ({ grp, half, f0 }) => {
  for (const s of [-1, 1]) {
    const n = grp(s * 1.25, 0, f0 + 1.2);
    for (let i = 0; i < 4; i++) ball(n, 0.26, GREEN(), -0.54 + i * 0.36, 0.24, 0).scale.set(1, 0.95, 0.8);
    shade(ball(n, 0.05, fix('#f08bb4', 0.5), s * 0.2, 0.46, 0.12));
  }
});
deco('x_feuer', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 0.3), 0, f0 + 1.35);
  for (let i = 0; i < 8; i++) ball(n, 0.08, STONE(), Math.sin(i * 0.785) * 0.34, 0.05, Math.cos(i * 0.785) * 0.34);
  for (const r of [0.4, 1.4, 2.5]) cyl(n, 0.045, 0.045, 0.5, DWOOD(), 0, 0.08, 0, 6).rotation.set(Math.PI / 2, 0, r);
  const flames = [['#ff7a1a', 0.17, 0.5], ['#ffd23f', 0.1, 0.34]].map(([col, r, h]) => shade(cone(n, r, h, glow(col, 2.2), 0, 0.1 + h / 2, 0, 8)));
  anim((t) => flames.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 11 + i) * 0.14, 1 + Math.sin(t * 15 + i * 2) * 0.22, 1 + Math.cos(t * 12 + i) * 0.14); }));
});
deco('x_vogelhaus', ({ grp, half, f0, anim }) => {
  const n = grp(half + 0.45, 0, f0 + 1.3);
  cyl(n, 0.03, 0.04, 1.2, DWOOD(), 0, 0.6, 0, 6);
  box(n, 0.34, 0.26, 0.3, fix('#f5d98b', 0.8), 0, 1.33, 0);
  put(n, gableRoof(0.34, 0.3, 0.18, 0.08), RED(), 0, 1.45, 0);
  shade(disc(n, 0.055, 0.02, fix('#2b2622', 0.9), 0, 1.35, 0.15));
  const bird = new THREE.Group();
  bird.position.set(0.3, 1.52, 0);
  ball(bird, 0.07, fix('#e5484d', 0.6), 0, 0, 0);
  cone(bird, 0.02, 0.05, fix('#f2c832', 0.5), 0.08, 0, 0, 5).rotation.z = -Math.PI / 2;
  n.add(bird);
  anim((t) => { bird.position.set(Math.sin(t * 1.4) * 0.5, 1.6 + Math.sin(t * 2.8) * 0.12, Math.cos(t * 1.4) * 0.5); bird.rotation.y = t * 1.4 + Math.PI / 2; });
});
deco('x_schmetterlinge', ({ g, ctx, half, anim }) => {
  const flies = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const col = fix(PAL.bright[i % 7], 0.5, { side: THREE.DoubleSide });
    const wings = [-1, 1].map((s) => {
      const w = new THREE.Group();
      shade(box(w, 0.12, 0.012, 0.16, col, s * 0.06, 0, 0));
      b.add(w);
      return [w, s];
    });
    g.add(b);
    flies.push([b, wings, i]);
  }
  const r = half + 1.0;
  const top = Math.max(1.2, ctx.topY);
  anim((t) => flies.forEach(([b, wings, i]) => {
    const a = t * (0.35 + i * 0.05) + i * 1.05;
    b.position.set(Math.sin(a) * r, 0.5 + (i / 5) * top + Math.sin(t * 1.7 + i) * 0.2, Math.cos(a) * r * 0.9 + 0.3);
    b.rotation.y = a + Math.PI / 2;
    wings.forEach(([w, s]) => { w.rotation.z = s * Math.sin(t * 16 + i) * 0.9; });
  }));
});
deco('x_wolken', ({ g, ctx, anim }) => {
  const clouds = [0, 1].map((i) => {
    const c = new THREE.Group();
    for (const [x, y, r] of [[0, 0, 0.34], [0.34, -0.04, 0.26], [-0.32, -0.05, 0.24], [0.1, 0.16, 0.24]]) shade(ball(c, r, WHITE(), x, y, 0));
    g.add(c);
    return c;
  });
  const y = ctx.apexY + 1.3;
  anim((t) => clouds.forEach((c, i) => { const a = t * 0.18 + i * Math.PI; c.position.set(Math.sin(a) * 2.2, y + i * 0.4 + Math.sin(t * 0.7 + i) * 0.1, Math.cos(a) * 1.2 - 0.3); }));
});
deco('x_trampolin', ({ grp, half, f0, anim }) => {
  const n = grp(-(half + 1.05), 0, f0 + 0.35);
  put(n, new THREE.TorusGeometry(0.5, 0.05, 6, 20).rotateX(Math.PI / 2), fix('#3b7cc9', 0.5), 0, 0.36, 0);
  shade(cyl(n, 0.46, 0.46, 0.02, DARK(), 0, 0.36, 0, 20));
  for (let i = 0; i < 4; i++) cyl(n, 0.025, 0.025, 0.36, IRON(), Math.sin(i * 1.571 + 0.785) * 0.46, 0.18, Math.cos(i * 1.571 + 0.785) * 0.46, 5);
  const b = ball(n, 0.14, fix('#f2c832', 0.4), 0, 0.5, 0);
  anim((t) => { b.position.y = 0.5 + Math.abs(Math.sin(t * 3)) * 0.9; });
});
deco('x_pool', ({ grp, half, f0, anim }) => {
  const n = grp(half + 1.05, 0, f0 + 0.85);
  put(n, new THREE.TorusGeometry(0.6, 0.13, 8, 24).rotateX(Math.PI / 2), fix('#f08bb4', 0.4), 0, 0.13, 0);
  shade(cyl(n, 0.58, 0.58, 0.03, BLUE(), 0, 0.17, 0, 24));
  const ring = shade(put(n, new THREE.TorusGeometry(0.15, 0.06, 8, 16).rotateX(Math.PI / 2), fix('#f2c832', 0.4), 0.15, 0.22, 0.1));
  anim((t) => { ring.position.set(Math.sin(t * 0.7) * 0.25, 0.22 + Math.sin(t * 2.4) * 0.012, Math.cos(t * 0.7) * 0.25); });
});
deco('x_grill', ({ grp, f0, anim }) => {
  const n = grp(-1.0, 0, f0 + 1.0);
  for (let i = 0; i < 3; i++) cyl(n, 0.02, 0.02, 0.6, IRON(), Math.sin(i * 2.094) * 0.18, 0.3, Math.cos(i * 2.094) * 0.18, 5);
  put(n, new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), DARK(), 0, 0.75, 0);
  shade(cyl(n, 0.26, 0.26, 0.02, glow('#ff7a1a', 1.2), 0, 0.74, 0, 16));
  for (const x of [-0.1, 0.08]) shade(cyl(n, 0.035, 0.035, 0.22, fix('#b0563a', 0.7), x, 0.78, 0, 8)).rotation.x = Math.PI / 2;
  const puffs = [0, 1, 2].map((i) => shade(ball(n, 0.07, fix('#c9c9c9', 1, { transparent: true, opacity: 0.6 }), 0, 0.9, 0)));
  anim((t) => puffs.forEach((p, i) => { const u = (t * 0.5 + i / 3) % 1; p.position.set(u * 0.15, 0.85 + u * 0.8, 0); p.scale.setScalar(0.6 + u * 1.6); }));
});

// ---------- Anbauten ----------

WINGS.a_treppe = {
  pal: 'stone', c: 0, w: 1.0,
  make(color) {
    // Außentreppe hinauf ins erste Stockwerk
    const g = new THREE.Group();
    const m = std(color, 0.9);
    for (let i = 0; i < 6; i++) box(g, 0.8, 0.2 * (i + 1), 0.3, m, 0.42, 0.1 * (i + 1), 0.75 - i * 0.3);
    box(g, 0.8, 0.1, 0.5, m, 0.42, 1.15, -0.95);
    for (let i = 0; i < 7; i += 2) box(g, 0.04, 0.4, 0.04, DARK(), 0.8, 0.2 * (i + 1) + 0.2, 0.75 - i * 0.3);
    const rail = shade(box(g, 0.04, 0.04, 2.1, DARK(), 0.8, 1.02, -0.1));
    rail.rotation.x = 0.588;
    return g;
  },
};
WINGS.a_stall = {
  pal: 'wood', c: 0, w: 1.6,
  make(color, roofColor) {
    // offener Unterstand mit Heu und Zaun
    const g = new THREE.Group();
    const m = std(color, 0.9);
    for (const [x, z] of [[1.4, -0.6], [1.4, 0.6], [0.1, 0.6]]) box(g, 0.09, 1.0, 0.09, m, x, 0.5, z);
    const r = box(g, 1.6, 0.07, 1.5, std(roofColor, 0.6), 0.75, 1.02, 0);
    r.rotation.z = -0.14;
    cyl(g, 0.26, 0.26, 0.5, fix('#e8c45a', 1), 0.55, 0.26, -0.3, 12).rotation.x = Math.PI / 2;
    for (const y of [0.25, 0.5]) box(g, 1.3, 0.05, 0.04, m, 0.75, y, 0.6);
    box(g, 0.5, 0.2, 0.26, m, 1.05, 0.14, 0.1);
    return g;
  },
};
WINGS.a_kiosk = {
  pal: 'bright', c: 2, w: 1.4,
  make(color) {
    // kleiner Verkaufsstand mit gestreifter Markise
    const g = new THREE.Group();
    box(g, 1.2, 0.6, 0.9, std(color, 0.7), 0.65, 0.3, 0);
    box(g, 1.3, 0.06, 1.0, WHITE(), 0.65, 0.63, 0);
    for (const x of [0.1, 1.2]) box(g, 0.05, 0.9, 0.05, WHITE(), x, 1.1, -0.4);
    for (let i = 0; i < 5; i++) {
      const s = box(g, 0.26, 0.05, 1.05, i % 2 ? WHITE() : RED(), 0.13 + i * 0.26, 1.5, 0.05);
      s.rotation.x = 0.3;
    }
    [['#e5484d', 0.3], ['#f08a24', 0.55], ['#f2c832', 0.8], ['#3f8a6a', 1.05]].forEach(([col, x]) => shade(ball(g, 0.09, fix(col, 0.5), x, 0.74, 0.2)));
    return g;
  },
};
WINGS.a_baumhaus = {
  pal: 'wall', c: 5, w: 1.7,
  make(color, roofColor) {
    // Baum mit einem Häuschen in der Krone und einer Leiter
    const g = new THREE.Group();
    cyl(g, 0.2, 0.28, 1.7, fix('#8a5a33', 0.9), 0.9, 0.85, 0, 10);
    for (const [x, y, z, r] of [[0.9, 2.35, -0.25, 0.7], [0.35, 2.0, 0.1, 0.5], [1.45, 2.05, 0, 0.52], [0.9, 2.1, 0.5, 0.45]]) ball(g, r, GREEN(), x, y, z);
    box(g, 1.1, 0.07, 0.9, WOOD(), 0.9, 1.45, 0.25);
    box(g, 0.7, 0.55, 0.6, std(color, 0.85), 0.9, 1.76, 0.2);
    put(g, gableFill(0.7, 0.6, 0.3), std(color, 0.85), 0.9, 2.03, 0.2);
    put(g, gableRoof(0.7, 0.6, 0.3, 0.1), std(roofColor, 0.55), 0.9, 2.02, 0.2);
    shade(box(g, 0.2, 0.32, 0.02, fix('#2b2622', 0.9), 0.9, 1.66, 0.51));
    for (const x of [0.78, 1.02]) box(g, 0.035, 1.5, 0.035, WOOD(), x, 0.74, 0.74).rotation.x = -0.12;
    for (let i = 0; i < 5; i++) shade(box(g, 0.26, 0.03, 0.03, WOOD(), 0.9, 0.22 + i * 0.27, 0.82 - i * 0.033));
    return g;
  },
};
WINGS.a_rutsche = {
  pal: 'bright', c: 2, w: 1.3,
  make(color) {
    // Rutschturm
    const g = new THREE.Group();
    for (const x of [0.2, 1.0]) for (const z of [-0.7, -0.1]) box(g, 0.07, 1.4, 0.07, WOOD(), x, 0.7, z);
    box(g, 0.94, 0.07, 0.74, WOOD(), 0.6, 1.0, -0.4);
    cone(g, 0.72, 0.4, RED(), 0.6, 1.62, -0.4, 4).rotation.y = Math.PI / 4;
    const m = std(color, 0.4);
    const chute = box(g, 0.5, 0.05, 1.7, m, 0.6, 0.52, 0.62);
    chute.rotation.x = 0.6;
    for (const x of [0.36, 0.84]) box(g, 0.04, 0.14, 1.7, RED(), x, 0.58, 0.62).rotation.x = 0.6;
    for (let i = 0; i < 4; i++) shade(box(g, 0.5, 0.03, 0.04, WOOD(), 0.6, 0.2 + i * 0.22, -0.72));
    return g;
  },
};

// ---------- in die Themen einsortieren ----------

const more = (theme, lists) => { for (const [cat, ids] of Object.entries(lists)) THEMES[theme][cat].push(...ids.filter((id) => !THEMES[theme][cat].includes(id))); };
more('haus', { levels: ['fachwerk', 'glas'], windows: ['f_laden', 'f_blume'], roofs: ['r_solar', 'r_garten'], tops: ['t_vogelnest', 't_uhr'],
  decos: ['x_teich', 'x_hundehuette', 'x_waescheleine', 'x_fahrrad', 'x_auto', 'x_hecke', 'x_vogelhaus', 'x_pool', 'x_grill', 'x_sandkasten', 'x_trampolin', 'x_schmetterlinge'] });
more('burg', { levels: ['fachwerk'], windows: ['f_bunt'], roofs: ['r_stufen'], tops: ['t_glocke'], decos: ['x_feuer', 'x_hecke'] });
more('zirkus', { levels: ['container'], doors: ['d_herz'], tops: ['t_drache'], decos: ['x_trampolin', 'x_wolken'] });
more('rakete', { levels: ['container', 'glas'], roofs: ['r_glaskuppel'], tops: ['t_ufo'], decos: ['x_wolken'] });
more('laden', { levels: ['glas', 'container'], doors: ['d_saloon'], windows: ['f_bunt', 'f_laden'], roofs: ['r_garten', 'r_solar'], tops: ['t_uhr'], decos: ['x_fahrrad', 'x_auto', 'x_hecke'] });
more('maerchen', { levels: ['wolke', 'kuerbis'], doors: ['d_herz'], windows: ['f_mond', 'f_blume'], roofs: ['r_pagode'], tops: ['t_vogelnest'], decos: ['x_schmetterlinge', 'x_teich', 'x_wolken', 'x_vogelhaus'] });
more('bauernhof', { levels: ['fachwerk'], doors: ['d_saloon'], windows: ['f_laden'], tops: ['t_glocke', 't_windsack'], decos: ['x_teich', 'x_hundehuette', 'x_feuer', 'x_waescheleine'] });
more('piraten', { doors: ['d_saloon'], tops: ['t_windsack'], decos: ['x_feuer'] });
more('meer', { levels: ['glas'], roofs: ['r_glaskuppel'], tops: ['t_windsack', 't_drache'], decos: ['x_pool', 'x_feuer'] });
more('schloss', { windows: ['f_bunt', 'f_mond'], roofs: ['r_pagode', 'r_stufen'], tops: ['t_glocke', 't_uhr'], decos: ['x_teich', 'x_hecke', 'x_schmetterlinge'] });
more('winter', { levels: ['wolke'], doors: ['d_tunnel'], windows: ['f_mond'], tops: ['t_glocke'], decos: ['x_feuer', 'x_wolken'] });
more('dschungel', { levels: ['kuerbis'], roofs: ['r_garten', 'r_stufen', 'r_pagode'], tops: ['t_vogelnest'], decos: ['x_feuer', 'x_schmetterlinge', 'x_teich'] });

// ====================================================================================================
// Vorlagen fürs Album: zu jedem Thema ein fertiges Gebäude zum Laden und Umbauen
// ====================================================================================================

const L = (id, c = LEVELS[id].c) => ({ id, c });
const P = (id, c) => ({ id, c });
export const TEMPLATES = [
  { L: [L('mauer', 1), L('ziegel')], win: 'f_eck', door: P('d_bogen', 1), roof: P('r_giebel', 0), top: P('t_schornstein', 0),
    deco: ['x_blumen', 'x_zaun', 'x_busch', 'x_baum', 'x_weg'], folk: ['kind', 'katze'] },
  { L: [L('stein'), L('turm'), L('turmschmal')], win: 'f_schlitz', door: P('d_tor', 2), roof: P('r_kegel', 1), top: P('t_wimpel', 0),
    deco: ['x_schilde', 'x_fackeln', 'x_ecktuerme', 'x_graben', 'x_banner'] },
  { L: [L('zelt'), L('zeltschmal')], win: 'f_stern', door: P('d_vorhang', 0), roof: P('r_zeltdach', 0), top: P('t_propeller', 1),
    deco: ['x_ballons', 'x_wimpel', 'x_lichter', 'x_regenbogen'], folk: ['affe', 'elefant'] },
  { L: [L('metall'), L('metallstreif'), L('metallschmal')], win: 'f_bullauge', door: P('d_luke', 1), roof: P('r_spitze', 0), top: P('t_antenne', 0),
    deco: ['x_flossen', 'x_flammen', 'x_leiter', 'x_sterne'] },
  { L: [L('laden'), L('streifen', 6)], win: 'f_schau', door: P('d_glas', 1), roof: P('r_markise', 0), top: P('t_eis', 0),
    deco: ['x_tisch', 'x_toepfe', 'x_schild', 'x_lichter'], folk: ['oma'] },
  { L: [L('stiel')], win: 'f_herz', door: P('d_rund', 3), roof: P('r_pilz', 0), top: P('t_schornstein', 0),
    deco: ['x_pilze', 'x_blumen', 'x_laterne', 'x_weg'], folk: ['hase', 'frosch'] },
  { L: [L('scheune')], win: 'f_heuluke', door: P('d_scheunentor', 0), roof: P('r_scheune', 6), top: P('t_hahn', 0),
    deco: ['x_heu', 'x_traktor', 'x_gemuese', 'x_kuerbisse'], wings: [{ id: 'a_schuppen', c: 0, side: 1 }], folk: ['kuh', 'huhn', 'schwein'] },
  { L: [L('rumpf'), L('kajuete')], win: 'f_kanone', door: P('d_kajuete', 0), roof: P('r_segel', 0), top: P('t_piratenflagge', 0),
    deco: ['x_wellen', 'x_hai', 'x_schatz', 'x_palme', 'x_papagei', 'x_anker'] },
  { L: [L('leuchtturm'), L('leuchtturm'), L('leuchtturm')], win: 'f_bullauge', door: P('d_bogen', 1), roof: P('r_lampe', 0), top: P('t_moewe', 0),
    deco: ['x_wellen', 'x_boot', 'x_schirm', 'x_sandburg', 'x_krabbe', 'x_rettungsring'] },
  { L: [L('schloss', 1), L('schlossturm', 2), L('schlossturmschmal', 0)], win: 'f_balkon', door: P('d_goldtor', 4), roof: P('r_krone', 4), top: P('t_herz', 0),
    deco: ['x_ecktuerme', 'x_rosen', 'x_brunnen', 'x_teppich', 'x_kutsche'], pat: 'm_sterne' },
  { L: [L('lebkuchen')], win: 'f_herz', door: P('d_rund', 2), roof: P('r_schnee', 0), top: P('t_schneemann', 0),
    deco: ['x_schneemann', 'x_tanne', 'x_geschenke', 'x_schlitten', 'x_zuckerstangen', 'x_flocken'], folk: ['pinguin'] },
  { L: [L('ruine'), L('bambus'), L('stamm')], win: 'f_blatt', door: P('d_perlen', 3), roof: P('r_blatt', 0), top: P('t_papagei', 0),
    deco: ['x_palme', 'x_lianen', 'x_rutsche', 'x_schaukel', 'x_blueten', 'x_trommeln'], folk: ['affe'] },
].map((t) => JSON.stringify({ win: null, pat: null, door: null, roof: null, top: null, deco: [], wings: [], folk: [], ...t }));
