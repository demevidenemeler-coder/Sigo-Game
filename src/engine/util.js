// Kleine Rechenhelfer, die überall gebraucht werden.

/** Zufallszahl zwischen a und b (b ausgeschlossen). rand(b) = 0…b */
export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + Math.random() * (b - a);
}

/** Zufällige ganze Zahl von a bis b (beide eingeschlossen). */
export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

/** Zufälliges Element einer Liste. */
export function pick(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

/** Liste zufällig mischen (neue Liste). */
export function shuffle(liste) {
  const neu = [...liste];
  for (let i = neu.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [neu[i], neu[j]] = [neu[j], neu[i]];
  }
  return neu;
}

export function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Abstand zweier Punkte. */
export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Warnung nur einmal pro Text in die Konsole schreiben. */
const schonGewarnt = new Set();
export function warnOnce(text) {
  if (schonGewarnt.has(text)) return;
  schonGewarnt.add(text);
  console.warn('[sigo] ' + text);
}
