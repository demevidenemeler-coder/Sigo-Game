// Eltern-Bereich: „Eigene Stimme“ – Tierlaute, Namen und Sätze selbst einsprechen.
// Eine Zeile pro Eintrag: 🎙 (aufnehmen / stoppen), ▶ (anhören), 🗑 (löschen). Aufnahmen bleiben auf dem Gerät.

import { LOCOS, WAGONS, COLORS, DECOR, ANIMALS, PASSENGERS, FOODS } from './catalog.js';
import { WHEEL_STYLES } from './game/wheelStyles.js';
import {
  canRecord, startRecording, saveRecording, deleteRecording, hasRecording, playRecording, recordingCount,
} from './recordings.js';

// Sätze, die die Stimme im Spiel sagt (Schlüssel in i18n)
export const PHRASE_KEYS = ['station', 'thanks', 'yummy', 'noThanks', 'sparkling', 'washHint', 'trackDone', 'autoBridge', 'autoTunnel',
  'autoCrossing', 'rainbowSay', 'bedtime', 'goodNight', 'full', 'bye'];
const WEATHER_IDS = ['tag', 'abend', 'nacht', 'sonne', 'regen', 'schnee'];

export const keys = {
  call: (id) => `call:${id}`,
  name: (lang, id) => `${lang}|name:${id}`,
  phrase: (lang, k) => `${lang}|phrase:${k}`,
};

export function showVoiceStudio({ el, button, t, nameOf, soundWord = () => '', lang, show, onBack, sfx }) {
  const page = el('div', 'settings voice-studio');
  page.append(el('h1', null, t('voiceStudio')), el('p', 'set-info', t('voiceStudioInfo')));
  if (!canRecord()) page.append(el('p', 'set-info warn', t('voiceNoMic')));

  const L = lang();
  let active = null; // { key, rec, row }
  let playing = false;

  const groups = [
    [t('vsCalls'), ANIMALS.map((a) => ({ key: keys.call(a.id), label: soundWord(a.id) ? `${nameOf(a.id)} – „${soundWord(a.id)}“` : nameOf(a.id) }))],
    [t('vsNames'), [...ANIMALS, ...PASSENGERS, ...LOCOS, ...WAGONS, ...FOODS, ...COLORS, ...DECOR, ...WHEEL_STYLES.map((id) => ({ id })), ...WEATHER_IDS.map((id) => ({ id }))]
      .filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i)
      .map((e) => ({ key: keys.name(L, e.id), label: nameOf(e.id) }))],
    [t('vsPhrases'), PHRASE_KEYS.map((k) => ({ key: keys.phrase(L, k), label: t(k) }))],
  ];

  const counter = el('p', 'set-info');
  const refreshCounter = () => { counter.textContent = t('vsCount', { n: recordingCount() }); };
  refreshCounter();
  page.append(counter);

  const setState = (row, key) => {
    const has = hasRecording(key);
    row.classList.toggle('has', has);
    row.querySelector('.vs-play').disabled = !has;
    row.querySelector('.vs-del').disabled = !has;
    row.querySelector('.vs-mark').textContent = has ? '✓' : '';
  };

  let starting = false;
  async function toggleRecord(row, key) {
    if (starting) return; // Mikrofon wird gerade geöffnet
    if (active) {
      const a = active;
      active = null;
      await finishRecording(a, await a.rec.stop());
      return;
    }
    try {
      starting = true;
      row.classList.add('recording');
      const rec = await startRecording(async (result) => {
        if (active && active.key === key) {
          const a = active;
          active = null;
          await finishRecording(a, result);
        }
      });
      active = { key, rec, row };
      starting = false;
      sfx('pop');
    } catch {
      starting = false;
      row.classList.remove('recording');
      page.querySelector('.vs-error').textContent = t('voiceNoMic');
    }
  }

  async function finishRecording(a, result) {
    a.row.classList.remove('recording');
    if (result.silent) {
      page.querySelector('.vs-error').textContent = t('vsSilent');
      return;
    }
    page.querySelector('.vs-error').textContent = '';
    await saveRecording(a.key, result.blob);
    setState(a.row, a.key);
    refreshCounter();
    playRecording(a.key);
  }

  page.append(el('p', 'set-info warn vs-error'));

  for (const [title, entries] of groups) {
    const details = el('details', 'vs-group');
    const sum = el('summary', null, `${title} (${entries.length})`);
    details.append(sum);
    for (const { key, label } of entries) {
      const row = el('div', 'vs-row');
      row.append(el('span', 'vs-label', label), el('span', 'vs-mark'));
      const rec = button('🎙', 'vs-btn vs-rec', () => toggleRecord(row, key));
      const play = button('▶', 'vs-btn vs-play', async () => {
        if (playing) return;
        playing = true;
        await playRecording(key);
        playing = false;
      });
      const del = button('🗑', 'vs-btn vs-del', async () => {
        await deleteRecording(key);
        setState(row, key);
        refreshCounter();
      });
      row.append(rec, play, del);
      setState(row, key);
      if (!canRecord()) rec.disabled = true;
      details.append(row);
    }
    page.append(details);
  }

  const actions = el('div', 'set-actions');
  actions.append(button(t('back'), 'big', () => {
    active?.rec.cancel();
    onBack();
  }));
  page.append(actions);
  show('settings', page);
}
