/**
 * Prövar webbygget under samma säkerhetshuvuden som servern skickar.
 *
 * Content-Security-Policy läses direkt ur public/.htaccess, så att provet och
 * servern aldrig kan glida isär. Bygget serveras lokalt med huvudet på, Chrome
 * öppnar appen, går igenom flikarna och trycker på en tangent så att
 * pianoproven hämtas och spelas. Allt som policyn stoppar skrivs ut, och
 * skriptet slutar med felkod om något stoppades eller sidan kastade.
 *
 * Kör:  node verktyg/prova-csp.mjs
 *
 * Kräver ett färdigt webbygge i dist/ (npm run bygg:webb) och en installerad
 * Chrome. En annan Chrome kan pekas ut med CHROME=... framför kommandot.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROT, 'dist');
const CHROME =
  process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT ?? 8743);

const htaccess = fs.readFileSync(path.join(ROT, 'public', '.htaccess'), 'utf8');
const CSP = htaccess.match(/Header always set Content-Security-Policy "([^"]+)"/)?.[1];
if (!CSP) {
  console.error('Hittar ingen Content-Security-Policy i public/.htaccess');
  process.exit(1);
}

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
};

const s = await new Promise((klar) => {
  const server = http.createServer((fråga, svar) => {
    let rel = decodeURIComponent(fråga.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const fil = path.resolve(DIST, '.' + rel);
    if (!fil.startsWith(DIST) || !fs.existsSync(fil) || fs.statSync(fil).isDirectory()) {
      svar.writeHead(404).end('finns inte');
      return;
    }
    svar.writeHead(200, {
      'content-type': TYPER[path.extname(fil)] ?? 'application/octet-stream',
      ...(process.env.UTAN_CSP ? {} : { 'content-security-policy': CSP }),
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(fil).pipe(svar);
  });
  server.listen(PORT, () => klar(server));
});

const webbläsare = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});

const fel = [];
const hämtadeProv = new Set();
const vila = (ms) => new Promise((r) => setTimeout(r, ms));

async function nySida() {
  const sida = await webbläsare.newPage();
  sida.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) {
      fel.push(`konsol: ${m.text()}`);
    }
  });
  sida.on('pageerror', (e) => fel.push(`kastat: ${e.message}`));
  sida.on('requestfailed', (r) => fel.push(`misslyckad hämtning: ${r.url()}`));
  sida.on('response', (r) => {
    if (r.url().endsWith('.ogg') && r.ok()) hämtadeProv.add(r.url());
  });
  // Policybrott rapporteras även som händelse i sidan; fånga dem där också.
  await sida.evaluateOnNewDocument(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP stoppade ${e.violatedDirective}: ${e.blockedURI}`);
    });
  });
  return sida;
}

try {
  console.log(`Policy: ${CSP}\n`);

  const sida = await nySida();
  await sida.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true });
  await sida.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
  // Webben börjar i körtonen, som räknas fram och inte hämtar något.
  // Flygeln väljs så att hämtningen av pianoproven också prövas. Utan
  // migrationer ställer parseSettings tillbaka klangen till förvalet.
  await sida.evaluate(() =>
    localStorage.setItem('korapp.settings.v1', JSON.stringify({ toneTimbre: 'salamander', migrationer: 99 })),
  );
  await sida.reload({ waitUntil: 'networkidle2' });
  await vila(2000);

  const ritad = await sida.evaluate(() => document.getElementById('root')?.innerText.length ?? 0);
  console.log(`Appen ritad: ${ritad > 0 ? 'ja' : 'NEJ'}`);
  if (ritad === 0) fel.push('appen ritades inte');

  for (const flik of await sida.$$eval('[role="tab"]', (f) => f.map((e) => e.getAttribute('aria-label')))) {
    await sida.click(`[role="tab"][aria-label="${flik}"]`);
    await vila(600);
    console.log(`  flik: ${flik}`);
  }

  // Tillbaka till spelvyn och en tangent, så att ljudet och proven prövas.
  const flikar = await sida.$$('[role="tab"]');
  await flikar[0]?.click();
  await vila(600);
  const tangent = await sida.$('[aria-label^="Tangent"], [aria-label^="Key"]');
  if (tangent) {
    await tangent.tap();
    await vila(2500);
    console.log(`  tangent tryckt, pianoprov hämtade: ${hämtadeProv.size}`);
    if (hämtadeProv.size === 0) fel.push('inga pianoprov hämtades');
  } else {
    fel.push('hittade ingen tangent att trycka på');
  }

  for (const extra of ['integritet.html', 'support.html']) {
    const p = await nySida();
    await p.goto(`http://localhost:${PORT}/${extra}`, { waitUntil: 'networkidle2' });
    console.log(`  ${extra} öppnad`);
    await p.close();
  }
} finally {
  await webbläsare.close();
  s.close();
}

console.log();
if (fel.length > 0) {
  console.log(`${fel.length} problem:`);
  for (const f of fel) console.log(`  ${f}`);
  process.exit(1);
}
console.log('Inget stoppades.');
