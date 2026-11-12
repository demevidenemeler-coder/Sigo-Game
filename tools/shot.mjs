// Testfoto-Werkzeug für Sigo 2: startet einen kleinen Dateiserver und ein unsichtbares Chrome,
// öffnet eine Szene, spielt Aktionen ab, macht Fotos und meldet Fehler aus der Seite.
//
//   node tools/shot.mjs --szene bauernhof --out shots/hof.png --warte 2 \
//        --aktionen '[["tap",1280,900],["drag",600,1200,1500,900],["foto","hof2"]]'
//   node tools/shot.mjs --url art/werkzeugtest/testseite.html --ohne-ready --out shots/test.jpg
//
// Hilfe: node tools/shot.mjs --hilfe

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WERKZEUGE = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(WERKZEUGE, '..');
const CHROME = process.env.CHROME || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const BUEHNE_H = 1600;   // Bühnenhöhe in Einheiten (Breite folgt dem Bildschirm)

const HILFE = `Testfoto mit echtem Chrome (ohne Fenster).

  node tools/shot.mjs --szene <id> [--out shots/<name>.png] [Optionen]
  node tools/shot.mjs --url <pfad> --ohne-ready [--out ...]

Optionen:
  --szene <id>         öffnet /?szene=<id>&test=1
  --url <pfad>         beliebige Seite relativ zum Projektordner (statt --szene)
  --param a=b          weiterer Adress-Parameter (mehrfach möglich)
  --out <datei>        Schlussfoto (.jpg Qualität 80 oder .png); Standard shots/<szene>.png
  --warte <sek>        nach dem Laden warten (Standard 1.5)
  --aktionen <json>    JSON-Text oder @datei.json, Liste von Aktionen (siehe unten)
  --gross              Gerätepixel-Faktor 2 (Fotos 2560×1600 statt 1280×800)
  --touch              Tippen/Ziehen als Finger (Touch) statt Maus
  --ohne-ready         nicht auf window.__sigo.ready warten
  --swiftshader        Grafikkarte nicht benutzen (WebGL über SwiftShader, langsamer)
  --zeitlimit <sek>    Notbremse für den ganzen Lauf (Standard 180)

Aktionen (Koordinaten in Bühnen-Einheiten, x 0…2560, y 0…1600 bei 16:10):
  ["tap",x,y]  ["drag",x1,y1,x2,y2,dauerSek?]  ["halten",x,y,sek]  ["warte",sek]
  ["foto","name"] → shots/<name>.jpg     ["js","ausdruck"] → Ergebnis in der Zusammenfassung

Ausgabe: am Ende eine JSON-Zeile {ok, fehler, warnungen, fotos, renderer, ergebnisse, fps?}.
Exit-Code 1, wenn es Fehler gab (Seitenfehler, console.error, fehlende Dateien außer Tönen).
Chrome-Pfad per Umgebungsvariable CHROME änderbar.`;

// ---------------------------------------------------------------------------
// Befehlszeile
// ---------------------------------------------------------------------------

function argumenteLesen(liste) {
  const opt = { params: [], warte: 1.5, gross: false, touch: false, ohneReady: false, zeitlimit: 180 };
  for (let i = 0; i < liste.length; i++) {
    const name = liste[i];
    const wert = () => {
      if (i + 1 >= liste.length) throw new Error(`${name} braucht einen Wert`);
      return liste[++i];
    };
    switch (name) {
      case '--szene': opt.szene = wert(); break;
      case '--url': opt.url = wert(); break;
      case '--param': opt.params.push(wert()); break;
      case '--out': opt.out = wert(); break;
      case '--warte': opt.warte = Number(wert()); break;
      case '--aktionen': opt.aktionen = wert(); break;
      case '--gross': opt.gross = true; break;
      case '--touch': opt.touch = true; break;
      case '--ohne-ready': opt.ohneReady = true; break;
      case '--swiftshader': opt.swiftshader = true; break;
      case '--zeitlimit': opt.zeitlimit = Number(wert()); break;
      case '-h': case '--hilfe': case '--help': opt.hilfe = true; break;
      default: throw new Error(`unbekannte Option: ${name}`);
    }
  }
  return opt;
}

