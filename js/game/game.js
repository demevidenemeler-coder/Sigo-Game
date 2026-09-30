// Spielkern: Renderer, Kamera, Bildschleife, Modi (Werkstatt / Malen / Fahren).

import * as THREE from 'three';
import { createWorkshop, createLandscape } from './world.js';
import { Train } from './train.js';
import { defaultTrackPoints } from './track.js';
import { createWorkshopMode } from './modes/workshop.js';
import { createDrawMode } from './modes/draw.js';
import { createDriveMode } from './modes/drive.js';

const MODE_ICONS = { workshop: '🛠️', draw: '✏️', drive: '🚂' };

export class Game {
  constructor({ canvas, ui, services, trainData, trackPoints }) {
    this.canvas = canvas;
    this.ui = ui;
    this.services = services; // say, sayName, sfx, saveTrain, saveTrack
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
    this.cam = { pos: new THREE.Vector3(8, 10, 20), look: new THREE.Vector3(), tPos: new THREE.Vector3(8, 10, 20), tLook: new THREE.Vector3() };
    this.bottomInset = 0;
    this.raycaster = new THREE.Raycaster();
    this.tweens = [];

    this.workshop = createWorkshop();
    this.land = createLandscape();
    this.train = new Train(trainData);
    this.land.track.setPoints(trackPoints ?? defaultTrackPoints());
    this.land.clearAroundTrack();
    this.drive = { s: 0, speed: 0, target: 0 };

    this.modes = {
      workshop: createWorkshopMode(this),
      draw: createDrawMode(this),
      drive: createDriveMode(this),
    };
    this.mode = null;
    this.modeName = null;

    this.buildModeBar();
    this.bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.running = false;
    this.last = 0;
    this.tick = this.tick.bind(this);
  }

  // ---------- Ablauf ----------

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.mode?.update(dt);
    this.tweens = this.tweens.filter((tw) => {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(tw.t);
      if (tw.t >= 1) tw.done?.();
      return tw.t < 1;
    });
    const k = 1 - Math.exp(-dt * 3.5);
    this.cam.pos.lerp(this.cam.tPos, k);
    this.cam.look.lerp(this.cam.tLook, k);
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
    if (this.scene.fog) {
      // Nebel nur in der Ferne, egal wie weit die Kamera weg ist
      const dist = this.cam.pos.distanceTo(this.cam.look);
      this.scene.fog.near = dist + 20;
      this.scene.fog.far = dist + 70;
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  }

  tween(dur, fn, done) {
    this.tweens.push({ t: 0, dur, fn, done });
  }

  setMode(name, { silent = false } = {}) {
    if (this.modeName === name) return;
    this.mode?.exit();
    this.modeName = name;
    this.mode = this.modes[name];
    this.modeBar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === name));
    this.mode.enter();
    if (!silent) this.services.say(this.services.t(name));
  }

  refreshMode() {
    this.mode?.exit();
    this.mode?.enter();
  }

  useScene(which) {
    const target = which === 'workshop' ? this.workshop : this.land;
    this.scene = target.scene;
    target.trainAnchor.add(this.train.group);
  }

  buildModeBar() {
    this.modeBar = document.createElement('nav');
    this.modeBar.className = 'mode-bar';
    for (const [name, icon] of Object.entries(MODE_ICONS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.mode = name;
      b.textContent = icon;
      b.addEventListener('click', () => {
        this.services.sfx('pop');
        this.setMode(name);
      });
      this.modeBar.append(b);
    }
    this.ui.append(this.modeBar);
  }

  pulseMode(name) {
    const b = this.modeBar.querySelector(`[data-mode="${name}"]`);
    b.classList.remove('pulse');
    void b.offsetWidth;
    b.classList.add('pulse');
  }

  saveTrain() {
    this.services.saveTrain(this.train.data);
  }

  // ---------- Kamera ----------

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.applyInset();
    this.mode?.onResize?.();
  }

  isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  // Bereich unten, der von Bedienelementen verdeckt ist: Bildmitte rückt nach oben
  setBottomInset(px) {
    this.bottomInset = px;
    this.applyInset();
  }

  applyInset() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const b = this.bottomInset;
    this.camera.aspect = w / (h + b);
    if (b > 0) this.camera.setViewOffset(w, h + b, 0, b, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  // Kamera so setzen, dass ein Bereich (halbe Breite/Höhe) sichtbar ist
  fit(center, halfW, halfH, dir, instant = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const b = this.bottomInset;
    const full = h + b;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanVis = (tanV * (h - b)) / full;
    const tanHor = (tanV * w) / full;
    const d = Math.max(halfW / tanHor, halfH / tanVis);
    const n = dir.clone().normalize();
    this.cam.tLook.copy(center);
    this.cam.tPos.copy(center).addScaledVector(n, d);
    if (instant) {
      this.cam.pos.copy(this.cam.tPos);
      this.cam.look.copy(this.cam.tLook);
    }
  }

  // ---------- Eingabe ----------

  ndc(x, y) {
    return new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  pick(x, y, objects) {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }

  groundPoint(x, y) {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
  }

  // Welcher Wagen liegt unter dem Finger? Mit Toleranz für kleine Finger.
  pickCar(x, y) {
    const hits = this.pick(x, y, this.train.cars);
    if (hits.length) {
      const idx = this.train.carIndexOf(hits[0].object);
      if (idx >= 0) return { index: idx, object: hits[0].object };
    }
    let best = null;
    let bestD = 90;
    const v = new THREE.Vector3();
    this.train.cars.forEach((c, i) => {
      c.getWorldPosition(v);
      v.y += 1;
      v.project(this.camera);
      const sx = ((v.x + 1) / 2) * window.innerWidth;
      const sy = ((1 - v.y) / 2) * window.innerHeight;
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = { index: i, object: null };
      }
    });
    return best;
  }

  bindPointer() {
    let active = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (active !== null) return;
      active = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.mode?.pointerDown?.(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === active) this.mode?.pointerMove?.(e);
    });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      this.mode?.pointerUp?.(e, e.type === 'pointercancel');
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  // Wagen hüpft kurz (Rückmeldung beim Antippen)
  hop(car) {
    const y0 = 0;
    this.tween(0.35, (t) => { car.position.y = y0 + Math.sin(t * Math.PI) * 0.35; });
  }

  popIn(obj) {
    this.tween(0.45, (t) => {
      const s = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.25 - (1 - t) * 0.9 : 1;
      obj.scale.setScalar(Math.max(0.05, s));
    });
  }
}
