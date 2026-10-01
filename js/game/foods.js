// Futter zum Tiere-Füttern: kleine 3D-Modelle im Spielzeug-Stil (etwa 0,3–0,45 groß, stehen auf y = 0).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';

const mats = new Map();
function mat(color, roughness = 0.55, extra = {}) {
  const key = color + roughness + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  return mats.get(key);
}

function part(g, geometry, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  g.add(m);
  return m;
}

const BUILD = {
  heu(g) {
    part(g, new RoundedBoxGeometry(0.42, 0.26, 0.3, 3, 0.06), '#e2c15a', 0, 0.13, 0);
    // abstehende Halme
    for (let i = 0; i < 14; i++) {
      const h = part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), i % 2 ? '#d4ae45' : '#efd57a', (Math.random() - 0.5) * 0.4, 0.13 + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.28);
      h.rotation.set(Math.random() * 3, 0, Math.random() * 3);
    }
    for (const x of [-0.1, 0.1]) part(g, new THREE.BoxGeometry(0.03, 0.27, 0.31), '#c8453a', x, 0.13, 0);
  },
  karotte(g) {
    const body = part(g, new THREE.ConeGeometry(0.075, 0.4, 14), '#f07a1f', 0, 0.14, 0);
    body.rotation.z = Math.PI / 2 + 0.3;
    for (let i = 0; i < 3; i++) {
      const l = part(g, new THREE.ConeGeometry(0.025, 0.18, 6), '#4fa65a', -0.2 - Math.cos(i) * 0.04, 0.24 + i * 0.02, (i - 1) * 0.04);
      l.rotation.z = 0.9 + (i - 1) * 0.35;
    }
  },
  apfel(g) {
    part(g, new THREE.SphereGeometry(0.15, 20, 16), mat('#e03a3e', 0.35), 0, 0.15, 0, 1, 0.92, 1);
    part(g, new THREE.CylinderGeometry(0.012, 0.016, 0.08, 6), '#6b4a2b', 0, 0.3, 0);
    part(g, new THREE.SphereGeometry(0.05, 10, 8), '#4fa65a', 0.05, 0.31, 0, 1.2, 0.3, 0.6).rotation.z = -0.5;
  },
  banane(g) {
    const b = part(g, new THREE.TorusGeometry(0.17, 0.045, 10, 20, 2.3), mat('#f5d33a', 0.45), 0, 0.22, 0, 1, 1, 1.2);
    b.rotation.z = Math.PI + 0.42;
    for (const a of [0.42 + Math.PI, 0.42 + Math.PI + 2.3]) part(g, new THREE.SphereGeometry(0.03, 8, 6), '#6b4a2b', Math.cos(a) * 0.17, 0.22 + Math.sin(a) * 0.17, 0);
  },
  koerner(g) {
    const pts = [[0, 0], [0.16, 0.01], [0.2, 0.1], [0.19, 0.11]].map(([x, y]) => new THREE.Vector2(x, y));
    part(g, new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: '#3b7cc9', roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.15;
      part(g, new THREE.SphereGeometry(0.026, 6, 5), i % 3 ? '#f2c832' : '#d9a23a', Math.cos(a) * r, 0.1 + (0.15 - r) * 0.35 + Math.random() * 0.02, Math.sin(a) * r);
    }
  },
  fisch(g) {
    part(g, new THREE.SphereGeometry(0.12, 18, 14), mat('#7fa8c9', 0.25, { metalness: 0.4 }), 0, 0.13, 0, 1.6, 0.85, 0.55);
    const tail = part(g, new THREE.ConeGeometry(0.08, 0.14, 4), '#5f8bb0', -0.24, 0.13, 0);
    tail.rotation.z = Math.PI / 2;
    tail.scale.set(1, 1, 0.4);
    for (const z of [0.06, -0.06]) part(g, new THREE.SphereGeometry(0.02, 8, 6), '#1e1e1e', 0.13, 0.16, z);
  },
  knochen(g) {
    const bone = mat('#f3ecdc', 0.5);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), bone, 0, 0.07, 0).rotation.z = Math.PI / 2;
    for (const x of [0.18, -0.18]) for (const z of [0.04, -0.04]) part(g, new THREE.SphereGeometry(0.05, 10, 8), bone, x, 0.07, z);
  },
  fleisch(g) {
    part(g, new THREE.SphereGeometry(0.13, 16, 12), '#a8452f', 0.04, 0.13, 0, 1.25, 0.9, 0.9);
    const bone = mat('#f3ecdc', 0.5);
    part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), bone, -0.17, 0.13, 0).rotation.z = Math.PI / 2;
    for (const z of [0.03, -0.03]) part(g, new THREE.SphereGeometry(0.035, 8, 6), bone, -0.25, 0.13, z);
  },
  blatt(g) {
    const stick = part(g, new THREE.CylinderGeometry(0.015, 0.02, 0.42, 6), '#7a5232', 0, 0.2, 0);
    stick.rotation.z = 0.25;
    for (let i = 0; i < 5; i++) {
      const y = 0.1 + i * 0.07;
      const side = i % 2 ? 1 : -1;
      const l = part(g, new THREE.SphereGeometry(0.06, 10, 8), i % 2 ? '#4fa65a' : '#6fbf5a', -0.05 * (y - 0.2) + side * 0.07, y, 0, 1.4, 0.35, 0.9);
      l.rotation.z = side * 0.6;
    }
  },
  fliege(g) {
    part(g, new THREE.SphereGeometry(0.07, 14, 10), '#2b2b2b', 0, 0.16, 0, 1.3, 1, 1);
    for (const z of [0.04, -0.04]) part(g, new THREE.SphereGeometry(0.028, 8, 6), '#c8453a', 0.08, 0.18, z);
    const wing = new THREE.MeshStandardMaterial({ color: '#dff1ff', transparent: true, opacity: 0.6, roughness: 0.1 });
    for (const z of [0.07, -0.07]) {
      const w = part(g, new THREE.SphereGeometry(0.07, 10, 8), wing, -0.02, 0.24, z, 1, 0.15, 0.6);
      w.rotation.x = Math.sign(z) * 0.5;
    }
  },
};

export function buildFood(id) {
  const g = new THREE.Group();
  BUILD[id](g);
  g.userData.food = id;
  return g;
}

// Hauptfarbe (für Krümel beim Fressen)
export const FOOD_COLOR = {
  heu: '#e2c15a', karotte: '#f07a1f', apfel: '#e03a3e', banane: '#f5d33a', koerner: '#f2c832',
  fisch: '#7fa8c9', knochen: '#f3ecdc', fleisch: '#a8452f', blatt: '#4fa65a', fliege: '#2b2b2b',
};
