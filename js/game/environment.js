// Tag & Nacht, Wetter (Sonne, Regen, Schnee), Dunkelheit im Tunnel.
// Alle Übergänge sind weich (kein plötzliches Umschalten).

import * as THREE from 'three';
import { lamps } from './lamps.js';
import { NoiseLoop } from '../audio.js';

const C = (c) => new THREE.Color(c);

// Grundstimmungen je Wetter (Tag)
const MOODS = {
  sonne: { skyTop: C('#6fb6e8'), skyBottom: C('#e3f1f6'), hemi: 1.3, sun: 2.6, sunColor: C('#fff4e0'), env: 0.55 },
  regen: { skyTop: C('#8796a6'), skyBottom: C('#c7cfd6'), hemi: 1.05, sun: 1.1, sunColor: C('#dfe6ee'), env: 0.4 },
  schnee: { skyTop: C('#a9c0d6'), skyBottom: C('#eef2f5'), hemi: 1.35, sun: 1.6, sunColor: C('#f2f6ff'), env: 0.5 },
};
const WET = new THREE.Color('#3f6b3a');
const WARM_TINT = new THREE.Color('#d98a3d');
// Abendrot: tiefstehende, warme Sonne, oranger Horizont, violett-blauer Himmel oben
const DUSK = { skyTop: C('#4d5aa8'), skyBottom: C('#ffae78'), hemi: 0.95, sun: 1.9, sunColor: C('#ffa45a'), env: 0.35 };
// Sonnenstand: tagsüber hoch, abends flach (lange, weiche Schatten)
const SUN_DAY = new THREE.Vector3(12, 24, 14);
const SUN_DUSK = new THREE.Vector3(34, 9, 12);
const NIGHT = { skyTop: C('#071330'), skyBottom: C('#22345e'), hemi: 0.22, sun: 0.4, sunColor: C('#8fa6ff'), env: 0.12 };

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Environment {
  constructor(land) {
    this.land = land;
    const scene = land.scene;
    this.tod = 0; // Tageszeit: 0 = Tag, 0.5 = Abend, 1 = Nacht (fließender Übergang)
    this.userTod = 0; // vom Kind gewählt (Knopf)
    this.sessionDusk = 0; // 0..1: in den letzten Minuten der Spielzeit wird es von selbst Abend
    this.night = 0; // Dunkelheit 0..1 (nur zwischen Abend und Nacht)
    this.dusk = 0; // Abendrot-Stärke 0..1
    this.sunOffset = SUN_DAY.clone();
    this.weather = 'sonne';
    this.rain = 0;
    this.snow = 0;
    this.wet = 0; // nasser Boden / Pfützen (bleibt nach dem Regen eine Weile)
    this.snowCover = 0; // liegender Schnee (schmilzt nach dem Schneefall langsam)
    this.tunnel = 0;
    this.tunnelTarget = 0;

    // Sterne und Mond
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(400);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0, fog: false }));
    this.moon.position.set(-140, 210, -260);
    scene.add(this.moon);

    // Regentropfen (dünne Striche)
    this.dropCount = 900;
    this.drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 3), new THREE.MeshBasicMaterial({ color: '#b9d3ea', transparent: true, opacity: 0.6 }), this.dropCount);
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    this.dropPos = Array.from({ length: this.dropCount }, () => new THREE.Vector3((Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70));
    scene.add(this.drops);

    // Schneeflocken
    this.flakeCount = 1400;
    const fp = new Float32Array(this.flakeCount * 3);
    this.flakes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, map: dotTexture(), transparent: true, opacity: 0, depthWrite: false }));
    this.flakes.geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.flakes.frustumCulled = false;
    this.flakePos = Array.from({ length: this.flakeCount }, () => new THREE.Vector3((Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 70));
    scene.add(this.flakes);

    // Scheinwerfer der Lok (nachts und im Tunnel)
    this.headlight = new THREE.SpotLight('#fff1c9', 0, 30, 0.55, 0.6, 1.2);
    scene.add(this.headlight, this.headlight.target);

    this.rainSound = new NoiseLoop('bandpass', 2600, 0.4);

    // Ausgangsfarben merken (für Schnee-Tönung)
    this.snowables = (land.snowables ?? []).map((m) => ({ m, base: m.color.clone() }));
  }

  setNight(on) {
    this.setTime(on ? 'nacht' : 'tag');
  }

  setTime(name) {
    this.userTod = { tag: 0, abend: 0.5, nacht: 1 }[name] ?? 0;
  }

  setWeather(w) {
    this.weather = w;
  }

  setTunnel(inside) {
    this.tunnelTarget = inside ? 1 : 0;
  }

  update(dt, look, loco, soundOn) {
    const k = 1 - Math.exp(-dt * 1.2);
    // Tageszeit gleitet langsam und gleichmäßig (ca. 4–5 Sekunden zwischen den Stufen)
    const todTarget = Math.max(this.userTod, 0.5 * this.sessionDusk);
    const step = (todTarget - this.tod) * (1 - Math.exp(-dt * 0.9));
    this.tod += Math.sign(step) * Math.min(Math.abs(step) + 0.0005, Math.abs(todTarget - this.tod));
    const t = this.tod;
    this.night = THREE.MathUtils.clamp((t - 0.5) * 2, 0, 1);
    this.dusk = t <= 0.5 ? t * 2 : 1 - (t - 0.5) * 2;
    // Einblenden sanft, Ausblenden zügig (damit z. B. bei Sonne keine Flocken nachrieseln)
    const fast = 1 - Math.exp(-dt * 4);
    const rainT = this.weather === 'regen' ? 1 : 0;
    const snowT = this.weather === 'schnee' ? 1 : 0;
    this.rain += (rainT - this.rain) * (rainT > this.rain ? k : fast);
    this.snow += (snowT - this.snow) * (snowT > this.snow ? k * 0.6 : fast);
    this.tunnel += (this.tunnelTarget - this.tunnel) * (1 - Math.exp(-dt * 5));
    // Wetterfolgen: Schnee bleibt liegen und schmilzt langsam (bei Regen schneller); Schmelzwasser macht nass
    if (this.weather === 'schnee') this.snowCover = Math.min(1, this.snowCover + dt / 18);
    else {
      const melt = Math.min(this.snowCover, dt / (this.weather === 'regen' ? 15 : 40));
      this.snowCover -= melt;
      this.wet = Math.min(1, this.wet + melt * 0.9);
    }
    if (this.weather === 'regen') this.wet = Math.min(1, this.wet + dt / 14);
    else if (this.snowCover <= 0) this.wet = Math.max(0, this.wet - dt / (this.night > 0.5 ? 120 : 60));

    // Stimmung mischen: Sonne → Regen/Schnee → Nacht
    const base = MOODS.sonne;
    const mix = (key) => {
      let v = base[key].clone ? base[key].clone() : base[key];
      const lerp = (a, b, t) => (a.clone ? a.lerp(b, t) : a + (b - a) * t);
      v = lerp(v, MOODS.regen[key], this.rain);
      v = lerp(v, MOODS.schnee[key], this.snow * (1 - this.rain));
      // Tageszeit: Tag → Abendrot → Nacht
      const dusk = DUSK[key].clone ? DUSK[key].clone() : DUSK[key];
      if (t <= 0.5) v = lerp(v, dusk, t * 2);
      else v = lerp(dusk, NIGHT[key], (t - 0.5) * 2);
      return v;
    };
    const L = this.land;
    const dark = 1 - this.tunnel * 0.65;
    L.sky.uniforms.top.value.copy(mix('skyTop'));
    L.sky.uniforms.bottom.value.copy(mix('skyBottom'));
    L.scene.fog.color.copy(L.sky.uniforms.bottom.value);
    L.hemi.intensity = mix('hemi') * dark;
    const tint = (day, dusk, night) => (t <= 0.5 ? C(day).lerp(C(dusk), t * 2) : C(dusk).lerp(C(night), (t - 0.5) * 2));
    L.hemi.color.copy(tint('#fff7ea', '#ffd2a6', '#6f86c9'));
    L.hemi.groundColor.copy(tint('#8fa877', '#8c7a63', '#2a3550'));
    // Sonne: tiefer und weicher am Abend
    this.sunOffset.copy(t <= 0.5 ? SUN_DAY.clone().lerp(SUN_DUSK, t * 2) : SUN_DUSK.clone().lerp(SUN_DAY, (t - 0.5) * 2));
    L.sun.shadow.intensity = 1 - 0.38 * this.dusk;
    L.sun.intensity = mix('sun') * dark;
    L.sun.color.copy(mix('sunColor'));
    L.scene.environmentIntensity = mix('env') * dark;

    this.stars.material.opacity = THREE.MathUtils.smoothstep(t, 0.55, 1) * (1 - this.rain * 0.8);
    this.moon.material.opacity = THREE.MathUtils.smoothstep(t, 0.6, 1) * (1 - this.rain * 0.7);

    // Lampen: nachts und im Tunnel hell
    // Lampen gehen schon im Abendrot an
    const glow = Math.max(THREE.MathUtils.smoothstep(t, 0.3, 0.75), this.tunnel);
    for (const m of lamps) m.emissiveIntensity = m.userData.lampDay + (m.userData.lampNight - m.userData.lampDay) * glow;

    // Schnee färbt Wiese und Bäume weiß (leichtes Eigenleuchten, damit auch die grüne Grastextur weiß wirkt)
    // Nasser Boden wird etwas dunkler und satter
    const cover = Math.max(this.snowCover, this.snow * 0.3);
    for (const { m, base: c } of this.snowables) {
      m.color.copy(c).lerp(WET, this.wet * 0.22).lerp(WARM_TINT, this.dusk * 0.14).lerp(C('#ffffff'), cover * 0.7);
      m.emissive.setScalar(cover * 0.5 * (1 - this.night * 0.8));
    }

    // Regen
    this.drops.visible = this.rain > 0.02;
    if (this.drops.visible) {
      const mtx = new THREE.Matrix4();
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, 0.1));
      const s = new THREE.Vector3(1, 1, 1);
      const active = Math.floor(this.dropCount * this.rain);
      for (let i = 0; i < this.dropCount; i++) {
        const p = this.dropPos[i];
        p.y -= dt * 22;
        if (p.y < 0) {
          p.y += 30;
          p.x = (Math.random() - 0.5) * 70;
          p.z = (Math.random() - 0.5) * 70;
        }
        const vis = i < active ? 1 : 0;
        mtx.compose(new THREE.Vector3(look.x + p.x, p.y, look.z + p.z), tilt, s.set(vis, vis, vis));
        this.drops.setMatrixAt(i, mtx);
      }
      this.drops.instanceMatrix.needsUpdate = true;
    }
    this.rainSound.set(soundOn ? this.rain * 0.22 : 0);

    // Schnee
    this.flakes.material.opacity = this.snow;
    if (this.snow > 0.02) {
      const arr = this.flakes.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      for (let i = 0; i < this.flakeCount; i++) {
        const p = this.flakePos[i];
        p.y -= dt * (1.2 + (i % 5) * 0.2);
        if (p.y < 0) p.y += 30;
        arr[i * 3] = look.x + p.x + Math.sin(t + i) * 0.6;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = look.z + p.z + Math.cos(t * 0.7 + i) * 0.6;
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
    }

    // Scheinwerfer
    if (loco) {
      const front = loco.localToWorld(new THREE.Vector3(1.6, 1.2, 0));
      const ahead = loco.localToWorld(new THREE.Vector3(12, -0.5, 0));
      this.headlight.position.copy(front);
      this.headlight.target.position.copy(ahead);
      this.headlight.intensity = glow * 60;
    } else {
      this.headlight.intensity = 0;
    }
  }

  stopSounds() {
    this.rainSound.stop();
  }
}
