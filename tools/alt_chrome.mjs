// Start-Test mit einem ÄLTEREN Chrome (wie auf dem Tablet), direkt über das Fernsteuer-Protokoll (ohne puppeteer,
// das alte Fassungen nicht mehr steuern kann). Der Test-Chrome auf dem Rechner ist neuer als der Tablet-Browser und
// verzeiht Dinge, an denen das Tablet scheitert (Beispiel: Import-Karte nach modulepreload).
//   npx @puppeteer/browsers install chrome@114 --path <ordner>
//   CHROME=<ordner>/chrome/win64-114…/chrome-win64/chrome.exe node tools/alt_chrome.mjs <projektordner> "index.html?szene=karte&test=1" 9
// Ausgabe: eine JSON-Zeile {stand: {laden, bereit, szene, sigoFehler, meldung}, fehler: […]}, Foto unter shots/alt_*.jpg
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
const [wurzel, seite, warte = '12'] = process.argv.slice(2);
const TYP = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(wurzel, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYP[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(d);
  });
}).listen(0);
const port = server.address().port;
const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'altchrome-'));
const dbg = 9300 + Math.floor(process.pid % 500);
const chrome = spawn(process.env.CHROME, ['--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profil}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,800', '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const pause = (s) => new Promise((r) => setTimeout(r, s * 1000));
let ziel = null;
for (let i = 0; i < 40 && !ziel; i++) {
  await pause(0.5);
  try { const l = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json(); ziel = l.find((t) => t.type === 'page'); } catch {}
}
if (!ziel) { console.log(JSON.stringify({ abbruch: 'Chrome nicht erreichbar' })); chrome.kill(); process.exit(1); }
const ws = new WebSocket(ziel.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nr = 0; const offen = new Map(); const fehler = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && offen.has(m.id)) { offen.get(m.id)(m.result ?? m.error); offen.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') fehler.push('ausnahme: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) fehler.push(m.params.entry.level + ': ' + m.params.entry.text.slice(0, 300) + ' ' + (m.params.entry.url || '').slice(-60));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) fehler.push('konsole ' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
};
const ruf = (method, params = {}) => new Promise((r) => { const id = ++nr; offen.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await ruf('Runtime.enable'); await ruf('Log.enable'); await ruf('Page.enable');
await ruf('Page.navigate', { url: `http://localhost:${port}/${seite}` });
await pause(Number(warte));
const aus = await ruf('Runtime.evaluate', { returnByValue: true, expression: `({version: navigator.userAgent, laden: !!document.getElementById('laden'), canvas: !!document.querySelector('canvas'), bereit: !!(window.__sigo && window.__sigo.ready), szene: (window.__sigo && window.__sigo.scene) ? window.__sigo.scene.id : null, sigoFehler: ((window.__sigo && window.__sigo.errors) || []).map(function(e){return e.text}).slice(0, 5), meldung: document.getElementById('ladefehler') ? document.getElementById('ladefehler').textContent : null})` });
const foto = await ruf('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
if (foto?.data) fs.writeFileSync(path.join(wurzel, 'shots', 'alt_' + seite.replace(/\W+/g, '_') + '.jpg'), Buffer.from(foto.data, 'base64'));
console.log(JSON.stringify({ roh: aus?.result?.value === undefined ? aus : undefined, stand: aus?.result?.value, fehler: [...new Set(fehler)].slice(0, 12) }));
ws.close(); chrome.kill(); server.close();
setTimeout(() => process.exit(0), 500);
