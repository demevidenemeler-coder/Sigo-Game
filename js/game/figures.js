// 3D-Figuren im Spielzeug-Stil: Tiere, Menschen, Ladung.
// Tiere schauen nach vorne (+x, man sieht sie von der Seite), Menschen zur Kamera (+z).
// Alle stehen auf y = 0 und sind etwa 0,6–0,85 hoch.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import { woodTexture } from './textures.js';
import { mergeStatic } from './merge.js';
import { modelGeometry, MODEL_MATERIAL } from './models.js';

const mats = new Map();
function mat(color, roughness = 0.6) {
  const key = color + roughness;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return mats.get(key);
}

const geos = new Map();
function geo(key, make) {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
}
const sphere = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 18, 14));
const rbox = (w, h, d, r = 0.05) => geo(`b${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const cyl = (rt, rb, h) => geo(`c${rt},${rb},${h}`, () => new THREE.CylinderGeometry(rt, rb, h, 14));
const cone = (r, h) => geo(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 12));

function part(group, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geometry, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  group.add(m);
  return m;
}

// Augen: schwarze Kugel mit kleinem Glanzpunkt
function eyes(g, x, y, z, spread, facing = 'x') {
  for (const s of [1, -1]) {
    const px = facing === 'x' ? x : x + s * spread;
    const pz = facing === 'x' ? z + s * spread : z;
    part(g, sphere(0.032), '#1e1e1e', px, y, pz);
    part(g, sphere(0.011), '#ffffff', px + (facing === 'x' ? 0.022 : 0.01), y + 0.012, pz + (facing === 'x' ? s * 0.008 : 0.024));
  }
}

function legs(g, color, xs, zs, h, r = 0.045, hoof = null) {
  for (const x of xs) {
    for (const z of zs) {
      part(g, cyl(r, r, h), color, x, h / 2, z);
      if (hoof) part(g, cyl(r * 1.05, r * 1.05, 0.05), hoof, x, 0.025, z);
    }
  }
}

const SKIN = '#f3c9a5';

const BUILD = {
  kuh(g) {
    part(g, rbox(0.62, 0.34, 0.34, 0.1), '#ffffff', 0, 0.45, 0);
    for (const [x, y, z, s] of [[0.1, 0.5, 0.17, 1], [-0.18, 0.42, 0.17, 0.8], [-0.05, 0.5, -0.17, 1.1], [0.2, 0.4, -0.17, 0.7]]) {
      part(g, sphere(0.08), '#2b2b2b', x, y, z, s * 1.2, s, 0.25);
    }
    part(g, rbox(0.24, 0.24, 0.22, 0.07), '#ffffff', 0.37, 0.62, 0);
    part(g, rbox(0.1, 0.13, 0.2, 0.04), '#f2a7b5', 0.5, 0.56, 0);
    part(g, sphere(0.018), '#7a3b4a', 0.555, 0.57, 0.05);
    part(g, sphere(0.018), '#7a3b4a', 0.555, 0.57, -0.05);
    eyes(g, 0.47, 0.67, 0, 0.075);
    for (const s of [1, -1]) {
      const horn = part(g, cone(0.03, 0.12), '#efe3c4', 0.35, 0.77, s * 0.08);
      horn.rotation.x = -s * 0.5;
      part(g, sphere(0.05), '#ffffff', 0.33, 0.68, s * 0.15, 0.6, 0.4, 1);
    }
    legs(g, '#ffffff', [0.2, -0.2], [0.1, -0.1], 0.3, 0.045, '#4a4a4a');
    part(g, sphere(0.06), '#f2a7b5', -0.1, 0.27, 0);
    const tail = part(g, cyl(0.015, 0.015, 0.28), '#ffffff', -0.33, 0.43, 0);
    tail.rotation.z = 0.3;
    part(g, sphere(0.035), '#2b2b2b', -0.37, 0.3, 0);
  },

  schwein(g) {
    part(g, sphere(0.25), '#f4a7b9', 0, 0.35, 0, 1.35, 1, 1);
    part(g, sphere(0.17), '#f4a7b9', 0.33, 0.43, 0);
    const snout = part(g, cyl(0.075, 0.075, 0.07), '#ee8fa6', 0.48, 0.41, 0);
    snout.rotation.z = Math.PI / 2;
    part(g, sphere(0.018), '#8a3b50', 0.52, 0.42, 0.03);
    part(g, sphere(0.018), '#8a3b50', 0.52, 0.42, -0.03);
    eyes(g, 0.44, 0.5, 0, 0.07);
    for (const s of [1, -1]) {
      const ear = part(g, cone(0.06, 0.11), '#ee8fa6', 0.3, 0.6, s * 0.1);
      ear.rotation.x = -s * 0.4;
      ear.rotation.z = -0.3;
    }
    legs(g, '#f4a7b9', [0.17, -0.17], [0.1, -0.1], 0.16, 0.055);
    const tail = part(g, geo('pigtail', () => new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI * 1.6)), '#ee8fa6', -0.35, 0.45, 0);
    tail.rotation.y = Math.PI / 2;
  },

  schaf(g) {
    for (const [x, y, z, r] of [[0, 0.45, 0, 0.18], [0.15, 0.47, 0.06, 0.14], [0.15, 0.47, -0.06, 0.14], [-0.15, 0.46, 0.06, 0.15],
      [-0.15, 0.46, -0.06, 0.15], [0, 0.57, 0.08, 0.13], [0, 0.57, -0.08, 0.13], [0.05, 0.36, 0, 0.14]]) {
      part(g, sphere(r), '#f7f4ec', x, y, z);
    }
    part(g, sphere(0.12), '#3d3a38', 0.3, 0.58, 0, 1.2, 1, 0.9);
    part(g, sphere(0.1), '#f7f4ec', 0.25, 0.68, 0);
    eyes(g, 0.4, 0.62, 0, 0.06);
    for (const s of [1, -1]) part(g, sphere(0.05), '#3d3a38', 0.27, 0.6, s * 0.12, 0.6, 0.35, 1.2);
    legs(g, '#3d3a38', [0.14, -0.14], [0.08, -0.08], 0.28, 0.035);
  },

  hund(g) {
    const fur = '#c68a4e';
    part(g, rbox(0.46, 0.22, 0.22, 0.09), fur, 0, 0.36, 0);
    part(g, sphere(0.15), fur, 0.28, 0.53, 0);
    part(g, rbox(0.14, 0.1, 0.13, 0.04), '#e8c49a', 0.42, 0.49, 0);
    part(g, sphere(0.032), '#1e1e1e', 0.49, 0.52, 0);
    eyes(g, 0.39, 0.58, 0, 0.065);
    for (const s of [1, -1]) {
      const ear = part(g, sphere(0.07), '#8a5a33', 0.25, 0.52, s * 0.14, 0.6, 1.3, 0.35);
      ear.rotation.x = s * 0.2;
    }
    legs(g, fur, [0.15, -0.15], [0.08, -0.08], 0.26, 0.045);
    const tail = part(g, cyl(0.025, 0.02, 0.2), fur, -0.27, 0.5, 0);
    tail.rotation.z = 0.8;
    part(g, sphere(0.04), '#ffffff', 0.35, 0.43, 0, 1, 0.8, 1.5);
  },

  katze(g) {
    const fur = '#f0a04b';
    part(g, rbox(0.36, 0.2, 0.18, 0.08), fur, 0, 0.3, 0);
    part(g, sphere(0.14), fur, 0.22, 0.47, 0);
    part(g, sphere(0.07), '#fff3e6', 0.31, 0.43, 0, 0.8, 0.7, 1.2);
    part(g, sphere(0.02), '#e5738a', 0.355, 0.46, 0);
    eyes(g, 0.32, 0.5, 0, 0.06);
    for (const s of [1, -1]) {
      const ear = part(g, cone(0.05, 0.1), fur, 0.2, 0.61, s * 0.07);
      ear.rotation.x = -s * 0.25;
    }
    for (const x of [-0.08, 0.06]) part(g, sphere(0.05), '#d9822f', x, 0.39, 0, 0.5, 0.3, 1.9);
    legs(g, fur, [0.12, -0.12], [0.06, -0.06], 0.2, 0.035);
    const tail = part(g, cyl(0.025, 0.02, 0.32), fur, -0.2, 0.46, 0);
    tail.rotation.z = 0.35;
  },

  ente(g) {
    part(g, sphere(0.2), '#f7d33c', 0, 0.22, 0, 1.3, 0.9, 1);
    part(g, sphere(0.13), '#f7d33c', 0.18, 0.44, 0);
    part(g, rbox(0.14, 0.05, 0.1, 0.02), '#f08c2b', 0.33, 0.42, 0);
    eyes(g, 0.27, 0.49, 0, 0.06);
    const tail = part(g, cone(0.07, 0.12), '#f7d33c', -0.26, 0.3, 0);
    tail.rotation.z = 0.9;
    for (const s of [1, -1]) part(g, sphere(0.1), '#eec52e', -0.02, 0.26, s * 0.16, 1.3, 0.6, 0.35);
  },

  teddy(g) {
    const fur = '#a8703f';
    part(g, sphere(0.2), fur, 0, 0.24, 0, 1, 1.1, 0.9);
    part(g, sphere(0.12), '#d9a877', 0, 0.24, 0.1, 1, 1.1, 0.6);
    part(g, sphere(0.16), fur, 0, 0.55, 0);
    part(g, sphere(0.07), '#d9a877', 0, 0.51, 0.13, 1.1, 0.85, 0.8);
    part(g, sphere(0.028), '#2b1d12', 0, 0.54, 0.19);
    eyes(g, 0, 0.6, 0.13, 0.06, 'z');
    for (const s of [1, -1]) {
      part(g, sphere(0.06), fur, s * 0.12, 0.68, 0);
      part(g, sphere(0.03), '#d9a877', s * 0.12, 0.68, 0.03);
      part(g, sphere(0.07), fur, s * 0.2, 0.3, 0.04, 0.8, 1.3, 0.8);
      part(g, sphere(0.08), fur, s * 0.1, 0.08, 0.1, 1, 0.8, 1.3);
    }
    // Schleife
    for (const s of [1, -1]) part(g, sphere(0.04), '#e5484d', s * 0.05, 0.41, 0.12, 1.2, 0.8, 0.6);
  },

  kind(g) {
    for (const s of [1, -1]) {
      part(g, cyl(0.045, 0.045, 0.22), '#3b6fb5', s * 0.06, 0.11, 0);
      part(g, rbox(0.08, 0.05, 0.12, 0.02), '#3a3a3a', s * 0.06, 0.025, 0.02);
    }
    part(g, rbox(0.26, 0.3, 0.17, 0.07), '#e5484d', 0, 0.36, 0);
    const armL = new THREE.Group();
    armL.position.set(0.15, 0.47, 0);
    part(armL, cyl(0.035, 0.035, 0.22), '#e5484d', 0, -0.1, 0);
    part(armL, sphere(0.04), SKIN, 0, -0.22, 0);
    armL.rotation.z = 0.25;
    g.add(armL);
    // Winkender Arm
    const armR = new THREE.Group();
    armR.position.set(-0.15, 0.47, 0);
    part(armR, cyl(0.035, 0.035, 0.22), '#e5484d', 0, 0.1, 0);
    part(armR, sphere(0.04), SKIN, 0, 0.22, 0);
    armR.rotation.z = 0.5;
    g.add(armR);
    g.userData.waveArm = armR;
    part(g, sphere(0.15), SKIN, 0, 0.64, 0);
    part(g, geo('hair', () => new THREE.SphereGeometry(0.158, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), '#6b4226', 0, 0.65, -0.01);
    part(g, sphere(0.06), '#6b4226', 0, 0.68, -0.08, 1.8, 1, 1);
    eyes(g, 0, 0.65, 0.135, 0.055, 'z');
    for (const s of [1, -1]) part(g, sphere(0.03), '#f5a3a3', s * 0.085, 0.6, 0.12, 1, 0.7, 0.5);
    part(g, geo('smile', () => new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI)), '#8a3b3b', 0, 0.595, 0.145).rotation.z = Math.PI;
  },

  oma(g) {
    part(g, cyl(0.12, 0.2, 0.4), '#8b5bb5', 0, 0.2, 0);
    part(g, rbox(0.26, 0.2, 0.17, 0.07), '#b58ad6', 0, 0.45, 0);
    for (const s of [1, -1]) {
      const arm = part(g, cyl(0.035, 0.035, 0.22), '#b58ad6', s * 0.15, 0.4, 0.03);
      arm.rotation.z = s * 0.2;
      part(g, sphere(0.04), SKIN, s * 0.17, 0.29, 0.05);
    }
    part(g, sphere(0.14), SKIN, 0, 0.67, 0);
    part(g, geo('hairOma', () => new THREE.SphereGeometry(0.148, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45)), '#d9d9d9', 0, 0.68, -0.01);
    part(g, sphere(0.07), '#d9d9d9', 0, 0.8, -0.06);
    eyes(g, 0, 0.68, 0.125, 0.05, 'z');
    for (const s of [1, -1]) {
      part(g, geo('glass', () => new THREE.TorusGeometry(0.035, 0.007, 6, 16)), '#6b5a4a', s * 0.05, 0.68, 0.135);
    }
    part(g, geo('smile', () => new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI)), '#8a3b3b', 0, 0.62, 0.13).rotation.z = Math.PI;
  },

  kiste(g) {
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#c99a62', 'crate'), roughness: 0.8 });
    part(g, rbox(0.46, 0.4, 0.4, 0.02), wood, 0, 0.2, 0);
    const edge = '#8a5a33';
    for (const y of [0.03, 0.37]) {
      for (const z of [0.19, -0.19]) part(g, rbox(0.48, 0.05, 0.04, 0.01), edge, 0, y, z);
    }
    for (const x of [0.21, -0.21]) {
      for (const z of [0.19, -0.19]) part(g, rbox(0.05, 0.4, 0.05, 0.01), edge, x, 0.2, z);
    }
  },

  geschenk(g) {
    part(g, rbox(0.4, 0.34, 0.4, 0.03), '#e5484d', 0, 0.17, 0);
    part(g, rbox(0.42, 0.36, 0.08, 0.01), '#f5c53a', 0, 0.17, 0);
    part(g, rbox(0.08, 0.36, 0.42, 0.01), '#f5c53a', 0, 0.17, 0);
    for (const s of [1, -1]) {
      const bow = part(g, geo('bow', () => new THREE.TorusGeometry(0.07, 0.025, 8, 16)), '#f5c53a', s * 0.06, 0.4, 0);
      bow.rotation.y = Math.PI / 2;
      bow.rotation.x = s * 0.5;
    }
  },

  apfel(g) {
    part(g, sphere(0.22), new THREE.MeshStandardMaterial({ color: '#d93a2f', roughness: 0.35 }), 0, 0.22, 0, 1, 0.9, 1);
    part(g, cyl(0.015, 0.015, 0.1), '#6b4226', 0, 0.45, 0);
    const leaf = part(g, sphere(0.06), '#4fa65a', 0.05, 0.46, 0, 1.2, 0.3, 0.6);
    leaf.rotation.z = -0.4;
  },

  pferd(g) {
    const fur = '#9a6236';
    part(g, rbox(0.62, 0.3, 0.28, 0.12), fur, 0, 0.55, 0);
    const neck = part(g, rbox(0.14, 0.34, 0.16, 0.06), fur, 0.3, 0.76, 0);
    neck.rotation.z = -0.5;
    part(g, rbox(0.3, 0.15, 0.15, 0.06), fur, 0.46, 0.9, 0);
    part(g, rbox(0.1, 0.11, 0.14, 0.04), '#c9956a', 0.6, 0.87, 0);
    eyes(g, 0.48, 0.95, 0, 0.065);
    for (const s of [1, -1]) {
      const ear = part(g, cone(0.035, 0.09), fur, 0.38, 1.02, s * 0.05);
      ear.rotation.x = -s * 0.2;
    }
    // Mähne und Schweif
    for (let i = 0; i < 4; i++) part(g, sphere(0.05), '#3d2a1c', 0.22 + i * 0.06, 0.76 + i * 0.07, 0, 1, 1, 0.8);
    const tail = part(g, cyl(0.04, 0.02, 0.32), '#3d2a1c', -0.36, 0.48, 0);
    tail.rotation.z = 0.35;
    legs(g, fur, [0.22, -0.22], [0.09, -0.09], 0.42, 0.045, '#3d3d3d');
  },

  huhn(g) {
    part(g, sphere(0.17), '#f7f4ec', 0, 0.26, 0, 1.25, 1, 0.95);
    part(g, sphere(0.1), '#f7f4ec', 0.15, 0.45, 0);
    part(g, cone(0.035, 0.08), '#f0a030', 0.26, 0.44, 0).rotation.z = -Math.PI / 2;
    part(g, sphere(0.04), '#e5484d', 0.15, 0.56, 0, 1, 1.2, 0.5);
    part(g, sphere(0.03), '#e5484d', 0.22, 0.38, 0, 0.7, 1.2, 0.6);
    eyes(g, 0.21, 0.48, 0, 0.055);
    const tail = part(g, cone(0.08, 0.16), '#efe9dc', -0.2, 0.36, 0);
    tail.rotation.z = 0.7;
    legs(g, '#f0a030', [0.02], [0.05, -0.05], 0.12, 0.015);
  },

  hahn(g) {
    BUILD.huhn(g);
    for (let i = 0; i < 3; i++) part(g, sphere(0.035), '#e5484d', 0.1 + i * 0.05, 0.57 + (i === 1 ? 0.03 : 0), 0);
    const tail = part(g, cone(0.1, 0.26), '#3d6b4a', -0.23, 0.45, 0);
    tail.rotation.z = 0.5;
    part(g, cone(0.07, 0.2), '#d9822f', -0.2, 0.42, 0.04).rotation.z = 0.9;
  },

  hase(g) {
    const fur = '#d9cbb8';
    part(g, sphere(0.17), fur, 0, 0.2, 0, 1.2, 1, 0.95);
    part(g, sphere(0.12), fur, 0.16, 0.38, 0);
    eyes(g, 0.25, 0.42, 0, 0.055);
    part(g, sphere(0.02), '#e5738a', 0.28, 0.37, 0);
    for (const s of [1, -1]) {
      const ear = part(g, sphere(0.05), fur, 0.12, 0.58, s * 0.05, 0.6, 2.2, 0.6);
      ear.rotation.z = 0.2;
      ear.rotation.x = -s * 0.15;
      part(g, sphere(0.025), '#f2b8c2', 0.13, 0.58, s * 0.06, 0.4, 1.8, 0.4).rotation.z = 0.2;
    }
    part(g, sphere(0.06), '#ffffff', -0.2, 0.25, 0);
    for (const s of [1, -1]) part(g, sphere(0.06), fur, 0.1, 0.05, s * 0.08, 1.4, 0.6, 0.8);
  },

  frosch(g) {
    const green = '#5fae5a';
    part(g, sphere(0.18), green, 0, 0.16, 0, 1.15, 0.75, 1.05);
    for (const s of [1, -1]) {
      part(g, sphere(0.07), green, 0.08, 0.3, s * 0.09);
      part(g, sphere(0.04), '#ffffff', 0.12, 0.33, s * 0.09);
      part(g, sphere(0.022), '#1e1e1e', 0.15, 0.34, s * 0.09);
      part(g, sphere(0.07), green, -0.1, 0.07, s * 0.16, 1.4, 0.5, 0.8);
    }
    part(g, geo('fsmile', () => new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI)), '#2f6b30', 0.17, 0.17, 0).rotation.set(0, Math.PI / 2, Math.PI);
  },

  loewe(g) {
    const fur = '#e8b04a';
    part(g, rbox(0.5, 0.26, 0.26, 0.1), fur, 0, 0.42, 0);
    part(g, sphere(0.22), '#b5652a', 0.3, 0.6, 0, 0.8, 1, 1.05);
    part(g, sphere(0.15), fur, 0.38, 0.6, 0);
    part(g, sphere(0.06), '#f5d79a', 0.5, 0.56, 0, 1, 0.8, 1.2);
    part(g, sphere(0.03), '#3d2a1c', 0.55, 0.59, 0);
    eyes(g, 0.48, 0.66, 0, 0.065);
    for (const s of [1, -1]) part(g, sphere(0.05), fur, 0.33, 0.76, s * 0.11);
    legs(g, fur, [0.17, -0.17], [0.09, -0.09], 0.3, 0.05);
    const tail = part(g, cyl(0.02, 0.02, 0.35), fur, -0.32, 0.45, 0);
    tail.rotation.z = 0.6;
    part(g, sphere(0.05), '#b5652a', -0.46, 0.34, 0);
  },

  elefant(g) {
    const grey = '#9aa3ad';
    part(g, sphere(0.3), grey, 0, 0.5, 0, 1.25, 0.95, 0.95);
    part(g, sphere(0.2), grey, 0.36, 0.62, 0);
    const trunk = part(g, cyl(0.06, 0.04, 0.35), grey, 0.52, 0.45, 0);
    trunk.rotation.z = 0.35;
    for (const s of [1, -1]) {
      part(g, sphere(0.16), '#8a929c', 0.3, 0.64, s * 0.2, 0.4, 1.1, 1);
      part(g, cone(0.025, 0.1), '#f5f1ea', 0.48, 0.5, s * 0.08).rotation.z = -1.2;
    }
    eyes(g, 0.49, 0.7, 0, 0.09);
    legs(g, grey, [0.2, -0.2], [0.13, -0.13], 0.28, 0.08);
    const tail = part(g, cyl(0.015, 0.015, 0.2), grey, -0.38, 0.45, 0);
    tail.rotation.z = 0.3;
  },

  giraffe(g) {
    const fur = '#f2c45a';
    part(g, rbox(0.4, 0.24, 0.22, 0.09), fur, 0, 0.62, 0);
    const neck = part(g, cyl(0.06, 0.08, 0.6), fur, 0.18, 0.98, 0);
    neck.rotation.z = -0.25;
    part(g, rbox(0.2, 0.12, 0.12, 0.05), fur, 0.3, 1.3, 0);
    eyes(g, 0.32, 1.35, 0, 0.055);
    for (const s of [1, -1]) part(g, cyl(0.015, 0.015, 0.1), '#8a5a33', 0.25, 1.41, s * 0.04);
    for (const [x, y, z] of [[0.05, 0.68, 0.12], [-0.1, 0.6, 0.12], [0.1, 0.58, -0.12], [-0.05, 0.68, -0.12], [0.16, 0.92, 0.06], [0.22, 1.1, -0.05]]) {
      part(g, sphere(0.04), '#a8703f', x, y, z, 1, 1, 0.3);
    }
    legs(g, fur, [0.14, -0.14], [0.07, -0.07], 0.5, 0.03, '#5c3b22');
  },

  pinguin(g) {
    part(g, sphere(0.18), '#2b2f36', 0, 0.28, 0, 0.95, 1.4, 0.95);
    part(g, sphere(0.15), '#ffffff', 0.1, 0.26, 0, 0.62, 1.25, 0.85);
    part(g, cone(0.04, 0.1), '#f0a030', 0.2, 0.45, 0).rotation.z = -Math.PI / 2;
    eyes(g, 0.15, 0.5, 0, 0.055);
    for (const s of [1, -1]) {
      const wing = part(g, sphere(0.06), '#2b2f36', 0, 0.3, s * 0.16, 0.7, 2, 0.3);
      wing.rotation.x = s * 0.3;
      part(g, sphere(0.05), '#f0a030', 0.06, 0.02, s * 0.06, 1.4, 0.4, 1);
    }
  },

  papa(g) {
    for (const s of [1, -1]) {
      part(g, cyl(0.05, 0.05, 0.32), '#3a3a3a', s * 0.07, 0.16, 0);
      part(g, rbox(0.09, 0.05, 0.14, 0.02), '#5c3b22', s * 0.07, 0.025, 0.02);
    }
    part(g, rbox(0.3, 0.36, 0.19, 0.08), '#4fa65a', 0, 0.5, 0);
    for (const s of [1, -1]) {
      const arm = part(g, cyl(0.04, 0.04, 0.28), '#4fa65a', s * 0.18, 0.48, 0);
      arm.rotation.z = s * 0.15;
      part(g, sphere(0.045), SKIN, s * 0.2, 0.33, 0);
    }
    part(g, sphere(0.16), SKIN, 0, 0.83, 0);
    part(g, geo('hairPapa', () => new THREE.SphereGeometry(0.165, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42)), '#3d2a1c', 0, 0.84, -0.01);
    part(g, sphere(0.12), '#3d2a1c', 0, 0.75, 0.06, 1.1, 0.7, 0.7);
    part(g, sphere(0.05), SKIN, 0, 0.79, 0.14, 1, 0.6, 0.6);
    eyes(g, 0, 0.86, 0.14, 0.06, 'z');
  },

  ball(g) {
    const colors = ['#e5484d', '#f5f1ea', '#3b7cc9', '#f2c832'];
    for (let i = 0; i < 4; i++) {
      const seg = part(g, geo(`ball${i}`, () => new THREE.SphereGeometry(0.2, 16, 12, (i * Math.PI) / 2, Math.PI / 2)), colors[i], 0, 0.2, 0);
      seg.material = new THREE.MeshPhysicalMaterial({ color: colors[i], roughness: 0.3, clearcoat: 1 });
    }
  },

  milch(g) {
    const metal = new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.3, metalness: 0.85 });
    part(g, cyl(0.15, 0.15, 0.36), metal, 0, 0.18, 0);
    part(g, cyl(0.08, 0.15, 0.1), metal, 0, 0.41, 0);
    part(g, cyl(0.1, 0.1, 0.06), metal, 0, 0.48, 0);
    part(g, geo('handle', () => new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI)), metal, 0, 0.5, 0);
    part(g, cyl(0.152, 0.152, 0.08), '#3b7cc9', 0, 0.22, 0);
  },

  // Lokführer mit Mütze (nur für die Lok)
  fahrer(g) {
    part(g, rbox(0.26, 0.28, 0.2, 0.07), '#2f5c9e', 0, 0.3, 0);
    part(g, sphere(0.14), SKIN, 0, 0.56, 0);
    part(g, cyl(0.15, 0.15, 0.08), '#2f5c9e', 0, 0.66, 0);
    part(g, rbox(0.1, 0.02, 0.2, 0.01), '#1f3f70', 0.12, 0.63, 0);
    part(g, sphere(0.06), '#ffffff', 0, 0.48, 0.1, 1.4, 0.6, 0.6); // Bart
    eyes(g, 0.12, 0.58, 0, 0.05);
    const arm = new THREE.Group();
    arm.position.set(0, 0.4, 0.13);
    part(arm, cyl(0.035, 0.035, 0.22), '#2f5c9e', 0, 0.1, 0);
    part(arm, sphere(0.04), SKIN, 0, 0.22, 0);
    arm.rotation.x = -0.3;
    g.add(arm);
    g.userData.waveArm = arm;
  },
};

// Tiere drehen den Kopf zur Kamera ein wenig, damit man die Gesichter sieht
const TURN = Object.fromEntries(['kuh', 'schwein', 'schaf', 'hund', 'katze', 'ente', 'pferd', 'huhn', 'hahn', 'hase', 'frosch', 'loewe', 'elefant', 'giraffe', 'pinguin'].map((id) => [id, id === 'pinguin' ? 1.0 : 0.35]));

// ---------- Münder (gehen auf und zu: Füttern) ----------

// Mensch/Teddy schauen zur Kamera (+z): [x, y, z, Größe]
const MOUTH_HUMAN = { kind: [0, 0.595, 0.15, 0.036], oma: [0, 0.62, 0.14, 0.034], papa: [0, 0.765, 0.157, 0.042], teddy: [0, 0.485, 0.178, 0.04] };
// Tiere: Größe der Mundöffnung
const MOUTH_SIZE = {
  kuh: 0.062, schwein: 0.052, schaf: 0.046, pferd: 0.07, hund: 0.05, katze: 0.04, huhn: 0.034, hahn: 0.038, ente: 0.05,
  hase: 0.034, frosch: 0.06, loewe: 0.07, elefant: 0.062, giraffe: 0.05, pinguin: 0.04,
};
const mouthAnchors = new Map();
const MOUTH_MAT = new THREE.MeshStandardMaterial({ color: '#5a1620', roughness: 0.7 });
const TONGUE_MAT = new THREE.MeshStandardMaterial({ color: '#f07a8c', roughness: 0.6 });
const unit = new THREE.SphereGeometry(1, 16, 12);

// Vorderster Punkt des Tiers (Schnauze/Schnabel): dort sitzt der Mund
function animalAnchor(g, id) {
  if (mouthAnchors.has(id)) return mouthAnchors.get(id);
  const T = TURN[id] ?? 0.35;
  const dir = new THREE.Vector3(Math.cos(T), 0, Math.sin(T));
  const pts = [];
  const v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) pts.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).clone());
  });
  const proj = pts.map((p) => p.dot(dir));
  const pmax = Math.max(...proj);
  const cluster = pts.filter((_, i) => proj[i] > pmax - 0.06);
  const c = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of cluster) {
    c.add(p);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  c.divideScalar(cluster.length);
  c.y = minY + (maxY - minY) * 0.42;
  const out = { pos: c, dir };
  mouthAnchors.set(id, out);
  return out;
}

function addMouth(g, id) {
  const human = MOUTH_HUMAN[id];
  const size = human ? human[3] : MOUTH_SIZE[id] * 1.3;
  if (!size) return;
  const holder = new THREE.Group();
  const mouth = new THREE.Mesh(unit, MOUTH_MAT);
  const tongue = new THREE.Mesh(unit, TONGUE_MAT);
  holder.add(mouth, tongue);
  if (human) {
    holder.position.set(human[0], human[1], human[2]);
  } else {
    const a = animalAnchor(g, id);
    holder.position.copy(a.pos).addScaledVector(a.dir, 0.002);
    holder.rotation.y = -Math.atan2(a.dir.z, a.dir.x); // +x des Mundes zeigt nach vorne
  }
  holder.visible = false;
  g.add(holder);
  const set = (open) => {
    const o = THREE.MathUtils.clamp(open, 0, 1);
    holder.visible = o > 0.04;
    if (!holder.visible) return;
    if (human) {
      mouth.scale.set(size * (0.55 + 0.45 * o), size * 0.9 * o, size * 0.35);
      tongue.scale.set(size * 0.4, size * 0.22 * o, size * 0.2);
      tongue.position.set(0, -size * 0.45 * o, size * 0.1);
    } else {
      // von der Seite gesehen: eine dunkle Öffnung an der Schnauzenspitze, die sich nach unten und vorne aufmacht
      mouth.scale.set(size * (0.35 + 0.35 * o), size * 1.05 * o, size * 0.85 * (0.5 + 0.5 * o));
      mouth.position.set(size * 0.1, -size * 0.15 * o, 0);
      tongue.scale.set(size * 0.32, size * 0.2 * o, size * 0.4);
      tongue.position.set(size * 0.1, -size * 0.62 * o, 0);
    }
  };
  g.userData.setMouth = set;
  g.userData.mouthHolder = holder;
}

export function buildFigure(id) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  const model = modelGeometry(id);
  if (model) {
    // Blender-Modell: ein einziges Teil (weicher, schöner, und billiger zu zeichnen)
    const m = new THREE.Mesh(model, MODEL_MATERIAL);
    m.castShadow = true;
    inner.add(m);
  } else {
    BUILD[id](inner);
  }
  inner.rotation.y = -(TURN[id] ?? 0);
  g.add(inner);
  g.userData.figure = id;
  g.userData.waveArm = inner.userData.waveArm;
  g.updateMatrixWorld(true);
  g.userData.box = new THREE.Box3().setFromObject(g);
  g.userData.top = g.userData.box.max.y;
  addMouth(g, id);
  // Leistung: unbewegliche Teile zusammenfassen (Winke-Arm und Mund bleiben beweglich)
  mergeStatic(g, (o) => o === g.userData.waveArm || o === g.userData.mouthHolder);
  return g;
}

export function hasFigure(id) {
  return id in BUILD;
}

// ---------- Sprechblase mit Zielfarbe (zu welchem Bahnhof die Figur möchte) ----------

const bubbleCache = new Map();
function bubbleMaterial(hex) {
  if (!bubbleCache.has(hex)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(64, 56, 48, 0, Math.PI * 2);
    g.moveTo(50, 98);
    g.lineTo(64, 124);
    g.lineTo(78, 98);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(64, 56, 48, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hex;
    g.beginPath();
    g.arc(64, 56, 34, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    bubbleCache.set(hex, new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  }
  return bubbleCache.get(hex);
}

// hex = null entfernt die Blase
export function setBubble(fig, hex) {
  if (fig.userData.bubble) {
    fig.remove(fig.userData.bubble);
    fig.userData.bubble = null;
  }
  if (!hex) return;
  const s = new THREE.Sprite(bubbleMaterial(hex));
  s.scale.setScalar(0.8);
  s.position.y = fig.userData.top + 0.42;
  s.center.set(0.5, 0.1);
  s.renderOrder = 5;
  s.userData.owner = fig;
  fig.add(s);
  fig.userData.bubble = s;
}
