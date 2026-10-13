// Bauteile für die Baustelle (buildSite.js): Stockwerke, Türen, Fenster, Dächer, Spitzen und Schmuck,
// sortiert nach Themen (Haus, Burg, Zirkus, Rakete, Laden, Märchen). Alles aus einfachen Formen gebaut.
// Die Themen sind nur Fächer zum Aussuchen – alle Teile lassen sich frei mischen.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { gableRoof, gableFill } from './zones.js';

export const H = 1.2; // Höhe eines Stockwerks
export const MAX_LEVELS = 5;
export const MAX_WINGS = 4; // Anbauten: bis zu zwei auf jeder Seite

export const CATS = ['levels', 'doors', 'windows', 'paint', 'roofs', 'tops', 'wings', 'decos', 'folk'];

// Bewohner: Figuren, die vor dem Gebäude stehen (in jedem Thema zuerst die passenden, dann die übrigen)
export const FOLK = ['kind', 'oma', 'papa', 'teddy', 'hund', 'katze', 'hase', 'kuh', 'schwein', 'schaf', 'pferd', 'huhn', 'ente', 'frosch',
  'pinguin', 'affe', 'loewe', 'elefant'];
export const MAX_FOLK = 6;

// Weitere Fenster und Schmuckteile (buildMore.js trägt sie hier ein): id → Baufunktion
export const EXTRA = { windows: {}, decos: {} };

export const THEMES = {
  haus: {
    icon: '🏠',
    visitors: ['kind', 'oma', 'papa', 'katze', 'hund'],
    levels: ['mauer', 'ziegel', 'holz', 'schmal'],
    doors: ['d_eck', 'd_bogen', 'd_doppel'],
    windows: ['f_eck', 'f_rund', 'f_hoch', 'f_bogen'],
    roofs: ['r_giebel', 'r_spitz', 'r_stroh', 'r_terrasse'],
    tops: ['t_schornstein', 't_hahn', 't_antenne', 't_fahne'],
    decos: ['x_blumen', 'x_vordach', 'x_zaun', 'x_busch', 'x_baum', 'x_briefkasten', 'x_bank', 'x_laterne', 'x_efeu', 'x_weg'],
  },
  burg: {
    icon: '🏰',
    visitors: ['kind', 'papa', 'pferd', 'hund'],
    levels: ['stein', 'turm', 'steinschmal', 'turmschmal'],
    doors: ['d_tor', 'd_zugbruecke', 'd_bogen'],
    windows: ['f_schlitz', 'f_bogen', 'f_rund'],
    roofs: ['r_zinnen', 'r_kegel', 'r_spitz', 'r_giebel'],
    tops: ['t_fahne', 't_wimpel', 't_krone', 't_stern'],
    decos: ['x_schilde', 'x_fackeln', 'x_ecktuerme', 'x_graben', 'x_kanone', 'x_banner', 'x_efeu', 'x_baum'],
  },
  zirkus: {
    icon: '🎪',
    visitors: ['affe', 'loewe', 'elefant', 'kind'],
    levels: ['zelt', 'streifen', 'zeltschmal'],
    doors: ['d_vorhang', 'd_bogen', 'd_doppel'],
    windows: ['f_stern', 'f_rund', 'f_herz'],
    roofs: ['r_zeltdach', 'r_kuppel', 'r_kegel'],
    tops: ['t_fahne', 't_stern', 't_kugel', 't_propeller', 't_wimpel'],
    decos: ['x_ballons', 'x_wimpel', 'x_lichter', 'x_sterne', 'x_regenbogen', 'x_laterne', 'x_zaun'],
  },
  rakete: {
    icon: '🚀',
    visitors: ['teddy', 'pinguin', 'kind'],
    levels: ['metall', 'metallstreif', 'metallschmal'],
    doors: ['d_luke', 'd_glas'],
    windows: ['f_bullauge', 'f_blase', 'f_rund'],
    roofs: ['r_spitze', 'r_kuppel', 'r_kegel'],
    tops: ['t_antenne', 't_kugel', 't_schuessel', 't_fahne'],
    decos: ['x_flossen', 'x_flammen', 'x_leiter', 'x_sterne', 'x_lichter'],
  },
  laden: {
    icon: '🍦',
    visitors: ['oma', 'kind', 'teddy', 'papa'],
    levels: ['laden', 'mauer', 'streifen'],
    doors: ['d_glas', 'd_doppel', 'd_eck'],
    windows: ['f_schau', 'f_rund', 'f_eck'],
    roofs: ['r_markise', 'r_terrasse', 'r_giebel', 'r_kuppel'],
    tops: ['t_eis', 't_donut', 't_kugel', 't_fahne'],
    decos: ['x_vordach', 'x_tisch', 'x_toepfe', 'x_schild', 'x_lichter', 'x_wimpel', 'x_bank', 'x_ballons'],
  },
  maerchen: {
    icon: '🍄',
    visitors: ['hase', 'frosch', 'katze', 'kind'],
    levels: ['stiel', 'stumpf', 'stielschmal'],
    doors: ['d_rund', 'd_bogen'],
    windows: ['f_herz', 'f_rund', 'f_bogen', 'f_stern'],
    roofs: ['r_pilz', 'r_zwiebel', 'r_stroh'],
    tops: ['t_schornstein', 't_herz', 't_stern', 't_kugel'],
    decos: ['x_pilze', 'x_blumen', 'x_laterne', 'x_regenbogen', 'x_zaun', 'x_efeu', 'x_weg', 'x_busch', 'x_sterne'],
  },
};

// In welches Fach gehört ein Teil?
export function catOf(id) {
  if (LEVELS[id]) return 'levels';
  if (FOLK.includes(id)) return 'folk';
  return { d: 'doors', f: 'windows', r: 'roofs', t: 'tops', x: 'decos', a: 'wings', m: 'paint' }[id[0]];
}

// Die Teile eines Fachs: Anbauten und Muster sind in allen Themen gleich, Bewohner beginnen mit den zum Thema passenden
export function partsOf(theme, cat) {
  const t = THEMES[theme];
  if (cat === 'wings') return Object.keys(WINGS);
  if (cat === 'paint') return PATTERNS;
  if (cat === 'folk') return [...t.visitors, ...FOLK.filter((id) => !t.visitors.includes(id))].slice(0, 9);
  return t[cat];
}

// Zu welchem Thema gehört ein Stockwerk (für den Besuch, der einzieht)?
export function themeOf(id) {
  return Object.keys(THEMES).find((t) => CATS.some((c) => THEMES[t][c]?.includes(id))) ?? 'haus';
}

// ---------- Farben ----------

export const PAL = {
  wall: ['#f7f1e3', '#f5d98b', '#f0c9c9', '#cfe5c4', '#d8e6f0', '#f2c7a5', '#d9c2ee', '#bfe3e0'],
  brick: ['#c8553f', '#d98a5f', '#e3c08c', '#a8a29a', '#8f5a4a'],
  wood: ['#a8794e', '#8a5a33', '#c9a26b', '#6e4a2e'],
  stone: ['#b9b4aa', '#8f97a3', '#d9cfbd', '#c9a58b', '#7d8a78'],
  metal: ['#e8ecef', '#c7d3dc', '#f2d16b', '#e98b8b', '#9bd0c4', '#b9a6e0'],
  bright: ['#e5484d', '#3b7cc9', '#f2c832', '#3f8a6a', '#8b5bb5', '#f08a24', '#f08bb4'],
  roof: ['#c8453a', '#4f6d8a', '#3f8a6a', '#8b5bb5', '#d9663b', '#e0a52c', '#3a3f47', '#e87fa8'],
  straw: ['#e0b84f', '#c99a3c', '#b98a4a', '#9aa35a'],
  door: ['#8a5a33', '#3b7cc9', '#e5484d', '#3f8a6a', '#f2c832', '#8b5bb5'],
};

// ---------- kleine Helfer ----------

const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const fixed = new Map();
const fix = (color, roughness = 0.8, extra) => {
  const k = color + roughness + (extra ? JSON.stringify(extra) : '');
  if (!fixed.has(k)) fixed.set(k, std(color, roughness, extra));
  return fixed.get(k);
};
const WHITE = () => fix('#ffffff', 0.6);
const DARK = () => fix('#3a3f47', 0.7);
const GOLD = () => fix('#f7c531', 0.35, { metalness: 0.3 });
const IRON = () => fix('#555b63', 0.5, { metalness: 0.4 });
const STONE = () => fix('#b9b1a3');
const GREEN = () => fix('#5aa34a', 0.9);
const glow = (color, k = 1.2) => fix(color, 0.4, { emissive: color, emissiveIntensity: k });

function put(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p, w, h, d, mat, x, y, z, shadow) => put(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadow);
const cyl = (p, r1, r2, h, mat, x, y, z, seg = 20) => put(p, new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z);
const ball = (p, r, mat, x, y, z) => put(p, new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
const cone = (p, r, h, mat, x, y, z, seg = 20) => put(p, new THREE.ConeGeometry(r, h, seg), mat, x, y, z);
const disc = (p, r, d, mat, x, y, z, seg = 24) => put(p, new THREE.CylinderGeometry(r, r, d, seg).rotateX(Math.PI / 2), mat, x, y, z, false);
const ext = (shape, depth = 0.05) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });

