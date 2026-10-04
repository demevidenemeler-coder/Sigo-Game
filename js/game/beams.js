// Scheinwerfer-Licht nachts: sichtbarer Lichtkegel + heller Fleck auf dem Boden (ohne teure echte Lichter).
// Alle Kegel teilen sich wenige Materialien; ihre Helligkeit folgt der Dunkelheit (setBeamGlow).

import * as THREE from 'three';

function gradientTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // alphaMap liest die Helligkeit (Grün-Kanal): schwarz = durchsichtig, weiß = voll
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  draw(g, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Kegel: hell am Scheinwerfer, zum Ende hin ausblendend; zu den Rändern weicher
const coneTex = gradientTexture((g, n) => {
  const grd = g.createLinearGradient(0, 0, 0, n);
  grd.addColorStop(0, 'rgb(255,255,255)'); // oben = an der Lampe
  grd.addColorStop(0.45, 'rgb(90,90,90)');
  grd.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
});
const poolTex = gradientTexture((g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgb(255,255,255)');
  grd.addColorStop(0.5, 'rgb(115,115,115)');
  grd.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, n, n);
});

const mats = [];
function beamMat(color, map, base) {
  const m = new THREE.MeshBasicMaterial({
    color, alphaMap: map, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  m.userData.base = base;
  mats.push(m);
  return m;
}
const coneMat = beamMat('#fff1c4', coneTex, 0.28);
const poolMat = beamMat('#ffe9b0', poolTex, 0.55);
const coneMatCar = beamMat('#fff6dd', coneTex, 0.18);
const poolMatCar = beamMat('#fff2cc', poolTex, 0.3);

const groups = [];
const lampPoolMat = beamMat('#ffc977', poolTex, 0.5);

// Warmer Lichtschein auf dem Boden (z. B. unter einer Laterne)
export function makeGlowPool(radius = 2.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), lampPoolMat);
  m.position.y = 0.05;
  m.renderOrder = 4;
  m.visible = false;
  m.userData.noMerge = true;
  m.raycast = () => {};
  groups.push(m);
  return m;
}

/**
 * Scheinwerfer-Gruppe: zeigt nach +x, Ursprung = Höhe der Lampe über dem Boden (y).
 * length/width in Welt-Einheiten. kind: 'train' | 'car'
 */
export function makeBeam({ length = 9, width = 2.6, height = 1.1, kind = 'train' } = {}) {
  const g = new THREE.Group();
  const car = kind === 'car';
  // Kegel: offener Zylinder (oben schmal = Lampe), liegt entlang +x, leicht nach unten geneigt
  const geo = new THREE.CylinderGeometry(car ? 0.08 : 0.18, width / 2, length, 20, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateZ(Math.PI / 2); // Spitze am Ursprung, Kegel öffnet nach +x
  const cone = new THREE.Mesh(geo, car ? coneMatCar : coneMat);
  cone.rotation.z = -Math.atan2(height * 0.9, length); // trifft vorne den Boden
  cone.position.y = height;
  cone.renderOrder = 5;
  g.add(cone);
  // Lichtfleck auf dem Boden
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(length * 0.9, width * 1.3).rotateX(-Math.PI / 2), car ? poolMatCar : poolMat);
  pool.position.set(length * 0.55, 0.06, 0);
  pool.renderOrder = 4;
  g.add(pool);
  g.visible = false;
  g.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
    o.userData.noMerge = true;
    o.raycast = () => {}; // nicht antippbar
  });
  groups.push(g);
  return g;
}

// Helligkeit aller Scheinwerfer (0 = Tag, 1 = Nacht/Tunnel)
export function setBeamGlow(glow) {
  for (const m of mats) m.opacity = m.userData.base * glow;
  const on = glow > 0.03;
  for (const g of groups) g.visible = on && g.userData.enabled !== false;
}
