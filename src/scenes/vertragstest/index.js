// Wegwerf-Szene zur Gegenprüfung: ruft jede Funktion und Option aus ENTWICKLUNG.md, Abschnitt 3, genau so auf,
// wie sie dort steht, und schreibt Ergebnisse nach window.__vertrag (für tools/shot.mjs mit ["js", …]).
// Nicht in main.js angemeldet – der Prüflauf meldet sie selbst an (registerScene über engine/index.js).
//
// Bühnen-Orte (hud-Koordinaten bei 2560 Breite, world x + 1280):
//   Ball (tap)          world (-400, 450)  → hud (880, 450)
//   Sonne (hold)        world (0, 450)     → hud (1280, 450)
//   Matsch (wipe)       world (500, 450)   → hud (1780, 450)
//   Apfel (drag)        world (-200, 1000) → hud (1080, 1000), Korb world (350, 1000) → hud (1630, 1000)
//   Kuh (Actor)         world (-900, 1250) → hud (380, 1250)
//   Knopf (ui.button)   hud (2200, 700)

import { Scene, stage, spr, tex, meta, hasTex, tween, ease, sfx, music, voice, note, animal,
         tap, drag, wipe, hold, Actor, fx, ui, store, ambient, Parallax, rand, pick, clamp, lerp,
         PIXI } from '../../engine/index.js';

const v = (window.__vertrag = { ok: [], fehler: [], zaehler: {}, messung: {} });
const gut = (name) => v.ok.push(name);
const schlecht = (name, info) => v.fehler.push(info === undefined ? name : `${name}: ${info}`);
const pruefe = (name, bedingung, info) => (bedingung ? gut(name) : schlecht(name, info));
const zaehle = (name) => { v.zaehler[name] = (v.zaehler[name] || 0) + 1; };

function matschTextur() {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#7b5734';
  g.beginPath();
  g.ellipse(150, 110, 130, 90, 0.2, 0, Math.PI * 2);
  g.fill();
  return PIXI.Texture.from(c);
}

export default class Vertragstest extends Scene {
  static id = 'vertragstest';
  static packs = ['demo', 'tiere'];   // 'common' ist immer geladen
  static music = 'musik/wiese';

