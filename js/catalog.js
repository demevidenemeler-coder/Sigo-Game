// Alles, was man in Werkstatt und Landschaft benutzen kann. Namen stehen in i18n.js.

// fuel: welche Vorräte die Lok braucht (nur relevant, wenn eine Tankstelle an der Strecke steht)
export const LOCOS = [
  { id: 'dampf', speed: 4.5, fuel: ['kohle', 'wasser'], horn: 'whistle', paint: { body: '#d9463b', roof: '#3a3a3a', trim: '#2f2f2f' } },
  { id: 'diesel', speed: 5, fuel: ['diesel'], horn: 'dieselhorn', paint: { body: '#f2c832', roof: '#d9463b', trim: '#2f2f2f' } },
  { id: 'elok', speed: 5.5, fuel: [], horn: 'elhorn', paint: { body: '#3b7cc9', roof: '#e8e4dc', trim: '#2f2f2f' } },
  { id: 'schnell', speed: 7, fuel: [], horn: 'elhorn', paint: { body: '#f5f1ea', roof: '#d9463b', trim: '#3a3a3a' } },
];

export const WAGONS = [
  { id: 'personen', slots: 3, paint: { body: '#f2c832', roof: '#8a5a33', trim: '#2f2f2f' } },
  { id: 'gueter', slots: 3, paint: { body: '#8a5a33', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'tier', slots: 3, paint: { body: '#4fa65a', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'flach', slots: 3, paint: { body: '#ee8a2b', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'zirkus', slots: 2, paint: { body: '#d9463b', roof: '#f2c832', trim: '#2f2f2f' } },
  { id: 'schluss', slots: 1, paint: { body: '#c8453a', roof: '#3a3a3a', trim: '#2f2f2f' } },
  { id: 'tank', slots: 0, paint: { body: '#f5f1ea', roof: '#8b5bb5', trim: '#2f2f2f' } },
  { id: 'holz', slots: 0, paint: { body: '#5c3b22', roof: '#8a5a33', trim: '#2f2f2f' } },
  { id: 'kohle', slots: 0, paint: { body: '#6b6f75', roof: '#3a3a3a', trim: '#2f2f2f' } },
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
  'loewe', 'elefant', 'giraffe', 'pinguin'].map((id) => ({ id }));
export const PASSENGERS = ['kind', 'papa', 'oma', 'teddy', 'ball', 'kiste', 'geschenk', 'milch', 'apfel'].map((id) => ({ id }));
export const CARGO = [...ANIMALS, ...PASSENGERS];

// Dinge, die man an die Strecke setzen kann
export const TRACK_OBJECTS = [
  { id: 'bahnhof', span: 9, max: 4 },
  { id: 'waschanlage', span: 6, max: 1 },
  { id: 'tankstelle', span: 7, max: 1 },
];

// Bahnhofsfarben: Fahrgäste zeigen in einer Sprechblase, zu welchem Bahnhof sie wollen
export const STATION_COLORS = [
  { id: 'rot', hex: '#e5484d' },
  { id: 'blau', hex: '#3b7cc9' },
  { id: 'gelb', hex: '#f2c832' },
  { id: 'gruen', hex: '#4fa65a' },
];

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
  const car = { type, paint: { ...def.paint }, decor: [], cargo: [], dest: [], dirt: 0 };
  if (isLoco(type)) car.fuel = { kohle: 1, wasser: 1, diesel: 1 };
  return car;
}

export function defaultTrain() {
  const loco = newCar('dampf');
  loco.decor = ['gesicht'];
  const w1 = newCar('personen');
  w1.cargo = ['kind', 'teddy'];
  const w2 = newCar('tier');
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
  for (const c of data.cars) {
    c.dirt ??= 0;
    c.dest ??= [];
    c.dest.length = c.cargo.length;
    for (let i = 0; i < c.dest.length; i++) c.dest[i] ??= null;
    if (isLoco(c.type)) c.fuel ??= { kohle: 1, wasser: 1, diesel: 1 };
  }
  return data;
}
