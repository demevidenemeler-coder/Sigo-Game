// Alles, was man in der Werkstatt benutzen kann. Namen stehen in i18n.js.

export const LOCOS = [
  { id: 'dampf', length: 2.9, paint: { body: '#d9463b', roof: '#3a3a3a', trim: '#2f2f2f' } },
  { id: 'elok', length: 2.9, paint: { body: '#3b7cc9', roof: '#e8e4dc', trim: '#2f2f2f' } },
];

export const WAGONS = [
  { id: 'personen', length: 2.6, slots: 3, paint: { body: '#f2c832', roof: '#8a5a33', trim: '#2f2f2f' } },
  { id: 'gueter', length: 2.6, slots: 3, paint: { body: '#8a5a33', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'tier', length: 2.6, slots: 3, paint: { body: '#4fa65a', roof: '#f5f1ea', trim: '#2f2f2f' } },
  { id: 'flach', length: 2.6, slots: 3, paint: { body: '#ee8a2b', roof: '#5c3b22', trim: '#2f2f2f' } },
  { id: 'tank', length: 2.6, slots: 0, paint: { body: '#f5f1ea', roof: '#8b5bb5', trim: '#2f2f2f' } },
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
];

export const DECOR = [
  { id: 'stern', emoji: '⭐' },
  { id: 'herz', emoji: '❤️' },
  { id: 'blume', emoji: '🌼' },
  { id: 'lampe', emoji: '💡' },
  { id: 'fahne', emoji: '🚩' },
  { id: 'ballon', emoji: '🎈' },
];

export const CARGO = [
  { id: 'kuh', emoji: '🐄' },
  { id: 'schwein', emoji: '🐖' },
  { id: 'schaf', emoji: '🐑' },
  { id: 'hund', emoji: '🐕' },
  { id: 'katze', emoji: '🐈' },
  { id: 'ente', emoji: '🦆' },
  { id: 'teddy', emoji: '🧸' },
  { id: 'kind', emoji: '🧒' },
  { id: 'oma', emoji: '👵' },
  { id: 'kiste', emoji: '📦' },
  { id: 'geschenk', emoji: '🎁' },
  { id: 'apfel', emoji: '🍎' },
];

export const MAX_WAGONS = 5;
export const MAX_DECOR = 4;

export function partDef(type) {
  return LOCOS.find((l) => l.id === type) ?? WAGONS.find((w) => w.id === type);
}

export function isLoco(type) {
  return LOCOS.some((l) => l.id === type);
}

export function newCar(type) {
  const def = partDef(type);
  return { type, paint: { ...def.paint }, decor: [], cargo: [] };
}

export function defaultTrain() {
  const loco = newCar('dampf');
  const w1 = newCar('personen');
  w1.cargo = ['kind', 'teddy'];
  const w2 = newCar('tier');
  w2.cargo = ['kuh'];
  return { cars: [loco, w1, w2] };
}
