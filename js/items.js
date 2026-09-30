// Inhalte: Kategorien und Dinge.
// `synth` = eingebautes Geräusch aus audio.js; sonst wird das Lautwort gesprochen.
// Namen je Sprache: [Name, Lautwort]. Neues Ding = eine Zeile in ITEMS + Namen in NAMES.

export const CATEGORIES = [
  { id: 'tiere', color: 'var(--home-tiere)' },
  { id: 'fahrzeuge', color: 'var(--home-fahrzeuge)' },
  { id: 'musik', color: 'var(--home-musik)' },
];

export const ITEMS = [
  { id: 'kuh', cat: 'tiere', emoji: '🐄' },
  { id: 'schwein', cat: 'tiere', emoji: '🐷' },
  { id: 'schaf', cat: 'tiere', emoji: '🐑' },
  { id: 'hund', cat: 'tiere', emoji: '🐶' },
  { id: 'katze', cat: 'tiere', emoji: '🐱' },
  { id: 'huhn', cat: 'tiere', emoji: '🐔' },
  { id: 'ente', cat: 'tiere', emoji: '🦆' },
  { id: 'maus', cat: 'tiere', emoji: '🐭' },
  { id: 'loewe', cat: 'tiere', emoji: '🦁' },
  { id: 'biene', cat: 'tiere', emoji: '🐝' },
  { id: 'eule', cat: 'tiere', emoji: '🦉' },
  { id: 'elefant', cat: 'tiere', emoji: '🐘' },

  { id: 'auto', cat: 'fahrzeuge', emoji: '🚗', synth: 'horn' },
  { id: 'feuerwehr', cat: 'fahrzeuge', emoji: '🚒', synth: 'siren' },
  { id: 'krankenwagen', cat: 'fahrzeuge', emoji: '🚑', synth: 'siren' },
  { id: 'polizei', cat: 'fahrzeuge', emoji: '🚓', synth: 'siren' },
  { id: 'zug', cat: 'fahrzeuge', emoji: '🚂', synth: 'whistle' },
  { id: 'bus', cat: 'fahrzeuge', emoji: '🚌', synth: 'engine' },
  { id: 'traktor', cat: 'fahrzeuge', emoji: '🚜', synth: 'engine' },
  { id: 'flugzeug', cat: 'fahrzeuge', emoji: '✈️', synth: 'whoosh' },
  { id: 'hubschrauber', cat: 'fahrzeuge', emoji: '🚁', synth: 'heli' },
  { id: 'fahrrad', cat: 'fahrzeuge', emoji: '🚲', synth: 'bikebell' },
  { id: 'schiff', cat: 'fahrzeuge', emoji: '🚢', synth: 'boathorn' },
  { id: 'rakete', cat: 'fahrzeuge', emoji: '🚀', synth: 'whoosh' },

  { id: 'trommel', cat: 'musik', emoji: '🥁', synth: 'drum' },
  { id: 'klavier', cat: 'musik', emoji: '🎹', synth: 'piano' },
  { id: 'gitarre', cat: 'musik', emoji: '🎸', synth: 'guitar' },
  { id: 'trompete', cat: 'musik', emoji: '🎺', synth: 'trumpet' },
  { id: 'geige', cat: 'musik', emoji: '🎻', synth: 'violin' },
  { id: 'glocke', cat: 'musik', emoji: '🔔', synth: 'bell' },
  { id: 'saxophon', cat: 'musik', emoji: '🎷', synth: 'sax' },
  { id: 'akkordeon', cat: 'musik', emoji: '🪗', synth: 'accordion' },
  { id: 'banjo', cat: 'musik', emoji: '🪕', synth: 'banjo' },
  { id: 'mikrofon', cat: 'musik', emoji: '🎤' },
];

export const NAMES = {
  de: {
    kuh: ['Kuh', 'Muuh'], schwein: ['Schwein', 'Grunz, grunz'], schaf: ['Schaf', 'Määh'],
    hund: ['Hund', 'Wau wau'], katze: ['Katze', 'Miau'], huhn: ['Huhn', 'Gack, gack, gack'],
    ente: ['Ente', 'Quak, quak'], maus: ['Maus', 'Piep, piep'], loewe: ['Löwe', 'Roaaar'],
    biene: ['Biene', 'Summ, summ'], eule: ['Eule', 'Schuhu'], elefant: ['Elefant', 'Töröö'],
    auto: ['Auto'], feuerwehr: ['Feuerwehrauto'], krankenwagen: ['Krankenwagen'],
    polizei: ['Polizeiauto'], zug: ['Zug'], bus: ['Bus'], traktor: ['Traktor'],
    flugzeug: ['Flugzeug'], hubschrauber: ['Hubschrauber'], fahrrad: ['Fahrrad'],
    schiff: ['Schiff'], rakete: ['Rakete'],
    trommel: ['Trommel'], klavier: ['Klavier'], gitarre: ['Gitarre'], trompete: ['Trompete'],
    geige: ['Geige'], glocke: ['Glocke'], saxophon: ['Saxophon'], akkordeon: ['Akkordeon'],
    banjo: ['Banjo'], mikrofon: ['Mikrofon', 'La la la'],
  },
  en: {
    kuh: ['Cow', 'Moo'], schwein: ['Pig', 'Oink, oink'], schaf: ['Sheep', 'Baa'],
    hund: ['Dog', 'Woof woof'], katze: ['Cat', 'Meow'], huhn: ['Chicken', 'Cluck, cluck'],
    ente: ['Duck', 'Quack, quack'], maus: ['Mouse', 'Squeak, squeak'], loewe: ['Lion', 'Roar'],
    biene: ['Bee', 'Buzz, buzz'], eule: ['Owl', 'Hoo hoo'], elefant: ['Elephant', 'Toot'],
    auto: ['Car'], feuerwehr: ['Fire truck'], krankenwagen: ['Ambulance'],
    polizei: ['Police car'], zug: ['Train'], bus: ['Bus'], traktor: ['Tractor'],
    flugzeug: ['Airplane'], hubschrauber: ['Helicopter'], fahrrad: ['Bicycle'],
    schiff: ['Ship'], rakete: ['Rocket'],
    trommel: ['Drum'], klavier: ['Piano'], gitarre: ['Guitar'], trompete: ['Trumpet'],
    geige: ['Violin'], glocke: ['Bell'], saxophon: ['Saxophone'], akkordeon: ['Accordion'],
    banjo: ['Banjo'], mikrofon: ['Microphone', 'La la la'],
  },
};

export function itemName(item, lang) {
  return (NAMES[lang]?.[item.id] ?? NAMES.de[item.id])[0];
}

export function itemSoundWord(item, lang) {
  return (NAMES[lang]?.[item.id] ?? NAMES.de[item.id])[1];
}
