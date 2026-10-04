// Spielkern: Renderer, Kamera, Bildschleife, Modi (Werkstatt / Malen / Fahren).

import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';
import { createWorkshop, createLandscape } from './world.js';
import { Train } from './train.js';
import { Environment } from './environment.js';
import { defaultTrackPoints } from './track.js';
import { createWorkshopMode } from './modes/workshop.js';
import { createDrawMode } from './modes/draw.js';
import { createDriveMode } from './modes/drive.js';
import { createWashMode } from './modes/wash.js';
import { createBedMode } from './modes/bed.js';
import { createBedroom } from './bedroom.js';
import { WeatherFx } from './weatherFx.js';
import { Hint } from './hint.js';
import { SideTrain } from './sideTrain.js';
import { Discoveries } from './discover.js';
import { VillageLife } from './village.js';

const MODE_ICONS = { workshop: '🛠️', wash: '🧽', draw: '🛤️', drive: '🚂' };
const SUN_OFFSET = new THREE.Vector3(12, 24, 14);
// Achsen des Sonnenlichts (zum Einrasten der Schattenkarte)
const WARM = new THREE.Color('#ffb36b');
const WARM_BG = new THREE.Color('#e9b98c');
const SUN_DIR = new THREE.Vector3();
const SUN_RIGHT = new THREE.Vector3();
const SUN_UP = new THREE.Vector3();
const SNAP = new THREE.Vector3();

export class Game {
  constructor({ canvas, ui, services, trainData, trackData }) {
    this.canvas = canvas;
    this.ui = ui;
    this.services = services; // say, sayName, sfx, saveTrain, saveTrack
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5); // höher bringt auf Tablets kaum Schärfe, kostet aber viel
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // wird pro Bild gezielt angestoßen (siehe tick)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // Weiche Spiegelungen auf Lack und Metall
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.frameTimes = [];

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
    this.cam = { pos: new THREE.Vector3(8, 10, 20), look: new THREE.Vector3(), tPos: new THREE.Vector3(8, 10, 20), tLook: new THREE.Vector3() };
    this.bottomInset = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll(); // auch die unsichtbaren Original-Objekte (Instanz-Bäume) antippen
    this.tweens = [];

    this.workshop = createWorkshop();
    this.bedroom = createBedroom();
    this.land = createLandscape();
    for (const sc of [this.workshop.scene, this.bedroom.scene, this.land.scene]) {
      sc.environment = this.envMap;
      sc.environmentIntensity = sc.userData.envIntensity ?? 0.55;
    }
    this.time = 0;
    this.env = new Environment(this.land);
    this.train = new Train(trainData);
    const points = Array.isArray(trackData) ? trackData : trackData?.points;
    this.land.track.setPoints(points ?? defaultTrackPoints());
    this.land.crossings.rebuild();
    this.land.objects.load(trackData?.objects);
    this.land.clearAroundTrack();
    this.drive = { s: 0, speed: 0, target: 0 };
    this.weatherFx = new WeatherFx(this);
    this.hint = new Hint(this.ui);
    this.sideTrain = new SideTrain(this);
    // Abendglanz: warmer Schleier über dem Bild (Abend im Spiel und kurz vor Spielende)
    this.glow = document.createElement('div');
    this.glow.className = 'dusk-glow';
    this.ui.prepend(this.glow);

    this.modes = {
      workshop: createWorkshopMode(this),
      draw: createDrawMode(this),
      drive: createDriveMode(this),
      wash: createWashMode(this),
      bed: createBedMode(this),
    };
    this.mode = null;
    this.modeName = null;