  async enter(params) {
    v.params = params;
    // --- Ebenen und Bühne ---
    pruefe('ebenen', [this.bg, this.world, this.front, this.hud].every((e) => e instanceof PIXI.Container));
    pruefe('stage.H', stage.H === 1600, stage.H);
    pruefe('stage.cx', stage.cx === stage.W / 2, `${stage.cx} / ${stage.W}`);
    pruefe('stage.cy', stage.cy === 800, stage.cy);

    // --- Helfer ---
    const r = rand(2, 3);
    pruefe('rand', r >= 2 && r < 3, r);
    pruefe('pick', [1, 2, 3].includes(pick([1, 2, 3])));
    pruefe('clamp', clamp(5, 0, 1) === 1 && clamp(-1, 0, 1) === 0);
    pruefe('lerp', lerp(0, 10, 0.25) === 2.5);
    const kurven = ['linear', 'quadIn', 'quadOut', 'quadInOut', 'cubicOut', 'cubicInOut', 'sineInOut', 'backOut',
      'backIn', 'elasticOut', 'bounceOut'];
    const fehlendeKurven = kurven.filter((k) => typeof ease[k] !== 'function' || Math.abs(ease[k](1) - 1) > 1e-6);
    pruefe('ease (alle 11)', fehlendeKurven.length === 0, fehlendeKurven.join(','));

    // --- Bilder ---
    pruefe('hasTex echt', hasTex('demo/lok'));
    pruefe('hasTex fehlt', !hasTex('demo/gibtsnicht'));
    pruefe('tex', tex('demo/lok') instanceof PIXI.Texture);
    const m = meta('demo/lok');
    pruefe('meta {w,h,ax,ay,pts}', ['w', 'h', 'ax', 'ay', 'pts'].every((k) => k in m) && m.pts.rad1, JSON.stringify(m));
    pruefe('tex Platzhalter', tex('demo/gibtsnicht') instanceof PIXI.Texture);

    // Hintergrund über Parallax (depth 0 = steht still, 1 = läuft mit der Welt)
    this.land = new Parallax(this, {
      layers: [
        { tex: 'demo/hintergrund', depth: 0, y: 1600, tile: false, x: -1415 },
        { tex: 'demo/rad', depth: 1, y: 1600, tile: true },
      ],
    });
    pruefe('Parallax', this.land.ebenen.length === 2);

    // spr mit allen Optionen
    const s = spr('demo/rad', { x: 10, y: 20, scale: 0.3, alpha: 0.9, rotation: 0.1, flip: true, anchor: 0.5,
      parent: this.world, z: 7 });
    pruefe('spr Optionen', s.x === 10 && s.y === 20 && Math.abs(s.scale.y - 0.3) < 1e-9 && s.scale.x < 0 &&
      Math.abs(s.alpha - 0.9) < 1e-6 && s.rotation === 0.1 && s.anchor.x === 0.5 && s.parent === this.world &&
      s.zIndex === 7, JSON.stringify({ x: s.x, sx: s.scale.x, a: s.anchor.x, z: s.zIndex }));
    const s2 = spr('demo/lok', { parent: this.world, x: -2000 });
    pruefe('spr Anker aus pack.json', Math.abs(s2.anchor.y - 0.981) < 1e-6, s2.anchor.y);
    s.visible = false;

    // --- tween (global) mit allen Feldern und Optionen ---
    const ziel = new PIXI.Container();
    this.world.addChild(ziel);
    let updates = 0;
    const t1 = tween(ziel, { x: 5, y: 6, scale: 2, rotation: 0.5, alpha: 0.5, skewX: 0.1 }, 0.3,
      { ease: 'cubicOut', delay: 0.1, onUpdate: () => updates++ });
    pruefe('tween thenable', typeof t1.then === 'function' && typeof t1.kill === 'function');
    const ziel2 = new PIXI.Container();
    this.world.addChild(ziel2);
    const t2 = tween(ziel2, { scaleX: 2, scaleY: 3 }, 0.2, { ease: 'sineInOut', yoyo: true, repeat: 1 });
    const ziel3 = new PIXI.Container();
    this.world.addChild(ziel3);
    const t3 = tween(ziel3, { x: 100 }, 1);
    t3.kill();
    let t3fertig = false;
    t3.then(() => { t3fertig = true; });

    // --- an die Szene gebunden ---
    const stEvery = { n: 0 };
    const ev = this.every(0.1, () => { stEvery.n++; if (stEvery.n >= 3) ev.kill(); });
    let nachAfter = false;
    this.after(0.2, () => { nachAfter = true; });
    await this.wait(0.15);
    await t1;
    pruefe('tween Felder', ziel.x === 5 && ziel.y === 6 && ziel.scale.x === 2 && ziel.rotation === 0.5 &&
      ziel.alpha === 0.5 && Math.abs(ziel.skew.x - 0.1) < 1e-9, JSON.stringify({ x: ziel.x, s: ziel.scale.x }));
    pruefe('tween onUpdate', updates > 2, updates);
    await t2;
    pruefe('tween yoyo/repeat', Math.abs(ziel2.scale.x - 1) < 1e-6 && Math.abs(ziel2.scale.y - 1) < 1e-6,
      `${ziel2.scale.x}/${ziel2.scale.y}`);
    pruefe('tween kill (Promise bleibt offen)', !t3fertig && ziel3.x < 100, ziel3.x);
    await this.tween(ziel, { x: 0 }, 0.1, { ease: 'linear' });
    gut('this.tween');
    pruefe('this.after', nachAfter);
    pruefe('this.every + kill', stEvery.n === 3, stEvery.n);
    gut('this.wait');

    // --- Eingabe ---
    this.ball = spr('demo/rad', { x: -400, y: 450, scale: 0.7, parent: this.world });
    this.tapBall = tap(this.ball, (e) => { zaehle('tap'); v.letzterTap = { x: e.x, y: e.y }; },
      { pad: 30, sound: 'common/tipp', squash: true });

    this.sonne = new PIXI.Graphics().circle(0, 0, 130).fill(0xffd77a);
    this.sonne.position.set(0, 450);
    this.world.addChild(this.sonne);
    this.holdSonne = hold(this.sonne, {
      onStart: () => zaehle('hold.start'),
      onTick: (dt) => { v.holdZeit = (v.holdZeit || 0) + dt; },
      onEnd: () => zaehle('hold.end'),
    });

    this.matsch = new PIXI.Sprite(matschTextur());
    this.matsch.anchor.set(0.5);
    this.matsch.position.set(500, 450);
    this.world.addChild(this.matsch);
    this.wisch = wipe(this.matsch, {
      radius: 110,
      onProgress: (p) => { v.wischP = p; },
      onDone: () => zaehle('wipe.done'),
      sound: 'common/wisch',
    });

    this.korb = spr('common/futter_heu', { x: 350, y: 1000, scale: 0.8, parent: this.world });
    this.apfel = spr('common/futter_apfel', { x: -200, y: 1000, scale: 0.8, parent: this.world, z: 5 });
    this.zieh = drag(this.apfel, {
      targets: [{ obj: this.korb, id: 'korb', radius: 200 }],
      onStart: () => zaehle('drag.start'),
      onMove: (z) => { v.dragZiel = z ? z.id : null; },
      onDrop: (z, ctx) => {
        zaehle('drag.drop');
        v.dropZiel = z ? z.id : null;
        if (z) ctx.snapTo(z);
      },
      back: true,
      lift: 1.1,
    });

    // --- Figur ---
    this.kuh = new Actor('kuh', { x: -900, y: 1250, scale: 0.45, flip: true, parent: this.world });
    pruefe('Actor flip', this.kuh.flip === true);
    this.kuh.flip = false;
    const mund = this.kuh.point('mouth');
    pruefe('Actor point(mouth) in world', Math.abs(mund.x - (-900 + 0.45 * (705 - 0.448 * 900))) < 2,
      JSON.stringify(mund));

    // --- Effekte: jede Art einmal ---
    const arten = ['herzen', 'sterne', 'funkeln', 'konfetti', 'staub', 'blasen', 'tropfen', 'blaetter', 'rauch',
      'noten', 'zzz'];
    for (const [i, art] of arten.entries()) {
      const n = fx.burst(art, -1000 + i * 200, 250, { count: 3, parent: this.front });
      if (n !== 3) schlecht('fx.burst ' + art, n);
    }
    gut('fx.burst (11 Arten)');
    this.rauch = fx.emitter('rauch', { x: 900, y: 300, rate: 2, parent: this.front });
    pruefe('fx.emitter', typeof this.rauch.stop === 'function');
    pruefe('fx.burst Obergrenze 40', fx.burst('herzen', 0, 0, { count: 100, parent: this.front }) === 40);

    // --- Ton (still im Test, aber Aufrufe müssen gehen) ---
    sfx('common/tipp', { vol: 0.5, rate: 1.1 });
    music('musik/wiese');
    for (const instr of ['xylo', 'klavier', 'glocke', 'trommel', 'floete', 'pling']) note(instr, 72, { vol: 0.5 });
    animal('kuh');
    v.voiceErgebnis = await Promise.race([voice('vertragstest_hallo'), this.wait(1).then(() => 'haengt')]);
    gut('Ton-Aufrufe');

    // --- Oberfläche ---
    this.knopf = ui.button('common/icon_sonne', { x: stage.W - 360, y: 700, size: 220,
      onTap: () => zaehle('button'), parent: this.hud });
    pruefe('ui.button', this.knopf.parent === this.hud);
    this.leiste = ui.tray(this, {
      items: [{ id: 'apfel', tex: 'common/futter_apfel' }, { id: 'heu', tex: 'common/futter_heu' }],
      y: 1395,
      onPick: (item, sprite) => {
        zaehle('tray.pick');
        drag(sprite, { onDrop: () => { zaehle('tray.drop'); this.tween(sprite, { alpha: 0 }, 0.5); } });
      },
    });
    this.zaehler = ui.counter('common/futter_apfel', { x: 1280 - 300, y: 260 });
    this.zaehler.set(3);
    pruefe('ui.counter.set', this.zaehler.n === 3);

    // --- Speicher ---
    store.set('vertragstest.wert', { a: 1 });
    pruefe('store get/set', store.get('vertragstest.wert', null)?.a === 1);
    pruefe('store get def', store.get('vertragstest.gibtsnicht', 42) === 42);
    const neu = store.sticker('vertragstest_' + Date.now());
    pruefe('store.sticker neu', neu === true);

    v.enterFertig = true;
  }

