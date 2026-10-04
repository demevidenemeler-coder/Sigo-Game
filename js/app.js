import {
  loadSettings, saveSettings, loadSession, saveSession, loadTrain, saveTrain, loadTrack, saveTrack, loadHeard, saveHeard,
} from './settings.js';
import { LANGUAGES, setLanguage, lang, speechLang, t, nameOf, soundWordOf } from './i18n.js';
import {
  unlockAudio, playSound, speak, stopSpeaking, voiceInfo, setChannelVolume, animalSound, hasAnimalSound,
  preloadSamples, ANIMAL_SAMPLE_NAMES,
} from './audio.js';
import { Music } from './music.js';
import { loadRecordings, hasRecording, playRecording } from './recordings.js';
import { showVoiceStudio, PHRASE_KEYS, keys as recKeys } from './voiceStudio.js';
import { defaultTrain, upgradeTrain } from './catalog.js';
import { defaultTrackPoints } from './game/track.js';
import { Game } from './game/game.js';
import { preloadModels } from './game/models.js';

const overlay = document.getElementById('overlay');
let settings = loadSettings();
let session = loadSession();
setLanguage(settings.language);

// ---------- Ton & Sprache ----------

let speechToken = 0;

// Eigene Aufnahmen (Eltern-Bereich) haben Vorrang vor der Computerstimme
loadRecordings();
function phraseKeyOf(text) {
  const L = lang();
  return PHRASE_KEYS.find((k) => t(k) === text && hasRecording(recKeys.phrase(L, k)));
}

// ---- Weniger Worte, mehr Geräusche ----
// Ein Dreijähriger hört weg, wenn alles kommentiert wird. Deshalb wird jedes Wort/jeder Satz nur bei den ersten
// Malen gesprochen (und danach ab und zu zur Erinnerung); dazwischen sorgen Geräusche für die Rückmeldung.
// Zwischen zwei Sprechern liegt immer eine Pause. Eltern können im Eltern-Bereich auf „immer“ stellen.
const SPEAK_FIRST = 2; // so oft wird ein Wort zu Beginn gesprochen
const REMIND_EVERY = 9; // danach jedes 9. Mal
const MIN_GAP_MS = 2600; // Mindestabstand zwischen zwei gesprochenen Dingen
const ALWAYS_KEYS = ['bedtime', 'goodNight']; // wichtige Sätze (Schlafenszeit) immer sprechen
let heard = loadHeard();
let heardTimer = null;
let lastSpokenAt = 0;
let lastSfxAt = 0;

function shouldSpeak(key, always = false) {
  if (always || settings.voiceMode === 'always') {
    lastSpokenAt = Date.now();
    return true;
  }
  if (Date.now() - lastSpokenAt < MIN_GAP_MS) return false;
  const n = heard[key] ?? 0;
  const yes = n < SPEAK_FIRST || n % REMIND_EVERY === 0;
  heard[key] = n + 1;
  clearTimeout(heardTimer);
  heardTimer = setTimeout(() => saveHeard(heard), 2500);
  if (yes) lastSpokenAt = Date.now();
  return yes;
}

async function say(text, opts = {}) {
  if (!settings.voice) return;
  const pk = phraseKeyOf(text);
  if (pk && (await playRecording(recKeys.phrase(lang(), pk)))) return;
  await speak(text, { lang: speechLang(), rate: settings.speechRate, ...opts });
}

const music = new Music();
let bedtimeActive = false; // Lok wird ins Bett gebracht: keine Hintergrundmusik (nur das Wiegenlied)

// Musik und Zuggeräusche folgen den Einstellungen
function applySound() {
  setChannelVolume('engine', settings.sounds ? 1 : 0);
  setChannelVolume('sfx', settings.sounds ? 1 : 0);
  if (settings.music && document.body.dataset.screen === 'game' && !bedtimeActive) music.start(settings.musicVolume);
  else music.stop();
}

function sfx(name) {
  lastSfxAt = Date.now();
  return settings.sounds ? playSound(name) : Promise.resolve();
}

// Tiere: erst der echte Laut, dann der Name („Muuuh … Kuh“).
// Andere Dinge: Name, danach ggf. ein Ausruf („Kind … Juhu!“)
async function sayName(id) {
  const my = ++speechToken;
  stopSpeaking();
  const hasCall = settings.sounds && (hasRecording(recKeys.call(id)) || hasAnimalSound(id));
  if (hasCall) await callOf(id); // der Tierlaut kommt immer
  if (my !== speechToken) return;
  const speak1 = shouldSpeak(`name:${id}`);
  if (speak1) {
    await sayWord(id);
    const word = !hasCall && soundWordOf(id);
    if (word && my === speechToken && settings.sounds) {
      await speak(word, { lang: speechLang(), rate: settings.speechRate, pitch: 1.5 });
    }
  } else if (!hasCall && Date.now() - lastSfxAt > 500) {
    sfx('pop'); // kein Wort, aber eine Rückmeldung zum Antippen
  }
}

