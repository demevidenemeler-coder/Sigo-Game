// Spielzimmer-Werkstatt: weicher Teppich unter den Gleisen, Sonnenflecken vom Fenster und Spielsachen im Hintergrund.
// Alles ruhig in den Farben, damit der Zug im Mittelpunkt bleibt.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Teppich: abgerundetes Rechteck, ruhige Grundfarbe, bunter Rand mit Punkten
function rugTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    const rr = (x, y, ww, hh, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + ww, y, x + ww, y + hh, r);
      g.arcTo(x + ww, y + hh, x, y + hh, r);
      g.arcTo(x, y + hh, x, y, r);
      g.arcTo(x, y, x + ww, y, r);
      g.closePath();
    };
    g.clearRect(0, 0, w, h);
    rr(4, 4, w - 8, h - 8, 120);
    g.fillStyle = '#f2c86b';
    g.fill();
    rr(26, 26, w - 52, h - 52, 100);
    g.fillStyle = '#e06b52';
    g.fill();
    rr(44, 44, w - 88, h - 88, 86);
    g.fillStyle = '#5b9bb3';
    g.fill();
    // Punkte im Rand
    const colors = ['#ffffff', '#3b7cc9', '#f5d33a', '#4fa65a'];
    let i = 0;
    for (let x = 140; x < w - 140; x += 46) {
      for (const y of [15, h - 15]) {
        g.fillStyle = colors[i++ % colors.length];
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // leise Muster in der Mitte: Wolken und Sterne
    g.globalAlpha = 0.35;
    g.fillStyle = '#ffffff';
    for (const [x, y, s] of [[200, 150, 1], [780, 360, 1.2], [520, 120, 0.8], [330, 380, 0.9]]) {
      for (const [dx, dy, r] of [[0, 0, 26], [28, -8, 32], [58, 0, 24]]) {
        g.beginPath();
        g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = '#fff6c4';
    for (const [x, y] of [[640, 300], [130, 300], [880, 150], [430, 250]]) {
      g.beginPath();
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 ? 9 : 22;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.fill();
    }
    g.globalAlpha = 1;
  });
}

function letterTexture(letter, bg, fg) {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, w);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, w - 20);
    g.fillStyle = fg;
    g.font = 'bold 84px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, w / 2, w / 2 + 6);
  });
}

function sunTexture() {
  return canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,240,200,1)');
    grd.addColorStop(0.6, 'rgba(255,240,200,0.6)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

function mesh(parent, geo, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function decorateWorkshop(scene) {
  const g = new THREE.Group();
  scene.add(g);

  // Teppich (liegt flach, knapp über dem Boden; die Gleise liegen darauf)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.8), new THREE.MeshStandardMaterial({
    map: rugTexture(), transparent: true, alphaTest: 0.5, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, -0.3);
  rug.receiveShadow = true;
  g.add(rug);

  // Sonnenflecken vom Fenster (weich, schräg)
  const sunMat = new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z] of [[-9, -4.2], [6, -4.6]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 3.2), sunMat);
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = 0.35;
    s.position.set(x, 0.03, z);
    g.add(s);
  }

  // Bauklötze mit Buchstaben (ein kleiner Turm und ein paar lose)
  const blocks = [
    ['A', '#e5484d', -9.6, 0.35, -5.2, 0.2],
    ['B', '#3b7cc9', -8.8, 0.35, -5.6, -0.3],
    ['C', '#f2c832', -9.2, 1.05, -5.4, 0.5],
    ['S', '#4fa65a', -7.4, 0.35, -6.2, 0.7],
    ['1', '#8b5bb5', 9.4, 0.35, -5.6, -0.2],
    ['2', '#ee8a2b', 10.2, 0.35, -5.0, 0.4],
  ];
  const blockGeo = new RoundedBoxGeometry(0.7, 0.7, 0.7, 2, 0.06);
  for (const [letter, color, x, y, z, ry] of blocks) {
    const m = mesh(g, blockGeo, new THREE.MeshStandardMaterial({ map: letterTexture(letter, color, '#ffffff'), roughness: 0.6 }), x, y, z);
    m.rotation.y = ry;
  }

  // Ball mit Streifen
  const ballTex = canvasTex(256, 128, (c, w, h) => {
    const cols = ['#e5484d', '#ffffff', '#3b7cc9', '#ffffff', '#f2c832', '#ffffff'];
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h);
    });
  });
  mesh(g, new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 }), 7.6, 0.55, -6.2).rotation.z = 0.4;

  // Spielzeugkiste mit Deckel und ein paar Sachen darin
  const box = new THREE.Group();
  box.position.set(-12.5, 0, -5.6);
  box.rotation.y = 0.15;
  mesh(box, new RoundedBoxGeometry(2.2, 1.1, 1.2, 2, 0.08), std('#4f9ad6', 0.6), 0, 0.55, 0);
  mesh(box, new RoundedBoxGeometry(2.3, 0.14, 1.3, 2, 0.05), std('#f2c832', 0.5), 0, 1.12, -0.55).rotation.x = -1.1;
  mesh(box, new THREE.SphereGeometry(0.28, 14, 10), std('#e5484d', 0.4), -0.5, 1.15, 0.1);
  mesh(box, new RoundedBoxGeometry(0.45, 0.45, 0.45, 2, 0.05), std('#4fa65a', 0.6), 0.35, 1.18, 0.05).rotation.y = 0.6;
  for (const x of [-0.6, 0, 0.6]) mesh(box, new THREE.SphereGeometry(0.12, 10, 8), std('#ffffff', 0.5), x, 0.6, 0.62, false);
  g.add(box);

  // Werkzeugkasten (rot) mit Hammer
  const tools = new THREE.Group();
  tools.position.set(12.4, 0, -5.8);
  tools.rotation.y = -0.2;
  mesh(tools, new RoundedBoxGeometry(1.6, 0.6, 0.8, 2, 0.06), std('#d9463b', 0.5), 0, 0.3, 0);
  mesh(tools, new THREE.TorusGeometry(0.3, 0.05, 8, 20, Math.PI), std('#3a3a3a', 0.4), 0, 0.6, 0);
  const hammer = new THREE.Group();
  hammer.position.set(1.4, 0.06, 0.4);
  hammer.rotation.y = 0.8;
  mesh(hammer, new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8).rotateZ(Math.PI / 2), std('#c99a62', 0.6), 0, 0.05, 0);
  mesh(hammer, new RoundedBoxGeometry(0.18, 0.18, 0.42, 2, 0.04), std('#9aa0a6', 0.3, { metalness: 0.7 }), 0.5, 0.1, 0);
  tools.add(hammer);
  g.add(tools);

  // Kleiner Holzbaum und Häuschen (wie aus einer Spielzeugkiste)
  mesh(g, new THREE.CylinderGeometry(0.08, 0.1, 0.6, 8), std('#a8703f'), -13.5, 0.3, -2.6);
  mesh(g, new THREE.ConeGeometry(0.55, 1.2, 12), std('#4fa65a', 0.6), -13.5, 1.1, -2.6);
  mesh(g, new RoundedBoxGeometry(1.0, 0.8, 0.8, 2, 0.05), std('#f7f1e3'), 13.6, 0.4, -2.4);
  const roof = mesh(g, new THREE.ConeGeometry(0.85, 0.6, 4), std('#e5484d', 0.5), 13.6, 1.1, -2.4);
  roof.rotation.y = Math.PI / 4;

  return g;
}
