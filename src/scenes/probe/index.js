// Probeszene zum Testen des Spielkerns: Tippen (Ball), Ziehen (Apfel → Korb/Teller), Wischen (Matsch),
// Halten (Sonne), Szenenwechsel (Pfeil oben rechts). Alle Bilder sind Platzhalter.

import { Scene, stage, spr, tap, drag, wipe, hold, PIXI } from '../../engine/index.js';

export default class Probe extends Scene {
  static id = 'probe';
  static packs = []; // nur Platzhalter-Bilder

  async enter(params) {
    const n = params.n || 0;
    this.zaehler = { n, tap: 0, drop: null, ziel: null, wipe: 0, fertig: 0, hold: 0 };

    // Hintergrund: Himmel, Hügel (gezeichnet, breiter als jeder Bildschirm bis 21:9)
    const himmel = new PIXI.Graphics()
      .rect(-2000, 0, 4000, 1600).fill(n % 2 ? 0xcfe3ef : 0xd8ecf5)
      .ellipse(-700, 1500, 1700, 520).fill(0xa8d49a)
      .ellipse(900, 1560, 1600, 480).fill(0x9acb8c);
    this.bg.addChild(himmel);

    // Tippen: Ball wackelt
    this.ball = spr('probe/ball', { x: -750, y: 1000, parent: this.world });
    tap(this.ball, () => {
      this.zaehler.tap++;
      this.tween(this.ball, { rotation: this.ball.rotation + 0.5 }, 0.4, { ease: 'backOut' });
    });

    // Ziehen: Apfel in Korb oder auf Teller
    this.korb = spr('probe/korb', { x: 250, y: 1200, parent: this.world, scale: 0.9 });
    this.teller = spr('probe/teller', { x: 800, y: 1200, parent: this.world, scale: 0.9 });
    this.apfel = spr('probe/apfel', { x: -250, y: 1150, parent: this.world, scale: 0.7, z: 5 });
    const ziele = [{ obj: this.korb, id: 'korb' }, { obj: this.teller, id: 'teller' }];
    drag(this.apfel, {
      targets: ziele,
      onMove: (ziel) => {
        this.zaehler.ziel = ziel ? ziel.id : null;
        this.korb.alpha = ziel?.id === 'korb' ? 0.75 : 1;
        this.teller.alpha = ziel?.id === 'teller' ? 0.75 : 1;
      },
      onDrop: (ziel, ctx) => {
        this.korb.alpha = this.teller.alpha = 1;
        this.zaehler.drop = ziel ? ziel.id : 'nichts';
        if (!ziel) return; // gleitet von selbst zurück
        ctx.snapTo(ziel);
        // nach einer Weile wieder an den Anfang (endlose Schleife)
        this.after(1.5, () => ctx.back(0.8));
      },
    });

    // Wischen: Matsch verschwindet, kommt nach einer Weile wieder
    this.matsch = spr('probe/matsch', { x: 700, y: 650, parent: this.world, scale: 1.5 });
    this.wisch = wipe(this.matsch, {
      radius: 110,
      onProgress: (p) => { this.zaehler.wipe = p; },
      onDone: () => {
        this.zaehler.fertig++;
        this.after(2, () => this.wisch.reset({ fade: 0.8 }));
      },
    });

    // Halten: Sonne wird größer, solange der Finger drauf ist
    this.sonne = new PIXI.Graphics().circle(0, 0, 130).fill(0xffd77a);
    this.sonne.position.set(-150, 380);
    this.world.addChild(this.sonne);
    hold(this.sonne, {
      onStart: () => this.tween(this.sonne, { scale: 1.15 }, 0.3, { overwrite: true }),
      onTick: (dt) => { this.zaehler.hold += dt; },
      onEnd: () => this.tween(this.sonne, { scale: 1 }, 0.5, { overwrite: true }),
    });

    // Weiter (Szenenwechsel probe → probe), oben rechts im hud
    this.weiter = new PIXI.Graphics()
      .circle(0, 0, 100).fill(0xfffaf0).stroke({ width: 7, color: 0xe3d3b8 })
      .moveTo(-30, -40).lineTo(40, 0).lineTo(-30, 40).closePath().fill(0x8cc084);
    this.hud.addChild(this.weiter);
    this.resize(stage.W);
    tap(this.weiter, () => this.go('probe', { n: n + 1 }));
  }

  resize(W) {
    this.weiter.position.set(W - 170, 170);
  }

  update(dt, t) {
    // ruhiges Wiegen der Sonne
    this.sonne.rotation = Math.sin(t * 0.8) * 0.05;
  }
}
