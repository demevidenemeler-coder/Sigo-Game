// Ladezeit-Messung für Sigo 2 unter Tablet-ähnlichen Bedingungen.
//
// Startet einen eigenen Dateiserver (Unterpfad /Sigo-Game/ wie GitHub Pages, HTTP/2 über https mit ETag,
// max-age=600 und gzip für Text) mit einer gemeinsamen, gedrosselten Leitung (alle Anfragen – Spiel UND Service
// Worker – teilen sich dieselbe Bandbreite, wie im echten WLAN) und ein echtes Chrome ohne Fenster
// (2560×1600 Gerätepixel, CPU-Drosselung über CDP). Das Spiel selbst wird nicht verändert: gemessen wird über
// window.__sigo, über Lese-Zugriffe auf die schon geladenen Spielkern-Module (dieselben Modul-Adressen, also
// dieselben Objekte), über CDP (CPU-Profil, Drosselung) und über das Protokoll des eigenen Servers.
//
//   node tools/ladezeit.mjs --cpu 4 --netz 30 --wdh 3 --out shots/ladezeit_vorher.json
//   node tools/ladezeit.mjs --cpu 6 --netz 8 --faelle a,b --wdh 1
//   node tools/ladezeit.mjs --bausteine          # Einzelkosten: Entpacken, Verkleinern, Hochladen
//
// Hilfe: node tools/ladezeit.mjs --hilfe

import http from 'node:http';
import http2 from 'node:http2';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const WERKZEUGE = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(WERKZEUGE, '..');
const CHROME = process.env.CHROME || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const PREFIX = '/Sigo-Game/';

// Die 13 Orte der Karte (Reihenfolge der Messung) – 'schlafen' ist die Gute-Nacht-Hütte
const ORTE = ['bauernhof', 'baustelle', 'garten', 'feuerwehr', 'malhaus', 'teich', 'musik', 'bahnhof', 'eisdiele',
  'spielplatz', 'wald', 'waschanlage', 'schlafen'];

const HILFE = `Ladezeit-Messung mit echtem Chrome unter Tablet-ähnlichen Bedingungen.

  node tools/ladezeit.mjs [Optionen]

Optionen:
  --cpu <n>            CPU-Drosselung (Emulation.setCPUThrottlingRate), Standard 4 (Tablet ≈ 4…6)
  --netz <mbit>        Bandbreite der gemeinsamen Leitung in Mbit/s, Standard 30; 0 = ungedrosselt
  --latenz <ms>        Verzögerung je Anfrage (Rundweg), Standard 20
  --wdh <n>            Wiederholungen (je mit frischem Browser-Profil), Standard 3; Ergebnis = Median
  --faelle <liste>     a,b,c,d,e (Standard alle):
                         a = allererster Besuch (leerer Speicher, Service Worker installiert sich nebenbei)
                         e = gleich danach, noch in der ersten Sitzung: Orte sofort antippen (0,1 s nach der
                             Karte), während der Offline-Speicher noch lädt – Bilder kommen übers Netz
                         b = späterer Start (Service Worker hat alles gespeichert)
                         c = nach fertigem Offline-Speicher: Karte → jeder Ort → Karte, danach jeder Ort ein
                             zweites Mal
                         d = Umblättern in Seiten-Orten, Stickerbuch öffnen
  --orte-erst <liste>  Orte für Fall e (Standard bauernhof,feuerwehr,teich)
  --orte <liste>       nur diese Orte in Fall c (Standard: alle 13 der Karte, dazu Bahnhof → Fahrt)
  --ohne-zweiten       in Fall c keinen zweiten Besuch
  --sw-warten <sek>    in Fall a höchstens so lange auf den fertigen Offline-Speicher warten (Standard 300)
  --spur               zusätzlich eine Chrome-Spur (Trace) beim Start und beim ersten Ort/Blättern: Zeit je
                       Thread und Ereignis (zeigt, was „browser_intern“ im CPU-Profil ist, und die Arbeit
                       außerhalb des Hauptthreads: Entpacken, Grafikkarte, Service Worker)
  --fotos              nach jedem gemessenen Wechsel ein Foto shots/lz_<fall>.jpg (nach der Messung)
  --variante <liste>   Gegenprobe: der Server liefert einzelne Dateien im Speicher abgeändert aus (die Dateien im
                       Projekt bleiben unverändert), z. B. um die Wirkung einer Abhilfe vorab zu messen:
                         ohne-vorrat      scene.js behält keine zuletzt besuchten Orte im Speicher
                         ohne-voraus      scene.js lädt nichts im Hintergrund voraus
  --http1              HTTP/1.1 ohne https statt HTTP/2 (dann höchstens 6 Anfragen gleichzeitig)
  --bausteine          statt der Fälle: Einzelkosten messen (Entpacken/Verkleinern der Tierbilder, Hochladen
                       der Hintergründe samt Mipmaps, Holen aus dem Offline-Speicher)
  --out <datei>        JSON-Ergebnis (Standard shots/ladezeit.json)
  --neu-auswerten <datei>  keine Messung: Phasen einer gespeicherten Messung aus ihrer Zeitachse neu bilden
  --zeitlimit <sek>    Notbremse für den ganzen Lauf (Standard 3600)
  Chrome-Pfad: Umgebungsvariable CHROME.

Ausgabe: Tabelle auf stdout, Fortschritt auf stderr, alle Einzelwerte und Mediane in der JSON-Datei.`;

// ---------------------------------------------------------------------------
// Befehlszeile
// ---------------------------------------------------------------------------

function argumenteLesen(liste) {
  const opt = { cpu: 4, netz: 30, latenz: 20, wdh: 3, faelle: ['a', 'b', 'c', 'd', 'e'], orte: null, zweiter: true,
    orteErst: ['bauernhof', 'feuerwehr', 'teich'],
    swWarten: 300, http1: false, spur: false, fotos: false, variante: [], bausteine: false, out: 'shots/ladezeit.json', zeitlimit: 3600 };
  for (let i = 0; i < liste.length; i++) {
    const name = liste[i];
    const wert = () => {
      if (i + 1 >= liste.length) throw new Error(`${name} braucht einen Wert`);
      return liste[++i];
    };
    switch (name) {
      case '--cpu': opt.cpu = Number(wert()); break;
      case '--netz': opt.netz = Number(wert()); break;
      case '--latenz': opt.latenz = Number(wert()); break;
      case '--wdh': opt.wdh = Math.max(1, Number(wert())); break;
      case '--faelle': opt.faelle = wert().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--orte': opt.orte = wert().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--orte-erst': opt.orteErst = wert().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--ohne-zweiten': opt.zweiter = false; break;
      case '--sw-warten': opt.swWarten = Number(wert()); break;
      case '--http1': opt.http1 = true; break;
      case '--spur': opt.spur = true; break;
      case '--fotos': opt.fotos = true; break;
      case '--variante': opt.variante = wert().split(',').map((x) => x.trim()).filter(Boolean); break;
      case '--bausteine': opt.bausteine = true; break;
      case '--out': opt.out = wert(); break;
      case '--neu-auswerten': opt.neuAuswerten = wert(); break;
      case '--zeitlimit': opt.zeitlimit = Number(wert()); break;
      case '-h': case '--hilfe': case '--help': opt.hilfe = true; break;
      default: throw new Error(`unbekannte Option: ${name}`);
    }
  }
  return opt;
}

const pause = (sek) => new Promise((r) => setTimeout(r, Math.max(0, sek) * 1000));
const log = (...a) => console.error(...a);

// ---------------------------------------------------------------------------
// Gedrosselte gemeinsame Leitung: alle Antworten teilen sich die Bandbreite (reihum in kleinen Stücken)
// ---------------------------------------------------------------------------

const STUECK = 16 * 1024;

class Leitung {
  constructor(mbit) {
    this.rate = mbit > 0 ? (mbit * 1e6) / 8 : 0;   // Bytes je Sekunde
    this.reihe = [];
    this.budget = 0;
    this.letzt = 0;
    this.timer = null;
  }

  sende(res, buf) {
    if (!this.rate) return new Promise((fertig) => res.end(buf, fertig));
    return new Promise((fertig) => {
      const s = { res, buf, pos: 0, fertig, wartet: false };
      res.once('close', () => this.weg(s));
      this.reihe.push(s);
      this.starte();
    });
  }

  weg(s) {
    const i = this.reihe.indexOf(s);
    if (i >= 0) this.reihe.splice(i, 1);
    s.fertig();
  }

  starte() {
    if (this.timer) return;
    this.letzt = performance.now();
    this.timer = setInterval(() => this.pumpe(), 4);
  }

