import {
  loadSettings, saveSettings, loadSession, saveSession, loadTrain, saveTrain, loadTrack, saveTrack,
} from './settings.js';
import { LANGUAGES, setLanguage, lang, speechLang, t, nameOf, soundWordOf } from './i18n.js';
import { unlockAudio, playSound, speak, stopSpeaking, voiceInfo, setChannelVolume } from './audio.js';
import { Music } from './music.js';
import { defaultTrain } from './catalog.js';
import { defaultTrackPoints } from './game/track.js';
import { Game } from './game/game.js';

const overlay = document.getElementById('overlay');
let settings = loadSettings();
let session = loadSession();
setLanguage(settings.language);

// ---------- Ton & Sprache ----------

let speechToken = 0;

async function say(text, opts = {}) {
  if (!settings.voice) return;
  await speak(text, { lang: speechLang(), rate: settings.speechRate, ...opts });
}

const music = new Music();

// Musik und Zuggeräusche folgen den Einstellungen
function applySound() {
  setChannelVolume('engine', settings.sounds ? 1 : 0);
  setChannelVolume('sfx', settings.sounds ? 1 : 0);
  if (settings.music && document.body.dataset.screen === 'game') music.start(settings.musicVolume);
  else music.stop();
}

function sfx(name) {
  return settings.sounds ? playSound(name) : Promise.resolve();
}

// Name sagen, bei Tieren und Leuten danach das Lautwort („Kuh … Muuh“)
async function sayName(id) {
  const my = ++speechToken;
  stopSpeaking();
  await say(nameOf(id));
  const word = soundWordOf(id);
  if (word && my === speechToken && settings.sounds) {
    await speak(word, { lang: speechLang(), rate: settings.speechRate, pitch: 1.5 });
  }
}

function sayText(text) {
  ++speechToken;
  stopSpeaking();
  return say(text);
}

// ---------- Spiel ----------

const game = new Game({
  canvas: document.getElementById('scene'),
  ui: document.getElementById('ui'),
  trainData: loadTrain() ?? defaultTrain(),
  trackPoints: loadTrack(),
  services: { say: sayText, sayName, sfx, t, saveTrain, saveTrack, soundsOn: () => settings.sounds },
});

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function showOverlay(name, content) {
  overlay.replaceChildren(content);
  overlay.dataset.screen = name;
  overlay.classList.remove('hidden');
  document.body.dataset.screen = name;
  music.stop();
}

function hideOverlay() {
  overlay.classList.add('hidden');
  overlay.replaceChildren();
  document.body.dataset.screen = 'game';
  applySound();
}

function goFullscreen() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().catch(() => {});
}

// ---------- Spielzeit & Pause ----------

const isResting = () => session.restUntil && Date.now() < session.restUntil;

function resetSession() {
  session = { playedMs: 0, restUntil: 0 };
  saveSession(session);
}

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const delta = Math.min(now - lastTick, 5000);
  lastTick = now;
  if (document.body.dataset.screen !== 'game' || document.hidden) return;
  session.playedMs += delta;
  if (Math.round(session.playedMs / 1000) % 10 === 0) saveSession(session);
  if (settings.playMinutes > 0 && session.playedMs >= settings.playMinutes * 60_000) endSession();
}, 1000);

function endSession() {
  session.restUntil = Date.now() + settings.restMinutes * 60_000;
  saveSession(session);
  sayText(t('tired'));
  showRest();
}

let restTimer = null;
function showRest() {
  game.stop();
  const wrap = el('div', 'rest-screen');
  const scene = el('div', 'rest-scene');
  scene.append(el('span', 'rest-moon', '🌙'), el('span', 'rest-animal', '🚂'), el('span', 'rest-z', 'z'));
  wrap.append(scene);
  showOverlay('rest', wrap);

  clearInterval(restTimer);
  const offerRestart = () => {
    if (isResting()) return false;
    clearInterval(restTimer);
    const again = el('button', 'big-play', '▶');
    again.type = 'button';
    again.addEventListener('click', () => {
      resetSession();
      startPlaying();
    });
    wrap.append(again);
    return true;
  };
  if (!offerRestart()) restTimer = setInterval(offerRestart, 15_000);
}

// ---------- Start ----------

function showStart() {
  if (isResting()) return showRest();
  if (session.restUntil) resetSession(); // Pause ist vorbei
  game.setMode('workshop', { silent: true });
  game.start();
  const wrap = el('div', 'start-screen');
  const play = el('button', 'big-play', '▶');
  play.type = 'button';
  play.addEventListener('click', () => {
    unlockAudio();
    goFullscreen();
    startPlaying();
  });
  wrap.append(play);
  showOverlay('start', wrap);
}

function startPlaying() {
  hideOverlay();
  game.start();
  if (!game.modeName) game.setMode('workshop');
  else {
    game.refreshMode(); // falls in den Einstellungen Zug oder Strecke zurückgesetzt wurden
    sayText(t(game.modeName));
  }
  lastTick = Date.now();
}

// ---------- Eltern-Bereich ----------

function row(label, control, hint) {
  const r = el('div', 'set-row');
  r.append(el('div', 'set-label', label), control);
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

function button(label, cls, onClick) {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function showSettings() {
  game.stop();
  stopSpeaking();
  const page = el('div', 'settings');
  page.append(el('h1', null, t('settingsTitle')), el('p', 'set-info', t('parentInfo')));

  page.append(row(t('language'), choice(
    Object.entries(LANGUAGES).map(([code, l]) => [code, l.label]),
    settings.language,
    (v) => { update({ language: v }); setLanguage(v); showSettings(); },
  )));
  page.append(row(t('playMinutes'), choice(
    [...[10, 15, 20, 30].map((n) => [n, `${n} ${t('minutes')}`]), [0, t('unlimited')]],
    settings.playMinutes,
    (v) => update({ playMinutes: v }),
  ), t('playedToday', { min: Math.floor(session.playedMs / 60_000) })));
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
  page.append(row(t('music'), choice(onOff, settings.music, (v) => update({ music: v }))));
  page.append(row(t('musicVolume'), choice([[0.3, t('quiet')], [0.5, t('medium')], [0.8, t('loud')]], settings.musicVolume,
    (v) => update({ musicVolume: v }))));

  if (isResting()) {
    const time = new Date(session.restUntil).toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' });
    page.append(el('p', 'set-info', t('restActive', { time })));
  }

  const resets = el('div', 'set-actions');
  resets.append(
    button(t('resetTrain'), 'big secondary', () => {
      const data = defaultTrain();
      game.train.data = data;
      game.train.rebuild();
      saveTrain(data);
      sfx('poof');
    }),
    button(t('resetTrack'), 'big secondary', () => {
      const pts = defaultTrackPoints();
      game.land.track.setPoints(pts);
      game.land.clearAroundTrack();
      saveTrack(null);
      sfx('poof');
    }),
  );
  page.append(resets);

  const actions = el('div', 'set-actions');
  actions.append(
    button(t('back'), 'big', () => (isResting() ? showRest() : startPlaying())),
    button(t('newSession'), 'big secondary', () => {
      resetSession();
      startPlaying();
    }),
  );
  page.append(actions);
  showOverlay('settings', page);
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
      if (document.body.dataset.screen !== 'settings') showSettings();
    }, 3000);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
}

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveSession(session);
});
setupParentGate();
showStart();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Nur beim Entwickeln am Computer: Zugriff für automatische Tests
if (location.hostname === 'localhost') window.__game = game;