function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5 * s);
  h.bezierCurveTo(-0.95 * s, 0.1 * s, -0.45 * s, 0.8 * s, 0, 0.3 * s);
  h.bezierCurveTo(0.45 * s, 0.8 * s, 0.95 * s, 0.1 * s, 0, -0.5 * s);
  return h;
}
function starShape(R = 0.5, r = 0.22) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r : R;
    if (i) s.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    else s.moveTo(Math.cos(a) * q, Math.sin(a) * q);
  }
  s.closePath();
  return s;
}
// Bogen: unten eckig, oben rund; Ursprung unten in der Mitte
function archShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}
function triShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// Muster (helle Fläche, dunklere Linien) – wird mit der Wandfarbe multipliziert
const texCache = new Map();
function tex(kind, rx, ry) {
  const key = `${kind}|${rx}|${ry}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(40,25,10,0.3)';
  x.lineWidth = 5;
  const line = (a, b, d, e) => { x.beginPath(); x.moveTo(a, b); x.lineTo(d, e); x.stroke(); };
  if (kind === 'brick' || kind === 'stone') {
    const rows = kind === 'brick' ? 4 : 2;
    const cols = kind === 'brick' ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const y = (r * 128) / rows;
      line(0, y, 128, y);
      for (let k = 0; k < cols; k++) {
        const vx = ((k + (r % 2 ? 0.5 : 0)) * 128) / cols;
        line(vx, y, vx, y + 128 / rows);
      }
    }
  } else if (kind === 'log') {
    for (let r = 0; r < 4; r++) {
      const g = x.createLinearGradient(0, r * 32, 0, r * 32 + 32);
      g.addColorStop(0, 'rgba(40,25,10,0.35)');
      g.addColorStop(0.35, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(40,25,10,0.3)');
      x.fillStyle = g;
      x.fillRect(0, r * 32, 128, 32);
    }
  } else if (kind === 'bark') {
    x.lineWidth = 6;
    for (const vx of [10, 44, 70, 104]) line(vx, 0, vx + 6, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

// ---------- Stockwerke ----------

export const LEVELS = {
  mauer: { shape: 'box', w: 2.4, d: 1.8, pal: 'wall', c: 0 },
  ziegel: { shape: 'box', w: 2.4, d: 1.8, pal: 'brick', c: 0, look: 'brick' },
  holz: { shape: 'box', w: 2.4, d: 1.8, pal: 'wood', c: 0, look: 'log' },
  schmal: { shape: 'box', w: 1.5, d: 1.4, pal: 'wall', c: 4 },
  stein: { shape: 'box', w: 2.4, d: 1.8, pal: 'stone', c: 0, look: 'stone' },
  steinschmal: { shape: 'box', w: 1.5, d: 1.4, pal: 'stone', c: 1, look: 'stone' },
  turm: { shape: 'round', r: 1.05, pal: 'stone', c: 0, look: 'stone' },
  turmschmal: { shape: 'round', r: 0.75, pal: 'stone', c: 1, look: 'stone' },
  zelt: { shape: 'round', r: 1.05, pal: 'bright', c: 0, look: 'stripe' },
  zeltschmal: { shape: 'round', r: 0.75, pal: 'bright', c: 1, look: 'stripe' },
  streifen: { shape: 'box', w: 2.4, d: 1.8, pal: 'bright', c: 2, look: 'stripe' },
  metall: { shape: 'round', r: 1.0, pal: 'metal', c: 0, look: 'metal' },
  metallstreif: { shape: 'round', r: 1.0, pal: 'metal', c: 1, look: 'band' },
  metallschmal: { shape: 'round', r: 0.72, pal: 'metal', c: 0, look: 'metal' },
  laden: { shape: 'box', w: 2.4, d: 1.8, pal: 'wall', c: 2, look: 'shop' },
  stiel: { shape: 'round', r: 0.98, pal: 'wall', c: 0, look: 'stem' },
  stielschmal: { shape: 'round', r: 0.72, pal: 'wall', c: 0, look: 'stem' },
  stumpf: { shape: 'round', r: 1.05, pal: 'wood', c: 0, look: 'bark' },
};

// Grundfläche eines Stockwerks: Breite, Tiefe und (bei runden) der Radius der Vorderseite
export function footprint(id) {
  const d = LEVELS[id];
  if (d.shape === 'box') return { w: d.w, d: d.d, round: false, half: d.w / 2 };
  const r = d.look === 'stem' ? d.r * 0.92 : d.r;
  return { w: d.r * 2, d: d.r * 2, round: true, r, half: d.r };
}

// Stelle an der Vorderseite: bei runden Türmen auf dem Bogen, sonst auf der flachen Wand
function front(fp, x, y, out = 0) {
  if (!fp.round) return { p: [x, y, fp.d / 2 + out], r: 0 };
  const a = Math.asin(THREE.MathUtils.clamp(x / fp.r, -0.96, 0.96));
  return { p: [Math.sin(a) * (fp.r + out), y, Math.cos(a) * (fp.r + out)], r: a };
}
export function attachFront(parent, obj, fp, x, y, out = 0.012) {
  const f = front(fp, x, y, out);
  obj.position.set(...f.p);
  obj.rotation.y = f.r;
  parent.add(obj);
  return obj;
}
// Stelle an der Seitenwand (sgn = -1 links, 1 rechts)
export function onSide(parent, obj, fp, sgn, y, out = 0.012) {
  if (fp.round) return attachFront(parent, obj, fp, sgn * fp.r * 0.96, y, out);
  obj.position.set(sgn * (fp.w / 2 + out), y, 0);
  obj.rotation.y = (sgn * Math.PI) / 2;
  parent.add(obj);
  return obj;
}

// Wo sitzen die Fenster? Breite Stockwerke: links und rechts. Schmale: eins in der Mitte (unten ist dort die Tür).
export function windowSlots(fp, ground) {
  if (fp.half >= 0.95) return [-fp.half * 0.63, fp.half * 0.63];
  return ground ? [] : [0];
}

export function levelModel(id, color) {
  const def = LEVELS[id];
  if (def.make) return def.make(color, def);
  const g = new THREE.Group();
  const look = def.look;
  if (def.shape === 'box') {
    const { w, d } = def;
    if (look === 'stripe') {
      put(g, new RoundedBoxGeometry(w, H, d, 2, 0.05), WHITE(), 0, H / 2, 0);
      const m = std(color, 0.7);
      for (let i = 0; i < 7; i += 2) for (const z of [d / 2, -d / 2]) box(g, w / 7, H - 0.02, 0.03, m, -w / 2 + (w / 7) * (i + 0.5), H / 2, z, false);
      for (let i = 0; i < 5; i += 2) for (const x of [w / 2, -w / 2]) box(g, 0.03, H - 0.02, d / 5, m, x, H / 2, -d / 2 + (d / 5) * (i + 0.5), false);
    } else {
      const map = look === 'brick' ? tex('brick', 2, 1) : look === 'stone' ? tex('stone', 2, 1) : look === 'log' ? tex('log', 1, 1) : null;
      put(g, new RoundedBoxGeometry(w, H, d, 2, 0.05), std(color, 0.85, map ? { map } : {}), 0, H / 2, 0);
      if (look === 'shop') {
        // Laden: dunkler Sockel und ein Gesims oben
        const dark = new THREE.Color(color).multiplyScalar(0.72);
        box(g, w + 0.05, 0.28, d + 0.05, std(dark, 0.8), 0, 0.14, 0);
        box(g, w + 0.1, 0.1, d + 0.1, WHITE(), 0, H - 0.05, 0);
      }
    }
    return g;
  }
  const r = def.r;
  if (look === 'stripe') {
    cyl(g, r - 0.004, r - 0.004, H, WHITE(), 0, H / 2, 0, 24);
    const m = std(color, 0.7);
    for (let i = 0; i < 12; i += 2) {
      put(g, new THREE.CylinderGeometry(r, r, H, 3, 1, true, (i * Math.PI) / 6 + Math.PI / 12, Math.PI / 6), m, 0, H / 2, 0, false);
    }
  } else if (look === 'metal' || look === 'band') {
    cyl(g, r, r, H, std(color, 0.35, { metalness: 0.45 }), 0, H / 2, 0, 28);
    for (const y of [0.04, H - 0.04]) cyl(g, r + 0.025, r + 0.025, 0.07, IRON(), 0, y, 0, 28);
    if (look === 'band') cyl(g, r + 0.015, r + 0.015, 0.3, fix('#e5484d', 0.5), 0, H / 2, 0, 28);
  } else if (look === 'stem') {
    cyl(g, r * 0.86, r, H, std(color, 0.9), 0, H / 2, 0, 24);
  } else {
    const map = look === 'bark' ? tex('bark', 3, 1) : tex('stone', 5, 1);
    cyl(g, r, r, H, std(color, 0.9, { map }), 0, H / 2, 0, 28);
    if (look === 'bark') cyl(g, r * 1.12, r * 1.2, 0.12, std(color, 0.9), 0, 0.06, 0, 12); // Wurzelansatz
  }
  return g;
}

// ---------- Fenster (Mitte im Ursprung, schauen nach +z) ----------

export function windowModel(id, glass) {
  if (EXTRA.windows[id]) return EXTRA.windows[id](glass);
  const g = new THREE.Group();
  const frame = WHITE();
  const flat = (shape, mat, z, s = 1) => {
    const geo = ext(shape, 0.05);
    geo.center();
    const m = put(g, geo, mat, 0, 0, z, false);
    m.scale.set(s, s, 1);
    return m;
  };
  if (id === 'f_eck' || id === 'f_hoch' || id === 'f_schau') {
    const [w, h] = id === 'f_eck' ? [0.54, 0.5] : id === 'f_hoch' ? [0.38, 0.76] : [0.78, 0.66];
    box(g, w, h, 0.06, frame, 0, 0, 0, false);
    box(g, w - 0.12, h - 0.12, 0.06, glass, 0, 0, 0.02, false);
    if (id !== 'f_schau') {
      box(g, 0.035, h - 0.1, 0.07, frame, 0, 0, 0.025, false);
      box(g, w - 0.1, 0.035, 0.07, frame, 0, 0, 0.025, false);
    } else {
      box(g, w + 0.08, 0.07, 0.14, frame, 0, -h / 2, 0.04, false);
    }
  } else if (id === 'f_rund') {
    disc(g, 0.3, 0.06, frame, 0, 0, 0);
    disc(g, 0.22, 0.06, glass, 0, 0, 0.02);
    box(g, 0.035, 0.44, 0.07, frame, 0, 0, 0.025, false);
    box(g, 0.44, 0.035, 0.07, frame, 0, 0, 0.025, false);
  } else if (id === 'f_bogen') {
    flat(archShape(0.5, 0.72), frame, 0);
    flat(archShape(0.5, 0.72), glass, 0.02, 0.76);
  } else if (id === 'f_herz') {
    flat(heartShape(0.5), frame, 0);
    flat(heartShape(0.5), glass, 0.02, 0.72);
  } else if (id === 'f_stern') {
    flat(starShape(0.36, 0.17), frame, 0);
    flat(starShape(0.36, 0.17), glass, 0.02, 0.7);
  } else if (id === 'f_schlitz') {
    box(g, 0.26, 0.7, 0.05, STONE(), 0, 0, 0, false);
    box(g, 0.1, 0.56, 0.06, DARK(), 0, 0, 0.01, false);
  } else if (id === 'f_bullauge' || id === 'f_blase') {
    put(g, new THREE.TorusGeometry(0.26, 0.06, 8, 24), IRON(), 0, 0, 0.02, false);
    if (id === 'f_bullauge') disc(g, 0.25, 0.04, glass, 0, 0, 0.01);
    else {
      const bubble = ball(g, 0.25, fix('#bfe6ff', 0.1, { transparent: true, opacity: 0.75 }), 0, 0, 0.02);
      bubble.scale.z = 0.7;
      bubble.castShadow = false;
    }
    for (let i = 0; i < 6; i++) ball(g, 0.025, DARK(), Math.cos(i * 1.047) * 0.26, Math.sin(i * 1.047) * 0.26, 0.08).castShadow = false;
  }
  return g;
}

// ---------- Türen (stehen im Ursprung auf dem Boden, schauen nach +z) ----------

export const DOORS = {
  d_eck: { pal: 'door', c: 0 }, d_bogen: { pal: 'door', c: 1 }, d_doppel: { pal: 'door', c: 2 },
  d_tor: { pal: 'stone', c: 2 }, d_zugbruecke: { pal: 'wood', c: 0 }, d_vorhang: { pal: 'bright', c: 0 },
  d_luke: { pal: 'metal', c: 1 }, d_glas: { pal: 'door', c: 1 }, d_rund: { pal: 'door', c: 3 },
};

export function doorModel(id, color) {
  if (DOORS[id].make) return DOORS[id].make(color);
  const g = new THREE.Group();
  const m = std(color, 0.6);
  const knob = (x, y, z = 0.07) => { ball(g, 0.04, GOLD(), x, y, z).castShadow = false; };
  const arch = (w, h, mat, z, depth = 0.08) => put(g, ext(archShape(w, h), depth), mat, 0, 0, z, false);
  let step = 0.7;
  if (id === 'd_eck') {
    box(g, 0.52, 0.86, 0.08, m, 0, 0.43, 0.03);
    knob(0.16, 0.44);
  } else if (id === 'd_bogen') {
    arch(0.56, 0.92, m, 0);
    knob(0.16, 0.42, 0.1);
  } else if (id === 'd_doppel') {
    box(g, 0.92, 0.84, 0.08, m, 0, 0.42, 0.03);
    box(g, 0.03, 0.82, 0.09, DARK(), 0, 0.42, 0.035, false);
    knob(-0.1, 0.44);
    knob(0.1, 0.44);
    step = 1.1;
  } else if (id === 'd_tor' || id === 'd_zugbruecke') {
    arch(1.0, 1.08, m, 0, 0.07);
    arch(0.8, 0.96, fix('#2b2622', 0.9), 0.03, 0.07);
    if (id === 'd_tor') {
      // Fallgitter
      for (let i = -2; i <= 2; i++) box(g, 0.035, 0.84 - Math.abs(i) * 0.08, 0.03, IRON(), i * 0.15, 0.42 - Math.abs(i) * 0.04, 0.115, false);
      for (const y of [0.25, 0.5]) box(g, 0.74, 0.035, 0.03, IRON(), 0, y, 0.115, false);
    } else {
      // heruntergelassene Brücke mit Ketten
      box(g, 0.78, 0.06, 0.95, m, 0, 0.03, 0.58);
      for (const x of [-0.36, 0.36]) {
        const ch = box(g, 0.025, 1.18, 0.025, IRON(), x, 0.47, 0.58, false);
        ch.rotation.x = 0.82;
      }
    }
    step = 0;
  } else if (id === 'd_vorhang') {
    box(g, 0.96, 0.98, 0.05, fix('#2b2622', 0.9), 0, 0.49, 0.02, false);
    // zwei zur Seite gerafften Vorhanghälften
    for (const s of [-1, 1]) {
      put(g, ext(triShape([[s * 0.48, 0.98], [0, 0.98], [s * 0.3, 0], [s * 0.46, 0]]), 0.06), m, 0, 0, 0.04, false);
    }
    box(g, 1.06, 0.1, 0.1, GOLD(), 0, 1.0, 0.05, false);
    step = 0;
  } else if (id === 'd_luke') {
    disc(g, 0.46, 0.06, IRON(), 0, 0.52, 0.02);
    disc(g, 0.38, 0.08, std(color, 0.35, { metalness: 0.4 }), 0, 0.52, 0.03);
    put(g, new THREE.TorusGeometry(0.13, 0.025, 6, 16), DARK(), 0, 0.52, 0.1, false);
    box(g, 0.26, 0.025, 0.025, DARK(), 0, 0.52, 0.1, false);
    box(g, 0.025, 0.26, 0.025, DARK(), 0, 0.52, 0.1, false);
    const ramp = box(g, 0.6, 0.04, 0.6, IRON(), 0, 0.06, 0.32);
    ramp.rotation.x = 0.2;
    step = 0;
  } else if (id === 'd_glas') {
    box(g, 0.6, 0.92, 0.07, m, 0, 0.46, 0.03);
    box(g, 0.44, 0.72, 0.08, fix('#bfe6ff', 0.15), 0, 0.5, 0.035, false);
    box(g, 0.04, 0.24, 0.05, GOLD(), 0.16, 0.46, 0.1, false);
  } else if (id === 'd_rund') {
    disc(g, 0.5, 0.06, std(new THREE.Color(color).multiplyScalar(0.7), 0.7), 0, 0.5, 0.02);
    disc(g, 0.42, 0.08, m, 0, 0.5, 0.03);
    for (const x of [-0.2, 0, 0.2]) box(g, 0.02, 0.76 - Math.abs(x) * 0.9, 0.02, DARK(), x, 0.5, 0.08, false);
    knob(0, 0.5, 0.1);
    step = 0.9;
  }
  if (step) box(g, step, 0.08, 0.24, STONE(), 0, -0.02, 0.13, false);
  return g;
}

// ---------- Dächer (Ursprung: Mitte der obersten Decke) ----------

export const ROOFS = {
  r_giebel: { pal: 'roof', c: 0 }, r_spitz: { pal: 'roof', c: 1 }, r_stroh: { pal: 'straw', c: 0 }, r_terrasse: { pal: 'roof', c: 4 },
  r_zinnen: { pal: 'stone', c: 0 }, r_kegel: { pal: 'roof', c: 1 }, r_zeltdach: { pal: 'bright', c: 0 }, r_kuppel: { pal: 'roof', c: 5 },
  r_spitze: { pal: 'bright', c: 0 }, r_markise: { pal: 'bright', c: 0 }, r_pilz: { pal: 'bright', c: 0 }, r_zwiebel: { pal: 'roof', c: 5 },
};

// Gibt das Modell zurück und merkt sich in userData: apex (Höhe der Spitze) und chimney (Platz für den Schornstein)
export function roofModel(id, fp, color, wallColor = '#f7f1e3') {
  if (ROOFS[id].make) return ROOFS[id].make(fp, color, wallColor);
  const g = new THREE.Group();
  const m = std(color, 0.55);
  const { w, d } = fp;
  const half = w / 2;
  let apex = 0.14;
  let chimney = [w * 0.24, 0.5, -d * 0.18];
  if (id === 'r_giebel' || id === 'r_stroh') {
    const h = (id === 'r_stroh' ? 1.2 : 1.05) * (w < 2 ? 0.8 : 1);
    put(g, gableFill(w, d, h), std(wallColor, 0.85));
    put(g, gableRoof(w, d, h, id === 'r_stroh' ? 0.34 : 0.22), id === 'r_stroh' ? std(color, 1) : m, 0, -0.02, 0);
    if (id === 'r_stroh') box(g, w + 0.5, 0.1, 0.22, std(new THREE.Color(color).multiplyScalar(0.8), 1), 0, h - 0.04, 0);
    apex = h;
    chimney = [w * 0.26, h * 0.68, -d * 0.17];
  } else if (id === 'r_spitz') {
    const h = w < 2 ? 1.25 : 1.5;
    const r = put(g, new THREE.ConeGeometry(1, h, 4).rotateY(Math.PI / 4), m, 0, h / 2, 0);
    r.scale.set((w + 0.4) / Math.SQRT2, 1, (d + 0.4) / Math.SQRT2);
    apex = h;
    chimney = [w * 0.2, h * 0.55, -d * 0.12];
  } else if (id === 'r_kegel') {
    const r = (fp.round ? half : Math.hypot(w, d) / 2) + 0.14;
    cone(g, r, 1.8, m, 0, 0.9, 0, 24);
    apex = 1.8;
    chimney = [r * 0.35, 0.95, -r * 0.2];
  } else if (id === 'r_zinnen') {
    if (fp.round) {
      cyl(g, half + 0.14, half + 0.14, 0.14, m, 0, 0.07, 0, 24);
      for (let i = 0; i < 8; i++) {
        const b = box(g, 0.34, 0.3, 0.22, m, Math.sin(i * 0.785) * (half + 0.03), 0.29, Math.cos(i * 0.785) * (half + 0.03));
        b.rotation.y = i * 0.785;
      }
    } else {
      box(g, w + 0.3, 0.14, d + 0.3, m, 0, 0.07, 0);
      for (const zx of [-1, 0, 1]) for (const zz of [-1, 1]) box(g, 0.36, 0.3, 0.22, m, zx * (w / 2 - 0.05), 0.29, zz * (d / 2 + 0.02));
      for (const zx of [-1, 1]) box(g, 0.22, 0.3, 0.36, m, zx * (w / 2 + 0.02), 0.29, 0);
    }
  } else if (id === 'r_terrasse') {
    box(g, w + 0.24, 0.12, d + 0.24, STONE(), 0, 0.06, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) box(g, 0.07, 0.4, 0.07, WHITE(), x * (w / 2 + 0.04), 0.3, z * (d / 2 + 0.04));
    for (const z of [-1, 1]) box(g, w + 0.16, 0.06, 0.07, WHITE(), 0, 0.5, z * (d / 2 + 0.04));
    for (const x of [-1, 1]) box(g, 0.07, 0.06, d + 0.16, WHITE(), x * (w / 2 + 0.04), 0.5, 0);
    // Sonnenschirm
    cyl(g, 0.03, 0.03, 1.1, DARK(), -w * 0.24, 0.65, 0, 8);
    cone(g, 0.62, 0.3, m, -w * 0.24, 1.3, 0, 10);
    chimney = [w * 0.26, 0.5, -d * 0.2];
  } else if (id === 'r_kuppel') {
    const r = half + 0.06;
    const dome = put(g, new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.08, 0);
    dome.scale.set(1, 0.92, d / w);
    put(g, fp.round ? new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.1, 24) : new THREE.BoxGeometry(w + 0.2, 0.1, d + 0.2), WHITE(), 0, 0.05, 0);
    apex = r * 0.92 + 0.08;
    chimney = [r * 0.5, apex * 0.5, -r * 0.3];
  } else if (id === 'r_zwiebel') {
    const pts = [[0.42, 0], [0.6, 0.12], [0.74, 0.4], [0.66, 0.7], [0.36, 1.0], [0.12, 1.3], [0.02, 1.6]].map(([x, y]) => new THREE.Vector2(x * half * 1.35, y));
    put(g, new THREE.LatheGeometry(pts, 24), m, 0, 0.08, 0);
    cyl(g, half * 0.62, half + 0.08, 0.1, WHITE(), 0, 0.05, 0, 24);
    ball(g, 0.07, GOLD(), 0, 1.7, 0);
    apex = 1.72;
    chimney = [half * 0.7, 0.5, -half * 0.3];
  } else if (id === 'r_zeltdach') {
    const r = (fp.round ? half : Math.hypot(w, d) / 2) + 0.28;
    cone(g, r - 0.01, 1.35, WHITE(), 0, 0.675, 0, 24);
    for (let i = 0; i < 12; i += 2) put(g, new THREE.ConeGeometry(r, 1.36, 3, 1, true, (i * Math.PI) / 6, Math.PI / 6), m, 0, 0.68, 0, false);
    // Zackenrand
    for (let i = 0; i < 12; i++) {
      const a = (i + 0.5) * (Math.PI / 6);
      const t = cone(g, 0.12, 0.2, i % 2 ? WHITE() : m, Math.sin(a) * (r - 0.05), -0.08, Math.cos(a) * (r - 0.05), 4);
      t.rotation.x = Math.PI;
    }
    apex = 1.35;
    chimney = [r * 0.35, 0.7, -r * 0.2];
  } else if (id === 'r_spitze') {
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(half * Math.cos((i / 10) * Math.PI * 0.5) ** 0.8, (i / 10) * 1.7));
    put(g, new THREE.LatheGeometry(pts, 28), std(color, 0.35, { metalness: 0.3 }));
    apex = 1.7;
    chimney = [half * 0.4, 0.8, -half * 0.3];
  } else if (id === 'r_markise') {
    box(g, w + 0.2, 0.14, d + 0.2, WHITE(), 0, 0.07, 0);
    // große gestreifte Markise über die ganze Front
    for (let i = 0; i < 7; i++) {
      const s = box(g, (w + 0.3) / 7, 0.05, 0.8, i % 2 ? WHITE() : m, -(w + 0.3) / 2 + ((w + 0.3) / 7) * (i + 0.5), -0.12, d / 2 + 0.4);
      s.rotation.x = 0.42;
    }
    chimney = [w * 0.26, 0.5, -d * 0.2];
  } else if (id === 'r_pilz') {
    const r = half * 1.6;
    const cap = put(g, new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -0.05, 0);
    cap.scale.y = 0.72;
    cyl(g, r * 0.98, r * 0.98, 0.06, fix('#f3ead8', 0.9), 0, -0.05, 0, 28);
    // weiße Punkte
    for (const [a, e] of [[0.3, 0.5], [1.6, 0.75], [2.7, 0.45], [3.9, 0.8], [5.1, 0.55], [0.9, 1.15], [3.2, 1.2], [5.6, 1.1]]) {
      const dot = ball(g, r * 0.13, WHITE(), Math.sin(a) * Math.sin(e) * r * 0.99, Math.cos(e) * r * 0.72 * 0.99 - 0.05, Math.cos(a) * Math.sin(e) * r * 0.99);
      dot.scale.y = 0.45;
      dot.castShadow = false;
    }
    apex = r * 0.72 - 0.05;
    chimney = [r * 0.45, apex * 0.75, -r * 0.2];
  }
  g.userData.apex = apex;
  g.userData.chimney = chimney;
  return g;
}

// ---------- Spitzen (Ursprung: Dachspitze) ----------

export const TOPS = {
  t_schornstein: {}, t_hahn: {}, t_antenne: {}, t_krone: {}, t_eis: {}, t_schuessel: {}, t_stern: {},
  t_fahne: { pal: 'bright', c: 0 }, t_wimpel: { pal: 'bright', c: 1 }, t_kugel: { pal: 'bright', c: 2 }, t_herz: { pal: 'bright', c: 0 },
  t_propeller: { pal: 'bright', c: 1 }, t_donut: { pal: 'bright', c: 6 },
};

export function topModel(id, color = '#e5484d') {
  if (TOPS[id].make) return TOPS[id].make(color);
  const g = new THREE.Group();
  const m = std(color, 0.6);
  const pole = (h, r = 0.025) => cyl(g, r, r, h, DARK(), 0, h / 2, 0, 8);
  if (id === 't_schornstein') {
    box(g, 0.32, 0.75, 0.32, fix('#b9644a'), 0, 0.2, 0);
    box(g, 0.4, 0.1, 0.4, DARK(), 0, 0.6, 0);
    g.userData.onRoof = true; // sitzt neben der Spitze auf der Dachfläche
  } else if (id === 't_fahne') {
    pole(0.95);
    box(g, 0.5, 0.3, 0.03, m, 0.27, 0.78, 0, false);
  } else if (id === 't_wimpel') {
    pole(1.05);
    put(g, ext(triShape([[0, 0], [0.85, 0.14], [0, 0.28]]), 0.03), m, 0.02, 0.74, -0.015, false);
    ball(g, 0.05, GOLD(), 0, 1.07, 0);
  } else if (id === 't_stern') {
    pole(0.4, 0.02);
    const geo = ext(starShape(0.3, 0.13), 0.08);
    geo.center();
    put(g, geo, GOLD(), 0, 0.62, 0);
  } else if (id === 't_hahn') {
    pole(0.7);
    box(g, 0.6, 0.03, 0.03, DARK(), 0, 0.45, 0, false);
    cone(g, 0.06, 0.14, DARK(), 0.33, 0.45, 0, 8).rotation.z = -Math.PI / 2;
    const body = ball(g, 0.15, GOLD(), 0, 0.82, 0);
    body.scale.set(1.3, 1, 0.6);
    ball(g, 0.08, GOLD(), 0.17, 0.96, 0);
    cone(g, 0.03, 0.08, fix('#f08a24'), 0.27, 0.95, 0, 6).rotation.z = -Math.PI / 2;
    box(g, 0.08, 0.06, 0.03, fix('#e5484d'), 0.17, 1.05, 0, false);
    const tail = box(g, 0.22, 0.16, 0.04, GOLD(), -0.22, 0.93, 0, false);
    tail.rotation.z = -0.7;
  } else if (id === 't_antenne') {
    pole(1.0, 0.02);
    for (const [y, r] of [[0.35, 0.2], [0.55, 0.14], [0.75, 0.08]]) cyl(g, r, r, 0.03, IRON(), 0, y, 0, 16);
    ball(g, 0.07, glow('#ff4d4d'), 0, 1.03, 0);
  } else if (id === 't_krone') {
    put(g, new THREE.CylinderGeometry(0.3, 0.26, 0.22, 16, 1, true), fix('#f7c531', 0.35, { metalness: 0.3, side: THREE.DoubleSide }), 0, 0.16, 0);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047;
      cone(g, 0.07, 0.2, GOLD(), Math.sin(a) * 0.29, 0.36, Math.cos(a) * 0.29, 6);
      ball(g, 0.04, fix(['#e5484d', '#3b7cc9', '#3f8a6a'][i % 3], 0.3), Math.sin(a) * 0.3, 0.16, Math.cos(a) * 0.3).castShadow = false;
    }
  } else if (id === 't_kugel') {
    pole(0.3);
    ball(g, 0.24, std(color, 0.3, { emissive: color, emissiveIntensity: 0.9 }), 0, 0.5, 0);
  } else if (id === 't_herz') {
    pole(0.3, 0.02);
    const geo = ext(heartShape(0.42), 0.1);
    geo.center();
    put(g, geo, m, 0, 0.62, 0);
  } else if (id === 't_eis') {
    // riesige Eiswaffel mit drei Kugeln
    cone(g, 0.28, 0.75, fix('#d9a45f', 0.9), 0, 0.3, 0, 16).rotation.x = Math.PI;
    ball(g, 0.27, fix('#f6a5c0', 0.7), -0.12, 0.78, 0);
    ball(g, 0.27, fix('#fff3d6', 0.7), 0.14, 0.8, 0.02);
    ball(g, 0.25, fix('#8a5a3c', 0.7), 0.02, 1.08, 0);
    ball(g, 0.07, fix('#e5484d', 0.4), 0.02, 1.36, 0);
  } else if (id === 't_donut') {
    pole(0.25);
    put(g, new THREE.TorusGeometry(0.3, 0.15, 12, 24), fix('#d9a45f', 0.8), 0, 0.62, 0);
    const icing = put(g, new THREE.TorusGeometry(0.3, 0.155, 12, 24, Math.PI * 2), m, 0, 0.62, 0.035, false);
    icing.scale.z = 0.7;
    for (let i = 0; i < 8; i++) box(g, 0.07, 0.025, 0.025, fix(['#ffffff', '#f2c832', '#3b7cc9'][i % 3]), Math.cos(i * 0.785) * 0.3, 0.62 + Math.sin(i * 0.785) * 0.3, 0.15, false).rotation.z = i * 1.3;
  } else if (id === 't_schuessel') {
    pole(0.4, 0.03);
    const dish = put(g, new THREE.SphereGeometry(0.4, 20, 8, 0, Math.PI * 2, 0, Math.PI / 3), fix('#e8ecef', 0.4, { side: THREE.DoubleSide, metalness: 0.3 }), 0, 0.82, -0.05);
    dish.rotation.x = Math.PI + 0.9;
    const feed = cyl(g, 0.012, 0.012, 0.36, DARK(), 0, 0.62, 0.22, 6);
    feed.rotation.x = 0.9;
    ball(g, 0.045, glow('#ff4d4d'), 0, 0.73, 0.36);
  } else if (id === 't_propeller') {
    pole(0.55);
    const rotor = new THREE.Group();
    rotor.position.set(0, 0.6, 0.06);
    for (let i = 0; i < 4; i++) {
      const blade = box(rotor, 0.5, 0.14, 0.03, i % 2 ? WHITE() : m, 0.27, 0, 0);
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(blade);
      rotor.add(arm);
    }
    ball(rotor, 0.07, GOLD(), 0, 0, 0.02);
    g.add(rotor);
    g.userData.anim = (t) => { rotor.rotation.z = t * 3; };
  }
  return g;
}

// ---------- Schmuck ----------
// ctx: { fp0 (unterstes Stockwerk), fpTop, topY (Oberkante der Mauern), apexY, slots (Fenster unten), glass }

export function decoModel(id, ctx) {
  if (EXTRA.decos[id]) return EXTRA.decos[id](ctx);
  const g = new THREE.Group();
  const { fp0, fpTop, topY } = ctx;
  const f0 = fp0.round ? fp0.r : fp0.d / 2; // Abstand der Vorderseite von der Mitte
  const half = fp0.half;
  const anims = [];
  // Untergruppe am Boden; „ground“ heißt: darf zur Seite rücken, wenn dort ein Anbau steht (buildSite.js)
  const grp = (x = 0, y = 0, z = 0) => { const n = new THREE.Group(); n.position.set(x, y, z); n.userData.ground = true; g.add(n); return n; };
  const BRIGHT = PAL.bright;
  if (id === 'x_blumen') {
    for (const x of ctx.slots.length ? ctx.slots : [-half * 0.6, half * 0.6]) {
      const n = attachFront(g, new THREE.Group(), fp0, x, 0.36, 0.09);
      box(n, 0.56, 0.12, 0.16, fix('#8a5a33'), 0, 0, 0, false);
      ['#f08bb4', '#f5c53a', '#e5484d'].forEach((col, i) => { ball(n, 0.075, fix(col, 0.6), -0.17 + i * 0.17, 0.11, 0).castShadow = false; });
    }
  } else if (id === 'x_vordach') {
    const n = attachFront(g, new THREE.Group(), fp0, 0, 1.04, 0.3);
    for (let i = 0; i < 5; i++) box(n, 0.26, 0.06, 0.62, i % 2 ? WHITE() : fix('#e5484d', 0.6), -0.52 + i * 0.26, 0, 0, i === 0);
    n.rotation.x = 0.3;
    for (const x of [-0.6, 0.6]) box(g, 0.05, 0.96, 0.05, WHITE(), x, 0.48, f0 + 0.56);
  } else if (id === 'x_lichter' || id === 'x_wimpel') {
    // Kette entlang der Vorderkante des untersten Stockwerks
    const n = 9;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = (u - 0.5) * half * 1.86;
      const sag = Math.sin(u * Math.PI) * 0.12;
      const col = BRIGHT[i % BRIGHT.length];
      const o = new THREE.Group();
      if (id === 'x_lichter') ball(o, 0.06, glow(col, 1.6), 0, 0, 0).castShadow = false;
      else put(o, ext(triShape([[-0.09, 0], [0.09, 0], [0, -0.2]]), 0.015), fix(col, 0.7), 0, 0.04, 0, false);
      attachFront(g, o, fp0, x, H - 0.1 - sag, 0.05);
    }
  } else if (id === 'x_schilde') {
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      const geo = ext(triShape([[-0.2, 0.22], [0.2, 0.22], [0.2, -0.02], [0, -0.26], [-0.2, -0.02]]), 0.05);
      put(sh, geo, fix(s < 0 ? '#e5484d' : '#3b7cc9', 0.5), 0, 0, 0, false);
      box(sh, 0.06, 0.4, 0.02, GOLD(), 0, 0, 0.055, false);
      box(sh, 0.32, 0.06, 0.02, GOLD(), 0, 0.08, 0.055, false);
      onSide(g, sh, fp0, s, 0.72);
    }
  } else if (id === 'x_fackeln') {
    for (const x of [-0.72, 0.72]) {
      const n = attachFront(g, new THREE.Group(), fp0, x * (half < 0.95 ? 0.75 : 1), 0.78, 0.08);
      const stick = cyl(n, 0.03, 0.02, 0.4, fix('#6e4a2e'), 0, 0, 0, 6);
      stick.rotation.x = 0.35;
      const flame = cone(n, 0.09, 0.26, glow('#ffa726', 2), 0, 0.3, 0.07, 8);
      flame.castShadow = false;
      anims.push((t) => { flame.scale.set(1 + Math.sin(t * 13 + x) * 0.15, 1 + Math.sin(t * 17 + x) * 0.25, 1); });
    }
  } else if (id === 'x_banner') {
    const n = attachFront(g, new THREE.Group(), fpTop, 0, topY - 0.14, 0.04);
    box(n, 0.56, 0.05, 0.05, GOLD(), 0, 0, 0, false);
    box(n, 0.46, 0.85, 0.03, fix('#b0283a', 0.7), 0, -0.44, 0, false);
    const geo = ext(starShape(0.13, 0.06), 0.02);
    geo.center();
    put(n, geo, GOLD(), 0, -0.4, 0.03, false);
  } else if (id === 'x_efeu') {
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Group();
      const b = ball(leaf, 0.13 + (i % 3) * 0.03, GREEN(), 0, 0, 0);
      b.scale.z = 0.4;
      b.castShadow = false;
      attachFront(g, leaf, fp0, -half * (0.9 - (i % 3) * 0.12), 0.12 + i * 0.125, 0.03);
    }
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Group();
      const b = ball(leaf, 0.14, GREEN(), 0, 0, 0);
      b.scale.z = 0.4;
      b.castShadow = false;
      const o = onSide(g, leaf, fp0, -1, 0.15 + i * 0.2);
      o.position.z += fp0.round ? 0 : 0.35 - i * 0.12;
    }
  } else if (id === 'x_zaun') {
    const z = f0 + 1.15;
    for (let i = 0; i < 12; i++) {
      const x = -1.9 + i * (3.8 / 11);
      if (Math.abs(x) < 0.5) continue;
      box(g, 0.1, 0.5, 0.05, WHITE(), x, 0.25, z);
      cone(g, 0.07, 0.1, WHITE(), x, 0.55, z, 4).rotation.y = Math.PI / 4;
    }
    for (const s of [-1, 1]) box(g, 1.45, 0.06, 0.03, WHITE(), s * 1.22, 0.3, z - 0.03, false);
  } else if (id === 'x_busch') {
    for (const s of [-1, 1]) {
      const n = grp(s * (half + 0.55), 0, f0 * 0.5);
      ball(n, 0.36, GREEN(), 0, 0.3, 0);
      ball(n, 0.26, GREEN(), 0.26, 0.24, 0.1);
      ball(n, 0.24, GREEN(), -0.22, 0.2, 0.14);
      for (const [x, y, zz] of [[0.1, 0.6, 0.15], [-0.2, 0.42, 0.25], [0.3, 0.4, 0.2]]) ball(n, 0.05, fix('#f08bb4', 0.6), x, y, zz).castShadow = false;
    }
  } else if (id === 'x_baum') {
    const n = grp(half + 1.0, 0, -0.7);
    cyl(n, 0.1, 0.14, 0.9, fix('#8a5a33', 0.9), 0, 0.45, 0, 8);
    ball(n, 0.62, GREEN(), 0, 1.35, 0);
    ball(n, 0.42, GREEN(), 0.35, 1.05, 0.2);
    for (const [x, y, zz] of [[0.3, 1.5, 0.45], [-0.35, 1.2, 0.45], [0.05, 1.05, 0.58]]) ball(n, 0.08, fix('#e5484d', 0.5), x, y, zz).castShadow = false;
  } else if (id === 'x_briefkasten') {
    const n = grp(0.85, 0, f0 + 1.3);
    cyl(n, 0.04, 0.04, 0.8, DARK(), 0, 0.4, 0, 8);
    box(n, 0.4, 0.26, 0.26, fix('#f2c832', 0.5), 0, 0.9, 0);
    box(n, 0.3, 0.03, 0.02, DARK(), 0, 0.94, 0.135, false);
  } else if (id === 'x_bank') {
    const n = grp(-(half + 0.25), 0, f0 + 0.75);
    n.rotation.y = 0.5;
    const wood = fix('#a8794e');
    box(n, 0.95, 0.06, 0.34, wood, 0, 0.3, 0);
    box(n, 0.95, 0.3, 0.05, wood, 0, 0.52, -0.16);
    for (const x of [-0.4, 0.4]) box(n, 0.06, 0.3, 0.3, DARK(), x, 0.15, 0);
  } else if (id === 'x_laterne') {
    const n = grp(-(half + 0.75), 0, f0 + 1.0);
    cyl(n, 0.04, 0.06, 1.5, DARK(), 0, 0.75, 0, 8);
    box(n, 0.24, 0.3, 0.24, glow('#ffe08a', 1.4), 0, 1.6, 0);
    cone(n, 0.24, 0.16, DARK(), 0, 1.84, 0, 4).rotation.y = Math.PI / 4;
  } else if (id === 'x_weg') {
    [[0, 0.5, 0.3], [0.12, 0.95, 0.26], [-0.1, 1.4, 0.28], [0.08, 1.85, 0.24]].forEach(([x, z, r]) => {
      const s = cyl(g, r, r, 0.05, STONE(), x, 0.03, f0 + z, 9);
      s.castShadow = false;
    });
  } else if (id === 'x_ecktuerme') {
    const hx = fp0.round ? fp0.r * 0.74 : fp0.w / 2;
    const hz = fp0.round ? fp0.r * 0.74 : fp0.d / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const n = grp(sx * hx, 0, sz * hz);
      cyl(n, 0.3, 0.32, 1.7, std('#b9b4aa', 0.9, { map: tex('stone', 3, 1) }), 0, 0.85, 0, 14);
      cone(n, 0.4, 0.6, fix('#c8453a', 0.55), 0, 2.0, 0, 14);
    }
  } else if (id === 'x_graben') {
    const ring = put(g, new THREE.RingGeometry(2.35, 2.95, 40).rotateX(-Math.PI / 2), fix('#6fb6e8', 0.15), 0, 0.02, 0, false);
    ring.receiveShadow = true;
    box(g, 0.8, 0.07, 0.9, fix('#a8794e'), 0, 0.06, 2.65);
  } else if (id === 'x_kanone') {
    const n = grp(half + 0.8, 0, f0 + 0.55);
    n.rotation.y = -0.5;
    const barrel = cyl(n, 0.1, 0.14, 0.8, IRON(), 0, 0.36, 0.15, 12);
    barrel.rotation.x = 1.25;
    for (const x of [-0.2, 0.2]) cyl(n, 0.22, 0.22, 0.06, fix('#6e4a2e'), x, 0.22, 0, 12).rotation.z = Math.PI / 2;
    for (const [x, zz] of [[0.45, 0.3], [0.62, 0.3], [0.53, 0.44]]) ball(n, 0.09, DARK(), x, 0.09, zz);
  } else if (id === 'x_ballons') {
    const n = grp(half + 0.35, 0, f0 + 0.3);
    const bunch = new THREE.Group();
    n.add(bunch);
    [['#e5484d', -0.22, 2.0], ['#f2c832', 0.05, 2.25], ['#3b7cc9', 0.28, 1.95]].forEach(([col, x, y]) => {
      const b = ball(bunch, 0.24, fix(col, 0.25), x, y, 0);
      b.scale.y = 1.2;
      const s = cyl(bunch, 0.008, 0.008, y - 0.3, DARK(), x / 2, y / 2 - 0.1, 0, 4);
      s.rotation.z = -x / (y - 0.3);
      s.castShadow = false;
    });
    anims.push((t) => { bunch.rotation.z = Math.sin(t * 1.3) * 0.06; bunch.rotation.x = Math.sin(t * 0.9) * 0.05; });
  } else if (id === 'x_sterne') {
    const geo = ext(starShape(0.16, 0.07), 0.04);
    geo.center();
    const r = Math.max(half, fpTop.half) + 0.75;
    const stars = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const s = put(g, geo, GOLD(), Math.sin(a) * r, topY + 0.1 + ((i * 37) % 10) / 9, Math.cos(a) * r, false);
      stars.push(s);
    }
    anims.push((t) => stars.forEach((s, i) => { s.rotation.y = t * 1.2 + i; s.position.y += Math.sin(t * 2 + i * 1.7) * 0.0015; }));
  } else if (id === 'x_regenbogen') {
    const R = THREE.MathUtils.clamp(topY * 0.75 + 1.2, 2.3, 3.4);
    ['#e5484d', '#f08a24', '#f2c832', '#3f8a6a', '#3b7cc9', '#8b5bb5'].forEach((col, i) => {
      put(g, new THREE.TorusGeometry(R - i * 0.13, 0.07, 6, 32, Math.PI), fix(col, 0.6), 0, 0, -(fp0.d / 2 + 0.55), false);
    });
    for (const s of [-1, 1]) {
      const cl = grp(s * (R - 0.3), 0.2, -(fp0.d / 2 + 0.5));
      ball(cl, 0.3, WHITE(), 0, 0, 0);
      ball(cl, 0.22, WHITE(), 0.28, -0.04, 0.05);
      ball(cl, 0.22, WHITE(), -0.26, -0.05, 0.05);
    }
  } else if (id === 'x_flossen') {
    const geo = ext(triShape([[0, 0], [0.75, 0], [0, 1.15]]), 0.07);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const fin = new THREE.Group();
      put(fin, geo, fix('#e5484d', 0.45), half * 0.92, 0, -0.035);
      fin.rotation.y = a;
      g.add(fin);
    }
  } else if (id === 'x_flammen') {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const n = new THREE.Group();
      n.rotation.y = a;
      const fl = new THREE.Group();
      fl.position.set(0, 0.16, half + 0.1);
      n.add(fl);
      g.add(n);
      if (i === 0) fl.position.z = half + 0.7; // vorne ist die Tür: Flamme weiter draußen
      const outer = cone(fl, 0.2, 0.7, glow('#ff7a1a', 1.8), 0, 0, 0.3, 10);
      outer.rotation.x = Math.PI / 2 - 0.25;
      const inner = cone(fl, 0.1, 0.45, glow('#ffe36b', 2.2), 0, 0, 0.22, 8);
      inner.rotation.x = Math.PI / 2 - 0.25;
      outer.castShadow = inner.castShadow = false;
      anims.push((t) => { fl.scale.setScalar(1 + Math.sin(t * 15 + i * 2) * 0.12); });
    }
  } else if (id === 'x_leiter') {
    const top = Math.min(topY, 2.4) + 0.1;
    const n = grp(half + 0.42, 0, f0 * 0.25);
    n.rotation.z = 0.28;
    const len = top / Math.cos(0.28);
    for (const z of [-0.18, 0.18]) box(n, 0.05, len, 0.05, fix('#a8794e'), 0, len / 2, z);
    for (let y = 0.25; y < len - 0.1; y += 0.3) box(n, 0.04, 0.04, 0.36, fix('#a8794e'), 0, y, 0, false);
  } else if (id === 'x_tisch') {
    const n = grp(half + 0.95, 0, f0 + 0.55);
    cyl(n, 0.4, 0.4, 0.05, WHITE(), 0, 0.55, 0, 16);
    cyl(n, 0.04, 0.04, 1.7, DARK(), 0, 0.85, 0, 8);
    for (let i = 0; i < 8; i++) put(n, new THREE.ConeGeometry(0.85, 0.35, 3, 1, true, (i * Math.PI) / 4, Math.PI / 4), i % 2 ? WHITE() : fix('#e5484d', 0.6), 0, 1.75, 0);
    for (const [x, z] of [[-0.6, 0.2], [0.55, 0.35]]) cyl(n, 0.16, 0.14, 0.34, fix('#3b7cc9', 0.6), x, 0.17, z, 10);
  } else if (id === 'x_toepfe') {
    for (const s of [-1, 1]) {
      const n = attachFront(g, new THREE.Group(), fp0, s * 0.62 * (half < 0.95 ? 0.78 : 1), 0, 0.3);
      cyl(n, 0.16, 0.11, 0.24, fix('#c8744a', 0.9), 0, 0.12, 0, 10);
      ball(n, 0.2, GREEN(), 0, 0.38, 0);
      ball(n, 0.07, fix(s < 0 ? '#f08bb4' : '#f2c832', 0.6), 0.05, 0.57, 0.06).castShadow = false;
    }
  } else if (id === 'x_schild') {
    const n = attachFront(g, new THREE.Group(), fp0, half * 0.82, H - 0.2, 0.02);
    box(n, 0.04, 0.04, 0.5, DARK(), 0, 0.12, 0.25, false);
    const sign = new THREE.Group();
    sign.position.set(0, -0.14, 0.42);
    sign.rotation.y = Math.PI / 2;
    disc(sign, 0.24, 0.05, fix('#f08bb4', 0.5), 0, 0, 0);
    for (const z of [-0.03, 0.03]) disc(sign, 0.15, 0.02, WHITE(), 0, 0, z);
    n.add(sign);
    anims.push((t) => { sign.rotation.x = Math.sin(t * 1.8) * 0.1; });
  } else if (id === 'x_pilze') {
    [[-(half + 0.5), f0 + 0.5, 1], [-(half + 0.95), f0 + 0.15, 0.7], [-(half + 0.2), f0 + 0.95, 0.55]].forEach(([x, z, s]) => {
      const n = grp(x, 0, z);
      n.scale.setScalar(s);
      cyl(n, 0.1, 0.13, 0.4, fix('#f3ead8', 0.9), 0, 0.2, 0, 10);
      const cap = put(n, new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), fix('#e5484d', 0.5), 0, 0.36, 0);
      cap.scale.y = 0.75;
      for (const [a, e] of [[0.5, 0.6], [2.4, 0.7], [4.3, 0.55], [1.4, 1.2]]) {
        ball(n, 0.05, WHITE(), Math.sin(a) * Math.sin(e) * 0.33, 0.36 + Math.cos(e) * 0.25, Math.cos(a) * Math.sin(e) * 0.33).castShadow = false;
      }
    });
  }
  if (anims.length) g.userData.anim = (t) => anims.forEach((fn) => fn(t));
  return g;
}

// ---------- Muster: eine dünne, durchsichtige Hülle mit weißem Muster um jedes Stockwerk ----------

export const PATTERNS = ['m_punkte', 'm_streifen', 'm_karo', 'm_herzen', 'm_sterne', 'm_blumen', 'm_wellen', 'm_zickzack'];

const patCache = new Map();
function patternTexture(id, rx, ry) {
  const key = `${id}|${rx}|${ry}`;
  if (patCache.has(key)) return patCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = x.strokeStyle = 'rgba(255,255,255,0.88)';
  x.lineWidth = 9;
  x.lineCap = x.lineJoin = 'round';
  const path = (pts, close = true) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); if (close) { x.closePath(); x.fill(); } else x.stroke(); };
  const spots = [[32, 32], [96, 96]]; // versetzt, damit es sich nahtlos wiederholt
  if (id === 'm_punkte') {
    for (const [a, b] of spots) { x.beginPath(); x.arc(a, b, 15, 0, Math.PI * 2); x.fill(); }
  } else if (id === 'm_streifen') {
    x.lineWidth = 16;
    for (let i = -128; i < 256; i += 64) path([[i, 128], [i + 128, 0]], false);
  } else if (id === 'm_karo') {
    x.fillRect(0, 0, 64, 64);
    x.fillRect(64, 64, 64, 64);
  } else if (id === 'm_herzen') {
    for (const [a, b] of spots) {
      x.beginPath();
      x.moveTo(a, b + 16);
      x.bezierCurveTo(a - 30, b - 2, a - 14, b - 24, a, b - 8);
      x.bezierCurveTo(a + 14, b - 24, a + 30, b - 2, a, b + 16);
      x.fill();
    }
  } else if (id === 'm_sterne') {
    for (const [a, b] of spots) {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 8 : 19;
        pts.push([a + Math.cos(an) * r, b + Math.sin(an) * r]);
      }
      path(pts);
    }
  } else if (id === 'm_blumen') {
    for (const [a, b] of spots) {
      for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(a + Math.cos(i * 1.257) * 11, b + Math.sin(i * 1.257) * 11, 8, 0, Math.PI * 2); x.fill(); }
      x.clearRect(a - 4, b - 4, 8, 8);
    }
  } else if (id === 'm_wellen') {
    for (const y of [32, 96]) {
      x.beginPath();
      x.moveTo(0, y);
      x.bezierCurveTo(32, y - 28, 32, y + 28, 64, y);
      x.bezierCurveTo(96, y - 28, 96, y + 28, 128, y);
      x.stroke();
    }
  } else if (id === 'm_zickzack') {
    for (const y of [40, 104]) path([[0, y], [32, y - 26], [64, y], [96, y - 26], [128, y]], false);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  patCache.set(key, t);
  return t;
}

// Hülle für ein Stockwerk (liegt knapp über der Wand, aber hinter Fenstern und Tür)
export function patternShell(id, levelId) {
  const def = LEVELS[levelId];
  const mat = (rx, ry) => new THREE.MeshStandardMaterial({ map: patternTexture(id, rx, ry), transparent: true, roughness: 0.85, depthWrite: false });
  let m;
  if (def.shape === 'box') {
    m = new THREE.Mesh(new RoundedBoxGeometry(def.w + 0.012, H - 0.04, def.d + 0.012, 2, 0.05), mat(def.w > 2 ? 4 : 3, 2));
  } else {
    const k = def.look === 'stem' ? 0.86 : 1;
    m = new THREE.Mesh(new THREE.CylinderGeometry(def.r * k + 0.006, def.r + 0.006, H - 0.04, 28, 1, true), mat(def.r > 0.9 ? 10 : 8, 2));
  }
  m.position.y = H / 2;
  m.renderOrder = 1;
  return m;
}

// ---------- Anbauten (stehen seitlich am untersten Stockwerk; Ursprung: Innenkante am Boden, wachsen nach +x) ----------

export const WINGS = {
  // w = Breite (Schmuck, Bagger und Steinstapel rücken um so viel zur Seite)
  a_fluegel: { pal: 'wall', c: 1, w: 1.4 }, a_garage: { pal: 'wall', c: 4, w: 1.6 }, a_turm: { pal: 'stone', c: 0, w: 1.15 },
  a_wintergarten: { w: 1.3 }, a_schuppen: { pal: 'wood', c: 0, w: 1.2 }, a_windmuehle: { pal: 'wall', c: 0, w: 1.6 },
  a_wasserrad: { pal: 'wood', c: 1, w: 0.7 }, a_zelt: { pal: 'bright', c: 0, w: 1.7 },
};

export function wingModel(id, color, roofColor, glass) {
  if (WINGS[id].make) return WINGS[id].make(color, roofColor, glass);
  const g = new THREE.Group();
  const m = std(color, 0.85);
  const rm = std(roofColor, 0.55);
  if (id === 'a_fluegel') {
    put(g, new RoundedBoxGeometry(1.3, 1.0, 1.4, 2, 0.05), m, 0.65, 0.5, 0);
    put(g, gableFill(1.3, 1.4, 0.62), m, 0.65, 1.0, 0);
    put(g, gableRoof(1.3, 1.4, 0.62, 0.16), rm, 0.65, 0.98, 0);
    const w = windowModel('f_eck', glass);
    w.position.set(0.65, 0.56, 0.712);
    g.add(w);
  } else if (id === 'a_garage') {
    put(g, new RoundedBoxGeometry(1.5, 0.95, 1.5, 2, 0.05), m, 0.75, 0.475, 0);
    box(g, 1.62, 0.1, 1.62, rm, 0.75, 1.0, 0);
    box(g, 1.1, 0.76, 0.05, WHITE(), 0.75, 0.38, 0.76, false);
    for (let i = 1; i < 5; i++) box(g, 1.1, 0.02, 0.06, fix('#c9c4ba', 0.6), 0.75, i * 0.152, 0.765, false);
    // kleines Auto davor
    const car = new THREE.Group();
    car.position.set(0.75, 0, 1.45);
    box(car, 0.74, 0.2, 0.38, fix('#3b7cc9', 0.4), 0, 0.2, 0);
    box(car, 0.4, 0.18, 0.34, fix('#3b7cc9', 0.4), -0.04, 0.38, 0);
    box(car, 0.34, 0.12, 0.35, fix('#9fd0ee', 0.2), -0.04, 0.39, 0, false);
    for (const x of [-0.24, 0.24]) for (const z of [-0.19, 0.19]) cyl(car, 0.1, 0.1, 0.06, DARK(), x, 0.1, z, 10).rotation.x = Math.PI / 2;
    g.add(car);
  } else if (id === 'a_turm') {
    cyl(g, 0.5, 0.52, 2.3, std(color, 0.9, { map: tex('stone', 4, 2) }), 0.5, 1.15, 0, 20);
    cone(g, 0.64, 0.85, rm, 0.5, 2.72, 0, 20);
    const w = windowModel('f_bogen', glass);
    w.position.set(0.5, 1.55, 0.51);
    w.scale.setScalar(0.8);
    g.add(w);
    cyl(g, 0.02, 0.02, 0.5, DARK(), 0.5, 3.35, 0, 6);
    box(g, 0.28, 0.17, 0.02, fix('#e5484d', 0.6), 0.65, 3.5, 0, false);
  } else if (id === 'a_wintergarten') {
    const gl = fix('#cfeaff', 0.1, { transparent: true, opacity: 0.5 });
    box(g, 1.2, 0.9, 1.2, gl, 0.6, 0.45, 0, false);
    const roof = box(g, 1.26, 0.04, 1.3, gl, 0.6, 1.06, 0, false);
    roof.rotation.z = -0.3;
    for (const x of [0.02, 1.2]) for (const z of [-0.6, 0.6]) box(g, 0.05, x < 1 ? 1.24 : 0.9, 0.05, WHITE(), x, x < 1 ? 0.62 : 0.45, z);
    box(g, 0.05, 0.05, 1.25, WHITE(), 1.2, 0.9, 0);
    box(g, 1.2, 0.08, 1.2, WHITE(), 0.6, 0.04, 0);
    for (const [x, z, r] of [[0.35, 0.2, 0.2], [0.8, -0.2, 0.26], [0.8, 0.3, 0.16]]) {
      cyl(g, 0.1, 0.07, 0.16, fix('#c8744a', 0.9), x, 0.16, z, 8);
      ball(g, r, GREEN(), x, 0.3 + r, z);
    }
  } else if (id === 'a_schuppen') {
    box(g, 1.0, 0.8, 1.2, std(color, 0.9, { map: tex('log', 1, 1) }), 0.5, 0.4, 0);
    const roof = box(g, 1.2, 0.07, 1.36, DARK(), 0.55, 0.92, 0);
    roof.rotation.z = -0.28;
    box(g, 0.4, 0.62, 0.04, std(new THREE.Color(color).multiplyScalar(0.7), 0.8), 0.5, 0.31, 0.61, false);
  } else if (id === 'a_windmuehle') {
    cyl(g, 0.36, 0.56, 1.9, m, 0.58, 0.95, 0, 16);
    cone(g, 0.46, 0.5, rm, 0.58, 2.15, 0, 16);
    put(g, ext(archShape(0.32, 0.56), 0.05), fix('#8a5a33', 0.6), 0.58, 0, 0.5, false);
    const rotor = new THREE.Group();
    rotor.position.set(0.58, 1.7, 0.48);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      box(arm, 0.95, 0.05, 0.04, fix('#8a5a33'), 0.5, 0, 0);
      box(arm, 0.7, 0.22, 0.02, WHITE(), 0.6, -0.12, 0, false);
      rotor.add(arm);
    }
    ball(rotor, 0.07, DARK(), 0, 0, 0.02);
    g.add(rotor);
    g.userData.anim = (t) => { rotor.rotation.z = t * 1.4; };
  } else if (id === 'a_wasserrad') {
    const wheel = new THREE.Group();
    wheel.position.set(0.3, 0.8, 0);
    for (const x of [-0.14, 0.14]) put(wheel, new THREE.TorusGeometry(0.7, 0.045, 6, 24).rotateY(Math.PI / 2), m, x, 0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const pad = box(wheel, 0.34, 0.05, 0.26, m, 0, Math.sin(a) * 0.68, Math.cos(a) * 0.68);
      pad.rotation.x = -a;
      if (i < 4) box(wheel, 0.05, 1.36, 0.05, m, 0, 0, 0).rotation.x = a;
    }
    g.add(wheel);
    cyl(g, 0.06, 0.06, 0.5, DARK(), 0.2, 0.8, 0, 8).rotation.z = Math.PI / 2;
    box(g, 0.6, 0.05, 2.2, fix('#6fb6e8', 0.15), 0.3, 0.03, 0.2, false);
    g.userData.anim = (t) => { wheel.rotation.x = t * 1.1; };
  } else if (id === 'a_zelt') {
    cone(g, 0.79, 1.3, WHITE(), 0.85, 0.65, 0, 20);
    for (let i = 0; i < 10; i += 2) put(g, new THREE.ConeGeometry(0.8, 1.31, 3, 1, true, (i * Math.PI) / 5 + 0.3, Math.PI / 5), m, 0.85, 0.655, 0, false);
    put(g, ext(triShape([[-0.26, 0], [0.26, 0], [0, 0.75]]), 0.04), fix('#2b2622', 0.9), 0.85, 0, 0.6, false).rotation.x = -0.5;
    cyl(g, 0.02, 0.02, 0.4, DARK(), 0.85, 1.48, 0, 6);
    box(g, 0.26, 0.16, 0.02, fix('#f2c832', 0.6), 0.99, 1.6, 0, false);
  }
  return g;
}

// ---------- Vorschau für die Knöpfe: ein einzelnes Teil, auf gleiche Größe gebracht ----------

export function partPreview(id) {
  const cat = catOf(id);
  const fp = footprint('mauer');
  const glass = fix('#9fd0ee', 0.2);
  let obj;
  if (cat === 'levels') {
    obj = levelModel(id, PAL[LEVELS[id].pal][LEVELS[id].c]);
  } else if (cat === 'doors') {
    obj = doorModel(id, PAL[DOORS[id].pal][DOORS[id].c]);
  } else if (cat === 'windows') {
    obj = windowModel(id, glass);
  } else if (cat === 'roofs') {
    const round = ROOFS[id].round ?? ['r_kegel', 'r_zeltdach', 'r_spitze', 'r_pilz', 'r_zwiebel'].includes(id);
    obj = roofModel(id, footprint(round ? 'turm' : 'mauer'), PAL[ROOFS[id].pal][ROOFS[id].c]);
  } else if (cat === 'tops') {
    obj = topModel(id, TOPS[id].pal ? PAL[TOPS[id].pal][TOPS[id].c] : undefined);
  } else if (cat === 'paint') {
    obj = levelModel('mauer', '#f0a3b8');
    obj.add(patternShell(id, 'mauer'));
  } else if (cat === 'wings') {
    obj = wingModel(id, WINGS[id].pal ? PAL[WINGS[id].pal][WINGS[id].c] : '#ffffff', PAL.roof[0], glass);
  } else {
    obj = decoModel(id, { fp0: fp, fpTop: fp, topY: H, apexY: H + 1, slots: windowSlots(fp, true), glass });
  }
  // einpassen: größte Ausdehnung = 1, Mitte im Ursprung, leicht gedreht
  const g = new THREE.Group();
  const bb = new THREE.Box3().setFromObject(obj);
  const size = bb.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z, 0.01);
  const c = bb.getCenter(new THREE.Vector3()).multiplyScalar(k);
  obj.scale.setScalar(k);
  obj.position.set(-c.x, -c.y, -c.z);
  g.add(obj);
  g.rotation.y = cat === 'windows' || cat === 'doors' ? -0.35 : -0.5;
  return g;
}

// Bausteine für weitere Teile (buildMore.js)
export { std, fix, put, box, cyl, ball, cone, disc, ext, heartShape, starShape, archShape, triShape, tex, WHITE, DARK, GOLD, IRON, STONE, GREEN, glow };