  pumpe() {
    const jetzt = performance.now();
    this.budget = Math.min(this.budget + ((jetzt - this.letzt) / 1000) * this.rate, this.rate * 0.03);
    this.letzt = jetzt;
    let weiter = true;
    while (this.budget >= 1 && weiter) {
      weiter = false;
      for (const s of [...this.reihe]) {
        if (s.wartet) continue;
        if (this.budget < 1) break;
        const n = Math.min(STUECK, s.buf.length - s.pos, Math.floor(this.budget));
        if (n <= 0) continue;
        let ok = true;
        try { ok = s.res.write(s.buf.subarray(s.pos, s.pos + n)); } catch { this.weg(s); continue; }
        s.pos += n;
        this.budget -= n;
        weiter = true;
        if (s.pos >= s.buf.length) {
          const i = this.reihe.indexOf(s);
          if (i >= 0) this.reihe.splice(i, 1);
          s.res.end();
          s.fertig();
        } else if (!ok) {
          s.wartet = true;
          s.res.once('drain', () => { s.wartet = false; });
        }
      }
    }
    if (!this.reihe.length) {
      clearInterval(this.timer);
      this.timer = null;
      this.budget = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Dateiserver wie GitHub Pages: /Sigo-Game/…, ETag + max-age=600, gzip für Text, 304 bei If-None-Match
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
// Gegenproben: Datei (relativ zum Projekt) → [suchen, ersetzen]
// (Die früheren Gegenproben sw-genau, ohne-verkleinern und rahmen-bleibt sind seit dem Umbau fest eingebaut.)
const VARIANTEN = {
  // ohne Vorrat: Ein Ort wird beim Verlassen ganz entladen (wie früher) – zum Vergleich der zweiten Besuche
  'ohne-vorrat': ['src/engine/scene.js', 'const VORRAT_ANZAHL = 2;', 'const VORRAT_ANZAHL = 0;'],
  // ohne Vorausladen: nichts wird im Hintergrund vorbereitet
  'ohne-voraus': ['src/engine/scene.js', '  _planeVoraus() {\n', '  _planeVoraus() {\n    return;\n'],
};

const GZIP = new Set(['.html', '.js', '.mjs', '.json', '.css', '.webmanifest', '.svg', '.txt', '.md']);

function zertifikat() {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'sigo-zert-'));
  const key = path.join(ordner, 'key.pem');
  const cert = path.join(ordner, 'cert.pem');
  const kandidaten = ['openssl', 'C:/Program Files/Git/mingw64/bin/openssl.exe', 'C:/Program Files/Git/usr/bin/openssl.exe'];
  for (const exe of kandidaten) {
    try {
      execFileSync(exe, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '7',
        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
      const z = { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
      fs.rmSync(ordner, { recursive: true, force: true });
      // Fingerabdruck des öffentlichen Schlüssels (SPKI, SHA-256, base64): Chrome vertraut dem Zertifikat dann über
      // --ignore-certificate-errors-spki-list wie einem echten. Mit --ignore-certificate-errors legt Chrome bei
      // einem Zertifikatsfehler nichts in den Browser-Speicher – dann gäbe es nie eine 304-Antwort (anders als am Tablet).
      const spki = crypto.createPublicKey(z.cert).export({ type: 'spki', format: 'der' });
      z.spki = crypto.createHash('sha256').update(spki).digest('base64');
      return z;
    } catch { /* nächster Kandidat */ }
  }
  fs.rmSync(ordner, { recursive: true, force: true });
  return null;
}

function serverStarten(opt) {
  const leitung = new Leitung(opt.netz);
  const protokoll = [];          // { start, ende, pfad, status, bytes, sw, kopf }
  const inhalte = new Map();     // datei → { mtime, roh, gz }

  const aenderungen = new Map();   // absoluter Pfad → [[suchen, ersetzen]]
  for (const v of opt.variante || []) {
    const a = VARIANTEN[v];
    if (!a) throw new Error(`unbekannte Variante: ${v} (bekannt: ${Object.keys(VARIANTEN).join(', ')})`);
    const ziel = path.resolve(WURZEL, a[0]);
    const text = fs.readFileSync(ziel, 'utf8');
    if (!text.includes(a[1])) throw new Error(`Variante ${v}: Stelle in ${a[0]} nicht gefunden (Datei geändert?)`);
    if (!aenderungen.has(ziel)) aenderungen.set(ziel, []);
    aenderungen.get(ziel).push([a[1], a[2]]);
  }

  async function inhalt(datei, stat) {
    const da = inhalte.get(datei);
    if (da && da.mtime === stat.mtimeMs) return da;
    let roh = await fsp.readFile(datei);
    // Textdateien wie GitHub Pages: dort liegt der Stand aus Git, also mit LF (im Arbeitsordner unter Windows oft
    // CRLF). Die Prüfsummen in sw-dateien.js rechnet tools/sw_liste.py genauso.
    if (GZIP.has(path.extname(datei).toLowerCase()) && roh.includes(13)) roh = Buffer.from(roh.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    if (aenderungen.has(datei)) {
      let text = roh.toString('utf8');
      for (const [a, b] of aenderungen.get(datei)) text = text.replace(a, b);
      roh = Buffer.from(text, 'utf8');
    }
    const neu = { mtime: stat.mtimeMs, roh, gz: GZIP.has(path.extname(datei).toLowerCase()) ? zlib.gzipSync(roh, { level: 6 }) : null };
    inhalte.set(datei, neu);
    return neu;
  }

  async function bearbeite(req, res) {
    const start = Date.now();
    const eintrag = { start, ende: 0, pfad: '', status: 0, bytes: 0, sw: false };
    try {
      const url = new URL(req.url, 'https://x');
      const roh = decodeURIComponent(url.pathname);
      eintrag.pfad = roh;
      eintrag.kopf = [req.headers['cache-control'] || '', req.headers.pragma || '', req.headers['sec-fetch-dest'] || '',
        req.headers['sec-fetch-mode'] || '', req.headers['if-none-match'] ? 'inm' : '', req.headers['service-worker'] || ''].join('|');
      // Wer fragt? Der Service Worker holt beim Installieren mit cache:'no-cache' (Kopfzeile Cache-Control)
      const cc = String(req.headers['cache-control'] || '');
      // (Chrome schickt bei cache:'no-cache' „Cache-Control: max-age=0“; pack.json holt auch das Spiel so – zählt
      // als Spiel)
      eintrag.sw = !!req.headers['service-worker']
        || (/max-age=0|no-cache/.test(cc) && req.headers['sec-fetch-dest'] === 'empty' && !/pack\.json$/.test(roh));
      await pause(opt.latenz / 1000);
      if (roh === '/leer.html') {
        // leere Seite außerhalb des Service-Worker-Bereichs (zum Einrichten von Drosselung und Beobachter)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end('<!doctype html><meta charset="utf-8"><title>leer</title>');
        eintrag.status = 200;
        eintrag.leer = true;
        return;
      }
      if (roh === PREFIX.slice(0, -1)) {
        res.writeHead(301, { location: PREFIX });
        res.end();
        eintrag.status = 301;
        return;
      }
      if (!roh.startsWith(PREFIX)) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('nicht gefunden');
        eintrag.status = 404;
        return;
      }
      let datei = path.resolve(WURZEL, '.' + roh.slice(PREFIX.length - 1));
      if (datei !== WURZEL && !datei.startsWith(WURZEL + path.sep)) {
        res.writeHead(403);
        res.end();
        eintrag.status = 403;
        return;
      }
      let stat = await fsp.stat(datei).catch(() => null);
      if (stat?.isDirectory()) {
        datei = path.join(datei, 'index.html');
        stat = await fsp.stat(datei).catch(() => null);
      }
      if (!stat?.isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'max-age=600' });
        res.end('nicht gefunden');
        eintrag.status = 404;
        return;
      }
      const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}${aenderungen.has(datei) ? '-v' : ''}"`;
      eintrag.etag = etag;
      const kopf = {
        'content-type': MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'max-age=600',
        etag,
        'last-modified': stat.mtime.toUTCString(),
        'access-control-allow-origin': '*',
      };
      if (String(req.headers['if-none-match'] || '').split(/\s*,\s*/).includes(etag)) {
        res.writeHead(304, kopf);
        res.end();
        eintrag.status = 304;
        return;
      }
      const daten = await inhalt(datei, stat);
      let body = daten.roh;
      if (daten.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
        body = daten.gz;
        kopf['content-encoding'] = 'gzip';
        kopf.vary = 'Accept-Encoding';
      }
      kopf['content-length'] = body.length;
      res.writeHead(200, kopf);
      eintrag.status = 200;
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      eintrag.bytes = body.length;
      await leitung.sende(res, body);
    } catch (e) {
      eintrag.status = eintrag.status || 500;
      try { res.writeHead(500); res.end(String(e)); } catch { /* schon weg */ }
    } finally {
      eintrag.ende = Date.now();
      protokoll.push(eintrag);
    }
  }

  let server;
  let protokollArt = 'http/1.1';
  const z = opt.http1 ? null : zertifikat();
  if (z) {
    server = http2.createSecureServer({ ...z, allowHTTP1: true }, bearbeite);
    protokollArt = 'h2';
  } else {
    if (!opt.http1) log('Hinweis: kein openssl gefunden – HTTP/1.1 ohne https (höchstens 6 Anfragen gleichzeitig).');
    server = http.createServer(bearbeite);
  }
  return new Promise((fertig, fehler) => {
    server.once('error', fehler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const basis = `${z ? 'https' : 'http'}://localhost:${port}${PREFIX}`;
      fertig({ server, protokoll, basis, protokollArt, spki: z?.spki || null });
    });
  });
}

// ---------------------------------------------------------------------------
// Beobachter in der Seite (wird vor dem Spiel eingesetzt; ändert am Spiel nichts, liest nur)
// ---------------------------------------------------------------------------