  update(dt, t) {
    if (dt > 0.05) schlecht('update dt > 0.05', dt);
    v.t = t;
    v.updates = (v.updates || 0) + 1;
  }

  exit() {
    v.exitGerufen = true;
  }

  hints() {
    return [this.ball, { von: this.apfel, nach: this.korb }];
  }

  // --- vom Prüflauf aufgerufen ---

  async figurTest() {
    const k = this.kuh;
    const erg = {};
    // jede Bewegung mit Zeitlimit: hängt ein Promise, steht 'haengt' im Ergebnis
    const mit = async (name, fn, sek = 6) => {
      const t0 = this.t;
      erg[name] = await Promise.race([Promise.resolve(fn()).then(() => 'ok'), this.wait(sek).then(() => 'haengt')]);
      erg[name + '_s'] = +(this.t - t0).toFixed(2);
    };
    k.pose('happy');
    await this.wait(0.4);
    erg.happy = k.poseName;
    k.pose('gibtsnicht');
    await this.wait(0.4);
    erg.ersatz = k.poseName;
    await mit('hop', () => k.hop());
    await mit('hopTo', () => k.hopTo(-700, 1250));
    await mit('walkTo', () => k.walkTo(-900, 1250));
    await mit('nod', () => k.nod());
    await mit('shake', () => k.shake());
    // Höhe des Körpers während cheer messen (hüpft die Figur wirklich?)
    let tiefst = 0;
    const mess = this.every(0.01, () => { tiefst = Math.min(tiefst, k.koerper.y); });
    await mit('cheer', () => k.cheer());
    mess.kill();
    erg.cheerHoehe = Math.round(tiefst);
    erg.poseNachCheer = k.poseName;
    await this.wait(0.5);
    await mit('bubble', () => k.bubble('common/futter_apfel', 1));
    erg.laut = await k.sound();
    return erg;
  }