function aktionenLesen(text) {
  if (!text) return [];
  const json = text.startsWith('@') ? fs.readFileSync(path.resolve(text.slice(1)), 'utf8') : text;
  const liste = JSON.parse(json);
  if (!Array.isArray(liste) || !liste.every(Array.isArray)) {
    throw new Error('--aktionen muss eine Liste von Listen sein, z. B. [["tap",100,200]]');
  }
  return liste;
}

// ---------------------------------------------------------------------------
// Kleiner statischer Dateiserver (ohne Zwischenspeicher, damit immer der neueste Stand kommt)
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

function serverStarten() {
  const server = http.createServer(async (anfrage, antwort) => {
    const kopf = { 'Cache-Control': 'no-store, max-age=0', 'Access-Control-Allow-Origin': '*' };
    try {
      let teil = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
      let datei = path.resolve(WURZEL, '.' + teil);
      if (datei !== WURZEL && !datei.startsWith(WURZEL + path.sep)) {
        antwort.writeHead(403, kopf).end('verboten');
        return;
      }
      let stat = await fsp.stat(datei).catch(() => null);
      if (stat?.isDirectory()) {
        datei = path.join(datei, 'index.html');
        stat = await fsp.stat(datei).catch(() => null);
      }
      if (!stat?.isFile()) {
        antwort.writeHead(404, kopf).end('nicht gefunden');
        return;
      }
      const typ = MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream';
      antwort.writeHead(200, { ...kopf, 'Content-Type': typ, 'Content-Length': stat.size });
      if (anfrage.method === 'HEAD') return antwort.end();
      fs.createReadStream(datei).pipe(antwort);
    } catch (e) {
      antwort.writeHead(500, kopf).end(String(e));
    }
  });
  return new Promise((fertig, fehler) => {
    server.once('error', fehler);
    server.listen(0, '127.0.0.1', () => fertig(server));   // Port 0 = freier Port
  });
}

// ---------------------------------------------------------------------------
// Chrome starten (zuerst mit Grafikkarte, sonst SwiftShader) und WebGL2 prüfen
// ---------------------------------------------------------------------------

const GRUND_ARGS = ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const VERSUCHE = [
  { name: 'gpu', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] },
  { name: 'swiftshader', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'] },
];

async function webglPruefen(browser) {
  const seite = await browser.newPage();
  try {
    return await seite.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
  } finally {
    await seite.close();
  }
}

async function chromeStarten(profile, nurSwiftshader) {
  const gruende = [];
  for (const versuch of VERSUCHE.filter((v) => !nurSwiftshader || v.name === 'swiftshader')) {
    const profil = await fsp.mkdtemp(path.join(os.tmpdir(), 'sigo-chrome-'));
    profile.push(profil);
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME, headless: true, userDataDir: profil,
        args: [...GRUND_ARGS, ...versuch.args], protocolTimeout: 60000,
      });
      const renderer = await webglPruefen(browser);
      if (renderer) return { browser, renderer, modus: versuch.name };
      gruende.push(`${versuch.name}: kein WebGL2-Kontext`);
      await browser.close();
    } catch (e) {
      gruende.push(`${versuch.name}: ${e.message.split('\n')[0]}`);
      if (browser) await browser.close().catch(() => {});
    }
  }
  throw new Error('Chrome ohne WebGL2 – ' + gruende.join('; '));
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

const pause = (sek) => new Promise((r) => setTimeout(r, Math.max(0, sek) * 1000));

function zeiger(seite, touch) {
  // Einheitliche Bedienung für Maus und Finger
  if (touch) {
    return {
      runter: (x, y) => seite.touchscreen.touchStart(x, y),
      ziehen: (x, y) => seite.touchscreen.touchMove(x, y),
      hoch: () => seite.touchscreen.touchEnd(),
    };
  }
  return {
    runter: async (x, y) => { await seite.mouse.move(x, y); await seite.mouse.down(); },
    ziehen: (x, y) => seite.mouse.move(x, y),
    hoch: () => seite.mouse.up(),
  };
}

async function fotoMachen(seite, datei) {
  await fsp.mkdir(path.dirname(datei), { recursive: true });
  const png = datei.toLowerCase().endsWith('.png');
  await seite.screenshot({ path: datei, type: png ? 'png' : 'jpeg', ...(png ? {} : { quality: 80 }) });
  return path.relative(WURZEL, datei).replaceAll('\\', '/');
}

