// Texturen werden per Code gezeichnet (keine Bilddateien nötig).
import * as THREE from 'three';

const cache = new Map();

function make(key, size, draw, repeat = 1) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Helle Holzbretter (Werkstattboden, Wagen)
export function woodTexture(base = '#d9b98a', key = 'wood') {
  return make(key + base, 256, (g, n) => {
    const r = rand(3);
    g.fillStyle = base;
    g.fillRect(0, 0, n, n);
    const planks = 4;
    for (let p = 0; p < planks; p++) {
      const y0 = (p * n) / planks;
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`;
      g.fillRect(0, y0, n, n / planks);
      // Maserung
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(90,55,25,${0.05 + r() * 0.1})`;
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        const y = y0 + r() * (n / planks);
        g.moveTo(0, y);
        for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2 + (r() - 0.5) * 2);
        g.stroke();
      }
      // Fuge
      g.fillStyle = 'rgba(60,35,15,0.35)';
      g.fillRect(0, y0, n, 2);
      const x = r() * n;
      g.fillRect(x, y0, 2, n / planks);
    }
  });
}

// Wiese: viele kleine Halme in verschiedenen Grüntönen
export function grassTexture() {
  return make('grass', 512, (g, n) => {
    const r = rand(11);
    g.fillStyle = '#8ec766';
    g.fillRect(0, 0, n, n);
    // weiche Flecken
    for (let i = 0; i < 60; i++) {
      const x = r() * n;
      const y = r() * n;
      const rad = 20 + r() * 60;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() > 0.5 ? '120,185,85' : '150,205,105';
      grd.addColorStop(0, `rgba(${c},0.45)`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Halme
    for (let i = 0; i < 5000; i++) {
      const x = r() * n;
      const y = r() * n;
      const shade = r();
      g.strokeStyle = shade > 0.5 ? `rgba(70,140,60,${0.25 + r() * 0.3})` : `rgba(175,220,120,${0.25 + r() * 0.3})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5);
      g.stroke();
    }
  }, 1);
}

// Schotter für das Gleisbett
export function gravelTexture() {
  return make('gravel', 256, (g, n) => {
    const r = rand(5);
    g.fillStyle = '#b9ad98';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 1800; i++) {
      const v = 140 + Math.floor(r() * 90);
      g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
      g.beginPath();
      g.arc(r() * n, r() * n, 1 + r() * 2.8, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// Wasser: sanfte Wellenlinien
export function waterTexture() {
  return make('water', 256, (g, n) => {
    const r = rand(9);
    g.fillStyle = '#6bb6d9';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`;
      g.lineWidth = 2;
      const x = r() * n;
      const y = r() * n;
      g.beginPath();
      g.arc(x, y, 8 + r() * 10, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  });
}