  // Schnelles Antippen wie ein Kind (alle 0,15 s cheer): wie zappelig wird der Körper?
  async zappelTest(mal = 12, abstand = 0.15) {
    const k = this.kuh;
    k.pose('idle');
    await this.wait(0.5);
    const proben = [];
    const mess = this.every(1 / 60, () => proben.push(k.koerper.y));
    for (let i = 0; i < mal; i++) {
      k.cheer();
      await this.wait(abstand);
    }
    await this.wait(1.5);
    mess.kill();
    let maxV = 0;
    let wenden = 0;
    for (let i = 2; i < proben.length; i++) {
      maxV = Math.max(maxV, Math.abs(proben[i] - proben[i - 1]) * 60);
      const a = proben[i - 1] - proben[i - 2];
      const b = proben[i] - proben[i - 1];
      if (a * b < 0) wenden++;
    }
    return { maxGeschwindigkeit: Math.round(maxV), richtungswechsel: wenden, pose: k.poseName, teilchen: fx.count };
  }

  // Parallax: Kamera-Ziel weit weg setzen und Geschwindigkeit messen
  async kameraTest() {
    const k = this.land.kamera;
    k.ziel = 5000;
    const proben = [];
    const mess = this.every(1 / 60, () => proben.push({ t: this.t, x: k.x }));
    await this.wait(1);
    mess.kill();
    let maxV = 0;
    for (let i = 1; i < proben.length; i++) {
      const dt = proben[i].t - proben[i - 1].t;
      if (dt > 0) maxV = Math.max(maxV, (proben[i].x - proben[i - 1].x) / dt);
    }
    this.land.springe(0);
    return { maxGeschwindigkeit: Math.round(maxV), nach1s: Math.round(proben[proben.length - 1].x) };
  }

  effekte() {
    fx.pop(this.ball);
    fx.wobble(this.ball);
    const p = fx.pulse(this.sonne);
    this.after(2, () => p.stop());
    this.rauch.stop();
    ambient.set({ zeit: 'nacht', wetter: 'schnee' });
    ui.hand(this.ball);
    return fx.stern(0, 600).then(() => ({ album: ui.albumAnzahl, zeit: ambient.zeit, wetter: ambient.wetter }));
  }

  alleAus() {
    for (const h of [this.tapBall, this.holdSonne, this.wisch, this.zieh]) h.off();
    return true;
  }
}
