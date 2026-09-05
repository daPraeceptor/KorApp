/**
 * Tar App Store-skärmbilder av webbygget i precis de pixelmått Apple begär.
 *
 * Apple kräver numera bara två storlekar, och räknar själv om dem till mindre
 * skärmar: iPhone 6,9 tum (1290 × 2796) och iPad 13 tum (2048 × 2732). Den
 * andra behövs för att `supportsTablet` är sant i app.json.
 *
 * Bilderna tas av webbygget, inte av iOS-appen, eftersom det är samma kodbas
 * och samma gränssnitt. Chrome emulerar rätt yta och rätt pixeltäthet, så
 * bilderna får exakt måtten ovan utan efterskalning.
 *
 * Kör:  npm run bilder:butik
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
const UT = path.join(ROT, 'butiksbilder');
const CHROME =
  process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT ?? 8742);

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
};

/** Bygget serveras över http, eftersom file:// inte får hämta pianoproven. */
function server() {
  return new Promise((klar) => {
    const s = http.createServer((fråga, svar) => {
      let rel = decodeURIComponent(fråga.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const fil = path.resolve(DIST, '.' + rel);
      if (!fil.startsWith(DIST) || !fs.existsSync(fil) || fs.statSync(fil).isDirectory()) {
        svar.writeHead(404).end('finns inte');
        return;
      }
      svar.writeHead(200, {
        'content-type': TYPER[path.extname(fil)] ?? 'application/octet-stream',
      });
      fs.createReadStream(fil).pipe(svar);
    });
    s.listen(PORT, () => klar(s));
  });
}

// Ett bibliotek som en körledares, så att bilderna visar appen i bruk i
// stället för en tom lista. Det skrivs bara in i webbläsarens lagring under
// körningen och rör ingenting på riktigt.
const nu = Date.now();
const MAPPAR = [
  { id: 'f-var', name: 'Vårkonsert', createdAt: nu - 900000 },
  { id: 'f-jul', name: 'Julkonsert', createdAt: nu - 800000 },
];
const LÅTAR = [
  ['s1', 'Uti vår hage', 118, 3, 'quarter', 'just', 5, [65, 60, 56, 53], 'f-var', 1],
  ['s2', 'Aftonen', 62, 4, 'eighth', 'just', 5, [69, 65], 'f-var', 2],
  ['s3', 'Kung Liljekonvalje', 52, 4, 'quarter', 'tempered', 7, [55], 'f-var', 3],
  ['s4', 'Sommarpsalm', 114, 4, 'triplet', 'just', 7, [62, 74], 'f-var', 4],
  ['s5', 'Vintern rasat ut', 96, 2, 'quarter', 'just', 2, [62, 66, 57], 'f-var', 5],
  ['s6', 'Nu tändas tusen juleljus', 84, 3, 'quarter', 'just', 0, [64, 60, 55], 'f-jul', 1],
  ['s7', 'Det är en ros utsprungen', 60, 4, 'quarter', 'just', 5, [65, 60, 57], 'f-jul', 2],
].map(
  ([
    id,
    title,
    bpm,
    beatsPerBar,
    subdivision,
    tuningSystem,
    tonicPitchClass,
    tones,
    folderId,
    sortIndex,
  ]) => ({
    id,
    title,
    bpm,
    beatsPerBar,
    subdivision,
    tuningSystem,
    tonicPitchClass,
    tones,
    notes: '',
    updatedAt: nu,
    folderId,
    sortIndex,
  }),
);

const ENHETER = [
  { namn: 'iphone-6,9tum', bredd: 430, höjd: 932, skala: 3 },
  { namn: 'ipad-13tum', bredd: 1024, höjd: 1366, skala: 2 },
];

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('Hittar inget bygge i dist/. Kör först: npm run bygg:webb');
  process.exit(1);
}
if (!fs.existsSync(CHROME)) {
  console.error(`Hittar ingen Chrome på ${CHROME}. Peka ut en med CHROME=...`);
  process.exit(1);
}

const s = await server();
const webbläsare = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--mute-audio'],
});

fs.rmSync(UT, { recursive: true, force: true });
fs.mkdirSync(UT, { recursive: true });

for (const enhet of ENHETER) {
  const sida = await webbläsare.newPage();
  await sida.setViewport({
    width: enhet.bredd,
    height: enhet.höjd,
    deviceScaleFactor: enhet.skala,
    isMobile: true,
    hasTouch: true,
  });

  await sida.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2' });
  await sida.evaluate(
    (låtar, mappar) => {
      localStorage.setItem('korapp.songs.v1', JSON.stringify(låtar));
      localStorage.setItem('korapp.folders.v1', JSON.stringify(mappar));
      // Alla nio underdelningarna som notbilder, utan avhuggna etiketter.
      // parseSettings prövar fält för fält, så en delmängd är säker att skriva.
      localStorage.setItem(
        'korapp.settings.v1',
        JSON.stringify({ showAdvancedSubdivisions: true }),
      );
    },
    LÅTAR,
    MAPPAR,
  );
  await sida.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));

  console.log(enhet.namn);

  const vila = (ms = 1200) => new Promise((r) => setTimeout(r, ms));
  const flik = async (etikett) => {
    await sida.click(`[role="tab"][aria-label="${etikett}"]`);
    await vila();
  };
  /** Rullar den största rullbara ytan till en andel av sin höjd. */
  const rulla = (andel) =>
    sida.evaluate((a) => {
      const rullbar = [...document.querySelectorAll('div')]
        .filter((e) => e.scrollHeight > e.clientHeight + 40)
        .sort((x, y) => y.clientHeight - x.clientHeight)[0];
      if (rullbar) rullbar.scrollTop = (rullbar.scrollHeight - rullbar.clientHeight) * a;
    }, andel);
  const ta = async (namn) => {
    const fil = path.join(UT, `${enhet.namn}-${namn}.png`);
    await sida.screenshot({ path: fil });
    console.log(`  ${path.basename(fil)}`);
  };

  await ta('1-latlistan');

  await flik('Ny låt');
  await rulla(0);
  await vila();
  await ta('2-metronom');

  await rulla(1);
  await vila();
  await ta('3-klaviatur');

  await flik('Inställningar');
  await rulla(0);
  await vila();
  await ta('4-installningar');

  await sida.close();
}

await webbläsare.close();
s.close();
console.log(`\nBilderna ligger i ${path.relative(ROT, UT)}/`);
