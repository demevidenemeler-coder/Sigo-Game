// Demo: zeigt alles, was der Spielkern kann, als kleines ruhiges Spielfeld.
// - Schaf (Actor): antippen → freut sich; Futter aus der Leiste aufs Schaf ziehen → frisst (Herzen)
// - Lok mit sich drehenden Rädern fährt langsam hin und her; antippen → Pfiff + Rauch
// - Matschfleck auf der Lok wegwischen → Funkeln, kommt nach einer Weile wieder
// - Xylophon mit fünf bunten Stäben
// - drei Knöpfe unten rechts: Tageszeit (Tag/Abend/Nacht), Regen, Schnee
// - Album-Knopf oben rechts (jedes dritte Füttern fliegt ein Stern hinein)

import {
  Scene, stage, spr, hasTex, localPoint, tap, wipe, Actor, fx, ui, ambient, note, sfx, rand, pick, clamp, PIXI,
} from '../../engine/index.js';
import {
  apfelTextur, moehreTextur, kleeTextur, matschTextur, sonneIcon, abendIcon, mondIcon, regenIcon, schneeIcon,
  stab, xyloRahmen, XYLO_FARBEN,
} from './bilder.js';

const BODEN = 1250;                 // Standlinie der Dinge (über der Leiste)
const LOK_SKALA = 0.55;
const LOK_BAHN = [330, 800];        // so weit fährt die Lok hin und her
const LOK_TEMPO = 75;               // Einheiten pro Sekunde (gemütlich)
const RAD_RADIUS = 100;             // Radius der Räder in Bildpunkten der Lok
const XYLO_TOENE = [72, 74, 76, 79, 81]; // C D E G A – passt immer zusammen
const ZEITEN = ['tag', 'abend', 'nacht'];

export default class Demo extends Scene {
  static id = 'demo';
  static packs = ['demo'];
  static music = 'musik/wiese';

  async enter() {
    this.gefuettert = 0;
    this.wischRuhe = 0;   // solange > 0 steht die Lok still (jemand wischt)

    // Hintergrund (2829 breit, füllt auch breite Bildschirme)
    spr('demo/hintergrund', { x: 0, y: 800, parent: this.bg });

    this.baueSchaf();
    this.baueXylophon();
    this.baueLok();
    this.baueLeiste();
    this.baueKnoepfe();
    ui.albumKnopf(this);

    // Ab und zu zeigt das Schaf, was es gern hätte (nur, wenn gerade niemand spielt)
    this.every(15, () => {
      if (this.idle > 4) this.schaf.bubble(pick(this.futter).tex, 2.6);
    });
  }

  // ---------------------------------------------------------------- Schaf

  baueSchaf() {
    this.schaf = new Actor('schaf', { pack: 'demo', x: -820, y: BODEN, scale: 0.5, parent: this.world, z: 10 });
    this.schaf.onTap(() => this.schaf.cheer());
  }

  fuettern(item) {
    const s = this.schaf;
    s.pose('eat');
    sfx('common/mampf');
    s.nod();
    this.after(0.35, () => {
      const mund = s.point('mouth');
      fx.burst('herzen', mund.x, mund.y - 110, { count: 5 });
    });
    this.gefuettert++;
    if (this.gefuettert % 3 === 0) {
      this.after(1.2, () => {
        s.cheer();
        const kopf = s.point('kopf');
        fx.stern(kopf.x, kopf.y - 40);
      });
    } else {
      this.after(1.2, () => s.pose('idle'));
    }
  }

  // ---------------------------------------------------------------- Xylophon

  baueXylophon() {
    const breite = 118;
    const xylo = new PIXI.Container({ label: 'xylophon' });
    xylo.position.set(-260, BODEN - 175);
    xylo.zIndex = 5;
    xylo.addChild(xyloRahmen(breite * 5 + 30));
    this.staebe = XYLO_FARBEN.map((farbe, i) => {
      const hoehe = 300 - i * 25;
      const s = stab(farbe, 100, hoehe);
      s.position.set((i - 2) * breite, (i - 2) * -2);
      s.hitArea = new PIXI.Rectangle(-breite / 2, -hoehe / 2 - 30, breite, hoehe + 60);
      xylo.addChild(s);
      tap(s, () => {
        note('xylo', XYLO_TOENE[i]);
        fx.wobble(s, 0.05);
        const oben = this.world.toLocal(s.toGlobal({ x: 0, y: -hoehe / 2 }));
        fx.burst('noten', oben.x, oben.y - 30, { count: 1 });
      }, { sound: null });
      return s;
    });
    this.world.addChild(xylo);
  }

  // ---------------------------------------------------------------- Lok

  baueLok() {
    const lok = new PIXI.Container({ label: 'lok' });
    lok.position.set(LOK_BAHN[0], BODEN);
    lok.scale.set(LOK_SKALA);
    lok.zIndex = 8;
    this.lok = lok;

    // Räder hinter dem Lok-Bild (nur in den Radkästen zu sehen)
    const lokBild = spr('demo/lok');
    this.raeder = ['rad1', 'rad2'].map((name) => {
      const p = localPoint('demo/lok', name);
      return spr('demo/rad', { x: p.x, y: p.y, scale: (2 * RAD_RADIUS) / 300, parent: lok });
    });
    lok.addChild(lokBild);

    // Matsch auf dem Kessel: wegwischen
    this.matsch = new PIXI.Sprite(matschTextur());
    this.matsch.anchor.set(0.5);
    this.matsch.position.set(-40, -250);
    this.matsch.scale.set(1.5);
    lok.addChild(this.matsch);
    this.wisch = wipe(this.matsch, {
      radius: 110,
      sound: 'common/wisch',
      onProgress: () => { this.wischRuhe = 1.5; },
      onDone: () => {
        const m = this.front.toLocal(this.matsch.getGlobalPosition());
        fx.burst('funkeln', m.x, m.y, { count: 10 });
        fx.pop(this.lok, 0.06);
        sfx('common/funkeln');
        this.after(8, () => this.wisch.reset({ fade: 1.2 }));
      },
    });

    // Antippen: Pfiff und eine Rauchwolke
    const t = lokBild.texture;
    tap(lok, () => this.pfeifen(), {
      sound: null,
      hitArea: new PIXI.Rectangle(-t.width * lokBild.anchor.x - 40, -t.height - 40, t.width + 80, t.height + 80),
    });

    // Schornstein (Bildpunkt 640/60 der Lok): leiser, ständiger Rauch
    this.schornstein = { x: 640 - lokBild.anchor.x * t.width, y: 60 - lokBild.anchor.y * t.height };
    this.rauch = fx.emitter('rauch', { rate: 0.7, z: 1, groesse: 0.8 });

    this.fahrt = { richtung: 1, warte: 2.5, v: 0 };
    this.world.addChild(lok);
  }