async function aktionenAusfuehren(seite, liste, opt, bericht) {
  const viewport = seite.viewport();
  const s = viewport.height / BUEHNE_H;          // Bühnen-Einheiten → CSS-Pixel
  const p = (x, y) => [x * s, y * s];
  const z = zeiger(seite, opt.touch);

  for (const aktion of liste) {
    const [art, ...w] = aktion;
    console.error(`  Aktion: ${JSON.stringify(aktion)}`);
    switch (art) {
      case 'tap': {
        await z.runter(...p(w[0], w[1]));
        await pause(0.08);
        await z.hoch();
        break;
      }
      case 'drag': {
        const [x1, y1, x2, y2, dauer = 0.6] = w;
        const schritte = 20;
        await z.runter(...p(x1, y1));
        for (let i = 1; i <= schritte; i++) {
          await pause(dauer / schritte);
          const t = i / schritte;
          await z.ziehen(...p(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t));
        }
        await pause(0.05);
        await z.hoch();
        break;
      }
      case 'halten': {
        await z.runter(...p(w[0], w[1]));
        await pause(w[2] ?? 1);
        await z.hoch();
        break;
      }
      case 'warte':
        await pause(w[0] ?? 1);
        break;
      case 'foto': {
        const name = String(w[0] ?? `foto${bericht.fotos.length + 1}`);
        bericht.fotos.push(await fotoMachen(seite, path.join(WURZEL, 'shots', name + '.jpg')));
        break;
      }
      case 'js': {
        let ergebnis;
        try {
          ergebnis = await seite.evaluate(String(w[0]));
        } catch (e) {
          ergebnis = { fehler: e.message.split('\n')[0] };
          bericht.fehler.push(`js „${w[0]}": ${ergebnis.fehler}`);
        }
        bericht.ergebnisse.push({ js: w[0], ergebnis: ergebnis === undefined ? null : ergebnis });
        console.error(`  → ${JSON.stringify(ergebnis)}`);
        break;
      }
      default:
        bericht.fehler.push(`unbekannte Aktion: ${JSON.stringify(aktion)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Hauptablauf
// ---------------------------------------------------------------------------

function schlussfoto(opt) {
  return path.resolve(WURZEL, opt.out ?? path.join('shots', `${opt.szene ?? 'seite'}.png`));
}

async function main() {
  let opt;
  try {
    opt = argumenteLesen(process.argv.slice(2));
  } catch (e) {
    console.error(`FEHLER: ${e.message}\n\n${HILFE}`);
    process.exit(2);
  }
  if (opt.hilfe || (!opt.szene && !opt.url)) {
    console.log(HILFE);
    process.exit(opt.hilfe ? 0 : 2);
  }

  const bericht = { ok: false, fehler: [], warnungen: [], fotos: [], renderer: null, ergebnisse: [] };
  const profile = [];
  let server, browser, seite, seitenfehler = false;

  // Notbremse: hängt irgendetwas, endet der Lauf trotzdem mit einer Meldung
  const notbremse = setTimeout(() => {
    bericht.fehler.push(`Zeitlimit von ${opt.zeitlimit} s überschritten`);
    aufraeumen().finally(() => { console.log(JSON.stringify(bericht)); process.exit(1); });
  }, opt.zeitlimit * 1000);

  async function aufraeumen() {
    if (browser) await browser.close().catch(() => {});
    browser = null;
    if (server) server.close();
    server = null;
    for (const profil of profile.splice(0)) {
      await fsp.rm(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
    }
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => aufraeumen().finally(() => process.exit(130)));
  }

  try {
    server = await serverStarten();
    const port = server.address().port;
    const start = await chromeStarten(profile, opt.swiftshader);
    browser = start.browser;
    bericht.renderer = `${start.renderer} (${start.modus})`;
    console.error(`Server: http://localhost:${port}/  Renderer: ${bericht.renderer}`);

    seite = await browser.newPage();
    await seite.setViewport({ width: 1280, height: 800, deviceScaleFactor: opt.gross ? 2 : 1,
                              hasTouch: opt.touch, isMobile: false });

    // Fehler aus der Seite einsammeln
    seite.on('console', (nachricht) => {
      const text = nachricht.text();
      if (text.startsWith('Failed to load resource')) return;   // kommt schon über die Antworten
      if (nachricht.type() === 'error') bericht.fehler.push(`console.error: ${text}`);
      else if (nachricht.type() === 'warn') bericht.warnungen.push(`console.warn: ${text}`);
    });
    seite.on('pageerror', (fehler) => {
      seitenfehler = true;
      bericht.fehler.push(`Seitenfehler: ${fehler.message.split('\n')[0]}`);
    });
    seite.on('requestfailed', (anfrage) => {
      const grund = anfrage.failure()?.errorText ?? '';
      if (grund.includes('ERR_ABORTED')) return;   // abgebrochene Ton-/Bild-Ladevorgänge sind harmlos
      bericht.fehler.push(`Anfrage fehlgeschlagen: ${anfrage.url()} (${grund})`);
    });
    seite.on('response', (antwort) => {
      if (antwort.status() < 400) return;
      const adresse = antwort.url();
      const text = `${antwort.status()} ${adresse.replace(`http://localhost:${port}`, '').replace(`http://127.0.0.1:${port}`, '')}`;
      // Fehlende Töne sind erlaubt (Spiel bleibt still), fehlendes Symbol ist egal
      if (/\/favicon\.ico(\?|$)/.test(adresse)) return;
      if (/\.(mp3|ogg|m4a|wav)(\?|$)/i.test(adresse)) bericht.warnungen.push(text);
      else bericht.fehler.push(text);
    });

    // Adresse bauen
    const adresse = new URL(opt.url ? opt.url.replace(/^\/+/, '') : '', `http://localhost:${port}/`);
    if (opt.szene) {
      adresse.searchParams.set('szene', opt.szene);
      adresse.searchParams.set('test', '1');
    }
    for (const paar of opt.params) {
      const [k, ...v] = paar.split('=');
      adresse.searchParams.set(k, v.join('='));
    }
    console.error(`Öffne ${adresse.href}`);
    await seite.goto(adresse.href, { waitUntil: 'load', timeout: 30000 });

    if (!opt.ohneReady) {
      // Nur das Vorhandensein prüfen (!!), sonst würde waitForFunction das Promise selbst abwarten
      await seite.waitForFunction(() => !!(window.__sigo && window.__sigo.ready), { timeout: 30000 })
        .catch(() => { throw new Error('window.__sigo.ready kam nicht innerhalb von 30 s'); });
      await seite.evaluate(() => Promise.race([
        window.__sigo.ready,
        new Promise((_, nein) => setTimeout(() => nein(new Error('__sigo.ready nicht erfüllt nach 30 s')), 30000)),
      ]));
    }
    await pause(opt.warte);

    await aktionenAusfuehren(seite, aktionenLesen(opt.aktionen), opt, bericht);

    // Fehlerliste und Bildrate des Spiels selbst übernehmen, falls vorhanden
    const sigo = await seite.evaluate(() => {
      const s = window.__sigo;
      if (!s) return null;
      return { fps: typeof s.fps === 'function' ? s.fps() : s.fps,
               errors: Array.isArray(s.errors) ? s.errors.map(String) : [] };
    }).catch(() => null);
    if (sigo?.fps !== undefined && sigo.fps !== null) bericht.fps = sigo.fps;
    for (const f of sigo?.errors ?? []) {
      if (!bericht.fehler.some((g) => g.includes(f))) bericht.fehler.push(`__sigo.errors: ${f}`);
    }

    bericht.fotos.push(await fotoMachen(seite, schlussfoto(opt)));
  } catch (e) {
    seitenfehler = true;
    bericht.fehler.push(`Abbruch: ${e.message.split('\n')[0]}`);
    // Auch nach einem Abbruch ein Foto, damit man sieht, wie weit die Seite kam
    if (seite) {
      try { bericht.fotos.push(await fotoMachen(seite, schlussfoto(opt))); } catch { /* Seite schon weg */ }
    }
  } finally {
    clearTimeout(notbremse);
    await aufraeumen();
  }

  bericht.ok = bericht.fehler.length === 0;
  console.log(JSON.stringify(bericht));
  process.exit(bericht.ok && !seitenfehler ? 0 : 1);
}

main();
