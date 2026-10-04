// Die feste große Strecke: einmal rund durch die ganze Welt – am Dorf vorbei, südlich um den Bauernhof,
// über den Fluss, durch den Berg, an den Feldern entlang und an der Obstwiese wieder zurück.
// Brücken, Tunnel und Bahnübergänge entstehen von selbst (crossings.js).

export const ROUTE = [
  [30, 30], [14, 30], [2, 31], [-6, 38], [-14, 46], [-26, 49.5], [-40, 49.5], [-50, 47.5], [-53.5, 40],
  [-60, 31], [-71, 21], [-75, 8], [-75, -6], [-73, -18], [-66, -26], [-56, -32], [-46, -36], [-34, -38],
  [-22, -35], [-6, -33], [10, -35], [24, -35], [33, -30], [36, -20], [36, -8], [36, 4], [36, 14], [35, 23], [33, 28.5],
];

// Bahnhöfe (Farbe in dieser Reihenfolge: rot, blau, gelb, grün) und Waschanlage – fest an der Strecke.
// side: 1 = links, -1 = rechts der Fahrtrichtung (Gebäudeseite)
export const STATIONS = [
  { type: 'bahnhof', x: 17, z: 30, side: 1 }, // Dorf
  { type: 'bahnhof', x: 36, z: -12, side: -1 }, // Obstwiese
  { type: 'bahnhof', x: -33, z: 49.5, side: -1 }, // Bauernhof
  { type: 'bahnhof', x: 2, z: -33.5, side: 1 }, // Felder
  { type: 'waschanlage', x: -75, z: 2 },
];
