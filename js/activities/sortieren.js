// Aktivität „Aufräumen": Dinge in den passenden Korb ziehen (Montessori: Klassifizieren).
// Fehlerkontrolle steckt im Material: Was nicht passt, rutscht zurück – ohne Fehlerton.

import { CATEGORIES, ITEMS } from '../items.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRound(settings) {
  const enabled = CATEGORIES.map((c) => c.id).filter((id) => settings.categories[id]);
  const count = Math.min(settings.homesPerRound, enabled.length);
  // Körbe immer in derselben Reihenfolge – räumliche Beständigkeit hilft kleinen Kindern
  const cats = shuffle(enabled).slice(0, count).sort(
    (a, b) => enabled.indexOf(a) - enabled.indexOf(b),
  );
  const pools = Object.fromEntries(cats.map((c) => [c, shuffle(ITEMS.filter((i) => i.cat === c))]));
  // Ein Beispielbild pro Korb zeigt, was hinein gehört (nicht Teil der Runde)
  const examples = Object.fromEntries(cats.map((c) => [c, pools[c].pop()]));
  const items = [];
  const target = Math.max(settings.itemsPerRound, cats.length);
  for (let k = 0; items.length < target && k < 100; k++) {
    const next = pools[cats[k % cats.length]].pop();
    if (next) items.push(next);
  }
  return { cats, examples, items: shuffle(items) };
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

export default {
  id: 'sortieren',
  icon: '🧺',
  titleKey: 'actSort',

  // Spielt eine Runde. Endet (Promise), wenn alles aufgeräumt ist.
  play(stage, ctx) {
    const { cats, examples, items } = pickRound(ctx.settings);

    const board = el('div', 'sort-board');
    const itemArea = el('div', 'sort-items');
    const homeArea = el('div', 'sort-homes');
    board.append(itemArea, homeArea);
    stage.append(board);

    const homes = cats.map((catId) => {
      const cat = CATEGORIES.find((c) => c.id === catId);
      const home = el('div', 'home');
      home.dataset.cat = catId;
      home.style.setProperty('--home-color', cat.color);
      const example = el('div', 'home-example', examples[catId].emoji);
      const content = el('div', 'home-content');
      home.append(example, content);
      home.addEventListener('pointerup', (e) => {
        if (e.target.closest('.item')) return;
        ctx.sayCategory(catId, examples[catId]);
      });
      homeArea.append(home);
      return home;
    });

    function homeAt(x, y) {
      const slack = 24;
      return homes.find((h) => {
        const r = h.getBoundingClientRect();
        return x >= r.left - slack && x <= r.right + slack && y >= r.top - slack && y <= r.bottom + slack;
      });
    }

    return new Promise((resolve) => {
      let remaining = items.length;

      async function accept(tile, home, item, dx, dy) {
        tile.classList.add('done');
        const content = home.querySelector('.home-content');
        const tr = tile.getBoundingClientRect();
        const cr = content.getBoundingClientRect();
        const tx = dx + (cr.left + cr.width / 2) - (tr.left + tr.width / 2);
        const ty = dy + (cr.top + cr.height / 2) - (tr.top + tr.height / 2);
        tile.style.transition = 'transform .35s ease-in, opacity .35s ease-in';
        tile.style.transform = `translate(${tx}px, ${ty}px) scale(.35)`;
        tile.style.opacity = '0';
        await new Promise((r) => setTimeout(r, 350));
        tile.style.visibility = 'hidden';
        content.append(el('span', 'mini', item.emoji));
        home.classList.remove('pulse');
        void home.offsetWidth;
        home.classList.add('pulse');
        ctx.sfx('plop');
        remaining--;
        const said = ctx.sayItem(item);
        if (remaining === 0) {
          await said;
          await new Promise((r) => setTimeout(r, 400));
          board.classList.add('finished');
          ctx.sfx('chime');
          await ctx.say(ctx.t('allSorted'));
          resolve();
        }
      }

      function goBack(tile) {
        tile.style.transition = 'transform .45s cubic-bezier(.3,1.5,.5,1)';
        tile.style.transform = '';
      }

      for (const item of items) {
        const tile = el('button', 'item');
        tile.type = 'button';
        tile.append(el('span', 'emoji', item.emoji));
        tile.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
        itemArea.append(tile);

        tile.addEventListener('pointerdown', (e) => {
          if (tile.classList.contains('done') || tile.classList.contains('dragging')) return;
          e.preventDefault();
          tile.setPointerCapture(e.pointerId);
          const sx = e.clientX;
          const sy = e.clientY;
          let dx = 0;
          let dy = 0;
          let moved = false;
          let hovered = null;
          tile.classList.add('dragging');
          tile.style.transition = 'none';

          const onMove = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            dx = ev.clientX - sx;
            dy = ev.clientY - sy;
            if (Math.hypot(dx, dy) > 12) moved = true;
            tile.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
            const h = moved ? homeAt(ev.clientX, ev.clientY) : null;
            if (h !== hovered) {
              hovered?.classList.remove('hover');
              h?.classList.add('hover');
              hovered = h;
            }
          };

          const onEnd = (ev) => {
            if (ev.pointerId !== e.pointerId) return;
            tile.removeEventListener('pointermove', onMove);
            tile.removeEventListener('pointerup', onEnd);
            tile.removeEventListener('pointercancel', onEnd);
            tile.classList.remove('dragging');
            hovered?.classList.remove('hover');

            if (!moved) {
              // Antippen: benennen und Geräusch
              goBack(tile);
              tile.classList.remove('wiggle');
              void tile.offsetWidth;
              tile.classList.add('wiggle');
              ctx.sayItem(item);
              return;
            }
            const home = ev.type === 'pointerup' ? homeAt(ev.clientX, ev.clientY) : null;
            if (home && home.dataset.cat === item.cat) accept(tile, home, item, dx, dy);
            else goBack(tile);
          };

          tile.addEventListener('pointermove', onMove);
          tile.addEventListener('pointerup', onEnd);
          tile.addEventListener('pointercancel', onEnd);
        });
      }
    });
  },
};
