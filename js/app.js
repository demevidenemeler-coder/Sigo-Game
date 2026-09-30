import { loadSettings, saveSettings, loadSession, saveSession } from './settings.js';
import { LANGUAGES, setLanguage, lang, speechLang, t, categoryName } from './i18n.js';
import { unlockAudio, playSound, speak, stopSpeaking, voiceInfo } from './audio.js';
import { CATEGORIES, itemName, itemSoundWord } from './items.js';
import { ACTIVITIES } from './activities/index.js';

const app = document.getElementById('app');
let settings = loadSettings();
let session = loadSession();
let restTimer = null;
let screenId = 0; // verhindert, dass alte Bildschirme nach einem Wechsel weiterlaufen

setLanguage(settings.language);

// ---------- Ton & Sprache ----------

let speechToken = 0;

async function say(text, opts = {}) {
  if (!settings.voice) return;
  await speak(text, { lang: speechLang(), rate: settings.speechRate, ...opts });
}

function sfx(name) {
  return settings.sounds ? playSound(name) : Promise.resolve();
}

async function sayItem(item) {
  const my = ++speechToken;
  stopSpeaking();
  await say(itemName(item, lang()));
  if (my !== speechToken || !settings.sounds) return;
  if (item.synth) {
    await playSound(item.synth);
  } else {
    const word = itemSoundWord(item, lang());
    if (word) await speak(word, { lang: speechLang(), rate: settings.speechRate, pitch: 1.5 });
  }
}

async function sayCategory(catId) {
  ++speechToken;
  stopSpeaking();
  await say(categoryName(catId));
}

const ctx = {
  get settings() { return settings; },
  t,
  say,
  sfx,
  sayItem,
  sayCategory,
};

// ---------- Hilfsfunktionen ----------

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function newScreen(name) {
  screenId++;
  clearInterval(restTimer);
  ++speechToken;
  stopSpeaking();
  app.replaceChildren();
  app.dataset.screen = name;
  return screenId;
}

function goFullscreen() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
}

function isResting() {
  return session.restUntil && Date.now() < session.restUntil;
}

function resetSession() {
  session = { roundsDone: 0, restUntil: 0 };
  saveSession(session);
}

// ---------- Bildschirme ----------

function showHome() {
  if (isResting()) return showRest();
  if (session.restUntil) resetSession(); // Pause ist vorbei
  newScreen('home');

  const wrap = el('div', 'home-screen');
  for (const act of ACTIVITIES) {
    const btn = el('button', 'activity-btn');
    btn.type = 'button';
    btn.append(el('span', 'activity-icon', act.icon));
    btn.addEventListener('click', () => {
      unlockAudio();
      goFullscreen();
      say(t(act.titleKey));
      startRound(act);
    });
    wrap.append(btn);
  }
  app.append(wrap);
}

function progressDots() {
  const bar = el('div', 'progress');
  for (let i = 0; i < settings.roundsPerSession; i++) {
    bar.append(el('span', i < session.roundsDone ? 'dot filled' : 'dot'));
  }
  return bar;
}

async function startRound(act) {
  if (session.roundsDone >= settings.roundsPerSession) return endSession();
  const my = newScreen('activity');

  const stage = el('div', 'stage');
  app.append(progressDots(), stage);

  await act.play(stage, ctx);
  if (my !== screenId) return; // Eltern haben zwischendurch die Einstellungen geöffnet

  session.roundsDone++;
  saveSession(session);
  app.querySelector('.progress')?.replaceWith(progressDots());

  if (session.roundsDone >= settings.roundsPerSession) {
    setTimeout(() => { if (my === screenId) endSession(); }, 1200);
    return;
  }

  // Das Kind entscheidet selbst, ob es weitergeht
  const next = el('button', 'next-btn', '▶');
  next.type = 'button';
  next.setAttribute('aria-label', 'Nochmal');
  next.addEventListener('click', () => startRound(act));
  app.append(next);
}

function endSession() {
  session.restUntil = Date.now() + settings.restMinutes * 60_000;
  saveSession(session);
  showRest(true);
}

function showRest(justFinished = false) {
  newScreen('rest');
  const wrap = el('div', 'rest-screen');
  const scene = el('div', 'rest-scene');
  scene.append(el('span', 'rest-moon', '🌙'), el('span', 'rest-animal', '🐻'), el('span', 'rest-z', 'z'));
  wrap.append(scene);
  app.append(wrap);
  if (justFinished) say(t('restSpeech'));

  const offerRestart = () => {
    if (isResting()) return false;
    clearInterval(restTimer);
    const again = el('button', 'next-btn', '▶');
    again.type = 'button';
    again.addEventListener('click', () => {
      resetSession();
      showHome();
    });
    wrap.append(again);
    return true;
  };
  if (!offerRestart()) restTimer = setInterval(offerRestart, 15_000);
}