const BEOBACHTER = String.raw`(() => {
  if (window.__lz) return;
  const lz = window.__lz = { ereignisse: [], lange: [], bilder: [], tipps: [], ready: null, sigo: null, module: null };
  const jetzt = () => performance.now();
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) lz.lange.push([e.startTime, e.duration]); })
      .observe({ type: 'longtask', buffered: true });
  } catch (e) { /* ältere Browser */ }
  addEventListener('pointerdown', () => lz.tipps.push(jetzt()), { capture: true, passive: true });
  let vorher = 0;
  const bild = (t) => { if (vorher) lz.bilder.push([t, t - vorher]); vorher = t; requestAnimationFrame(bild); };
  requestAnimationFrame(bild);

  let SM = null, A = null, I = null;
  const alt = {};
  const merke = (k, v) => { if (alt[k] !== v) { alt[k] = v; lz.ereignisse.push([jetzt(), k, v]); } };
  const lies = () => {
    const s = window.__sigo;
    if (!s) return;
    if (!lz.sigo) {
      lz.sigo = jetzt();
      lz.ereignisse.push([lz.sigo, 'sigo', 1]);
      Promise.resolve(s.ready).then(() => { lz.ready = jetzt(); lz.ereignisse.push([lz.ready, 'ready', 1]); });
      const b = document.baseURI;
      Promise.all(['src/engine/scene.js', 'src/engine/assets.js', 'src/engine/input.js']
        .map((p) => import(new URL(p, b).href)))
        .then(([sc, as, inp]) => { SM = sc.SceneManager; A = as; I = inp; lz.module = jetzt(); })
        .catch((e) => { lz.modulFehler = String(e); });
    }
    merke('stage', s.stage && s.stage.app ? 1 : 0);
    if (!SM) return;
    const c = SM.current;
    merke('wechsel', SM._wechsel ? 1 : 0);
    if ('phase' in SM) merke('phase', SM.phase || '');   // Kern meldet selbst, wo der Wechsel steht
    const p = SM.blende ? SM.blende.p : 1;
    merke('blende', p >= 0.999 ? 'zu' : p <= 0.001 ? 'offen' : 'faehrt');
    merke('szene', c ? c.id : '');
    merke('shown', c && c._shown ? 1 : 0);
    merke('gesperrt', I.isInputLocked() ? 1 : 0);
    const geladen = A.loadedPacks();
    merke('pakete', geladen.filter((x) => A.isPackLoaded(x)).sort().join(','));
    merke('laedt', geladen.filter((x) => !A.isPackLoaded(x)).sort().join(','));
    if (c && Array.isArray(c.seiten)) {
      const nr = c.nr;
      const gl = !!c._lauf;
      let phase = 'ruht';
      if (gl) {
        const x = c.seite && c.seite.welt ? Math.abs(c.seite.welt.x) : 0;
        phase = nr === lz._nrRuhe ? 'aufbau' : x >= 2839 ? 'hochladen' : 'gleitet';
      } else {
        lz._nrRuhe = nr;   // Seite in Ruhe: ändert sich nr beim Blättern, ist die neue Seite gebaut
      }
      merke('seite', nr);
      merke('blaettern', phase);
    } else {
      merke('seite', -1);
      merke('blaettern', 'ruht');
    }
  };
  lz.lies = lies;
  const schleife = () => { try { lies(); } catch (e) { lz.leseFehler = String(e); } setTimeout(schleife, 4); };
  schleife();
  const rafSchleife = () => { try { lies(); } catch (e) { /* s. o. */ } requestAnimationFrame(rafSchleife); };
  requestAnimationFrame(rafSchleife);

  // fertig = Szene id steht, kein Wechsel, Blende offen, Eingabe frei
  lz.bereit = (id) => !!(SM && SM.current && SM.current.id === id && !SM._wechsel && SM.current._shown
    && !I.isInputLocked() && SM.blende && SM.blende.p <= 0.001);
  lz.blaetterBereit = () => !!(SM && SM.current && !SM.current._lauf);

  // Wohin tippen? (CSS-Pixel)
  lz.punkt = (was, arg) => {
    const s = window.__sigo;
    const sz = SM && SM.current;
    if (!sz) return null;
    let o = null;
    if (was === 'los') o = sz.knopf;
    else if (was === 'ort') o = sz.ortVon && sz.ortVon[arg] && sz.ortVon[arg].flaeche;
    else if (was === 'pfeil') o = arg < 0 ? sz.pfeilLinks : sz.pfeilRechts;
    if (o) { const g = o.getGlobalPosition(); return { x: g.x, y: g.y }; }
    if (was === 'hud') { const g = s.stage.hud.toGlobal({ x: arg[0] === 'W' ? s.stage.W + arg[1] : arg[0], y: arg[2] }); return { x: g.x, y: g.y }; }
    return null;
  };

  // Was liegt gerade auf der Grafikkarte, und wie groß werden die Bilder der Szene gezeigt?
  lz.bildbedarf = () => {
    const s = window.__sigo;
    const r = s.stage.app.renderer;
    const res = r.resolution;
    const maxAnzeige = new Map();
    let fehler = 0;
    const geh = (o) => {
      if (!o || o.destroyed || o.visible === false) return;
      try { pruefe(o); } catch (e) { fehler++; }
      for (const k of o.children || []) geh(k);
    };
    const pruefe = (o) => {
      const t = o.texture;
      if (t && t.source && t.source.pixelWidth > 1 && o.worldTransform) {
        const m = o.worldTransform;
        const sx = Math.hypot(m.a, m.b) * res;
        const sy = Math.hypot(m.c, m.d) * res;
        const w = t.frame.width * sx;
        const h = t.frame.height * sy;
        const q = t.source;
        const alt = maxAnzeige.get(q);
        const f = Math.max(w / Math.max(1, t.frame.width * (q.resolution || 1)), h / Math.max(1, t.frame.height * (q.resolution || 1)));
        if (!alt || f > alt.f) maxAnzeige.set(q, { f, label: q.label || t.label || '' });
      }
    };
    geh(s.stage.app.stage);
    let quellPx = 0, noetigPx = 0, zuGross = 0;
    for (const [q, v] of maxAnzeige) {
      const px = q.pixelWidth * q.pixelHeight;
      quellPx += px;
      const f = Math.min(1, v.f);
      noetigPx += px * f * f;
      if (v.f < 0.5) zuGross++;
    }
    const verwaltet = (r.texture && r.texture.managedTextures) || [];
    let gpuPx = 0;
    for (const q of verwaltet) if (q) gpuPx += (q.pixelWidth || 0) * (q.pixelHeight || 0) * (q.autoGenerateMipmaps ? 4 / 3 : 1);
    return { sichtbareBilder: maxAnzeige.size, quellMPx: quellPx / 1e6, noetigMPx: noetigPx / 1e6, mehrAlsDoppeltGross: zuGross,
             gpuTexturen: verwaltet.filter(Boolean).length, gpuMB: (gpuPx * 4) / 1e6, aufloesung: res, fehler };
  };
})();`;

// ---------------------------------------------------------------------------
// CPU-Profil auswerten: Zeit je Art (Stapel von innen nach außen geprüft)
// ---------------------------------------------------------------------------

const HOCHLADEN = /^(texImage2D|texSubImage2D|generateMipmap|compressedTexImage2D|texStorage2D|initSource|uploadImageResource|_uploadImageResource|onSourceUpdate|updateSource)$/;

function artVon(stapel) {
  // stapel: [{name, url}] innen → außen
  let art = null;
  const hat = (fn) => stapel.some(fn);
  if (hat((f) => HOCHLADEN.test(f.name))) return 'hochladen';
  if (hat((f) => f.name === 'decodeAudioData')) return 'ton';
  if (hat((f) => /^(createImageBitmap|drawImage|getImageData|putImageData|toBlob|decode)$/.test(f.name))) return 'bild_entpacken_haupt';
  const innen = stapel[0]?.name || '';
  if (innen === '(garbage collector)') return 'gc';
  if (innen === '(program)') return 'browser_intern';
  if (innen === '(idle)') return 'leer';
  if (hat((f) => /\/src\/(scenes|gemeinsam)\//.test(f.url))) return 'szene_code';
  if (hat((f) => /\/src\/(engine\/|main\.js)/.test(f.url))) art = 'kern_code';
  if (hat((f) => /\/vendor\/pixi/.test(f.url) && /^(render|_render|renderPipes|execute|draw)$/.test(f.name))) return 'zeichnen';
  if (art) return art;
  if (hat((f) => /\/vendor\/pixi/.test(f.url))) return 'pixi_sonst';
  if (hat((f) => /^JSON\.parse|^parse$/.test(f.name))) return 'json';
  return 'sonst';
}

function profilAuswerten(profil, versatz, phasen) {
  // versatz: profil-Zeit (µs) / 1000 - versatz = performance.now() der Seite
  const knoten = new Map();
  for (const k of profil.nodes) knoten.set(k.id, k);
  const eltern = new Map();
  for (const k of profil.nodes) for (const c of k.children || []) eltern.set(c, k.id);
  const artCache = new Map();
  const art = (id) => {
    if (artCache.has(id)) return artCache.get(id);
    const stapel = [];
    let n = id;
    while (n !== undefined) {
      const k = knoten.get(n);
      if (!k) break;
      stapel.push({ name: k.callFrame.functionName, url: k.callFrame.url });
      n = eltern.get(n);
    }
    const a = artVon(stapel);
    artCache.set(id, a);
    return a;
  };
  const gesamt = {};
  const jePhase = {};
  const selbst = new Map();   // Funktion (Name Datei:Zeile) → Eigenzeit
  let t = profil.startTime;
  for (let i = 0; i < profil.samples.length; i++) {
    t += profil.timeDeltas[i];
    const d = (profil.timeDeltas[i + 1] ?? 0) / 1000;   // diese Probe gilt bis zur nächsten
    const a = art(profil.samples[i]);
    gesamt[a] = (gesamt[a] || 0) + d;
    const k = knoten.get(profil.samples[i]);
    if (k && k.callFrame.functionName !== '(idle)') {
      const cf = k.callFrame;
      const name = `${cf.functionName || '(anonym)'} ${cf.url ? cf.url.split('/').slice(-2).join('/') + ':' + (cf.lineNumber + 1) : ''}`.trim();
      selbst.set(name, (selbst.get(name) || 0) + d);
    }
    const seitenZeit = t / 1000 - versatz;
    for (const ph of phasen) {
      if (seitenZeit >= ph.von && seitenZeit < ph.bis) {
        jePhase[ph.name] ??= {};
        jePhase[ph.name][a] = (jePhase[ph.name][a] || 0) + d;
        break;
      }
    }
  }
  const runde = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v >= 0.5).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, Math.round(v)]));
  const top = [...selbst].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, v]) => [n, Math.round(v)]);
  return { gesamt: runde(gesamt), jePhase: Object.fromEntries(Object.entries(jePhase).map(([k, v]) => [k, runde(v)])), top };
}

// ---------------------------------------------------------------------------
// Chrome-Spur (Trace) auswerten: Eigenzeit je Thread und Ereignis-Name
// ---------------------------------------------------------------------------

// Bewusst schlank (eine lange Spur mit allen Kategorien wird größer, als Node als Text lesen kann);
// LZ_SPUR_KAT="a,b,…" ersetzt die Liste
const SPUR_KATEGORIEN = (process.env.LZ_SPUR_KAT || 'devtools.timeline,toplevel,v8,loading,ServiceWorker,CacheStorage,disabled-by-default-v8.gc,gpu')
  .split(',');

function spurAuswerten(buf) {
  let j;
  try { j = JSON.parse(Buffer.from(buf).toString('utf8')); } catch { return { fehler: 'Spur nicht lesbar' }; }
  const ev = Array.isArray(j) ? j : j.traceEvents || [];
  const pName = {};
  const tName = {};
  for (const e of ev) {
    if (e.ph !== 'M') continue;
    if (e.name === 'process_name') pName[e.pid] = e.args?.name;
    if (e.name === 'thread_name') tName[`${e.pid}:${e.tid}`] = e.args?.name;
  }
  const jeThread = new Map();
  let t0 = Infinity;
  let t1 = 0;
  for (const e of ev) {
    if (e.ph !== 'X' || !(e.dur > 0)) continue;
    const k = `${e.pid}:${e.tid}`;
    if (!jeThread.has(k)) jeThread.set(k, []);
    jeThread.get(k).push(e);
    t0 = Math.min(t0, e.ts);
    t1 = Math.max(t1, e.ts + e.dur);
  }
  const threads = [];
  for (const [k, liste] of jeThread) {
    liste.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const selbst = {};
    const stapel = [];
    let belegt = 0;
    for (const e of liste) {
      while (stapel.length && stapel[stapel.length - 1].ende <= e.ts) stapel.pop();
      const ende = e.ts + e.dur;
      const oben = stapel[stapel.length - 1];
      if (oben) {
        if (ende <= oben.ende) selbst[oben.name] -= e.dur;
        else continue;   // überlappt ohne Verschachtelung – auslassen
      } else {
        belegt += e.dur;
      }
      selbst[e.name] = (selbst[e.name] || 0) + e.dur;
      stapel.push({ name: e.name, ende });
    }
    if (belegt < 50000) continue;   // unter 50 ms: unwichtig
    const pid = k.split(':')[0];
    const top = Object.entries(selbst).filter(([, v]) => v >= 5000).sort((a, b) => b[1] - a[1]).slice(0, 14)
      .map(([n, v]) => [n, Math.round(v / 1000)]);
    threads.push({ thread: `${pName[pid] || 'Prozess'} ${pid} / ${tName[k] || k}`, belegt_ms: Math.round(belegt / 1000), eigenzeit_ms: Object.fromEntries(top) });
  }
  threads.sort((a, b) => b.belegt_ms - a.belegt_ms);
  return { dauer_ms: Math.round((t1 - t0) / 1000), threads: threads.slice(0, 14) };
}

