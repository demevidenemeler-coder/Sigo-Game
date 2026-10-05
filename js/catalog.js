// Alles, was man in Werkstatt und Landschaft benutzen kann. Namen stehen in i18n.js.

export const LOCOS = [
  { id: 'dampf', speed: 4.5, horn: 'whistle', paint: { body: '#d9463b', roof: '#3a3a3a', trim: '#2f2f2f' } },
  { id: 'diesel', speed: 5, horn: 'dieselhorn', paint: { body: '#f2c832', roof: '#d9463b', trim: '#2f2f2f' } },
  { id: 'elok', speed: 5.5, horn: 'elhorn', paint: { body: '#3b7cc9', roof: '#e8e4dc', trim: '#2f2f2f' } },
  { id: 'schnell', speed: 7, horn: 'elhorn', paint: { body: '#f5f1ea', roof: '#d9463b', trim: '#3a3a3a' } },
];

export const WAGONS = [
  { id: 'personen', slots: 3, paint: { body: '#f2c832', roof: '#8a5a33', trim: '#2f2f2f' } },
  { id: 'tier', slots: 3, paint: { body: '#4fa65a', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'stall', slots: 2, paint: { body: '#c8453a', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'huehner', slots: 2, paint: { body: '#f2c832', roof: '#d9463b', trim: '#8a5a33' } },
  { id: 'teich', slots: 3, paint: { body: '#3b7cc9', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'zoo', slots: 2, paint: { body: '#ee8a2b', roof: '#4fa65a', trim: '#2f2f2f' } },
  { id: 'affen', slots: 3, paint: { body: '#4fa65a', roof: '#f2c832', trim: '#2f2f2f' } },
  { id: 'zirkus', slots: 2, paint: { body: '#d9463b', roof: '#f2c832', trim: '#2f2f2f' } },
  { id: 'gueter', slots: 3, paint: { body: '#8a5a33', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'flach', slots: 3, paint: { body: '#ee8a2b', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'tank', slots: 0, paint: { body: '#f5f1ea', roof: '#3b7cc9', trim: '#2f2f2f' } },
  { id: 'schluss', slots: 1, paint: { body: '#c8453a', roof: '#3a3a3a', trim: '#2f2f2f' } },
  { id: 'auto', slots: 0, paint: { body: '#3b7cc9', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'kran', slots: 0, paint: { body: '#f2c832', roof: '#3a3a3a', trim: '#2f2f2f' } },
];

export const COLORS = [
  { id: 'rot', hex: '#d9463b' },
  { id: 'orange', hex: '#ee8a2b' },
  { id: 'gelb', hex: '#f2c832' },
  { id: 'gruen', hex: '#4fa65a' },
  { id: 'blau', hex: '#3b7cc9' },
  { id: 'lila', hex: '#8b5bb5' },
  { id: 'rosa', hex: '#f08bb4' },
  { id: 'weiss', hex: '#f5f1ea' },
  { id: 'schwarz', hex: '#3a3a3a' },
  { id: 'braun', hex: '#8a5a33' },
];

export const DECOR = [
  { id: 'gesicht' },
  { id: 'stern' },
  { id: 'herz' },
  { id: 'blume' },
  { id: 'lampe' },
  { id: 'lichterkette' },
  { id: 'glocke' },
  { id: 'fahne' },
  { id: 'ballon' },
  { id: 'regenbogen' },
];

// Tiere und Mitfahrer (eigene Fächer in der Werkstatt)
export const ANIMALS = ['kuh', 'schwein', 'schaf', 'pferd', 'hund', 'katze', 'huhn', 'hahn', 'ente', 'hase', 'frosch',
  'loewe', 'elefant', 'giraffe', 'affe', 'pinguin'].map((id) => ({ id }));
export const PASSENGERS = ['kind', 'papa', 'oma', 'teddy', 'ball', 'kiste', 'geschenk', 'milch', 'apfel'].map((id) => ({ id }));
export const CARGO = [...ANIMALS, ...PASSENGERS];

// Futter (Werkstatt-Fach „Futter“). Wer was mag – das Erste ist das Lieblingsfutter.
export const FOODS = ['heu', 'karotte', 'apfel', 'banane', 'koerner', 'fisch', 'knochen', 'fleisch', 'blatt', 'fliege'].map((id) => ({ id }));
export const LIKES = {
  kuh: ['heu'], schaf: ['heu'], pferd: ['karotte', 'heu', 'apfel'], schwein: ['apfel', 'karotte', 'banane', 'koerner'],
  hund: ['knochen', 'fleisch'], katze: ['fisch'], huhn: ['koerner'], hahn: ['koerner'], ente: ['koerner'],
  hase: ['karotte'], frosch: ['fliege'], loewe: ['fleisch'], elefant: ['banane', 'apfel', 'heu'], giraffe: ['blatt'], affe: ['banane', 'apfel'],
  pinguin: ['fisch'], kind: ['apfel', 'banane', 'karotte'], papa: ['apfel', 'banane', 'karotte'],
  oma: ['apfel', 'banane', 'karotte'], teddy: ['apfel', 'banane'],
};
export const isEater = (id) => id in LIKES;

// Dinge, die man an die Strecke setzen kann
export const TRACK_OBJECTS = [
  { id: 'bahnhof', span: 9, max: 4 },
  { id: 'waschanlage', span: 6, max: 1 },
];

// Bahnhofsfarben: Fahrgäste zeigen in einer Sprechblase, zu welchem Bahnhof sie wollen
export const STATION_COLORS = [
  { id: 'rot', hex: '#e5484d' },
  { id: 'blau', hex: '#3b7cc9' },
  { id: 'gelb', hex: '#f2c832' },
  { id: 'gruen', hex: '#4fa65a' },
];

// Wer in welchen Wagen darf (ein Elefant passt nicht in den Teichwagen).
// In den richtigen Wagen gesetzt freut sich das Tier (Herzchen + Laut); im falschen schüttelt es den Kopf.
const PEOPLE = ['kind', 'papa', 'oma', 'teddy'];
const THINGS = ['ball', 'kiste', 'geschenk', 'milch', 'apfel'];
export const RIDES_IN = {
  personen: PEOPLE,
  schluss: PEOPLE,
  tier: ['hund', 'katze', 'hase'],
  stall: ['kuh', 'pferd', 'schaf', 'schwein'],
  huehner: ['huhn', 'hahn'],
  teich: ['ente', 'frosch', 'pinguin'],
  affen: ['affe'],
  zoo: ['loewe', 'elefant', 'giraffe', 'affe'],
  zirkus: ['loewe', 'elefant', 'affe'],
  gueter: THINGS,
  flach: THINGS,
};
export const canRide = (type, id) => (RIDES_IN[type] ?? []).includes(id);
export const isHomeWagon = canRide;
// Wagen, in den ein Tier/Mitfahrer am liebsten möchte (für die Denkblase)
export const homeWagonOf = (id) => Object.keys(RIDES_IN).find((type) => RIDES_IN[type].includes(id)) ?? null;

export const MAX_WAGONS = 6;
export const MAX_DECOR = 4;

export function partDef(type) {
  return LOCOS.find((l) => l.id === type) ?? WAGONS.find((w) => w.id === type);
}

export function isLoco(type) {
  return LOCOS.some((l) => l.id === type);
}

export function newCar(type) {
  const def = partDef(type);
  const car = { type, paint: { ...def.paint, wheel: def.paint.wheel ?? def.paint.roof }, decor: [], cargo: [], dest: [], dirt: 0, wheelStyle: 'speichen' };
  return car;
}

export function defaultTrain() {
  const loco = newCar('dampf');
  loco.decor = ['gesicht'];
  const w1 = newCar('personen');
  w1.cargo = ['kind', 'teddy'];
  const w2 = newCar('stall');
  w2.cargo = ['kuh', 'schaf'];
  w1.dest = [null, null];
  w2.dest = [null, null];
  return { cars: [loco, w1, w2] };
}

// Ladung und Ziel (Bahnhofsfarbe oder null) gehören zusammen
export function pushCargo(car, id, dest = null) {
  car.cargo.push(id);
  car.dest ??= [];
  car.dest[car.cargo.length - 1] = dest;
}

export function spliceCargo(car, index) {
  const [id] = car.cargo.splice(index, 1);
  const [dest] = (car.dest ?? []).splice(index, 1);
  return { id, dest: dest ?? null };
}

// Ältere Spielstände ergänzen (neue Felder)
export function upgradeTrain(data) {
  // Holz- und Kohlewagen gibt es nicht mehr: werden zu Rungen- bzw. Güterwagen
  const RETIRED = { holz: 'flach', kohle: 'gueter' };
  for (const c of data.cars) {
    // früher fuhren Kühe & Co. im Tierwagen – jetzt ist das der Haustierwagen, die Hoftiere ziehen in den Stallwagen
    if (c.type === 'tier' && c.cargo.length && c.cargo.every((id) => canRide('stall', id))) c.type = 'stall';
    if (RETIRED[c.type]) {
      const def = WAGONS.find((w) => w.id === RETIRED[c.type]);
      c.type = def.id;
      c.paint = { ...def.paint, wheel: def.paint.roof };
    }
    c.dirt ??= 0;
    c.paint.wheel ??= c.paint.roof;
    c.wheelStyle ??= 'speichen';
    c.dest ??= [];
    c.dest.length = c.cargo.length;
    for (let i = 0; i < c.dest.length; i++) c.dest[i] ??= null;
    delete c.fuel;
  }
  return data;
}
