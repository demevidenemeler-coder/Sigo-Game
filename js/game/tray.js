// Leiste unten (Werkstatt und Bau-Modus): oben Fächer mit Symbol + Beschriftung,
// darunter eine Reihe großer Karten mit ◀ ▶ zum Blättern.

export function createTray(parent, { tabs = [], onTab, extraClass = '' } = {}) {
  const root = document.createElement('div');
  root.className = `tray hidden ${extraClass}`;

  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  for (const t of tabs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.dataset.tab = t.id;
    b.innerHTML = `<span class="tab-icon">${t.icon}</span><span class="tab-label"></span>`;
    b.querySelector('.tab-label').textContent = t.label;
    b.addEventListener('click', () => onTab?.(t.id));
    tabBar.append(b);
  }
  if (tabs.length) root.append(tabBar);

  const row = document.createElement('div');
  row.className = 'items-row';
  const left = document.createElement('button');
  left.type = 'button';
  left.className = 'scroll-btn left';
  left.textContent = '◀';
  const right = document.createElement('button');
  right.type = 'button';
  right.className = 'scroll-btn right';
  right.textContent = '▶';
  const items = document.createElement('div');
  items.className = 'tray-items';
  row.append(left, items, right);
  root.append(row);
  parent.append(root);

  const page = (dir) => items.scrollBy({ left: dir * items.clientWidth * 0.75, behavior: 'smooth' });
  left.addEventListener('click', () => page(-1));
  right.addEventListener('click', () => page(1));

  function updateArrows() {
    const overflow = items.scrollWidth > items.clientWidth + 4;
    row.classList.toggle('overflow', overflow);
    left.disabled = items.scrollLeft < 4;
    right.disabled = items.scrollLeft + items.clientWidth > items.scrollWidth - 4;
  }
  items.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);

  return {
    root,
    items,
    setItems(buttons) {
      items.replaceChildren(...buttons);
      items.scrollLeft = 0;
      requestAnimationFrame(updateArrows);
    },
    setActiveTab(id) {
      tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    },
    setLabels(labels) {
      tabBar.querySelectorAll('.tab').forEach((b) => {
        b.querySelector('.tab-label').textContent = labels[b.dataset.tab] ?? '';
      });
    },
    show() {
      root.classList.remove('hidden');
      requestAnimationFrame(updateArrows);
    },
    hide() {
      root.classList.add('hidden');
    },
    get hidden() {
      return root.classList.contains('hidden');
    },
    top() {
      return root.getBoundingClientRect().top;
    },
    height() {
      return root.getBoundingClientRect().height;
    },
    updateArrows,
  };
}