    this.buildModeBar();
    this.discover = new Discoveries(this); // Entdecker-Album
    this.village = new VillageLife(this); // Leute im Dorf
    this.bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.running = false;
    this.last = 0;
    this.tick = this.tick.bind(this);
  }

  // ---------- Ablauf ----------

  // Shader aller Bereiche einmal im Voraus übersetzen – sonst ruckelt es beim ersten Betreten (Fahren, Bett …)
  warmUp() {
    if (this.warmed) return;
    this.warmed = true;
    const r = this.renderer;
    const jobs = [this.land.scene, this.bedroom.scene, this.workshop.scene];
    const next = () => {
      const sc = jobs.shift();
      if (!sc) return;
      const p = r.compileAsync ? r.compileAsync(sc, this.camera) : Promise.resolve(r.compile(sc, this.camera));
      p.catch(() => {}).then(() => setTimeout(next, 50));
    };
    setTimeout(next, 300);
  }

  start() {
    this.warmUp();
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
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.time += dt;
    this.adaptQuality(raw);
    this.mode?.update(dt);
    if (this.scene === this.land.scene) {
      this.land.animate(dt, this.time);
      this.env.update(dt, this.cam.look, this.train.loco, this.services.soundsOn());
      this.land.ambient.night = this.env.night;
      this.land.ambient.look.copy(this.cam.look);
      this.weatherFx.update(dt, this.cam.look);
      this.sideTrain.update(dt);
      this.discover.update(dt, this.time);
      this.village.update(dt, this.time);
      this.renderer.toneMappingExposure = 0.98 - 0.36 * this.env.night;
      this.glow.style.opacity = (this.env.dusk * 0.42).toFixed(3);
    } else {
      this.glow.style.opacity = this.current === this.workshop ? ((this.sessionDusk ?? 0) * 0.4).toFixed(3) : 0;
      this.weatherFx.hideOverlay();
      // Zimmer: gegen Spielende wird das Licht langsam warm und gedämpft (wie Abendsonne durchs Fenster)
      const d = this.sessionDusk ?? 0;
      const w = this.current === this.workshop ? this.workshop : null;
      if (w) {
        w.sun.color.set('#ffffff').lerp(WARM, d * 0.85);
        this.scene.userData.hemi.color.set('#fff7ea').lerp(WARM, d * 0.6);
        this.scene.background.set('#f1e6d3').lerp(WARM_BG, d);
      }
      this.renderer.toneMappingExposure = this.current === this.workshop ? 1.05 - 0.12 * d : 1.1;
    }
    this.stepTweens(dt);
    const k = 1 - Math.exp(-dt * 3.5);
    this.cam.pos.lerp(this.cam.tPos, k);
    this.cam.look.lerp(this.cam.tLook, k);
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
    // Die Sonne (und damit der scharfe Schattenbereich) folgt dem Blickpunkt
    const sun = this.current.sun;
    // Sonnenrichtung (wandert mit der Tageszeit). Die Schattenkarte rastet auf ihr Raster ein:
    // sonst „schwimmen“ die Schattenkanten bei jeder Kamerabewegung (Flimmern).
    const onLand = this.scene === this.land.scene;
    const offset = onLand ? this.env.sunOffset : SUN_OFFSET;
    SUN_DIR.copy(offset).normalize();
    SUN_RIGHT.set(0, 1, 0).cross(SUN_DIR).normalize();
    SUN_UP.copy(SUN_DIR).cross(SUN_RIGHT).normalize();
    const sc = sun.shadow.camera;
    const texel = (sc.right - sc.left) / sun.shadow.mapSize.x;
    const look = this.cam.look;
    const snapped = SNAP.copy(SUN_RIGHT).multiplyScalar(Math.round(SUN_RIGHT.dot(look) / texel) * texel)
      .addScaledVector(SUN_UP, Math.round(SUN_UP.dot(look) / texel) * texel)
      .addScaledVector(SUN_DIR, SUN_DIR.dot(look));
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).add(offset);
    // Nahgrenze der Kamera mitwachsen lassen: viel genauere Tiefe → kein Flackern flacher Flächen aus der Ferne
    const camDist = this.cam.pos.distanceTo(this.cam.look);
    const near = THREE.MathUtils.clamp(camDist * 0.04, 0.1, 6);
    if (Math.abs(near - this.camera.near) > this.camera.near * 0.1) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    if (this.scene.fog) {
      // Nebel nur in der Ferne, egal wie weit die Kamera weg ist
      const dist = this.cam.pos.distanceTo(this.cam.look);
      this.scene.fog.near = dist + 40;
      this.scene.fog.far = dist + 170;
    }
    // Schatten: von nah jedes Bild, von weit weg (Vogelperspektive) nur jedes 3. Bild – dort sieht man den Unterschied nicht
    this.frameNo = (this.frameNo ?? 0) + 1;
    const far = this.cam.pos.distanceTo(this.cam.look) > 45;
    this.renderer.shadowMap.needsUpdate = !far || this.frameNo % 3 === 0;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.tick);
  }

  // Läuft es zu langsam, wird die Auflösung stufenweise gesenkt
  // Läuft es zu langsam, wird stufenweise gespart: erst Auflösung, dann Schattenqualität, zuletzt Schatten aus.
  adaptQuality(frameTime) {
    if (frameTime > 0.5) return; // Tab war im Hintergrund
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length < 90) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    this.frameTimes = [];
    const typical = sorted[Math.floor(sorted.length * 0.75)]; // 75 % der Bilder sind schneller
    if (typical < 1 / 45) return;
    this.qualityStep = (this.qualityStep ?? 0) + 1;
    if (this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    } else if (!this.propsThinned) {
      // weniger Blumen und Grasbüschel (sieht man kaum, spart aber viel)
      this.propsThinned = true;
      this.land.setThin(true);
    } else if (!this.shadowsReduced) {
      this.shadowsReduced = true;
      for (const s of [this.land.sun, this.workshop.sun]) {
        s.shadow.mapSize.set(1024, 1024);
        s.shadow.map?.dispose();
        s.shadow.map = null;
      }
    } else if (typical > 1 / 30 && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      for (const sc of [this.land.scene, this.workshop.scene, this.bedroom.scene]) sc.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
  }

  // Animationen weiterführen. Neue Animationen, die in einem done-Callback starten, gehen dabei nicht verloren.
  stepTweens(dt) {
    const active = this.tweens;
    this.tweens = [];
    const keep = [];
    for (const tw of active) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.fn(tw.t);
      if (tw.t >= 1) tw.done?.();
      else keep.push(tw);
    }
    this.tweens = keep.concat(this.tweens);
  }

  // 0..1: so weit ist die Spielzeit fast um (Abendstimmung im Spiel)
  setSessionDusk(v) {
    this.sessionDusk = v;
    this.env.sessionDusk = v;
  }

  tween(dur, fn, done) {
    this.tweens.push({ t: 0, dur, fn, done });
  }

  // Jahreszeit: 'auto' (nach Kalender) oder fest
  setSeason(choice = 'auto') {
    const month = new Date().getMonth(); // 0 = Januar
    const auto = [2, 3, 4].includes(month) ? 'fruehling' : [5, 6, 7].includes(month) ? 'sommer' : [8, 9, 10].includes(month) ? 'herbst' : 'winter';
    this.season = choice === 'auto' ? auto : choice;
    this.env.setSeason(this.season);
  }

  setMode(name, { silent = false } = {}) {
    if (this.modeName === name) return;
    this.hint?.hide();
    this.mode?.exit();
    this.modeName = name;
    this.mode = this.modes[name];
    this.discover?.onMode(name);
    this.modeBar.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === name));
    this.mode.enter();
    if (!silent) this.services.say(this.services.t(name));
  }

  refreshMode() {
    this.mode?.exit();
    this.mode?.enter();
  }

  useScene(which) {
    const target = { workshop: this.workshop, bed: this.bedroom }[which] ?? this.land;
    this.current = target;
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

  saveTrack() {
    this.services.saveTrack({ points: this.land.track.points, objects: this.land.objects.serialize() });
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

  // Eingabe an den aktiven Modus weiterreichen. Normalerweise zählt nur ein Finger;
  // Modi mit multiTouch (Bauen: Zoomen mit zwei Fingern) bekommen alle Finger.
  bindPointer() {
    let active = null;
    const multi = new Set();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.mode?.multiTouch) {
        multi.add(e.pointerId);
        this.canvas.setPointerCapture(e.pointerId);
        this.mode.pointerDown?.(e);
        return;
      }
      if (active !== null) return;
      active = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.mode?.pointerDown?.(e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (multi.has(e.pointerId) || e.pointerId === active) this.mode?.pointerMove?.(e);
    });
    const end = (e) => {
      if (multi.has(e.pointerId)) {
        multi.delete(e.pointerId);
        this.mode?.pointerUp?.(e, e.type === 'pointercancel');
        return;
      }
      if (e.pointerId !== active) return;
      active = null;
      this.mode?.pointerUp?.(e, e.type === 'pointercancel');
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mode?.wheel?.(e);
    }, { passive: false });
  }

  // Kamera sofort setzen (z. B. beim Verschieben mit dem Finger), ohne weiches Nachziehen
  applyCameraNow() {
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
    this.camera.updateMatrixWorld();
  }

  // Kurz hüpfen (Rückmeldung beim Antippen) – von der eigenen Grundhöhe aus
  hop(obj) {
    const base = obj.userData.baseY ?? (obj.userData.hopBase ??= obj.position.y);
    this.tween(0.35, (t) => { obj.position.y = base + Math.sin(t * Math.PI) * 0.35; });
  }

  popIn(obj) {
    if (!obj) return;
    const s0 = obj.scale.x;
    this.tween(0.45, (t) => {
      const k = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.25 - (1 - t) * 0.9 : 1;
      obj.scale.setScalar(s0 * Math.max(0.05, k));
    });
  }
}
