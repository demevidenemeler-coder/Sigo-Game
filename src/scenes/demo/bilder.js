// Gezeichnete Platzhalter für die Demo: Futter (Apfel, Möhre, Klee), Matschfleck, Knopf-Symbole, Xylophon.
// Alles weich und rund, damit es zum Knete-Stil passt, bis echte Bilder da sind.

import { PIXI } from '../../engine/index.js';

const { Graphics, Texture } = PIXI;

function leinwand(w, h, zeichne) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  zeichne(c.getContext('2d'), w, h);
  return Texture.from(c);
}

function glanz(c, x, y, r, staerke = 0.5) {
  const v = c.createRadialGradient(x, y, 0, x, y, r);
  v.addColorStop(0, `rgba(255,255,255,${staerke})`);
  v.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = v;
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
}

// ---------------------------------------------------------------- Futter

export function apfelTextur() {
  return leinwand(220, 220, (c) => {
    // Stiel und Blatt
    c.strokeStyle = '#7a5032';
    c.lineWidth = 12;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(110, 62);
    c.quadraticCurveTo(112, 38, 124, 22);
    c.stroke();
    c.fillStyle = '#6cb04a';
    c.beginPath();
    c.ellipse(150, 40, 30, 15, -0.5, 0, Math.PI * 2);
    c.fill();
    // Apfel: zwei Bäckchen
    const v = c.createRadialGradient(85, 95, 10, 110, 125, 100);
    v.addColorStop(0, '#ff7a6a');
    v.addColorStop(1, '#c9302f');
    c.fillStyle = v;
    c.beginPath();
    c.moveTo(110, 70);
    c.bezierCurveTo(160, 40, 210, 90, 190, 150);
    c.bezierCurveTo(175, 200, 135, 205, 110, 192);
    c.bezierCurveTo(85, 205, 45, 200, 30, 150);
    c.bezierCurveTo(10, 90, 60, 40, 110, 70);
    c.fill();
    glanz(c, 75, 100, 34, 0.6);
  });
}

