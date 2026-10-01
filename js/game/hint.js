// Zeige-Hand: zeigt kleinen Kindern ohne Worte, was man machen kann.
// - tap(x, y): Hand kommt, drückt zweimal (mit Kringel)
// - drag(x0, y0, x1, y1, bild): Hand nimmt etwas und zieht es hin
// - path(punkte): Hand malt eine Linie (z. B. eine Strecke)
// Sobald irgendwo getippt wird, verschwindet sie. Nach jedem Hinweis wird länger gewartet;
// nach einigen Hinweisen ohne Reaktion ist Ruhe, bis wieder getippt wird.

export class Hint {
  constructor(ui) {
    this.el = document.createElement('div');
    this.el.className = 'hint2 hidden';
    this.el.innerHTML = '<div class="hint2-carry"></div><span class="hint2-hand">👆</span>';
    this.ring = document.createElement('div');
    this.ring.className = 'hint2-ring hidden';
    ui.append(this.ring, this.el);
    this.carry = this.el.querySelector('.hint2-carry');
    this.anim = null;
    this.lastTouch = performance.now();
    this.shown = 0;
    this.playing = false;
    window.addEventListener('pointerdown', () => this.touched(), true);
  }

  touched() {
    this.lastTouch = performance.now();
    this.shown = 0;
    this.hide();
  }

  // Ist es Zeit für einen Hinweis? (wartet länger, je öfter schon gezeigt wurde)
  due(ms) {
    if (this.playing || this.shown >= 4) return false;
    return performance.now() - this.lastTouch > ms * (1 + this.shown * 0.6);
  }

  hide() {
    this.anim?.cancel();
    this.ringAnim?.cancel();
    this.anim = null;
    this.playing = false;
    this.el.classList.add('hidden');
    this.ring.classList.add('hidden');
  }

  setCarry(img) {
    this.carry.replaceChildren();
    if (!img) return;
    if (img.startsWith('#')) {
      const pot = document.createElement('span');
      pot.className = 'pot';
      pot.style.background = img;
      this.carry.append(pot);
    } else {
      const i = document.createElement('img');
      i.src = img;
      i.alt = '';
      this.carry.append(i);
    }
  }

  start(keyframes, duration, img) {
    this.hide();
    this.setCarry(img);
    this.el.classList.remove('hidden');
    this.playing = true;
    this.shown++;
    this.anim = this.el.animate(keyframes, { duration, easing: 'ease-in-out', fill: 'forwards' });
    this.anim.onfinish = () => {
      this.playing = false;
      this.el.classList.add('hidden');
      this.lastTouch = performance.now();
    };
  }

  pulseRing(x, y, delay) {
    this.ring.style.left = `${x}px`;
    this.ring.style.top = `${y}px`;
    this.ring.classList.remove('hidden');
    this.ringAnim = this.ring.animate(
      [{ transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0 }],
      { duration: 650, delay, iterations: 2, fill: 'both' },
    );
  }

  tap(x, y) {
    const at = (dx, dy, s, o) => ({ transform: `translate(${x + dx}px, ${y + dy}px) scale(${s})`, opacity: o });
    this.start([
      { ...at(90, 110, 1, 0), offset: 0 },
      { ...at(0, 0, 1, 1), offset: 0.3 },
      { ...at(0, 0, 0.82, 1), offset: 0.4 },
      { ...at(0, 0, 1, 1), offset: 0.5 },
      { ...at(0, 0, 0.82, 1), offset: 0.6 },
      { ...at(0, 0, 1, 1), offset: 0.75 },
      { ...at(30, 40, 1, 0), offset: 1 },
    ], 2400);
    this.pulseRing(x, y, 2400 * 0.38);
  }

  tapElement(el) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    this.tap(r.left + r.width / 2, r.top + r.height / 2);
  }

  drag(x0, y0, x1, y1, img) {
    const at = (x, y, s, o) => ({ transform: `translate(${x}px, ${y}px) scale(${s})`, opacity: o });
    this.start([
      { ...at(x0, y0, 1, 0), offset: 0 },
      { ...at(x0, y0, 0.88, 1), offset: 0.15 },
      { ...at(x1, y1, 1, 1), offset: 0.7 },
      { ...at(x1, y1, 1, 1), offset: 0.85 },
      { ...at(x1, y1, 1, 0), offset: 1 },
    ], 2600, img);
  }

  // punkte: [[x, y], …] – die Hand malt sie nach
  path(points) {
    const n = points.length;
    const frames = points.map(([x, y], i) => ({ transform: `translate(${x}px, ${y}px)`, opacity: i === 0 || i === n - 1 ? 0 : 1, offset: i / (n - 1) }));
    this.start(frames, 3600);
  }
}