async function spurStart(seite, an) {
  if (!an) return false;
  await seite.tracing.start({ categories: SPUR_KATEGORIEN }).catch((e) => log('Spur: ' + e.message));
  return true;
}

async function spurStop(seite, an) {
  if (!an) return null;
  const buf = await seite.tracing.stop().catch(() => null);
  return buf ? spurAuswerten(buf) : null;
}

// ---------------------------------------------------------------------------
// Auswertung eines Messfensters
// ---------------------------------------------------------------------------

// Ereignisse, die als Zeitachse ins Ergebnis kommen (ms ab Tipp bzw. Navigation)
const ZEITACHSE = new Set(['phase', 'pakete', 'laedt', 'szene', 'shown', 'gesperrt', 'wechsel', 'blende', 'stage', 'sigo', 'ready']);

function erstes(ereignisse, ab, fn) {
  for (const e of ereignisse) if (e[0] >= ab && fn(e)) return e[0];
  return null;
}

function netzImFenster(protokoll, zeitUrsprung, von, bis) {
  // Server-Zeiten (Epoche, ms) → Seitenzeit
  const imFenster = protokoll.filter((e) => {
    if (e.leer) return false;
    const s = e.start - zeitUrsprung;
    return s >= von - 5 && s <= bis;
  });
  const sum = (liste) => ({ anfragen: liste.length, mb: +(liste.reduce((a, e) => a + e.bytes, 0) / 1e6).toFixed(2) });
  const art = (p) => (/\.webp$/.test(p) ? 'bilder' : /\.mp3$/.test(p) ? 'toene' : /\.m?js$/.test(p) ? 'code' : /pack\.json$/.test(p) ? 'pack_json' : 'sonst');
  const spiel = imFenster.filter((e) => !e.sw);
  const jeArt = {};
  for (const e of spiel) {
    const a = art(e.pfad);
    jeArt[a] ??= [];
    jeArt[a].push(e);
  }
  return {
    spiel: sum(spiel),
    nur304: spiel.filter((e) => e.status === 304).length,
    doppelt: (() => {
      const n = new Map();
      for (const e of spiel) if (e.status === 200) n.set(e.pfad, (n.get(e.pfad) || 0) + 1);
      return [...n.values()].filter((x) => x > 1).length;
    })(),
    jeArt: Object.fromEntries(Object.entries(jeArt).map(([k, v]) => [k, sum(v)])),
    serviceWorker: sum(imFenster.filter((e) => e.sw)),
    letzteAntwort: spiel.length ? Math.round(Math.max(...spiel.map((e) => e.ende - zeitUrsprung)) - von) : null,
  };
}

// Wann waren alle Pakete da? Letzte Paket-Meldung zwischen `ab` und `bis` (keine = es war schon alles geladen:
// dann bleibt `ab`, die Zeit danach zählt zum Aufbau). Das Modul der Szene wird vor den Paketen geholt.
// Grenze der Messung: Der gleichzeitige Teil von enter() läuft in derselben Aufgabe wie das Ende des Ladens und
// fällt darum in „laden“; „aufbau“ ist nur der Teil von enter(), der danach noch wartet. Die Rechenzeit des
// Szenen-Codes steht getrennt im CPU-Profil (szene_code).
function paketeFertig(ev, ab, bis) {
  let t = ab;
  for (const e of ev) {
    if (e[0] < ab || (bis != null && e[0] > bis + 3)) continue;   // +3 ms: im selben Abfrage-Durchgang gemerkt
    if ((e[1] === 'laedt' && e[2] === '') || e[1] === 'pakete') t = e[0];
  }
  return t;
}

function rueckblick(fenster) {
  // aus den Ereignissen eines Wechsels die Phasen bilden
  const { ev, von, ziel } = fenster;
  const tGo = erstes(ev, von, (e) => e[1] === 'wechsel' && e[2] === 1);
  const tZu = tGo != null ? erstes(ev, tGo, (e) => e[1] === 'blende' && e[2] === 'zu') : null;
  const tLeer = tZu != null ? erstes(ev, tZu, (e) => e[1] === 'szene' && e[2] === '') : null;
  const tNeu = tZu != null ? erstes(ev, tZu, (e) => e[1] === 'szene' && e[2] === ziel) : null;
  // Gemerkt wird nur, was sich zwischen zwei Abfragen ändert. Läuft ein Wechsel-Schritt in einer einzigen Aufgabe
  // durch (alles schon geladen: alte Szene weg, neue gebaut und gezeigt), sieht der Beobachter z. B. „shown“ nie
  // auf 0 – dann gilt der Zustand zum Zeitpunkt des Szenenwechsels.
  const zustand = (t, k) => {
    let w;
    for (const e of ev) if (e[0] <= t && e[1] === k) w = e[2];
    return w;
  };
  let tShown = tNeu != null ? erstes(ev, tNeu, (e) => e[1] === 'shown' && e[2] === 1) : null;
  if (tNeu != null && zustand(tNeu, 'shown') !== 0 && !ev.some((e) => e[0] >= tNeu && e[1] === 'shown' && e[2] === 0)) {
    tShown = tNeu;
  }
  // Meldet der Kern seine Phase (SceneManager.phase), gelten deren Grenzen: Seit das Laden schon beim Tipp beginnt
  // (während die Blende schließt), sagen die Paket-Meldungen nichts mehr über das Ende des Ladens. Auch hier kann
  // eine kurze Phase zwischen zwei Abfragen liegen – dann zählt die nächste gesehene.
  const mitPhase = tGo != null && ev.some((e) => e[0] >= tGo && e[1] === 'phase' && e[2]);
  const ab = (liste) => (tZu != null ? erstes(ev, tZu, (e) => e[1] === 'phase' && liste.includes(e[2])) : null);
  const vorher = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
  const tHoch = mitPhase ? vorher(ab(['hochladen', 'oeffnen']), tShown) : null;
  const tAufbau = mitPhase ? vorher(ab(['aufbau', 'hochladen', 'oeffnen']), tHoch) : null;
  const tPF = mitPhase ? tAufbau : tZu != null ? paketeFertig(ev, tZu, tNeu) : null;
  const tOffen = tShown != null ? erstes(ev, tShown, (e) => e[1] === 'gesperrt' && e[2] === 0) : null;
  const ms = (a, b) => (a != null && b != null ? Math.round(b - a) : null);
  return {
    zeiten: { go: tGo, zu: tZu, leer: tLeer, pakete: tPF, neu: tNeu, hoch: tHoch, shown: tShown, offen: tOffen },
    phasen: {
      weg_spiel: ms(von, tGo),            // Tipp → Wechsel beginnt (Zugfahrt o. ä., so gewollt)
      blende_zu: ms(tGo, tZu),            // (lädt seit dem Umbau schon mit)
      laden: ms(tZu, tPF),                // Abbau der alten Szene, Modul, Pakete (Netz, Entpacken)
      aufbau: mitPhase ? ms(tPF, tHoch) : ms(tPF, tShown),   // Szene bauen: enter() (höchstens 1,2 s abgewartet)
      hochladen: mitPhase ? ms(tHoch, tShown) : null,        // Bilder hinter der Blende zur Grafikkarte
      blende_auf: ms(tShown, tOffen),
      warten_nach_go: ms(tGo, tOffen),
      gesamt: ms(von, tOffen),
    },
  };
}

function bilderImFenster(bilder, von, bis) {
  const d = bilder.filter(([t]) => t >= von && t <= bis).map(([, x]) => x);
  if (!d.length) return { anzahl: 0 };
  const sortiert = [...d].sort((a, b) => a - b);
  return {
    anzahl: d.length,
    laengstes_ms: Math.round(sortiert[sortiert.length - 1]),
    ueber50ms: d.filter((x) => x > 50).length,
    ueber100ms: d.filter((x) => x > 100).length,
    median_ms: +sortiert[Math.floor(sortiert.length / 2)].toFixed(1),
  };
}

function langeImFenster(lange, von, bis) {
  const d = lange.filter(([t]) => t >= von && t <= bis);
  return { anzahl: d.length, summe_ms: Math.round(d.reduce((a, [, x]) => a + x, 0)), laengste_ms: Math.round(Math.max(0, ...d.map(([, x]) => x))) };
}

// ---------------------------------------------------------------------------
// Ein Lauf (eine Wiederholung)
// ---------------------------------------------------------------------------

const GRUND_ARGS = ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];

// Zertifikat: mit Fingerabdruck (SPKI) vertraut Chrome ihm wie einem echten – dann gibt es Browser-Speicher und
// 304-Antworten wie am Tablet. Nur ohne Fingerabdruck (kein openssl) bleibt es beim Übergehen der Fehler.
function startArgs(server) {
  return server.spki
    ? [...GRUND_ARGS, `--ignore-certificate-errors-spki-list=${server.spki}`]
    : [...GRUND_ARGS, '--ignore-certificate-errors', '--allow-insecure-localhost'];
}

async function seiteEinrichten(browser, opt, info, basis) {
  const seite = await browser.newPage();
  await seite.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2, hasTouch: false, isMobile: false });
  // Erst eine leere Seite derselben Herkunft öffnen: Der Wechsel in einen anderen Prozess (about:blank → Server)
  // ist dann schon geschehen, Drosselung und Profiler gelten auch für das Spiel.
  await seite.goto(new URL('/leer.html', basis).href, { waitUntil: 'load' });
  const cdp = await seite.createCDPSession();
  if (opt.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opt.cpu });
  await cdp.send('Emulation.setHardwareConcurrencyOverride', { hardwareConcurrency: 8 }).catch(() => {});
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await seite.evaluateOnNewDocument(BEOBACHTER);
  // Auch Worker (Pixi entpackt Bilder in Workern) drosseln, soweit Chrome das zulässt
  seite.on('workercreated', (w) => {
    info.worker = (info.worker || 0) + 1;
    w.client?.send('Emulation.setCPUThrottlingRate', { rate: opt.cpu })
      .then(() => { info.workerGedrosselt = (info.workerGedrosselt || 0) + 1; })
      .catch(() => { info.workerNichtGedrosselt = (info.workerNichtGedrosselt || 0) + 1; });
  });
  seite.on('pageerror', (e) => info.fehler.push('Seitenfehler: ' + e.message.split('\n')[0]));
  seite.on('console', (m) => { if (m.type() === 'error') info.fehler.push('console.error: ' + m.text().slice(0, 200)); });
  return { seite, cdp };
}

