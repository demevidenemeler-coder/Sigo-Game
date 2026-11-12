// Feste Maße der Zugfahrt (Szenen-Koordinaten: x = 0 Bildmitte, y 0 oben … 1600 unten).

export const GLEIS_Y = 1250;      // Lauffläche der Schiene (dort stehen die Räder)
export const LOK_X = 380;         // Vorderkante der Lok – der Zug steht, die Landschaft zieht vorbei
export const ZUG_SKALA = 0.5;
export const TEMPO = 380;         // Höchsttempo (Einheiten/s) – ruhig
export const ANFAHREN = 140;      // Beschleunigung beim Anfahren (Einheiten/s²): in ~3 s auf Tempo
export const BREMSEN = 125;       // geplante Verzögerung vor einem Halt (Einheiten/s²)
export const BREMSEN_MAX = 210;   // stärker wird nie gebremst

export const HINTEN_Y = 1178;     // Standlinie der Dinge hinter dem Gleis
export const VORNE_Y = 1495;      // Standlinie der vorderen Reihe (zwischen Gleis und Gras)

// Zeichenreihenfolge in scene.world
export const Z = {
  boden: -100,
  hinten: 10,      // Bäume, Häuser, Bahnhof (unter sich nach Standlinie sortiert)
  strasse: 15,     // Straße am Bahnübergang (unter der Schiene)
  gleis: 20,
  bruecke: 25,     // Xylophon-Brücke (über der Schiene, unter dem Zug)
  aufGleis: 28,    // Tier auf dem Gleis
  zug: 30,
  vorn: 40,        // Tunnelberg, Waschbogen (vor dem Zug)
  vorne: 45,       // vordere Reihe (Blumen, Luftballons, Auto)
  flug: 50,        // fliegende Äpfel, Schmetterling, losgelassene Ballons
};

// Abstand zwischen zwei Stationen (Mitte zu Mitte)
export const STATION_ABSTAND = [2600, 3600];
