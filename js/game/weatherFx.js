// Wetterfolgen – was nach dem Wetter bleibt:
// - Regen macht den Boden nass: Pfützen wachsen (auf der Strecke und daneben). Fährt der Zug hindurch,
//   spritzt es (und der Zug wird schmutzig). Pfützen antippen = platsch. Mit Sonne trocknen sie langsam.
// - Hört der Regen am Tag auf, erscheint ein Regenbogen.
// - Schnee bleibt liegen und schmilzt danach langsam (Schmelzwasser gibt Pfützen).
//   Neben den Bahnhöfen und an der Strecke bauen sich Schneemänner auf – Kugel für Kugel.

import * as THREE from 'three';

const smooth = THREE.MathUtils.smoothstep;
const WATER = new THREE.Color('#6d93b3');
const ICE = new THREE.Color('#e3f1fa');
const mat = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

// Pfütze mit unregelmäßigem Rand
function puddleGeometry(seed) {
  const shape = new THREE.Shape();
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2.3);
    const x = Math.cos(a) * r * 1.3;
    const z = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  return new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2);
}

function snowman() {
  const g = new THREE.Group();
  g.userData.kind = 'snowman';
  const snow = mat('#ffffff', 0.85, { emissive: '#dfe9f5', emissiveIntensity: 0.25 });
  const add = (geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  // Teile in Bau-Reihenfolge, jeweils mit Schwelle (wie viel Schnee liegen muss)
  const base = add(new THREE.SphereGeometry(0.62, 20, 14), snow, 0, 0.5, 0);
  const mid = add(new THREE.SphereGeometry(0.46, 20, 14), snow, 0, 1.25, 0);
  const head = add(new THREE.SphereGeometry(0.34, 20, 14), snow, 0, 1.85, 0);
  const deco = new THREE.Group();
  const coal = mat('#222222', 0.5);
  for (const z of [0.12, -0.12]) deco.add(add(new THREE.SphereGeometry(0.045, 8, 6), coal, 0.3, 1.95, z));
  for (const y of [1.15, 1.32, 1.5]) deco.add(add(new THREE.SphereGeometry(0.05, 8, 6), coal, 0.45, y, 0));
  const nose = add(new THREE.ConeGeometry(0.06, 0.32, 10), mat('#f07a1f', 0.5), 0.45, 1.86, 0);
  nose.rotation.z = -Math.PI / 2;
  deco.add(nose);
  const hat = new THREE.Group();
  hat.add(add(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), coal, 0, 0, 0));
  hat.add(add(new THREE.CylinderGeometry(0.22, 0.24, 0.36, 20), coal, 0, 0.2, 0));
  hat.add(add(new THREE.CylinderGeometry(0.245, 0.245, 0.07, 20), mat('#e5484d', 0.5), 0, 0.06, 0));
  hat.position.y = 2.13;
  deco.add(hat);
  for (const z of [1, -1]) {
    const arm = add(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 6), mat('#6b4a2b', 0.8), 0, 1.4, z * 0.65);
    arm.rotation.x = z * 1.0;
    deco.add(arm);
  }
  // Schal
  const scarf = add(new THREE.TorusGeometry(0.3, 0.07, 8, 20), mat('#3b7cc9', 0.7), 0, 1.6, 0);
  scarf.rotation.x = Math.PI / 2;
  deco.add(scarf);
  g.add(base, mid, head, deco);
  g.userData.parts = [[base, 0.2], [mid, 0.38], [head, 0.55], [deco, 0.7]];
  g.userData.hat = hat;
  g.traverse((o) => { o.userData.owner = g; });
  return g;
}

export class WeatherFx {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    this.env = game.env;
    const scene = this.land.scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.puddles = [];
    this.snowmen = [];
    this.fx = [];
    this.signature = '';
    this.lastWeather = this.env.weather;
    this.rainbowTimer = 0;
    this.rainbowAlpha = 0;
    this.lastSplash = 0;
    this.puddleMat = mat('#6d93b3', 0.05, { metalness: 0.35, transparent: true, opacity: 0.88 });
    this.rippleMat = new THREE.MeshBasicMaterial({ color: '#dceaf5', transparent: true, opacity: 0.7, depthWrite: false });
    this.dropMat = new THREE.MeshBasicMaterial({ color: '#cfe6f7' });
    this.rippleGeo = new THREE.RingGeometry(0.75, 0.9, 24).rotateX(-Math.PI / 2);
    this.dropGeo = new THREE.SphereGeometry(0.06, 6, 5);

