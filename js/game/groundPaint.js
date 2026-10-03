// Gemalter Boden: Eine große Leinwand über dem Spielfeld mit weichen Wiesenflecken, Feldwegen,
// Dorfplatz und Feldern – dazu eine fein gekachelte Halm-Struktur (Detail), damit es auch von nah gut aussieht.
// Alles wird einmal beim Start gemalt; beim Spielen kostet es nichts.

import * as THREE from 'three';

// Bereich der Leinwand in Weltkoordinaten (außerhalb: Randfarbe)
export const PAINT = { x0: -140, x1: 140, z0: -100, z1: 100 };
const PX = 7; // Pixel pro Welt-Einheit (2048 × 1400)

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const GRASS = {
  base: '#6caa4f',
  dark: '#5c9946',
  deep: '#4f8b40',
  light: '#80b95a',
  warm: '#96b956',
  path: '#dcbf8a',
  pathEdge: '#c4a272',
  plaza: '#e6d3a8',
};

function rgba(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

/**
 * zones: { paths: [[[x,z],…]], plazas: [{x,z,r}], fields: [{x,z,w,d,rot,kind}], dark: [{x,z,r}] }
 * features: Fluss (für sattes Ufergras)
 */
export function paintGround(zones, features) {
  const W = (PAINT.x1 - PAINT.x0) * PX;
  const H = (PAINT.z1 - PAINT.z0) * PX;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rand(29);
  const X = (x) => (x - PAINT.x0) * PX;
  const Z = (z) => (z - PAINT.z0) * PX;

  g.fillStyle = GRASS.base;
  g.fillRect(0, 0, W, H);

  const blob = (x, z, rad, hex, a) => {
    const grd = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), rad * PX);
    grd.addColorStop(0, rgba(hex, a));
    grd.addColorStop(0.6, rgba(hex, a * 0.6));
    grd.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grd;
    g.fillRect(X(x) - rad * PX, Z(z) - rad * PX, rad * PX * 2, rad * PX * 2);
  };

  // große, weiche Wiesenflecken (hell, dunkel, gelblich) – macht die Fläche lebendig
  for (let i = 0; i < 520; i++) {
    const x = PAINT.x0 + r() * (PAINT.x1 - PAINT.x0);
    const z = PAINT.z0 + r() * (PAINT.z1 - PAINT.z0);
    const k = r();
    const hex = k < 0.4 ? GRASS.dark : k < 0.75 ? GRASS.light : GRASS.warm;
    blob(x, z, 3 + r() * 9, hex, 0.3 + r() * 0.25);
  }
  // sattes, dunkleres Gras am Flussufer
  if (features) {
    for (let i = 0; i < features.riverS.pts.length; i += 3) {
      const { x, z } = features.riverS.pts[i];
      blob(x, z, 9, GRASS.deep, 0.35);
    }
  }
  // dunkle Stellen (Wald, unter Baumgruppen, am Bergfuß)
  for (const d of zones.dark ?? []) blob(d.x, d.z, d.r, GRASS.deep, 0.55);

  // Felder: Streifen (Ackerfurchen), leicht gedreht
  for (const f of zones.fields ?? []) {
    g.save();
    g.translate(X(f.x), Z(f.z));
    g.rotate(-(f.rot ?? 0));
    const w = f.w * PX;
    const d = f.d * PX;
    const colors = {
      korn: ['#e8c45a', '#d9b04a'],
      kohl: ['#9a6b45', '#8a5d3a'],
      kuerbis: ['#9a6b45', '#8a5d3a'],
      sonnenblume: ['#8fb84e', '#7ea944'],
      erdbeere: ['#7a5a3a', '#6b4e33'],
    }[f.kind] ?? ['#9a6b45', '#8a5d3a'];
    g.fillStyle = rgba(GRASS.dark, 0.6);
    roundRect(g, -w / 2 - PX * 0.8, -d / 2 - PX * 0.8, w + PX * 1.6, d + PX * 1.6, PX * 1.5);
    g.fill();
    g.fillStyle = colors[0];
    roundRect(g, -w / 2, -d / 2, w, d, PX * 1.2);
    g.fill();
    g.save();
    roundRect(g, -w / 2, -d / 2, w, d, PX * 1.2);
    g.clip();
    g.fillStyle = colors[1];
    const rows = f.rows ?? Math.round(f.d / 1.4);
    for (let i = 0; i < rows; i++) {
      const y = -d / 2 + ((i + 0.5) / rows) * d;
      g.fillRect(-w / 2, y - PX * 0.28, w, PX * 0.56);
    }
    g.restore();
    g.restore();
  }

  // Plätze (Dorfplatz, Hof)
  for (const p of zones.plazas ?? []) {
    blob(p.x, p.z, p.r * 1.25, GRASS.pathEdge, 0.5);
    g.filter = 'blur(1.5px)';
    g.fillStyle = GRASS.plaza;
    g.beginPath();
    g.ellipse(X(p.x), Z(p.z), p.r * PX, p.r * PX * (p.squash ?? 1), 0, 0, Math.PI * 2);
    g.fill();
    g.filter = 'none';
    // ein paar Pflastersteine
    for (let i = 0; i < p.r * p.r * 3; i++) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * p.r * 0.92;
      g.fillStyle = rgba(r() > 0.5 ? '#d6c194' : '#efe2c0', 0.8);
      g.beginPath();
      g.ellipse(X(p.x + Math.cos(a) * rr), Z(p.z + Math.sin(a) * rr * (p.squash ?? 1)), PX * 0.28, PX * 0.22, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Feldwege: weiche Kurven, Rand etwas dunkler, in der Mitte ein Grasstreifen
  for (const path of zones.paths ?? []) {
    const width = path.width ?? 2.2;
    const pts = path.pts ?? path;
    const stroke = (wid, style) => {
      g.strokeStyle = style;
      g.lineWidth = wid * PX;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(X(pts[0][0]), Z(pts[0][1]));
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const mz = (pts[i][1] + pts[i + 1][1]) / 2;
        g.quadraticCurveTo(X(pts[i][0]), Z(pts[i][1]), X(mx), Z(mz));
      }
      const last = pts[pts.length - 1];
      g.lineTo(X(last[0]), Z(last[1]));
      g.stroke();
    };
    // weiche Kanten (Unschärfe statt Treppenstufen, auch aus der Nähe)
    g.filter = 'blur(3px)';
    stroke(width + 1.2, rgba(GRASS.deep, 0.45));
    g.filter = 'blur(1.5px)';
    stroke(width + 0.3, GRASS.pathEdge);
    stroke(width, GRASS.path);
    g.filter = 'blur(4px)';
    stroke(width * 0.35, rgba('#ead3a3', 0.8));
    g.filter = 'none';
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function roundRect(g, x, y, w, h, rad) {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

// Fein gekachelte Struktur (Grautöne um 50 %): Halme und kleine Flecken. Wird mit der Leinwand multipliziert.
export function detailTexture() {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const r = rand(5);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < 40; i++) {
    const x = r() * n;
    const y = r() * n;
    const rad = 10 + r() * 30;
    const v = r() > 0.5 ? 145 : 112;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    for (const ox of [-n, 0, n]) {
      for (const oy of [-n, 0, n]) {
        g.save();
        g.translate(ox, oy);
        g.fillStyle = grd;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        g.restore();
      }
    }
  }
  for (let i = 0; i < 2600; i++) {
    const x = r() * n;
    const y = r() * n;
    const v = r() > 0.5 ? 95 + r() * 20 : 150 + r() * 25;
    g.strokeStyle = `rgba(${v},${v},${v},${0.35 + r() * 0.35})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Bodenmaterial: Leinwand (über das Spielfeld) × Detail (gekachelt). Außerhalb der Leinwand: Randfarbe.
export function groundMaterial(paint, opts = {}) {
  const span = 520; // Größe der Bodenplatte
  // UV der Bodenplatte: u = (x + 260) / 520, v = (260 - z) / 520 → auf den Leinwand-Bereich umrechnen
  const wx = PAINT.x1 - PAINT.x0;
  const wz = PAINT.z1 - PAINT.z0;
  paint.repeat.set(span / wx, span / wz);
  paint.offset.set(-(PAINT.x0 + span / 2) / wx, -(span / 2 - PAINT.z1) / wz);
  paint.flipY = true;
  const detail = detailTexture();
  const mat = new THREE.MeshStandardMaterial({ map: paint, roughness: 1, vertexColors: true, ...opts });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detail };
    sh.uniforms.detailScale = { value: new THREE.Vector2(wx / 6, wz / 6) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform vec2 detailScale;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float dt = texture2D(detailMap, vMapUv * detailScale).r;
        diffuseColor.rgb *= mix(0.62, 1.3, dt);`);
  };
  mat.customProgramCacheKey = () => 'ground-detail';
  return mat;
}