async function warteBis(seite, fn, arg, sek, was) {
  const ende = Date.now() + sek * 1000;
  while (Date.now() < ende) {
    const ok = await seite.evaluate(fn, arg).catch(() => false);
    if (ok) return true;
    await pause(0.05);
  }
  throw new Error(`Zeitüberschreitung (${sek} s): ${was}`);
}

async function jetztInSeite(seite) {
  return seite.evaluate(() => performance.now());
}

async function tippe(seite, punkt) {
  await seite.mouse.move(punkt.x, punkt.y);
  await seite.mouse.down();
  await pause(0.08);
  await seite.mouse.up();
}

async function profilStart(cdp, seite) {
  const p1 = await jetztInSeite(seite);
  await cdp.send('Profiler.start');
  const p2 = await jetztInSeite(seite);
  return { p1, p2 };
}

async function profilStop(cdp, start) {
  const { profile } = await cdp.send('Profiler.stop');
  const versatz = profile.startTime / 1000 - (start.p1 + start.p2) / 2;
  return { profile, versatz };
}

/**
 * Misst einen Szenenwechsel: aktion() löst ihn aus, gewartet wird, bis `ziel` bedienbar ist.
 */
async function messeWechsel(ctx, name, ziel, aktion, { zeitlimit = 120, spur = false } = {}) {
  const { seite, cdp, server } = ctx;
  const evIndex = await seite.evaluate(() => window.__lz.ereignisse.length);
  const mitSpur = await spurStart(seite, spur);
  const prof = await profilStart(cdp, seite);
  const von = await jetztInSeite(seite);
  await aktion();
  await warteBis(seite, (id) => window.__lz.bereit(id), ziel, zeitlimit, `${name}: ${ziel} bedienbar`);
  const bis = await jetztInSeite(seite);
  await pause(0.25);
  const { profile, versatz } = await profilStop(cdp, prof);
  const spurErgebnis = await spurStop(seite, mitSpur);
  const daten = await seite.evaluate((i, v, b) => ({
    ev: window.__lz.ereignisse.slice(i),
    tipp: window.__lz.tipps.filter((t) => t >= v).slice(0, 1)[0] ?? null,
    lange: window.__lz.lange.filter(([t]) => t >= v - 1 && t <= b + 300),
    bilder: window.__lz.bilder.filter(([t]) => t >= v && t <= b + 300),
    ursprung: performance.timeOrigin,
  }), evIndex, von, bis);
  const start = daten.tipp ?? von;
  const r = rueckblick({ ev: daten.ev, von: start, ziel });
  const ph = r.zeiten;
  const phasen = [
    { name: 'weg_spiel', von: start, bis: ph.go ?? bis },
    { name: 'blende_zu', von: ph.go ?? bis, bis: ph.zu ?? bis },
    { name: 'laden', von: ph.zu ?? bis, bis: ph.pakete ?? bis },
    { name: 'aufbau', von: ph.pakete ?? bis, bis: ph.shown ?? bis },
    { name: 'blende_auf', von: ph.shown ?? bis, bis: ph.offen ?? bis },
  ];
  const cpu = profilAuswerten(profile, versatz, phasen);
  const netz = netzImFenster(server.protokoll, daten.ursprung, start, bis);
  const netzLaden = netzImFenster(server.protokoll, daten.ursprung, ph.zu ?? start, ph.pakete ?? bis);
  const pakete = daten.ev.filter((e) => ZEITACHSE.has(e[1])).map(([t, k, v]) => [Math.round(t - start), k, v]);
  const bedarf = await seite.evaluate(() => window.__lz.bildbedarf()).catch((e) => ({ fehler: String(e.message).slice(0, 200) }));
  if (ctx.fotos) {
    await seite.screenshot({ path: path.join(WURZEL, 'shots', `lz_${name}.jpg`), type: 'jpeg', quality: 70 }).catch(() => {});
  }
  const ergebnis = {
    fall: name, ziel, ...r.phasen,
    netz, netz_in_ladephase: netzLaden.spiel, cpu_ms: cpu.gesamt, cpu_je_phase_ms: cpu.jePhase, cpu_top_funktionen: cpu.top,
    bilder: bilderImFenster(daten.bilder, start, bis),
    bilder_blende_auf: bilderImFenster(daten.bilder, ph.shown ?? bis, ph.offen ?? bis),
    lange_aufgaben: langeImFenster(daten.lange, start, bis),
    zeitachse: pakete, bildbedarf: bedarf,
    ...(spurErgebnis ? { spur: spurErgebnis } : {}),
  };
  log(`  ${name.padEnd(28)} gesamt ${String(ergebnis.gesamt).padStart(6)} ms  (Weg ${ergebnis.weg_spiel}, zu ${ergebnis.blende_zu}, laden ${ergebnis.laden}, aufbau ${ergebnis.aufbau}${ergebnis.hochladen != null ? ', hoch ' + ergebnis.hochladen : ''}, auf ${ergebnis.blende_auf})  Netz ${netz.spiel.anfragen}/${netz.spiel.mb} MB`);
  return ergebnis;
}

async function hudPunkt(seite, x, y) {
  return seite.evaluate((a) => window.__lz.punkt('hud', a), x === 'W' ? ['W', y[0], y[1]] : [x, 0, y]);
}

