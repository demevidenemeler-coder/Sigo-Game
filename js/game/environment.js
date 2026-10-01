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
const NIGHT = { skyTop: C('#071330'), skyBottom: C('#22345e'), hemi: 0.32, sun: 0.55, sunColor: C('#9fb4ff'), env: 0.18 };

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
    this.night = 0;
    this.nightTarget = 0;
    this.weather = 'sonne';
    this.rain = 0;
    this.snow = 0;
    this.tunnel = 0;
    this.tunnelTarget = 0;

    // Sterne und Mond
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(170);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff6d8', transparent: true, opacity: 0, fog: false }));
    this.moon.position.set(-60, 90, -110);
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
    this.nightTarget = on ? 1 : 0;
  }

  setWeather(w) {
    this.weather = w;
  }

  setTunnel(inside) {
    this.tunnelTarget = inside ? 1 : 0;
  }

  update(dt, look, loco, soundOn) {
    const k = 1 - Math.exp(-dt * 1.2);
    this.night += (this.nightTarget - this.night) * k;
    this.rain += ((this.weather === 'regen' ? 1 : 0) - this.rain) * k;
    this.snow += ((this.weather === 'schnee' ? 1 : 0) - this.snow) * k * 0.6;
    this.tunnel += (this.tunnelTarget - this.tunnel) * (1 - Math.exp(-dt * 5));

    // Stimmung mischen: Sonne → Regen/Schnee → Nacht
    const base = MOODS.sonne;
    const mix = (key) => {
      let v = base[key].clone ? base[key].clone() : base[key];
      const lerp = (a, b, t) => (a.clone ? a.lerp(b, t) : a + (b - a) * t);
      v = lerp(v, MOODS.regen[key], this.rain);
      v = lerp(v, MOODS.schnee[key], this.snow * (1 - this.rain));
      v = lerp(v, NIGHT[key], this.night);
      return v;
    };
    const L = this.land;
    const dark = 1 - this.tunnel * 0.65;
    L.sky.uniforms.top.value.copy(mix('skyTop'));
    L.sky.uniforms.bottom.value.copy(mix('skyBottom'));
    L.scene.fog.color.copy(L.sky.uniforms.bottom.value);
    L.hemi.intensity = mix('hemi') * dark;
    L.sun.intensity = mix('sun') * dark;
    L.sun.color.copy(mix('sunColor'));
    L.scene.environmentIntensity = mix('env') * dark;

    this.stars.material.opacity = this.night * (1 - this.rain * 0.8);
    this.moon.material.opacity = this.night * (1 - this.rain * 0.7);

    // Lampen: nachts und im Tunnel hell
    const glow = Math.max(this.night, this.tunnel);
    for (const m of lamps) m.emissiveIntensity = m.userData.lampDay + (m.userData.lampNight - m.userData.lampDay) * glow;

    // Schnee färbt Wiese und Bäume weiß
    for (const { m, base: c } of this.snowables) m.color.copy(c).lerp(C('#ffffff'), this.snow * 0.7);

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
