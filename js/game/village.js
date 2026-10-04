// Leben im Dorf: Oma, Papa und das Kind spazieren über den Platz und winken, wenn der Zug vorbeikommt.
// Auf dem Spielplatz schaukelt der Teddy.

import * as THREE from 'three';
import { buildFigure } from './figures.js';
import { wave } from './trainModel.js';
import { FIRE, fireTruck } from './zones.js';
import { tree } from './world.js';

const WAVE_DIST = 17;
const COOLDOWN = 18;

export class VillageLife {
  constructor(game) {
    this.game = game;
    this.land = game.land;
    const v = this.land.village;
    this.center = v.center;
    this.cooldown = 0;
    this.signature = '';
    this.enabled = true;

    // Spaziergänger: jeder auf seinem Kreis um den Brunnen
    this.walkers = [
      { id: 'oma', r: 3.2, speed: 0.11, a: 0.5, pause: 0 },
      { id: 'papa', r: 3.7, speed: -0.13, a: 2.6, pause: 0 },
      { id: 'kind', r: 2.6, speed: 0.24, a: 4.4, pause: 0, hop: true },
    ].map((w) => {
      const fig = buildFigure(w.id);
      fig.scale.setScalar(1.6);
      fig.userData.baseScale = 1.6;
      this.land.scene.add(fig);
      this.land.tappable.push(fig);
      return { ...w, fig };
    });

    this.makePets();
    this.makeFire();
    this.makeCatTree();

    // Schaukeln (zwei Sitze am Gestell, auf einem sitzt der Teddy)
    this.swings = [];
    const frame = v.swing;
    if (frame) {
      frame.updateMatrixWorld(true);
      for (const [x, rider] of [[-0.5, 'teddy'], [0.5, null]]) {
        const pivot = new THREE.Group();
        pivot.position.copy(new THREE.Vector3(x, 1.95, 0).applyMatrix4(frame.matrixWorld));
        pivot.rotation.y = frame.rotation.y;
        const swing = new THREE.Group();
        pivot.add(swing);
        const rope = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 });
        for (const z of [-0.2, 0.2]) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.45, 5), rope);
          r.position.set(0, -0.72, z);
          swing.add(r);
        }
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: x < 0 ? '#e5484d' : '#3b7cc9', roughness: 0.5 }));
        seat.position.y = -1.45;
        seat.castShadow = true;
        swing.add(seat);
        if (rider) {
          const t = buildFigure(rider);
          t.scale.setScalar(1.1);
          t.position.set(0, -1.45, 0);
          t.rotation.y = 0;
          swing.add(t);
        }
        this.land.scene.add(pivot);
        this.swings.push({ pivot, swing, phase: x < 0 ? 0 : 1.7, amp: rider ? 0.55 : 0.2, frame });
      }
    }
  }

  // ---------- Haustiere: Hund vor der Hütte (bellt den Zug an), Katze auf dem Dach ----------
  makePets() {
    const v = this.land.village;
    this.pets = [];
    if (v.dogAt) {
      const dog = buildFigure('hund');
      dog.scale.setScalar(1.5);
      dog.position.set(v.dogAt.x, 0, v.dogAt.z);
      dog.rotation.y = Math.atan2(-(this.center.z - v.dogAt.z), this.center.x - v.dogAt.x);
      this.land.scene.add(dog);
      this.land.tappable.push(dog);
      this.pets.push({ fig: dog, home: v.dogAt.obj, barks: true });
    }
    const roofHouse = v.houses.find((h) => h.i === 2) ?? v.houses[0];
    if (roofHouse) {
      roofHouse.obj.updateMatrixWorld(true);
      const p = new THREE.Vector3(0.25, 2.3, 0.02).applyMatrix4(roofHouse.obj.matrixWorld);
      const cat = buildFigure('katze');
      cat.scale.setScalar(1.3);
      cat.position.copy(p);
      cat.rotation.y = roofHouse.obj.rotation.y + Math.PI / 2;
      this.land.scene.add(cat);
      this.land.tappable.push(cat);
      this.pets.push({ fig: cat, home: roofHouse.obj, baseY: p.y });
    }
    this.barkCooldown = 0;
  }

  // ---------- Feuerwehr: Rolltor und Feuerwehrauto (beweglich, daher eigene Objekte) ----------
  makeFire() {
    const st = this.land.village.fire;
    if (!st) return;
    st.updateMatrixWorld(true);
    const { d, door } = FIRE;
    this.fire = { st, busy: false, flash: 0 };
    const root = new THREE.Group();
    root.position.copy(st.position);
    root.rotation.y = st.rotation.y;
    this.land.scene.add(root);
    // Rolltor: weiß mit Rillen, fährt nach oben
    const dg = new THREE.Group();
    dg.position.set(door.x, 0, d / 2 + 0.02);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(door.w, door.h, 0.06), new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.5 }));
    panel.position.y = door.h / 2;
    panel.castShadow = true;
    dg.add(panel);
    const groove = new THREE.MeshStandardMaterial({ color: '#c9c4ba', roughness: 0.6 });
    for (let i = 1; i < 6; i++) {
      const gr = new THREE.Mesh(new THREE.BoxGeometry(door.w, 0.03, 0.07), groove);
      gr.position.y = (door.h / 6) * i;
      dg.add(gr);
    }
    root.add(dg);
    // Feuerwehrauto steht drinnen
    const truck = fireTruck();
    truck.position.set(door.x, 0, -0.15);
    // Feuerwehrmann im Fahrerhaus (Fahrer-Figur mit rotem Helm)
    const ff = buildFigure('fahrer');
    ff.scale.setScalar(0.92);
    ff.position.set(-0.25, 0.74, 0.92);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d23c32', roughness: 0.4 }));
    helmet.position.y = 0.66;
    helmet.scale.set(1.1, 0.9, 1.15);
    ff.add(helmet);
    truck.add(ff);
    root.add(truck);
    Object.assign(this.fire, { root, door: dg, truck, home: truck.position.z });
    this.land.tappable.push(truck);
    truck.userData.tap = 'fire';
  }

  // ---------- Katze auf dem Baum (neben der Feuerwache) ----------
  makeCatTree() {
    const st = this.land.village.fire;
    if (!st) return;
    const T = new THREE.Vector3(-4.6, 0, 3.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), st.rotation.y).add(st.position);
    const t = tree('rund', () => 0.5);
    t.scale.setScalar(1.7);
    t.position.copy(T);
    t.rotation.y = st.rotation.y + Math.PI;
    // dicker Ast, auf dem die Katze sitzt (zeigt zur Feuerwache)
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.0, 7), new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.9 }));
    branch.position.set(-0.55, 1.15, 0.15);
    branch.rotation.set(0.25, 0, Math.PI / 2 - 0.35);
    branch.castShadow = true;
    t.add(branch);
    t.userData.tap = 'cat';
    this.land.scene.add(t);
    this.land.tappable.push(t);
    t.updateMatrixWorld(true);
    const perch = new THREE.Vector3(-1.02, 1.3, 0.3).applyMatrix4(t.matrixWorld);
    const fig = buildFigure('katze');
    fig.scale.setScalar(1.4);
    fig.userData.baseScale = 1.4;
    fig.userData.tap = 'cat';
    fig.position.copy(perch);
    fig.rotation.y = st.rotation.y + Math.PI / 2;
    this.land.scene.add(fig);
    this.land.tappable.push(fig);
    this.cat = { tree: t, fig, perch, state: 'stuck', meow: 4, downTime: 0, rescued: false };
  }

  tapCat() {
    const c = this.cat;
    const g = this.game;
    g.services.animalCall('katze');
    if (c.state === 'stuck') setTimeout(() => this.fireAlarm(), 700); // die Feuerwehr kommt!
    else if (c.state === 'down') g.hop(c.fig);
  }

  // Was die Zeige-Hand zeigen soll (noch nie gerettet → Katze, Wache noch nie benutzt → Wache)
  hintTarget() {
    if (this.cat?.state === 'stuck' && !this.cat.rescued && this.cat.fig.visible) return this.cat.fig;
    if (this.fire && !this.fire.used && this.fire.root.visible) return this.fire.st;
    return null;
  }

  // Tatütata: Tor auf, Auto fährt heraus – Katze retten (falls sie oben sitzt) oder Wasser marsch – und alles zurück
  fireAlarm() {
    const f = this.fire;
    if (!f || f.busy) return;
    f.busy = true;
    f.used = true;
    const g = this.game;
    const { door } = FIRE;
    const { truck } = f;
    const rescue = this.cat?.state === 'stuck';
    const out = f.home + 3.2;
    g.services.sfx('siren');
    f.flash = rescue ? 15 : 9.5;
    const step = (dur, fn, next) => g.tween(dur, fn, next);
    const back = () => step(1.8, (t) => { truck.position.z = out - (out - f.home) * t * t * (3 - 2 * t); }, () =>
      step(0.7, (t) => { f.door.position.y = (1 - t) * door.h * 0.95; f.door.scale.y = 0.15 + t * 0.85; }, () => {
        f.busy = false;
      }));
    step(0.7, (t) => { f.door.position.y = t * door.h * 0.95; f.door.scale.y = 1 - t * 0.85; }, () =>
      step(1.6, (t) => { truck.position.z = f.home + (out - f.home) * (1 - (1 - t) ** 2); }, () => {
        if (rescue) this.rescueCat(back);
        else this.waterShow(back);
      }));
  }

  waterShow(done) {
    const g = this.game;
    const ladder = this.fire.truck.userData.ladder;
    g.tween(0.8, (t) => { ladder.rotation.x = -0.75 * t; }, () => {
      this.spray(2.2);
      setTimeout(() => g.tween(0.8, (t) => { ladder.rotation.x = -0.75 * (1 - t); }, done), 2400);
    });
  }

  // Leiter zur Katze drehen, aufrichten und ausfahren; Katze springt in den Korb, fährt mit herunter und springt ab
  rescueCat(done) {
    const g = this.game;
    const c = this.cat;
    const { truck } = this.fire;
    const turn = truck.userData.turn;
    const ladder = truck.userData.ladder;
    c.state = 'rescue';
    truck.updateMatrixWorld(true);
    const target = truck.worldToLocal(c.perch.clone().add(new THREE.Vector3(0, -0.3, 0))).sub(turn.position);
    const yaw = Math.atan2(target.x, target.z);
    const h = Math.hypot(target.x, target.z);
    const pitch = Math.atan2(target.y, h);
    const ext = Math.max(1, Math.hypot(h, target.y) / 2.3);
    const tipWorld = () => {
      ladder.updateMatrixWorld(true);
      return new THREE.Vector3(0, 0.3, 2.25).applyMatrix4(ladder.matrixWorld);
    };
    const pose = (k) => {
      turn.rotation.y = yaw * Math.min(1, k * 2);
      const r = Math.max(0, k * 2 - 1);
      ladder.rotation.x = -pitch * r;
      ladder.scale.z = 1 + (ext - 1) * r;
    };
    g.tween(2.0, (t) => pose(t), () => {
      // Katze springt in den Korb
      const from = c.fig.position.clone();
      const to = tipWorld();
      g.services.animalCall('katze');
      g.tween(0.5, (t) => {
        c.fig.position.lerpVectors(from, to, t);
        c.fig.position.y += Math.sin(t * Math.PI) * 0.5;
      }, () => {
        g.tween(2.0, (t) => {
          pose(1 - t);
          c.fig.position.copy(tipWorld());
        }, () => {
          // abspringen neben das Auto
          const from2 = c.fig.position.clone();
          const to2 = new THREE.Vector3(-1.7, 0, 1.1).applyMatrix4(truck.matrixWorld);
          to2.y = 0;
          g.tween(0.6, (t) => {
            c.fig.position.lerpVectors(from2, to2, t);
            c.fig.position.y += Math.sin(t * Math.PI) * 0.6;
          }, () => {
            c.state = 'down';
            c.rescued = true;
            c.downTime = 0;
            g.hop(c.fig);
            g.services.sfx('sparkle');
            setTimeout(() => g.services.animalCall('katze'), 300);
            done();
          });
        });
      });
    });
  }

  // Nach einer Weile klettert die Katze wieder auf den Baum
  updateCat(dt, time) {
    const c = this.cat;
    if (!c) return;
    const vis = this.fire.root.visible;
    c.tree.visible = vis;
    c.fig.visible = vis;
    if (c.state === 'stuck') {
      c.fig.position.y = c.perch.y + Math.abs(Math.sin(time * 1.3)) * 0.02;
      // ab und zu miauen, wenn der Zug in der Nähe ist
      c.meow -= dt;
      const lp = this.game.train.loco?.getWorldPosition(new THREE.Vector3());
      if (c.meow <= 0 && lp && this.game.modeName === 'drive' && lp.distanceTo(c.perch) < 22) {
        c.meow = 11 + Math.random() * 5;
        this.game.services.animalCall('katze');
        this.game.hop(c.fig);
      }
    } else if (c.state === 'down' && !this.fire.busy) {
      c.downTime += dt;
      if (c.downTime > 45) {
        c.state = 'climb';
        const from = c.fig.position.clone();
        this.game.tween(1.2, (t) => {
          c.fig.position.lerpVectors(from, c.perch, t);
          c.fig.position.y += Math.sin(t * Math.PI) * 0.8;
        }, () => {
          c.state = 'stuck';
          c.meow = 3;
        });
      }
    }
  }

  // Wasserstrahl aus der Leiterspitze: Tropfen im Bogen nach vorne
  spray(dur) {
    const f = this.fire;
    const ladder = f.truck.userData.ladder;
    const geo = this.dropGeo ??= new THREE.SphereGeometry(0.06, 6, 4);
    const mat = this.sprayMat ??= new THREE.MeshStandardMaterial({ color: '#7cc4f0', roughness: 0.1, transparent: true, opacity: 0.85 });
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(f.root.quaternion);
    let left = Math.round(dur * 30);
    const shoot = () => {
      if (left-- <= 0) return;
      ladder.updateMatrixWorld(true);
      const from = f.truck.userData.tip.clone().applyMatrix4(ladder.matrixWorld);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(from);
      this.land.scene.add(m);
      const sp = 3.2 + Math.random() * 0.6;
      const side = (Math.random() - 0.5) * 0.4;
      this.game.tween(0.9, (t) => {
        m.position.set(from.x + (fwd.x * sp + fwd.z * side) * t, from.y + 2.2 * t - 5 * t * t, from.z + (fwd.z * sp - fwd.x * side) * t);
      }, () => this.land.scene.remove(m));
      setTimeout(shoot, 33);
    };
    shoot();
    this.game.services.sfx('splash');
  }

  // ---------- Antippen im Dorf ----------
  tap(o) {
    const g = this.game;
    const kind = o.userData.tap;
    // kleines Wackeln für alles
    const s0 = o.userData.baseScale ?? o.scale.x;
    g.tween(0.4, (t) => {
      const k = Math.sin(t * Math.PI);
      o.scale.set(s0 * (1 - k * 0.08), s0 * (1 + k * 0.14), s0 * (1 - k * 0.08));
    }, () => o.scale.setScalar(s0));
    const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld);
    if (kind === 'house') return this.visitor(o);
    if (kind === 'fire') return this.fireAlarm();
    if (kind === 'cat') return this.tapCat();
    if (kind === 'church') {
      g.services.sfx('churchbell');
      setTimeout(() => g.services.animalCall('storch'), 2400);
      return;
    }
    if (kind === 'well') {
      g.services.sfx('splash');
      return this.droplets(at(0, 0.7, 0), '#6fb6e8', 14);
    }
    if (kind === 'market') {
      g.services.sfx('boing');
      return this.flyThing(at(0, 1.1, 0.2), new THREE.SphereGeometry(0.11, 10, 8), ['#e5484d', '#f08a24', '#f2c832'][Math.floor(Math.random() * 3)], 2.2);
    }
    // ---- Bauernhof ----
    if (kind === 'barn') {
      // Tor knarrt, ein Tier kommt heraus und ruft
      g.services.sfx('creak');
      const id = ['pferd', 'kuh', 'schwein', 'schaf', 'hase', 'katze', 'hund'][Math.floor(Math.random() * 7)];
      return this.visitor(o, { id, door: o.userData.door ?? 2.4, scale: 2.0, sound: null, call: true, delay: 500 });
    }
    if (kind === 'hay') {
      g.services.sfx('poof');
      this.droplets(at(0, 0.9, 0), '#e8c45a', 16);
      // manchmal hat sich jemand im Heu versteckt
      if (Math.random() < 0.45) {
        const id = ['hase', 'katze', 'huhn'][Math.floor(Math.random() * 3)];
        this.visitor(o, { id, door: 1.0, scale: 1.4, sound: null, call: true, delay: 250 });
      }
      return;
    }
    if (kind === 'tractor') return this.startTractor(o);
    if (kind === 'mill') {
      g.services.sfx('whoosh');
      const rotor = o.userData.rotor;
      if (!rotor) return;
      g.tween(3.5, (t) => { rotor.userData.boost = 1 + 9 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - t) ** 0.5; }, () => { rotor.userData.boost = 1; });
      return;
    }
    if (kind === 'mailbox') {
      g.services.sfx('pling');
      return this.flyThing(at(0, 1.1, 0), new THREE.BoxGeometry(0.26, 0.02, 0.18), '#ffffff', 3.2, true);
    }
  }

  // Tür geht auf: jemand kommt heraus, winkt (oder ruft) und geht wieder hinein
  visitor(house, opts = {}) {
    if (house.userData.visiting) return;
    house.userData.visiting = true;
    const g = this.game;
    const { id = ['kind', 'oma', 'papa', 'teddy'][Math.floor(Math.random() * 4)], door = 1.15, scale = 1.5, sound = 'dingdong', call = false, delay = 0 } = opts;
    if (sound) g.services.sfx(sound);
    const fig = buildFigure(id);
    house.updateMatrixWorld(true);
    fig.position.copy(new THREE.Vector3(0, 0.02, door).applyMatrix4(house.matrixWorld));
    fig.position.y = 0.02;
    fig.rotation.y = house.rotation.y;
    fig.scale.setScalar(0.001);
    setTimeout(() => {
      this.land.scene.add(fig);
      g.tween(0.45, (t) => fig.scale.setScalar(scale * Math.max(0.001, Math.sin(t * Math.PI * 0.5) * (1 + Math.sin(t * Math.PI) * 0.15))), () => {
        if (fig.userData.waveArm) wave(fig, g);
        else g.hop(fig);
        if (call) g.services.animalCall(id);
        else g.services.sayName(id);
        setTimeout(() => {
          g.tween(0.4, (t) => fig.scale.setScalar(scale * Math.max(0.001, 1 - t)), () => {
            this.land.scene.remove(fig);
            house.userData.visiting = false;
          });
        }, 2600);
      });
    }, delay);
  }

  // Traktor: tuckert los, wackelt, pufft Rauch und fährt ein Stückchen vor und zurück
  startTractor(o) {
    if (o.userData.busy) return;
    o.userData.busy = true;
    const g = this.game;
    g.services.sfx('tractor');
    o.updateMatrixWorld(true);
    const start = o.position.clone();
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(o.quaternion).setY(0).normalize();
    const exhaust = new THREE.Vector3(0.65, 1.65, 0.2);
    let nextPuff = 0;
    g.tween(2.6, (t) => {
      const drive = Math.sin(t * Math.PI) * 1.6; // vor und wieder zurück
      o.position.copy(start).addScaledVector(fwd, drive);
      o.position.y = Math.abs(Math.sin(t * 60)) * 0.03;
      o.rotation.z = Math.sin(t * 47) * 0.015;
      if (t >= nextPuff) {
        nextPuff += 0.12;
        this.puff(exhaust.clone().applyMatrix4(o.matrixWorld));
      }
      o.updateMatrixWorld(true);
    }, () => {
      o.position.copy(start);
      o.rotation.z = 0;
      o.userData.busy = false;
    });
  }

  puff(at) {
    const geo = this.puffGeo ??= new THREE.IcosahedronGeometry(0.18, 1);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7a7a7a', roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.copy(at);
    this.land.scene.add(m);
    this.game.tween(1.2, (t) => {
      m.position.set(at.x + t * 0.3, at.y + t * 1.4, at.z);
      m.scale.setScalar(1 + t * 2.5);
      m.material.opacity = 0.75 * (1 - t);
    }, () => {
      this.land.scene.remove(m);
      m.material.dispose();
    });
  }

  // Ding fliegt im Bogen heraus (Apfel vom Markt, Brief aus dem Briefkasten)
  flyThing(from, geo, color, height, spin = false) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true }));
    m.castShadow = true;
    m.position.copy(from);
    this.land.scene.add(m);
    const dir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(1.2);
    this.game.tween(1.1, (t) => {
      m.position.set(from.x + dir.x * t, from.y + Math.sin(t * Math.PI) * height * (spin ? 1 : 0.6) - (spin ? 0 : t * from.y * 0.9), from.z + dir.z * t);
      if (spin) m.rotation.set(t * 6, t * 9, 0);
      m.material.opacity = t < 0.8 ? 1 : (1 - t) / 0.2;
    }, () => {
      this.land.scene.remove(m);
      m.material.dispose();
    });
  }

  droplets(at, color, n) {
    const geo = this.dropGeo ??= new THREE.SphereGeometry(0.06, 6, 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.1, transparent: true }));
      m.position.copy(at);
      this.land.scene.add(m);
      const a = (i / n) * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 1.2, 2.4 + Math.random(), Math.sin(a) * 1.2);
      this.game.tween(0.8, (t) => {
        m.position.set(at.x + v.x * t, at.y + v.y * t - 4.5 * t * t, at.z + v.z * t);
        m.material.opacity = 1 - t;
      }, () => {
        this.land.scene.remove(m);
        m.material.dispose();
      });
    }
  }

  // Liegen Schienen mitten durchs Dorf, gehen die Leute nach Hause
  layout() {
    const track = this.land.track;
    const sig = track.length.toFixed(2);
    if (sig === this.signature) return;
    this.signature = sig;
    let d = Infinity;
    for (const [x, z] of track.samples) d = Math.min(d, Math.hypot(x - this.center.x, z - this.center.z));
    this.enabled = d > 5.5;
    for (const w of this.walkers) w.fig.visible = this.enabled;
  }

  update(dt, time) {
    this.layout();
    // Feuerwehr: nur sichtbar, wenn die Wache steht; Blaulicht blinkt im Einsatz
    if (this.fire) {
      const f = this.fire;
      f.root.visible = f.st.visible && f.st.scale.x > 0.5;
      f.flash = Math.max(0, f.flash - dt);
      f.truck.userData.lights.forEach((l, i) => {
        l.material.emissiveIntensity = f.flash > 0 ? (Math.sin(time * 14 + i * Math.PI) > 0 ? 3.5 : 0.2) : 0.3;
      });
      this.updateCat(dt, time);
    }
    for (const s of this.swings) {
      s.pivot.visible = s.frame.visible && s.frame.scale.x > 0.5;
      s.swing.rotation.x = Math.sin(time * 1.6 + s.phase) * s.amp; // vor und zurück (quer zum Balken)
    }
    // Haustiere: nur sichtbar, wenn ihr Zuhause steht; Katze atmet im Schlaf, Hund bellt den Zug an
    const lp0 = this.game.train.loco?.getWorldPosition(new THREE.Vector3());
    this.barkCooldown -= dt;
    for (const p of this.pets) {
      p.fig.visible = p.home.visible && p.home.scale.x > 0.5;
      if (p.baseY != null) p.fig.scale.setScalar(1.3 * (1 + Math.sin(time * 1.5) * 0.02));
      if (p.barks && p.fig.visible && lp0 && this.game.modeName === 'drive' && this.barkCooldown <= 0
        && Math.hypot(lp0.x - p.fig.position.x, lp0.z - p.fig.position.z) < 15) {
        this.barkCooldown = 16;
        this.game.services.animalCall('hund');
        this.game.hop(p.fig);
      }
    }
    if (!this.enabled) return;
    const loco = this.game.train.loco;
    const lp = loco?.getWorldPosition(new THREE.Vector3());
    const near = lp && this.game.modeName === 'drive' && Math.hypot(lp.x - this.center.x, lp.z - this.center.z) < WAVE_DIST;
    this.cooldown -= dt;
    if (near && this.cooldown <= 0) {
      this.cooldown = COOLDOWN;
      for (const w of this.walkers) {
        w.pause = 2.6;
        w.fig.rotation.y = Math.atan2(lp.x - w.fig.position.x, lp.z - w.fig.position.z);
        if (w.fig.userData.waveArm) wave(w.fig, this.game);
        else this.game.hop(w.fig);
      }
    }
    for (const w of this.walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      w.a += w.speed * dt;
      const x = this.center.x + Math.cos(w.a) * w.r;
      const z = this.center.z + Math.sin(w.a) * w.r * 0.85;
      const dx = -Math.sin(w.a) * Math.sign(w.speed);
      const dz = Math.cos(w.a) * 0.85 * Math.sign(w.speed);
      w.fig.position.set(x, w.hop ? Math.abs(Math.sin(time * 7)) * 0.06 : Math.abs(Math.sin(time * 4 + w.r)) * 0.02, z);
      w.fig.rotation.y = Math.atan2(dx, dz);
      // ab und zu stehen bleiben und schauen
      if (Math.random() < dt * 0.05) w.pause = 1.5 + Math.random() * 2;
    }
  }
}