async function lauf(opt, nr, server) {
  const info = { fehler: [], nr };
  const ergebnisse = [];
  const profil = await fsp.mkdtemp(path.join(os.tmpdir(), 'sigo-ladezeit-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: profil, args: startArgs(server), protocolTimeout: 180000,
    acceptInsecureCerts: !server.spki,
  });
  // Den Service Worker kann man zwischendurch anhalten (wie nach einem Neustart des Tablets)
  const browserCdp = await browser.target().createCDPSession();
  try {
    const version = await browser.version();
    info.chrome = version;
    let { seite, cdp } = await seiteEinrichten(browser, opt, info, server.basis);
    info.renderer = await seite.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const i = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return gl ? (i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null;
    });
    const url = server.basis + 'index.html?sw=1';
    const ctx = { seite, cdp, server, fotos: opt.fotos && nr === 1 };

    // ---------------- Start (a: erster Besuch, b: später)
    const messeStart = async (name) => {
      const vorStart = Date.now();
      const prof = { p1: 0, p2: 0 };
      const mitSpur = await spurStart(ctx.seite, opt.spur);
      await cdp.send('Profiler.start');
      await ctx.seite.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await warteBis(ctx.seite, () => !!(window.__lz && window.__lz.ready), null, 180, `${name}: Startbild bedienbar`);
      await pause(0.25);
      const { profile } = await cdp.send('Profiler.stop');
      const spurErgebnis = await spurStop(ctx.seite, mitSpur);
      const d = await ctx.seite.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const res = performance.getEntriesByType('resource');
        const module = res.filter((r) => /\/src\/.*\.js$/.test(r.name));
        const z = window.__lz;
        return {
          ev: z.ereignisse, lange: z.lange, bilder: z.bilder, ready: z.ready, sigo: z.sigo, ursprung: performance.timeOrigin,
          fcp: fcp ? fcp.startTime : null, dcl: nav ? nav.domContentLoadedEventEnd : null, load: nav ? nav.loadEventEnd : null,
          moduleAnzahl: module.length, moduleEnde: module.length ? Math.max(...module.map((r) => r.responseEnd)) : null,
          sw: navigator.serviceWorker && navigator.serviceWorker.controller ? 1 : 0,
        };
      });
      const ev = d.ev;
      const t = (k, v) => erstes(ev, 0, (e) => e[1] === k && (v === undefined || e[2] === v));
      const tNeu = erstes(ev, 0, (e) => e[1] === 'szene' && e[2] === 'start');
      const tShown = t('shown', 1);
      // Ende des Ladens: Beginn des Aufbaus (SceneManager.phase) – seit dem schnellen ersten Start laden die Pakete
      // danach leise weiter, „alle Pakete fertig“ wäre zu spät; ohne Phase wie früher
      const tPF = t('phase', 'aufbau') ?? paketeFertig(ev, t('stage', 1) ?? 0, tNeu);
      // Profil-Zeitachse: Start des Profils ≈ Navigation (der Versatz wird über den ersten Probenzeitpunkt geschätzt)
      const versatz = profile.startTime / 1000 - (vorStart - d.ursprung);
      const phasen = [
        { name: 'html_und_module', von: -1e9, bis: d.sigo ?? 0 },
        { name: 'grafik_start', von: d.sigo ?? 0, bis: t('stage', 1) ?? 0 },
        { name: 'laden', von: t('stage', 1) ?? 0, bis: tPF ?? 0 },
        { name: 'aufbau', von: tPF ?? 0, bis: tShown ?? 0 },
        { name: 'blende_auf', von: tShown ?? 0, bis: d.ready ?? 0 },
      ];
      const cpu = profilAuswerten(profile, versatz, phasen);
      const netz = netzImFenster(server.protokoll, d.ursprung, vorStart - d.ursprung, d.ready);
      const ms = (a, b) => (a != null && b != null ? Math.round(b - a) : null);
      const pakete = ev.filter((e) => ZEITACHSE.has(e[1])).map(([tt, k, v]) => [Math.round(tt), k, v]);
      const r = {
        fall: name, ziel: 'start',
        gesamt: Math.round(d.ready),
        erstes_bild_punkte: d.fcp != null ? Math.round(d.fcp) : null,
        html_und_module: Math.round(d.sigo),
        module_anzahl: d.moduleAnzahl,
        grafik_start: ms(d.sigo, t('stage', 1)),
        laden: ms(t('stage', 1), tPF),
        aufbau: ms(tPF, tShown),
        blende_auf: ms(tShown, d.ready),
        load_ereignis: d.load != null ? Math.round(d.load) : null,
        sw_kontrolliert: d.sw,
        netz, cpu_ms: cpu.gesamt, cpu_je_phase_ms: cpu.jePhase, cpu_top_funktionen: cpu.top,
        bilder: bilderImFenster(d.bilder, 0, d.ready),
        lange_aufgaben: langeImFenster(d.lange, 0, d.ready),
        zeitachse: pakete,
        ...(spurErgebnis ? { spur: spurErgebnis } : {}),
      };
      log(`  ${name.padEnd(28)} gesamt ${String(r.gesamt).padStart(6)} ms  (HTML+Module ${r.html_und_module}, Grafik ${r.grafik_start}, laden ${r.laden}, aufbau ${r.aufbau}, auf ${r.blende_auf})  Netz ${netz.spiel.anfragen}/${netz.spiel.mb} MB, SW ${netz.serviceWorker.anfragen}/${netz.serviceWorker.mb} MB`);
      return r;
    };

    const losUndKarte = async (name) => {
      await pause(1.0);
      const p = await ctx.seite.evaluate(() => window.__lz.punkt('los'));
      return messeWechsel(ctx, name, 'karte', () => tippe(ctx.seite, p));
    };

    // Stand des Offline-Speichers: { aktiv, installiert, n (Dateien in sigo2-Speichern) }
    const swStand = () => ctx.seite.evaluate(async () => {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      const namen = await caches.keys();
      let n = 0;
      for (const k of namen.filter((x) => x.startsWith('sigo2-'))) n += (await (await caches.open(k)).keys()).length;
      return { aktiv: !!(reg && reg.active && reg.active.state === 'activated'), installiert: !!(reg && reg.installing), n };
    }).catch(() => null);
    // Wartet auf den fertigen Offline-Speicher und schreibt den Verlauf mit: [Sekunden, Dateien, Zustand, Anfragen]
    const swFertig = async () => {
      const ende = Date.now() + opt.swWarten * 1000;
      const t0 = Date.now();
      const verlauf = [];
      let letzt = -1e9;
      while (Date.now() < ende) {
        const z = await swStand();
        const sek = +((Date.now() - t0) / 1000).toFixed(1);
        if (z && sek - letzt >= 5) {
          verlauf.push([sek, z.n, z.aktiv ? 'aktiv' : z.installiert ? 'installiert' : '-', server.protokoll.filter((e) => e.sw).length]);
          letzt = sek;
        }
        if (z?.aktiv) return { sek, dateien: z.n, verlauf };
        await pause(1);
      }
      return { sek: null, dateien: null, abbruch: true, verlauf };
    };

    const imFall = (f) => opt.faelle.includes(f);
    // Karte → Ort → Karte (Pausen: vor dem Tipp auf den Ort bzw. auf den Karten-Knopf)
    const zurKarte = async (name, warte = 1.5) => {
      await pause(warte);
      const p = await hudPunkt(ctx.seite, 170, 170);
      return messeWechsel(ctx, name, 'karte', () => tippe(ctx.seite, p));
    };
    let spurOrt = opt.spur;
    const zumOrt = async (name, id, warte = 1.0) => {
      await pause(warte);
      const p = await ctx.seite.evaluate((o) => window.__lz.punkt('ort', o), id);
      if (!p) throw new Error(`Ort ${id} nicht auf der Karte gefunden`);
      const spur = spurOrt && name.startsWith('c_');
      if (spur) spurOrt = false;
      return messeWechsel(ctx, name, id, () => tippe(ctx.seite, p), { spur });
    };

    // Erster Besuch wird immer gebraucht (sonst gibt es keinen Offline-Speicher für b–d)
    const a1 = await messeStart('a_erster_start');
    const swStart = Date.now();
    if (imFall('a')) ergebnisse.push(a1);
    const a2 = await losUndKarte('a_los_bis_karte');
    if (imFall('a')) ergebnisse.push(a2);

    // ---------------- e: erste Sitzung – Orte sofort antippen, solange der Offline-Speicher noch lädt
    if (imFall('e')) {
      for (const id of opt.orteErst) {
        try {
          const vorher = await swStand();
          const r = await zumOrt(`e_${id}_erste_sitzung`, id, 0.1);
          r.offline_dateien_beim_tipp = vorher?.n ?? null;
          r.offline_fertig_beim_tipp = !!vorher?.aktiv;
          ergebnisse.push(r);
          ergebnisse.push(await zurKarte(`e_${id}_erste_sitzung_zurueck`, 0.5));
        } catch (e) {
          info.fehler.push(`e/${id}: ${e.message}`);
          log(`  FEHLER e/${id}: ${e.message}`);
          await ctx.seite.evaluate(() => window.__sigo.go('karte')).catch(() => {});
          await warteBis(ctx.seite, () => window.__lz.bereit('karte'), null, 60, 'zurück zur Karte').catch(() => {});
        }
      }
    }

    if (imFall('b') || imFall('c') || imFall('d')) {
      const sw = await swFertig();
      const seitStart = +((Date.now() - (server.protokoll.find((e) => e.sw)?.start ?? swStart)) / 1000).toFixed(1);
      const swNetz = server.protokoll.filter((e) => e.sw);
      info.serviceWorker = { ...sw, sek_seit_erster_sw_anfrage: seitStart, anfragen: swNetz.length,
        mb: +(swNetz.reduce((a, e) => a + e.bytes, 0) / 1e6).toFixed(1), antworten304: swNetz.filter((e) => e.status === 304).length };
      log(`  Offline-Speicher fertig: ${JSON.stringify(info.serviceWorker)}`);
      if (process.env.LZ_KOPF) {
        const h = {};
        for (const e of server.protokoll) h[e.kopf] = (h[e.kopf] || 0) + 1;
        log(JSON.stringify(h, null, 1));
        log(JSON.stringify(server.protokoll.filter((e) => e.status === 404).map((e) => e.pfad)));
      }

      // ---------------- b: späterer Start – neue Seite, Service Worker angehalten (wie nach einem Neustart)
      await ctx.seite.close();
      await browserCdp.send('ServiceWorker.enable').catch(() => {});
      await browserCdp.send('ServiceWorker.stopAllWorkers').catch(() => {});
      ({ seite, cdp } = await seiteEinrichten(browser, opt, info, server.basis));
      ctx.seite = seite;
      ctx.cdp = cdp;
      const b1 = await messeStart('b_spaeter_start');
      if (imFall('b')) ergebnisse.push(b1);
      const b2 = await losUndKarte('b_los_bis_karte');
      if (imFall('b')) ergebnisse.push(b2);
    }

    // ---------------- c: Karte → Ort → Karte (nach fertigem Offline-Speicher)
    if (imFall('c')) {
      const orte = opt.orte || ORTE;
      const runden = opt.zweiter ? [1, 2] : [1];
      for (const runde of runden) {
        for (const id of orte) {
          try {
            ergebnisse.push(await zumOrt(`c_${id}_${runde}`, id));
            if (id === 'bahnhof' && runde === 1 && !opt.orte) {
              // Bahnhof → Fahrt (im Spiel nach dem Einsteigen; hier direkt über __sigo.go)
              await pause(1.0);
              ergebnisse.push(await messeWechsel(ctx, 'c_bahnhof_fahrt_1', 'fahrt', () => ctx.seite.evaluate(() => { window.__sigo.go('fahrt'); })));
            }
            ergebnisse.push(await zurKarte(`c_${id}_${runde}_zurueck`));
          } catch (e) {
            info.fehler.push(`${id}/${runde}: ${e.message}`);
            log(`  FEHLER ${id}: ${e.message}`);
            await ctx.seite.evaluate(() => window.__sigo.go('karte')).catch(() => {});
            await warteBis(ctx.seite, () => window.__lz.bereit('karte'), null, 60, 'zurück zur Karte').catch(() => {});
          }
        }
      }
    }

    // ---------------- d: Umblättern, Stickerbuch
    if (imFall('d')) {
      const blaettere = async (name, richtung) => {
        await pause(1.2);
        const evIndex = await ctx.seite.evaluate(() => window.__lz.ereignisse.length);
        const p = await ctx.seite.evaluate((r) => window.__lz.punkt('pfeil', r), richtung);
        const prof = await profilStart(ctx.cdp, ctx.seite);
        const von = await jetztInSeite(ctx.seite);
        await tippe(ctx.seite, p);
        await pause(0.1);
        await warteBis(ctx.seite, () => window.__lz.blaetterBereit(), null, 30, name);
        const bis = await jetztInSeite(ctx.seite);
        await pause(0.2);
        const { profile, versatz } = await profilStop(ctx.cdp, prof);
        const d = await ctx.seite.evaluate((i, v) => ({ ev: window.__lz.ereignisse.slice(i), bilder: window.__lz.bilder.filter(([t]) => t >= v), lange: window.__lz.lange.filter(([t]) => t >= v - 1), tipp: window.__lz.tipps.filter((t) => t >= v)[0] ?? v, ursprung: performance.timeOrigin }), evIndex, von);
        const st = d.tipp;
        const tA = erstes(d.ev, st, (e) => e[1] === 'blaettern' && e[2] === 'aufbau');
        const tH = erstes(d.ev, st, (e) => e[1] === 'blaettern' && e[2] === 'hochladen');
        const tG = erstes(d.ev, st, (e) => e[1] === 'blaettern' && e[2] === 'gleitet');
        const tR = erstes(d.ev, (tG ?? st), (e) => e[1] === 'blaettern' && e[2] === 'ruht');
        const ms = (a, b) => (a != null && b != null ? Math.round(b - a) : null);
        const ph = [
          { name: 'seite_aufbau', von: st, bis: tH ?? tG ?? bis },
          { name: 'hochladen', von: tH ?? tG ?? bis, bis: tG ?? bis },
          { name: 'gleiten', von: tG ?? bis, bis: tR ?? bis },
        ];
        const cpu = profilAuswerten(profile, versatz, ph);
        const r = {
          fall: name, ziel: 'seite', gesamt: ms(st, tR ?? bis),
          seite_aufbau: ms(st, tH ?? tG), hochladen: ms(tH, tG), gleiten: ms(tG, tR), erste_reaktion: ms(st, tA ?? tH ?? tG),
          netz: netzImFenster(server.protokoll, d.ursprung, st, bis), cpu_ms: cpu.gesamt, cpu_je_phase_ms: cpu.jePhase,
          bilder_gleiten: bilderImFenster(d.bilder, tG ?? bis, tR ?? bis), lange_aufgaben: langeImFenster(d.lange, st, bis),
        };
        log(`  ${name.padEnd(28)} gesamt ${String(r.gesamt).padStart(6)} ms  (Seite bauen ${r.seite_aufbau}, hochladen ${r.hochladen}, gleiten ${r.gleiten}; längstes Bild beim Gleiten ${r.bilder_gleiten.laengstes_ms} ms)`);
        return r;
      };
      for (const id of ['bauernhof', 'garten']) {
        try {
          await zumOrt(`d_hin_${id}`, id);
          ergebnisse.push(await blaettere(`d_${id}_seite_1`, 1));
          ergebnisse.push(await blaettere(`d_${id}_seite_2`, 1));
          ergebnisse.push(await blaettere(`d_${id}_zurueck_1`, -1));
          // Stickerbuch aus dem Ort und zurück in den Ort
          await pause(1.2);
          const pa = await hudPunkt(ctx.seite, 'W', [-180, 180]);
          ergebnisse.push(await messeWechsel(ctx, `d_album_aus_${id}`, 'album', () => tippe(ctx.seite, pa)));
          await pause(1.2);
          const pz = await hudPunkt(ctx.seite, 170, 170);
          ergebnisse.push(await messeWechsel(ctx, `d_album_zurueck_${id}`, id, () => tippe(ctx.seite, pz)));
          await zurKarte(`d_weg_${id}`);
        } catch (e) {
          info.fehler.push(`d/${id}: ${e.message}`);
          log(`  FEHLER d/${id}: ${e.message}`);
          await ctx.seite.evaluate(() => window.__sigo.go('karte')).catch(() => {});
          await warteBis(ctx.seite, () => window.__lz.bereit('karte'), null, 60, 'zurück zur Karte').catch(() => {});
        }
      }
      try {
        await pause(1.2);
        const pa = await hudPunkt(ctx.seite, 'W', [-180, 180]);
        ergebnisse.push(await messeWechsel(ctx, 'd_album_aus_karte', 'album', () => tippe(ctx.seite, pa)));
        ergebnisse.push(await zurKarte('d_album_zur_karte'));
      } catch (e) {
        info.fehler.push(`d/album: ${e.message}`);
      }
    }
    info.fehlend = await ctx.seite.evaluate(() => (window.__sigo?.fehlend || []).slice(0, 20)).catch(() => null);
  } finally {
    await browser.close().catch(() => {});
    await fsp.rm(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
  }
  return { info, ergebnisse };
}

