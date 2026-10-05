// Modelle aus Blender (tools/blender/*.py → models/*.sigm): ein Mesh mit Eckfarben, ein Material.
// Werden beim Start einmal geladen; fehlt eines (z. B. kaputter Download), baut figures.js die alte Figur.

import * as THREE from 'three';

export const MODEL_IDS = ['kuh', 'schwein', 'schaf', 'hund', 'katze', 'ente', 'pferd', 'huhn', 'hahn', 'hase', 'frosch', 'loewe', 'elefant', 'giraffe', 'pinguin', 'affe', 'teddy', 'kind', 'oma', 'papa', 'fahrer',
  // Entdecker-Tiere (Album)
  'fuchs', 'igel', 'eichhoernchen', 'storch', 'fisch', 'maulwurf', 'reh', 'eule', 'schnecke', 'biber'];

const geometries = new Map();

// sRGB-Byte → linearer Wert (three.js rechnet mit linearen Eckfarben)
const LIN = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

export function parseSigm(buf) {
  const dv = new DataView(buf);
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'SIGM') throw new Error('kein SIGM');
  const nv = dv.getUint32(4, true);
  const ni = dv.getUint32(8, true);
  let off = 12;
  const pos = new Float32Array(buf.slice(off, off + nv * 12));
  off += nv * 12;
  const n8 = new Int8Array(buf, off, nv * 3);
  off += nv * 3;
  const c8 = new Uint8Array(buf, off, nv * 3);
  off += nv * 3;
  off += off % 2;
  const index = new Uint16Array(buf.slice(off, off + ni * 2));
  const nor = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) {
    nor[i] = n8[i] / 127;
    col[i] = LIN[c8[i]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export async function preloadModels() {
  await Promise.all(MODEL_IDS.map(async (id) => {
    try {
      const res = await fetch(`models/${id}.sigm`);
      if (!res.ok) return;
      geometries.set(id, parseSigm(await res.arrayBuffer()));
    } catch {
      // ohne Modell geht es mit der gebauten Figur weiter
    }
  }));
}

export const modelGeometry = (id) => geometries.get(id);

export const MODEL_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
