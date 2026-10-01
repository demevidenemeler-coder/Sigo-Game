// Verspielte Radmuster (Werkstatt-Fach „Räder“). Jedes Muster ist ein Bild auf der Radscheibe;
// die Grundfarbe der Scheibe kommt aus der Farbe „Räder“ (anmalbar). „speichen“ = klassische 3D-Speichen.

import * as THREE from 'three';

export const WHEEL_STYLES = ['speichen', 'stern', 'herz', 'blume', 'punkte', 'regenbogen', 'sonne', 'spirale', 'smiley', 'donut', 'ball', 'zahnrad'];

const S = 256;
const C = S / 2;

function star(g, cx, cy, ro, ri, n, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function heart(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.9);
  g.bezierCurveTo(cx - s * 1.4, cy + s * 0.1, cx - s * 0.9, cy - s * 1.0, cx, cy - s * 0.35);
  g.bezierCurveTo(cx + s * 0.9, cy - s * 1.0, cx + s * 1.4, cy + s * 0.1, cx, cy + s * 0.9);
  g.closePath();
}

const DRAW = {
  stern(g) {
    g.fillStyle = '#fff6c2';
    star(g, C, C, 105, 45, 5);
    g.fill();
    g.fillStyle = '#ffd23a';
    star(g, C, C, 70, 30, 5);
    g.fill();
  },
  herz(g) {
    g.fillStyle = '#ff5a7a';
    heart(g, C, C + 8, 78);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(C - 40, C - 28, 16, 10, -0.6, 0, Math.PI * 2);
    g.fill();
  },
  blume(g) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(C + Math.cos(a) * 58, C + Math.sin(a) * 58, 40, 26, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffc93a';
    g.beginPath();
    g.arc(C, C, 38, 0, Math.PI * 2);
    g.fill();
  },
  punkte(g) {
    g.fillStyle = '#ffffff';
    for (const [r, n, size] of [[0, 1, 22], [62, 6, 17], [104, 10, 13]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r * 0.01;
        g.beginPath();
        g.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, size, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
  regenbogen(g) {
    const cols = ['#e5484d', '#ee8a2b', '#f5d33a', '#5fbf4f', '#3b8fd9', '#8b5bb5'];
    cols.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(C, C, 124 - i * 18, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(C, C, 16, 0, Math.PI * 2);
    g.fill();
  },
  sonne(g) {
    g.fillStyle = '#ffb52e';
    star(g, C, C, 124, 70, 12, 0);
    g.fill();
    g.fillStyle = '#ffe14a';
    g.beginPath();
    g.arc(C, C, 72, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a3a1a';
    for (const x of [-24, 24]) {
      g.beginPath();
      g.arc(C + x, C - 14, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#5a3a1a';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(C, C + 4, 30, 0.25 * Math.PI, 0.75 * Math.PI);
    g.stroke();
  },
  spirale(g) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    for (let t = 0; t < 1; t += 0.005) {
      const a = t * Math.PI * 7;
      const r = 6 + t * 112;
      g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    g.stroke();
  },
  smiley(g) {
    g.fillStyle = '#ffe14a';
    g.beginPath();
    g.arc(C, C, 112, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b2b2b';
    for (const x of [-38, 38]) {
      g.beginPath();
      g.ellipse(C + x, C - 26, 12, 18, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ff8fa3';
    for (const x of [-66, 66]) {
      g.beginPath();
      g.arc(C + x, C + 18, 16, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#2b2b2b';
    g.lineWidth = 11;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(C, C + 6, 52, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  },
  donut(g) {
    g.fillStyle = '#d9a066';
    g.beginPath();
    g.arc(C, C, 120, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff8fc0';
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 104 + Math.sin(a * 7) * 8;
      g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    g.fill();
    const cols = ['#ffffff', '#3b8fd9', '#f5d33a', '#5fbf4f', '#e5484d'];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 50 + rnd() * 50;
      g.save();
      g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r);
      g.rotate(rnd() * Math.PI);
      g.fillStyle = cols[i % cols.length];
      g.fillRect(-9, -3, 18, 6);
      g.restore();
    }
    // Loch in der Mitte
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(C, C, 36, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  },
  ball(g) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(C, C, 122, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b2b2b';
    const pent = (cx, cy, r, rot) => {
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * Math.PI * 2;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    };
    pent(C, C, 34, -Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + Math.PI / 5;
      pent(C + Math.cos(a) * 104, C + Math.sin(a) * 104, 30, a);
    }
  },
  zahnrad(g) {
    g.fillStyle = '#e3b341';
    g.beginPath();
    const teeth = 12;
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const r = i % 4 < 2 ? 122 : 100;
      g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(C + Math.cos(a) * 58, C + Math.sin(a) * 58, 20, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#c3beb5';
    g.beginPath();
    g.arc(C, C, 22, 0, Math.PI * 2);
    g.fill();
  },
};

const matCache = new Map();
export function wheelDecalMaterial(style) {
  if (!DRAW[style]) return null;
  if (!matCache.has(style)) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    DRAW[style](c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    matCache.set(style, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
  }
  return matCache.get(style);
}