// ---------------------------------------------------------------------------
// Bausteine: Einzelkosten in der laufenden Seite (nach dem Start, Offline-Speicher warm)
// ---------------------------------------------------------------------------

async function bausteine(opt, server) {
  const info = { fehler: [] };
  const profil = await fsp.mkdtemp(path.join(os.tmpdir(), 'sigo-ladezeit-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profil, args: startArgs(server),
    protocolTimeout: 600000, acceptInsecureCerts: !server.spki });
  try {
    const { seite } = await seiteEinrichten(browser, opt, info, server.basis);
    await seite.goto(server.basis + 'index.html?szene=probe&test=1', { waitUntil: 'domcontentloaded' });
    await warteBis(seite, () => !!(window.__lz && window.__lz.ready), null, 120, 'Probe-Szene');
    const tiere = JSON.parse(await fsp.readFile(path.join(WURZEL, 'assets/tiere/pack.json'), 'utf8'));
    const hgs = [];
    for (const d of await fsp.readdir(path.join(WURZEL, 'assets'))) {
      const pj = path.join(WURZEL, 'assets', d, 'pack.json');
      if (!fs.existsSync(pj)) continue;
      const j = JSON.parse(await fsp.readFile(pj, 'utf8'));
      for (const [n, b] of Object.entries(j.images || {})) if (/^hg/.test(n) && b.h >= 1500) hgs.push({ url: `assets/${d}/${b.file}`, w: b.w, h: b.h });
    }
    // Liste des Offline-Speichers (wie sw.js sie liest)
    const swSelf = {};
    vm.runInNewContext(await fsp.readFile(path.join(WURZEL, 'sw-dateien.js'), 'utf8'), { self: swSelf });
    const swDateien = swSelf.SIGO_DATEIEN || [];
    const erg = await seite.evaluate(async (tierBilder, hintergruende, swListe) => {
      const zeit = () => performance.now();
      const out = {};
      // 0) Offline-Speicher: so sucht sw.js jede Datei (caches.open + match mit ignoreSearch) – mit so vielen
      //    Einträgen wie im echten Speicher; dazu dieselbe Suche ohne ignoreSearch
      {
        const name = 'lz-probe-' + Math.random().toString(36).slice(2);
        const c = await caches.open(name);
        const basis = new URL('./', document.baseURI);
        const urls = swListe.map((u) => new URL(u, basis).href);
        for (let i = 0; i < urls.length; i += 50) {
          await Promise.all(urls.slice(i, i + 50).map((u) => c.put(u, new Response('x'.repeat(64)))));
        }
        const anfragen = urls.filter((u) => /\/assets\/(tiere|common|zug|rahmen)\//.test(u));
        out.speicher_eintraege = urls.length;
        out.speicher_abfragen = anfragen.length;
        let t = zeit();
        await Promise.all(anfragen.map(async (u) => { const cc = await caches.open(name); return cc.match(u, { ignoreSearch: true }); }));
        out.speicher_suche_ignoreSearch_parallel_ms = Math.round(zeit() - t);
        t = zeit();
        await Promise.all(anfragen.map(async (u) => { const cc = await caches.open(name); return cc.match(u); }));
        out.speicher_suche_genau_parallel_ms = Math.round(zeit() - t);
        t = zeit();
        for (const u of anfragen.slice(0, 40)) await (await caches.open(name)).match(u, { ignoreSearch: true });
        out.speicher_suche_ignoreSearch_je_datei_ms = +((zeit() - t) / 40).toFixed(2);
        t = zeit();
        for (const u of anfragen.slice(0, 40)) await (await caches.open(name)).match(u);
        out.speicher_suche_genau_je_datei_ms = +((zeit() - t) / 40).toFixed(2);
        await caches.delete(name);
      }
      // 1) Tierbilder holen (Netz/Cache)
      let t = zeit();
      const blobs = await Promise.all(tierBilder.map(async (b) => ({ ...b, blob: await (await fetch(b.url)).blob() })));
      out.tiere_holen_ms = Math.round(zeit() - t);
      out.tiere_mb = +(blobs.reduce((a, b) => a + b.blob.size, 0) / 1e6).toFixed(2);
      // 2) alle gleichzeitig entpacken + auf 600 verkleinern (so lädt assets.js heute)
      t = zeit();
      let bm = await Promise.all(blobs.map((b) => {
        const f = 600 / Math.max(b.w, b.h);
        return f < 1 ? createImageBitmap(b.blob, { resizeWidth: Math.round(b.w * f), resizeHeight: Math.round(b.h * f), resizeQuality: 'high' }) : createImageBitmap(b.blob);
      }));
      out.tiere_entpacken_verkleinert_parallel_ms = Math.round(zeit() - t);
      bm.forEach((x) => x.close());
      // 3) dasselbe ohne Verkleinern
      t = zeit();
      bm = await Promise.all(blobs.map((b) => createImageBitmap(b.blob)));
      out.tiere_entpacken_voll_parallel_ms = Math.round(zeit() - t);
      bm.forEach((x) => x.close());
      // 4) eins nach dem anderen (Kosten je Bild)
      t = zeit();
      for (const b of blobs.slice(0, 20)) { const f = 600 / Math.max(b.w, b.h); (await createImageBitmap(b.blob, { resizeWidth: Math.round(b.w * f), resizeHeight: Math.round(b.h * f), resizeQuality: 'high' })).close(); }
      out.tier_entpacken_verkleinert_je_bild_ms = +((zeit() - t) / 20).toFixed(1);
      t = zeit();
      for (const b of blobs.slice(0, 20)) (await createImageBitmap(b.blob)).close();
      out.tier_entpacken_voll_je_bild_ms = +((zeit() - t) / 20).toFixed(1);
      // 5) Hochladen auf die Grafikkarte: eigener WebGL2-Kontext, mit gl.finish() abgewartet
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const gl = c.getContext('webgl2');
      const lade = (bild, mip) => {
        const tx = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        const t0 = zeit();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bild);
        if (mip) gl.generateMipmap(gl.TEXTURE_2D);
        gl.finish();
        const d = zeit() - t0;
        gl.deleteTexture(tx);
        return d;
      };
      const hg = [];
      for (const h of hintergruende.slice(0, 12)) {
        const blob = await (await fetch(h.url)).blob();
        const t1 = zeit();
        const b = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
        const entpacken = zeit() - t1;
        const mit = lade(b, true);
        const ohne = lade(b, false);
        hg.push({ url: h.url, mpx: +((h.w * h.h) / 1e6).toFixed(2), kb: Math.round(blob.size / 1024), entpacken_ms: Math.round(entpacken), hochladen_mit_mip_ms: Math.round(mit), hochladen_ohne_mip_ms: Math.round(ohne) });
        b.close();
      }
      out.hintergruende = hg;
      const sum = (k) => hg.reduce((a, x) => a + x[k], 0);
      const mpx = hg.reduce((a, x) => a + x.mpx, 0);
      out.hg_entpacken_ms_je_mpx = +(sum('entpacken_ms') / mpx).toFixed(1);
      out.hg_hochladen_mit_mip_ms_je_mpx = +(sum('hochladen_mit_mip_ms') / mpx).toFixed(1);
      out.hg_hochladen_ohne_mip_ms_je_mpx = +(sum('hochladen_ohne_mip_ms') / mpx).toFixed(1);
      // 6) Tierbild (600) hochladen
      const kl = await Promise.all(blobs.slice(0, 20).map((b) => { const f = 600 / Math.max(b.w, b.h); return createImageBitmap(b.blob, { resizeWidth: Math.round(b.w * f), resizeHeight: Math.round(b.h * f) }); }));
      let s = 0;
      for (const b of kl) { s += lade(b, true); b.close(); }
      out.tier600_hochladen_mit_mip_je_bild_ms = +(s / kl.length).toFixed(1);
      return out;
    }, Object.entries(tiere.images).map(([, b]) => ({ url: 'assets/tiere/' + b.file, w: b.w, h: b.h })), hgs, swDateien);
    return { info, bausteine: erg };
  } finally {
    await browser.close().catch(() => {});
    await fsp.rm(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Mediane und Tabelle
// ---------------------------------------------------------------------------

function median(werte) {
  const z = werte.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!z.length) return null;
  const m = Math.floor(z.length / 2);
  return z.length % 2 ? z[m] : Math.round(((z[m - 1] + z[m]) / 2) * 100) / 100;
}

// Mittelt alle Zahlen gleicher Pfade über die Wiederholungen
function medianObjekt(liste) {
  const erstes = liste.find((x) => x && typeof x === 'object');
  if (!erstes) return median(liste);
  if (Array.isArray(erstes)) return erstes;  // Listen (z. B. Paket-Ereignisse) vom ersten Lauf
  const schluessel = new Set(liste.flatMap((x) => (x && typeof x === 'object' ? Object.keys(x) : [])));
  const out = {};
  for (const k of schluessel) {
    const werte = liste.map((x) => x?.[k]);
    const probe = werte.find((v) => v !== undefined && v !== null);
    if (typeof probe === 'number') out[k] = median(werte);
    else if (probe && typeof probe === 'object') out[k] = medianObjekt(werte);
    else out[k] = probe ?? null;
  }
  return out;
}

// Gruppen von Wechseln über alle Wiederholungen und Orte: Median, P90, Höchstwert, Anteil „lädt noch hinter der
// geschlossenen Blende“ (laden > 100 ms) – der Median je Ort und dann über die Orte verdeckt sonst Ausreißer.
const GRUPPEN = [
  ['erste_sitzung_ort_sofort (e)', (f) => /^e_.*_erste_sitzung$/.test(f)],
  ['karte_zum_ort_erstbesuch (c, Offline-Speicher fertig)', (f) => /^c_[a-z]+_1$/.test(f)],
  ['karte_zum_ort_zweitbesuch (c)', (f) => /^c_[a-z]+_2$/.test(f)],
  ['zurueck_zur_karte (c, e)', (f) => /_zurueck$/.test(f) && /^[ce]_/.test(f)],
  ['bahnhof_zur_fahrt', (f) => f === 'c_bahnhof_fahrt_1'],
  ['album (d)', (f) => /^d_album_/.test(f)],
  ['erster_start (a)', (f) => f === 'a_erster_start'],
  ['spaeter_start (b)', (f) => f === 'b_spaeter_start'],
];

function quantil(werte, q) {
  const z = werte.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!z.length) return null;
  return z[Math.min(z.length - 1, Math.ceil(q * z.length) - 1)];
}

function verteilung(laeufe) {
  const out = {};
  for (const [name, passt] of GRUPPEN) {
    const alle = laeufe.flatMap((l) => l.ergebnisse.filter((e) => passt(e.fall)));
    if (!alle.length) continue;
    const gesamt = alle.map((e) => e.gesamt);
    const abGo = alle.map((e) => (e.gesamt != null && e.weg_spiel != null ? e.gesamt - e.weg_spiel : null));
    const laden = alle.map((e) => e.laden);
    out[name] = {
      n: alle.length,
      ohne_wert: gesamt.filter((x) => typeof x !== 'number').length,
      gesamt: { median: median(gesamt), p90: quantil(gesamt, 0.9), max: quantil(gesamt, 1) },
      ab_wechsel: abGo.some((x) => x != null) ? { median: median(abGo), p90: quantil(abGo, 0.9), max: quantil(abGo, 1) } : null,
      laden: laden.some((x) => x != null) ? { median: median(laden), p90: quantil(laden, 0.9), max: quantil(laden, 1),
        anteil_ueber_100ms: +(laden.filter((x) => x > 100).length / laden.filter((x) => typeof x === 'number').length).toFixed(2) } : null,
    };
  }
  return out;
}

function verteilungTabelle(v) {
  const s = (x) => (x == null ? '–' : String(Math.round(x)));
  const zeilen = [['Gruppe', 'n', 'Median', 'P90', 'max', 'ab Wechsel P90', 'laden>100ms']];
  for (const [k, g] of Object.entries(v || {})) {
    zeilen.push([k, String(g.n), s(g.gesamt.median), s(g.gesamt.p90), s(g.gesamt.max), s(g.ab_wechsel?.p90),
      g.laden ? `${Math.round(g.laden.anteil_ueber_100ms * 100)} %` : '–']);
  }
  const breiten = zeilen[0].map((_, i) => Math.max(...zeilen.map((z) => z[i].length)));
  return zeilen.map((z) => z.map((x, i) => (i === 0 ? x.padEnd(breiten[i]) : x.padStart(breiten[i]))).join('  ')).join('\n');
}

function tabelle(mediane) {
  const zeilen = [];
  const kopf = ['Fall', 'gesamt', 'Weg', 'zu', 'laden', 'Aufbau', 'auf', 'Anfr.', 'MB', 'Hochl.', 'Szene', 'Kern', 'Pixi', 'GC', 'intern', 'max.Bild'];
  zeilen.push(kopf);
  for (const [fall, m] of Object.entries(mediane)) {
    const c = m.cpu_ms || {};
    const s = (v) => (v == null ? '–' : String(Math.round(v)));
    zeilen.push([
      fall, s(m.gesamt), s(m.weg_spiel ?? m.html_und_module ?? m.seite_aufbau), s(m.blende_zu ?? m.grafik_start ?? m.hochladen),
      s(m.laden), s(m.aufbau), s(m.blende_auf ?? m.gleiten),
      s(m.netz?.spiel?.anfragen), m.netz?.spiel?.mb == null ? '–' : m.netz.spiel.mb.toFixed(1),
      s(c.hochladen), s(c.szene_code), s(c.kern_code), s((c.pixi_sonst || 0) + (c.zeichnen || 0)), s(c.gc), s(c.browser_intern),
      s(m.bilder?.laengstes_ms ?? m.bilder_gleiten?.laengstes_ms),
    ]);
  }
  const breiten = kopf.map((_, i) => Math.max(...zeilen.map((z) => String(z[i]).length)));
  return zeilen.map((z) => z.map((x, i) => (i === 0 ? String(x).padEnd(breiten[i]) : String(x).padStart(breiten[i]))).join('  ')).join('\n');
}

// ---------------------------------------------------------------------------
// Hauptablauf
// ---------------------------------------------------------------------------

// Phasen der Szenenwechsel einer gespeicherten Messung aus ihrer Zeitachse neu bilden (nach einer Änderung an
// rueckblick()), Mediane neu rechnen und die Datei überschreiben. CPU-Zeiten je Phase bleiben, wie sie waren.
function neuAuswerten(datei) {
  const pfad = path.resolve(WURZEL, datei);
  const d = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  let n = 0;
  for (const l of d.laeufe || []) {
    for (const e of l.ergebnisse || []) {
      if (!('weg_spiel' in e) || !Array.isArray(e.zeitachse)) continue;
      const r = rueckblick({ ev: e.zeitachse, von: 0, ziel: e.ziel });
      Object.assign(e, r.phasen);
      n++;
    }
  }
  const jeFall = {};
  for (const l of d.laeufe || []) for (const e of l.ergebnisse || []) (jeFall[e.fall] ??= []).push(e);
  d.median = Object.fromEntries(Object.entries(jeFall).map(([k, v]) => [k, { ...medianObjekt(v), wiederholungen: v.length }]));
  d.neu_ausgewertet = new Date().toISOString();
  fs.writeFileSync(pfad, JSON.stringify(d, null, 1));
  log(`${n} Wechsel neu ausgewertet → ${datei}`);
  console.log(tabelle(d.median));
}

async function main() {
  let opt;
  try {
    opt = argumenteLesen(process.argv.slice(2));
  } catch (e) {
    console.error(`FEHLER: ${e.message}\n\n${HILFE}`);
    process.exit(2);
  }
  if (opt.hilfe) {
    console.log(HILFE);
    process.exit(0);
  }
  if (opt.neuAuswerten) {
    neuAuswerten(opt.neuAuswerten);
    return;
  }
  const notbremse = setTimeout(() => { console.error('Zeitlimit überschritten'); process.exit(1); }, opt.zeitlimit * 1000);
  const server = await serverStarten(opt);
  log(`Server ${server.basis} (${server.protokollArt}), Netz ${opt.netz || '∞'} Mbit/s, ${opt.latenz} ms, CPU ×${opt.cpu}`);
  const bedingungen = { cpu: opt.cpu, netz_mbit: opt.netz, latenz_ms: opt.latenz, protokoll: server.protokollArt,
    bildschirm: '1280×800 CSS-Pixel × 2 = 2560×1600 Gerätepixel', hardwareConcurrency: 8, chrome: CHROME,
    variante: opt.variante };
  let ergebnis;
  try {
    if (opt.bausteine) {
      const wdh = [];
      for (let i = 0; i < opt.wdh; i++) {
        log(`Bausteine, Wiederholung ${i + 1}/${opt.wdh}`);
        wdh.push(await bausteine(opt, server));
      }
      ergebnis = { bedingungen, datum: new Date().toISOString(), median: medianObjekt(wdh.map((w) => w.bausteine)), laeufe: wdh };
      console.log(JSON.stringify(ergebnis.median, null, 1));
    } else {
      const laeufe = [];
      const zusammen = (fertig) => {
        const jeFall = {};
        for (const l of laeufe) for (const e of l.ergebnisse) (jeFall[e.fall] ??= []).push(e);
        const mediane = Object.fromEntries(Object.entries(jeFall).map(([k, v]) => [k, { ...medianObjekt(v), wiederholungen: v.length }]));
        return { bedingungen, datum: new Date().toISOString(), ...(fertig ? {} : { teilweise: `${laeufe.length}/${opt.wdh} Wiederholungen` }),
          median: mediane, verteilung: verteilung(laeufe),
          serviceWorker: medianObjekt(laeufe.map((l) => l.info.serviceWorker).filter(Boolean)),
          laeufe: laeufe.map((l) => ({ info: l.info, ergebnisse: l.ergebnisse })) };
      };
      const zielDatei = path.resolve(WURZEL, opt.out);
      await fsp.mkdir(path.dirname(zielDatei), { recursive: true });
      for (let i = 0; i < opt.wdh; i++) {
        log(`Wiederholung ${i + 1}/${opt.wdh}`);
        server.protokoll.length = 0;
        try {
          laeufe.push(await lauf(opt, i + 1, server));
        } catch (e) {
          // z. B. „browser is already running“: diese Wiederholung fehlt, die anderen bleiben
          log(`  Wiederholung ${i + 1} abgebrochen: ${e.message}`);
          laeufe.push({ info: { nr: i + 1, fehler: [`abgebrochen: ${e.message}`] }, ergebnisse: [] });
        }
        // Zwischenstand sichern (geht der Rest schief, bleibt das Fertige)
        if (i < opt.wdh - 1) await fsp.writeFile(zielDatei, JSON.stringify(zusammen(false), null, 1));
      }
      ergebnis = zusammen(true);
      console.log(`\nMediane über ${opt.wdh} Wiederholungen (ms; CPU-Spalten = Hauptthread-Zeit im Fenster):`);
      console.log(tabelle(ergebnis.median));
      console.log('\nVerteilung über alle Besuche (ms; Median der Mediane verdeckt Ausreißer):');
      console.log(verteilungTabelle(ergebnis.verteilung));
      if (ergebnis.serviceWorker) console.log('\nOffline-Speicher (Fall a, nebenbei):', JSON.stringify({ ...ergebnis.serviceWorker, verlauf: undefined }));
    }
  } finally {
    clearTimeout(notbremse);
    server.server.close();
  }
  const ziel = path.resolve(WURZEL, opt.out);
  await fsp.mkdir(path.dirname(ziel), { recursive: true });
  await fsp.writeFile(ziel, JSON.stringify(ergebnis, null, 1));
  log(`geschrieben: ${path.relative(WURZEL, ziel)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