// ---------- Eltern-Bereich ----------

function row(label, control, hint) {
  const r = el('div', 'set-row');
  const l = el('div', 'set-label', label);
  r.append(l, control);
  if (hint) r.append(el('div', 'set-hint', hint));
  return r;
}

function choice(options, value, onChange) {
  const group = el('div', 'choice');
  for (const [val, label] of options) {
    const b = el('button', val === value ? 'opt active' : 'opt', label);
    b.type = 'button';
    b.addEventListener('click', () => {
      group.querySelectorAll('.opt').forEach((o) => o.classList.remove('active'));
      b.classList.add('active');
      onChange(val);
    });
    group.append(b);
  }
  return group;
}

function update(patch) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
}

function showSettings() {
  newScreen('settings');
  const page = el('div', 'settings');
  page.append(el('h1', null, t('settingsTitle')), el('p', 'set-info', t('parentInfo')));

  page.append(row(t('language'), choice(
    Object.entries(LANGUAGES).map(([code, l]) => [code, l.label]),
    settings.language,
    (v) => { update({ language: v }); setLanguage(v); showSettings(); },
  )));

  const topics = el('div', 'choice');
  for (const c of CATEGORIES) {
    const b = el('button', settings.categories[c.id] ? 'opt active' : 'opt', categoryName(c.id));
    b.type = 'button';
    b.addEventListener('click', () => {
      const next = { ...settings.categories, [c.id]: !settings.categories[c.id] };
      if (Object.values(next).filter(Boolean).length < 2) return; // mind. zwei Körbe
      update({ categories: next });
      b.classList.toggle('active', next[c.id]);
    });
    topics.append(b);
  }
  page.append(row(t('topics'), topics, t('topicsHint')));

  page.append(row(t('homesPerRound'), choice([[2, '2'], [3, '3']], settings.homesPerRound,
    (v) => update({ homesPerRound: v }))));
  page.append(row(t('itemsPerRound'), choice([3, 4, 6, 8].map((n) => [n, String(n)]), settings.itemsPerRound,
    (v) => update({ itemsPerRound: v }))));
  page.append(row(t('roundsPerSession'), choice([1, 2, 3, 5, 8].map((n) => [n, String(n)]), settings.roundsPerSession,
    (v) => update({ roundsPerSession: v }))));
  page.append(row(t('restMinutes'), choice(
    [[0, t('noRest')], ...[15, 30, 60, 120].map((n) => [n, `${n} ${t('minutes')}`])],
    settings.restMinutes,
    (v) => update({ restMinutes: v }),
  )));

  const onOff = [[true, t('on')], [false, t('off')]];
  const voiceName = voiceInfo(speechLang());
  page.append(row(t('voice'), choice(onOff, settings.voice, (v) => update({ voice: v })),
    voiceName ? t('voiceOk', { name: voiceName }) : t('voiceMissing')));
  page.append(row(t('speechRate'), choice([[0.7, t('slow')], [0.85, t('normal')]], settings.speechRate,
    (v) => update({ speechRate: v }))));
  page.append(row(t('sounds'), choice(onOff, settings.sounds, (v) => update({ sounds: v }))));

  if (isResting()) {
    const time = new Date(session.restUntil).toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' });
    page.append(el('p', 'set-info', t('restActive', { time })));
  }

  const actions = el('div', 'set-actions');
  const back = el('button', 'big', t('back'));
  back.type = 'button';
  back.addEventListener('click', showHome);
  const fresh = el('button', 'big secondary', t('newSession'));
  fresh.type = 'button';
  fresh.addEventListener('click', () => { resetSession(); showHome(); });
  actions.append(back, fresh);
  page.append(actions);

  app.append(page);
}

// 3 Sekunden gedrückt halten öffnet den Eltern-Bereich
function setupParentGate() {
  const btn = document.getElementById('parent-btn');
  btn.title = t('holdHint');
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    btn.classList.remove('holding');
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    btn.classList.add('holding');
    timer = setTimeout(() => {
      cancel();
      if (app.dataset.screen !== 'settings') {
        speechSynthesis?.getVoices();
        showSettings();
      }
    }, 3000);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- Start ----------

document.addEventListener('contextmenu', (e) => e.preventDefault());
setupParentGate();
showHome();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