  pfeifen() {
    note('floete', 81, { dauer: 0.3, vol: 0.8 });
    this.after(0.38, () => note('floete', 76, { dauer: 0.5, vol: 0.8 }));
    const s = this.schornsteinOrt();
    fx.burst('rauch', s.x, s.y, { count: 5 });
  }

  schornsteinOrt() {
    return this.front.toLocal(this.lok.toGlobal(this.schornstein));
  }

  // ---------------------------------------------------------------- Futter-Leiste

  baueLeiste() {
    this.futter = [
      { id: 'apfel', tex: bild('common/futter_apfel', apfelTextur) },
      { id: 'karotte', tex: bild('common/futter_karotte', moehreTextur) },
      { id: 'heu', tex: bild('common/futter_heu', kleeTextur) },
    ];
    this.leiste = ui.tray(this, {
      items: this.futter,
      versatz: -260, // etwas links der Mitte, rechts sind die Knöpfe
      targets: () => {
        const mund = this.schaf.point('mouth');
        return [{ id: 'schaf', x: mund.x, y: mund.y, radius: 300 }];
      },
      onDrop: (item) => this.fuettern(item),
    });
  }

  // ---------------------------------------------------------------- Knöpfe: Tageszeit und Wetter

  baueKnoepfe() {
    this.zeitIcons = {
      tag: () => bild('common/icon_sonne', sonneIcon),
      abend: () => bild('common/icon_abend', abendIcon),
      nacht: () => bild('common/icon_mond', mondIcon),
    };
    this.knoepfe = [
      ui.button(this.zeitIcons.tag(), { size: 200, onTap: () => this.naechsteZeit() }),
      ui.button(bild('common/icon_regen', regenIcon), { size: 200, onTap: () => this.wetter('regen') }),
      ui.button(bild('common/icon_schnee', schneeIcon), { size: 200, onTap: () => this.wetter('schnee') }),
    ];
    this.ordneKnoepfe();
  }

  resize() {
    this.ordneKnoepfe();
  }

  ordneKnoepfe() {
    const rechts = stage.W / 2 + 1066 - 100;
    this.knoepfe?.forEach((k, i) => k.position.set(rechts - (2 - i) * 225, stage.H - 70 - 115));
  }

  naechsteZeit() {
    const neu = ZEITEN[(ZEITEN.indexOf(ambient.zeit) + 1) % ZEITEN.length];
    ambient.set({ zeit: neu }, { dauer: 2 });
    this.knoepfe[0].setIcon(this.zeitIcons[neu]());
  }

  wetter(art) {
    const neu = ambient.wetter === art ? 'klar' : art;
    ambient.set({ wetter: neu }, { dauer: 2 });
    this.knoepfe[1].markiere(neu === 'regen');
    this.knoepfe[2].markiere(neu === 'schnee');
  }

  // ---------------------------------------------------------------- Ablauf

  update(dt) {
    // Lok: weich anfahren, langsam fahren, vor dem Ende sanft bremsen, kurz warten, zurück
    const f = this.fahrt;
    const lok = this.lok;
    this.wischRuhe = Math.max(0, this.wischRuhe - dt);
    let vZiel = 0;
    if (f.warte > 0) {
      f.warte -= dt;
    } else if (this.wischRuhe <= 0) {
      const ziel = f.richtung > 0 ? LOK_BAHN[1] : LOK_BAHN[0];
      const rest = Math.abs(ziel - lok.x);
      if (rest < 1.5) {
        f.richtung = -f.richtung;
        f.warte = rand(2.5, 4);
      } else {
        vZiel = f.richtung * clamp(rest * 0.9, 10, LOK_TEMPO);
      }
    }
    f.v += (vZiel - f.v) * (1 - Math.exp(-dt * 2.5));
    const vorher = lok.x;
    lok.x = clamp(lok.x + f.v * dt, LOK_BAHN[0] - 20, LOK_BAHN[1] + 20);
    // Räder drehen sich passend zur Strecke (Strecke in Bildpunkten der Lok / Radius)
    const dreh = (lok.x - vorher) / LOK_SKALA / RAD_RADIUS;
    for (const r of this.raeder) r.rotation += dreh;

    const s = this.schornsteinOrt();
    this.rauch.at(s.x, s.y);
  }

  hints() {
    const liste = [{ von: this.leiste.sprite('apfel'), nach: this.schaf }];
    if (!this.wisch.isDone()) liste.push(this.matsch);
    liste.push(this.staebe[2], this.schaf, this.lok);
    return liste;
  }
}

// echtes Bild aus einem Paket, sonst die gezeichnete Ersatz-Form
function bild(id, ersatz) {
  return hasTex(id) ? id : ersatz();
}