// Nur das Tiergeräusch (z. B. Tiere auf der Weide), ohne Namen
async function callOf(id) {
  if (await playRecording(recKeys.call(id))) return;
  await animalSound(id);
}

function animalCall(id) {
  if (settings.sounds) callOf(id);
}

// Name eines Dings: eigene Aufnahme, sonst Computerstimme
async function sayWord(id) {
  if (settings.voice && (await playRecording(recKeys.name(lang(), id)))) return;
  await say(nameOf(id));
}

function sayText(text) {
  const key = PHRASE_KEYS.find((k) => t(k) === text) ?? text;
  if (!shouldSpeak(`phrase:${key}`, ALWAYS_KEYS.includes(key))) return Promise.resolve();
  ++speechToken;
  stopSpeaking();
  return say(text);
}

// ---------- Spiel ----------

await preloadModels(); // Blender-Modelle (klein, kommen offline aus dem Speicher)
const game = new Game({
  canvas: document.getElementById('scene'),
  ui: document.getElementById('ui'),
  trainData: upgradeTrain(loadTrain() ?? defaultTrain()),
  trackData: loadTrack(),
  services: { say: sayText, sayName, animalCall, sfx, t, saveTrain, saveTrack, soundsOn: () => settings.sounds, bedDone: () => finishBedtime() },
});
game.setSeason(settings.season ?? 'auto');

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
  game.setSessionDusk(0);
}

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const delta = Math.min(now - lastTick, 5000);
  lastTick = now;
  if (document.body.dataset.screen !== 'game' || document.hidden) return;
  session.playedMs += delta;
  if (Math.round(session.playedMs / 1000) % 10 === 0) saveSession(session);
  // Die letzten 3 Minuten: Abendstimmung (kündigt das Spielende sanft an)
  const limit = settings.playMinutes * 60_000;
  game.setSessionDusk(limit >= 300_000 ? Math.min(1, Math.max(0, (session.playedMs - (limit - 180_000)) / 180_000)) : 0);
  if (settings.playMinutes > 0 && session.playedMs >= settings.playMinutes * 60_000) endSession();
}, 1000);

// Spielzeit um: erst bringt das Kind den Zug ins Bett (bed.js), danach kommt der Ruhe-Bildschirm
function endSession() {
  if (bedtimeActive) return;
  bedtimeActive = true;
  music.stop(); // die fröhliche Musik hört auf, damit das Wiegenlied allein spielt
  game.setMode('bed', { silent: true });
}

function finishBedtime() {
  bedtimeActive = false;
  session.restUntil = Date.now() + settings.restMinutes * 60_000;
  saveSession(session);
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
    preloadSamples(ANIMAL_SAMPLE_NAMES);
    goFullscreen();
    startPlaying();
  });
  wrap.append(play);
  showOverlay('start', wrap);
}

function startPlaying() {
  hideOverlay();
  game.start();
  // Nach dem Schlafen (oder wenn die Eltern weiterspielen lassen): zurück in die Werkstatt
  if (game.modeName === 'bed') {
    bedtimeActive = false;
    game.setMode('workshop', { silent: true });
  }
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
  page.append(row(t('voiceMode'), choice([['sparse', t('voiceSparse')], ['always', t('voiceAlways')]], settings.voiceMode,
    (v) => update({ voiceMode: v })), t('voiceModeHint')));
  page.append(row(t('season'), choice([['auto', t('seasonAuto')], ['fruehling', '🌸'], ['sommer', '☀️'], ['herbst', '🍂'], ['winter', '⛄']],
    settings.season ?? 'auto', (v) => { update({ season: v }); game.setSeason(v); }), t('seasonHint')));
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
      game.land.crossings.rebuild();
      [...game.land.objects.items].forEach((it) => game.land.objects.remove(it));
      game.land.clearAroundTrack();
      saveTrack(null);
      sfx('poof');
    }),
  );
  page.append(resets);
  page.append(row(t('voiceStudio'), button(t('voiceStudioOpen'), 'big secondary vs-open', () => openStudio()), t('voiceStudioShort')));

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

function openStudio() {
  showVoiceStudio({ el, button, t, nameOf, soundWord: soundWordOf, lang, show: showOverlay, sfx, onBack: showSettings });
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