export function moehreTextur() {
  return leinwand(220, 220, (c) => {
    c.translate(110, 120);
    c.rotate(0.55);
    // Grün
    c.fillStyle = '#62ad44';
    for (const w of [-0.5, 0, 0.5]) {
      c.save();
      c.rotate(w);
      c.beginPath();
      c.ellipse(0, -95, 13, 34, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // Rübe
    const v = c.createLinearGradient(-30, 0, 30, 0);
    v.addColorStop(0, '#ffa64a');
    v.addColorStop(1, '#e8731c');
    c.fillStyle = v;
    c.beginPath();
    c.moveTo(-34, -68);
    c.quadraticCurveTo(0, -84, 34, -68);
    c.quadraticCurveTo(14, 40, 0, 92);
    c.quadraticCurveTo(-14, 40, -34, -68);
    c.fill();
    c.strokeStyle = 'rgba(170,80,20,0.45)';
    c.lineWidth = 5;
    c.lineCap = 'round';
    for (const y of [-30, 0, 30]) {
      c.beginPath();
      c.moveTo(-14 + y * 0.1, y);
      c.lineTo(4, y + 4);
      c.stroke();
    }
    glanz(c, -14, -40, 22, 0.5);
  });
}

export function kleeTextur() {
  return leinwand(220, 220, (c) => {
    // Stiel
    c.strokeStyle = '#4f8f36';
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(110, 200);
    c.quadraticCurveTo(100, 160, 110, 118);
    c.stroke();
    // drei Herzblätter
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(110, 105);
      c.rotate((i * Math.PI * 2) / 3 - Math.PI / 2);
      const v = c.createLinearGradient(0, -10, 0, 70);
      v.addColorStop(0, '#9bd468');
      v.addColorStop(1, '#5ea43e');
      c.fillStyle = v;
      c.beginPath();
      c.moveTo(0, 6);
      c.bezierCurveTo(-58, 20, -48, 78, -8, 72);
      c.quadraticCurveTo(0, 66, 0, 58);
      c.quadraticCurveTo(0, 66, 8, 72);
      c.bezierCurveTo(48, 78, 58, 20, 0, 6);
      c.fill();
      c.restore();
    }
    // kleine Blüte
    c.fillStyle = '#f2a8c8';
    c.beginPath();
    c.arc(110, 105, 16, 0, Math.PI * 2);
    c.fill();
    glanz(c, 104, 99, 10, 0.7);
  });
}

// ---------------------------------------------------------------- Matsch

export function matschTextur() {
  return leinwand(300, 220, (c) => {
    const kleckse = [[150, 110, 90, 70], [80, 120, 50, 42], [220, 95, 58, 48], [170, 165, 46, 34], [110, 70, 40, 32],
      [240, 160, 26, 22], [50, 70, 18, 16], [270, 60, 14, 12]];
    c.fillStyle = '#7b5734';
    for (const [x, y, rx, ry] of kleckse) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2);
      c.fill();
    }
    // etwas Tiefe: dunkle und helle Tupfen
    c.fillStyle = 'rgba(80,52,28,0.6)';
    for (const [x, y, r] of [[130, 125, 22], [200, 100, 16], [90, 115, 14], [165, 150, 12]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(190,150,105,0.55)';
    for (const [x, y, r] of [[120, 85, 14], [205, 78, 10], [72, 108, 8]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// ---------------------------------------------------------------- Knopf-Symbole (Graphics, ca. 140 groß)

export function sonneIcon() {
  const g = new Graphics();
  for (let i = 0; i < 8; i++) {
    const w = (i * Math.PI) / 4;
    g.moveTo(Math.cos(w) * 52, Math.sin(w) * 52).lineTo(Math.cos(w) * 70, Math.sin(w) * 70);
  }
  g.stroke({ width: 14, color: 0xf5b83d, cap: 'round' });
  g.circle(0, 0, 40).fill(0xffd45e).stroke({ width: 6, color: 0xf0b23a });
  return g;
}

export function abendIcon() {
  const g = new Graphics();
  g.circle(0, 12, 46).fill(0xff9a52).rect(-75, 12, 150, 60).cut(); // halbe Sonne über dem Horizont
  g.moveTo(-70, 16).lineTo(70, 16).stroke({ width: 10, color: 0xe0784a, cap: 'round' });
  g.moveTo(-40, 40).lineTo(40, 40).stroke({ width: 10, color: 0xf2b07a, cap: 'round' });
  for (const w of [-2.4, -1.57, -0.74]) {
    g.moveTo(Math.cos(w) * 58, 12 + Math.sin(w) * 58).lineTo(Math.cos(w) * 74, 12 + Math.sin(w) * 74);
  }
  g.stroke({ width: 10, color: 0xffb46a, cap: 'round' });
  return g;
}

export function mondIcon() {
  // Mondsichel mit kleinem Stern (als Textur, die Sichel wird ausgeschnitten)
  return leinwand(160, 160, (c) => {
    c.fillStyle = '#ffe58a';
    c.beginPath();
    c.arc(72, 84, 58, 0, Math.PI * 2);
    c.fill();
    glanz(c, 52, 70, 30, 0.5);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(102, 62, 50, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffd45e';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 17;
      const w = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(122 + Math.cos(w) * r, 112 + Math.sin(w) * r);
    }
    c.closePath();
    c.fill();
  });
}

function wolke(g, farbe) {
  g.circle(-30, 0, 30).circle(10, -14, 36).circle(42, 4, 26).roundRect(-58, 0, 126, 32, 16).fill(farbe);
}

export function regenIcon() {
  const g = new Graphics();
  wolke(g, 0x9db4cc);
  for (const x of [-30, 5, 40]) g.moveTo(x, 46).lineTo(x - 8, 70);
  g.stroke({ width: 10, color: 0x5aa0e0, cap: 'round' });
  return g;
}

export function schneeIcon() {
  const g = new Graphics();
  for (let i = 0; i < 3; i++) {
    const w = (i * Math.PI) / 3;
    const dx = Math.cos(w);
    const dy = Math.sin(w);
    g.moveTo(-dx * 60, -dy * 60).lineTo(dx * 60, dy * 60);
    for (const s of [-1, 1]) {
      // kleine Ästchen
      const bx = dx * 38 * s;
      const by = dy * 38 * s;
      const n1 = w + s * 0.6 + (s < 0 ? Math.PI : 0);
      const n2 = w - s * 0.6 + (s < 0 ? Math.PI : 0);
      g.moveTo(bx, by).lineTo(bx + Math.cos(n1) * 18, by + Math.sin(n1) * 18);
      g.moveTo(bx, by).lineTo(bx + Math.cos(n2) * 18, by + Math.sin(n2) * 18);
    }
  }
  g.stroke({ width: 10, color: 0x7ab6e6, cap: 'round' });
  g.circle(0, 0, 10).fill(0x7ab6e6);
  return g;
}

// ---------------------------------------------------------------- Xylophon

export const XYLO_FARBEN = [0xe8695a, 0xf29e45, 0xf3cf4c, 0x79c068, 0x5a9fe0];

/** Ein Klangstab (Mitte = 0,0). */
export function stab(farbe, breite, hoehe) {
  const g = new Graphics();
  g.roundRect(-breite / 2, -hoehe / 2 + 8, breite, hoehe, 26).fill({ color: 0x3f2a18, alpha: 0.18 });
  g.roundRect(-breite / 2, -hoehe / 2, breite, hoehe, 26).fill(farbe);
  g.roundRect(-breite / 2 + 12, -hoehe / 2 + 12, breite * 0.32, hoehe - 24, 14).fill({ color: 0xffffff, alpha: 0.28 });
  g.circle(0, -hoehe / 2 + 30, 9).fill({ color: 0x5a4030, alpha: 0.55 });
  g.circle(0, hoehe / 2 - 30, 9).fill({ color: 0x5a4030, alpha: 0.55 });
  return g;
}

/** Holzrahmen unter den Stäben (zwei Leisten, trapezförmig). */
export function xyloRahmen(breite) {
  const g = new Graphics();
  g.ellipse(0, 175, breite * 0.55, 34).fill({ color: 0x3f2a18, alpha: 0.16 });
  g.poly([-breite / 2, -120, breite / 2, -80, breite / 2, -50, -breite / 2, -84]).fill(0xb98552);
  g.poly([-breite / 2, 84, breite / 2, 62, breite / 2, 92, -breite / 2, 120]).fill(0xa8743f);
  return g;
}