    // Regenbogen: weicher Bogen über den Himmel (liegt über dem Bild, damit man ihn in jeder Ansicht sieht)
    this.rainbow = document.createElement('div');
    this.rainbow.className = 'rainbow';
    game.ui.prepend(this.rainbow);
  }

  // Stellen für Pfützen und Schneemänner neu wählen, wenn sich Strecke oder Bahnhöfe ändern
  layout() {
    const track = this.land.track;
    const objects = this.land.objects;
    const stations = objects.items.filter((i) => i.type === 'bahnhof');
    const sig = `${track.length.toFixed(2)}|${stations.map((s) => s.s.toFixed(1) + (s.flipped ? 'f' : '')).join(',')}`;
    if (sig === this.signature) return;
    this.signature = sig;
    const tap = this.land.tappable;
    for (const o of [...this.puddles.map((p) => p.mesh), ...this.snowmen]) {
      this.group.remove(o);
      if (tap.includes(o)) tap.splice(tap.indexOf(o), 1);
    }
    this.puddles = [];
    this.snowmen = [];
    let seed = Math.round(track.length * 100);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const L = track.length;
    const free = (s) => objects.isFree(s, 3.5);
    const blocked = (x, z) => this.land.features.blocked(x, z, 0.8);

    // Pfützen auf der Strecke (dort spritzt der Zug)
    const n = Math.max(3, Math.round(L / 30));
    for (let i = 0; i < n; i++) {
      let s = ((i + 0.3 + rnd() * 0.4) / n) * L;
      for (let k = 0; k < 12 && !free(s); k++) s += 2.5;
      if (!free(s)) continue;
      const f = track.frameAt(s);
      if (blocked(f.p.x, f.p.z)) continue;
      this.addPuddle(f.p.x, 0.055, f.p.z, 0.9 + rnd() * 0.3, f.angle, s, rnd);
    }
    // Pfützen neben der Strecke
    for (let i = 0; i < Math.round(L / 9); i++) {
      const f = track.frameAt(rnd() * L);
      const side = rnd() > 0.5 ? 1 : -1;
      const off = 3 + rnd() * 6;
      const x = f.p.x - f.t.z * off * side;
      const z = f.p.z + f.t.x * off * side;
      if (blocked(x, z) || track.distanceTo(x, z) < 2.2) continue;
      if (objects.footprints().some(([fx, fz, r]) => Math.hypot(fx - x, fz - z) < r + 1)) continue;
      this.addPuddle(x, 0.035, z, 0.7 + rnd() * 0.9, rnd() * Math.PI, null, rnd);
    }

    // Schneemänner: neben jedem Bahnhof und ein paar an der Strecke
    const spots = [];
    for (const st of stations) spots.push(st.obj.localToWorld(new THREE.Vector3(-3.4, 0, 6.2)));
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 10; k++) {
        const f = track.frameAt(rnd() * L);
        const side = rnd() > 0.5 ? 1 : -1;
        const off = 4 + rnd() * 4;
        const p = new THREE.Vector3(f.p.x - f.t.z * off * side, 0, f.p.z + f.t.x * off * side);
        if (blocked(p.x, p.z) || track.distanceTo(p.x, p.z) < 3) continue;
        if (spots.some((q) => q.distanceTo(p) < 12)) continue;
        spots.push(p);
        break;
      }
    }
    for (const p of spots) {
      if (blocked(p.x, p.z) || track.distanceTo(p.x, p.z) < 2.5) continue;
      const m = snowman();
      m.position.copy(p);
      m.rotation.y = rnd() * Math.PI * 2;
      m.visible = false;
      this.group.add(m);
      this.snowmen.push(m);
      this.land.tappable.push(m);
    }
  }

  addPuddle(x, y, z, size, angle, s, rnd) {
    const mesh = new THREE.Mesh(puddleGeometry(rnd() * 10), this.puddleMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = angle;
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.userData.kind = 'puddle';
    this.group.add(mesh);
    if (s == null) this.land.tappable.push(mesh); // Pfützen auf der Strecke: dort zählt der Zug
    this.puddles.push({ mesh, size, s, onTrack: s != null });
  }

  // Wie groß sind Pfützen gerade (0..1)?
  puddleScale() {
    return smooth(this.env.wet, 0.12, 0.7);
  }

  // Platsch: Tropfen fliegen, ein Ring breitet sich aus
  splash(pos, strength = 1) {
    for (let i = 0; i < 10 * strength; i++) {
      const m = new THREE.Mesh(this.dropGeo, this.dropMat);
      m.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * (1.5 + Math.random() * 2), 2.5 + Math.random() * 2.5, Math.sin(a) * (1.5 + Math.random() * 2));
      this.group.add(m);
      this.fx.push({ obj: m, life: 1, v, kind: 'drop' });
    }
    this.ripple(pos, 1.2);
  }

  ripple(pos, size = 0.5) {
    const r = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
    r.position.set(pos.x, 0.08, pos.z);
    r.scale.setScalar(0.1);
    this.group.add(r);
    this.fx.push({ obj: r, life: 1, kind: 'ripple', size });
  }

  // Für den Fahrmodus: Pfützen auf der Strecke, die groß genug zum Spritzen sind
  trackPuddles() {
    const k = this.puddleScale();
    if (k < 0.25 || this.env.snowCover > 0.5) return []; // gefroren: kein Spritzen
    return this.puddles.filter((p) => p.onTrack);
  }

  tapPuddle(obj) {
    const p = this.puddles.find((q) => q.mesh === obj);
    if (!p || !p.mesh.visible) return false;
    if (this.env.snowCover > 0.5) {
      // Eis: klingt hell und knackt
      this.game.services.sfx('pling');
      return true;
    }
    this.splash(p.mesh.position, 1.2);
    this.game.services.sfx('splash');
    return true;
  }

  tapSnowman(m) {
    const hat = m.userData.hat;
    this.game.tween(0.5, (t) => {
      hat.position.y = 2.13 + Math.sin(t * Math.PI) * 0.5;
      hat.rotation.y = t * Math.PI * 2;
    });
    const s0 = m.scale.x;
    this.game.tween(0.4, (t) => {
      const k = Math.sin(t * Math.PI);
      m.scale.set(s0 * (1 + k * 0.08), s0 * (1 - k * 0.1), s0 * (1 + k * 0.08));
    });
    this.game.services.sfx('plop');
    this.game.services.sayName('schneemann');
  }

  hideOverlay() {
    this.rainbow.style.opacity = 0;
  }

  update(dt, look) {
    this.layout();
    const env = this.env;
    const services = this.game.services;

    // Regenbogen, wenn der Regen am Tag aufhört
    if (this.lastWeather === 'regen' && env.weather === 'sonne' && env.night < 0.5) {
      this.rainbowTimer = 45;
      setTimeout(() => {
        if (this.rainbowTimer > 0) {
          services.sfx('sparkle');
          services.say(services.t('rainbowSay'));
        }
      }, 2500);
    }
    this.lastWeather = env.weather;
    this.rainbowTimer = Math.max(0, this.rainbowTimer - dt);
    const show = this.rainbowTimer > 0 && env.weather === 'sonne' && env.night < 0.5;
    this.rainbowAlpha += ((show ? 1 : 0) - this.rainbowAlpha) * Math.min(1, dt * 0.6);
    this.rainbow.style.opacity = (this.rainbowAlpha * 0.75).toFixed(3);

    // Pfützen (bei liegendem Schnee gefroren: hell und matt wie Eis)
    const k = this.puddleScale();
    const ice = smooth(env.snowCover, 0.3, 0.8);
    this.puddleMat.color.copy(WATER).lerp(ICE, ice);
    this.puddleMat.roughness = 0.05 + ice * 0.25;
    for (const p of this.puddles) {
      p.mesh.visible = k > 0.01;
      p.mesh.scale.setScalar(Math.max(0.001, p.size * k));
    }
    // Regentropfen machen Kringel in den Pfützen
    if (env.rain > 0.3 && k > 0.2 && ice < 0.3 && this.puddles.length) {
      for (let i = 0; i < 3; i++) {
        if (Math.random() > dt * 6) continue;
        const p = this.puddles[Math.floor(Math.random() * this.puddles.length)];
        const r = p.size * k * 0.8;
        const a = Math.random() * Math.PI * 2;
        this.ripple(p.mesh.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r * 0.7)), 0.35);
      }
    }

    // Schneemänner bauen sich mit dem liegenden Schnee auf – und schmelzen wieder
    const c = env.snowCover;
    for (const m of this.snowmen) {
      m.visible = c > 0.2;
      if (!m.visible) continue;
      for (const [part, th] of m.userData.parts) {
        const s = smooth(c, th, th + 0.1);
        part.visible = s > 0.01;
        part.scale.setScalar(Math.max(0.001, s));
      }
    }

    // Tropfen und Ringe
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      if (f.kind === 'drop') {
        f.life -= dt * 1.4;
        f.v.y -= dt * 12;
        f.obj.position.addScaledVector(f.v, dt);
        if (f.obj.position.y < 0.05) f.life = 0;
      } else {
        f.life -= dt * 1.3;
        f.obj.scale.setScalar(f.size * (1.2 - f.life) * 1.6);
        f.obj.material.opacity = 0.7 * f.life;
      }
      if (f.life <= 0) {
        this.group.remove(f.obj);
        if (f.kind === 'ripple') f.obj.material.dispose();
        this.fx.splice(i, 1);
      }
    }
  }
}
