/**
 * What comes out of the printer, measured.
 *
 * Every other check in this repo looks at the screen. The printed
 * documents are the things people actually keep — a certificate goes in a
 * folder and gets shown to an employer years later — and nothing was
 * measuring them.
 *
 * It found the certificate printing on PORTRAIT paper. The sheet is A4
 * landscape and says so, with its own `@page cert-sheet`, but a bare
 * `@page` in styles.css applied to every page in the document and beat
 * it. On screen the certificate looked perfect; on paper its sides were
 * cut off. No amount of looking at the app would have shown that.
 *
 * Runs against the harness, because every one of these needs a record in
 * the database to render:
 *
 *   npm run harness                 (serves :4180)
 *   node tools/print-audit.mjs
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4180}`;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** route, what it is, expected paper, expected page count (0 = any). */
const DOCS = [
  ['/c/AIHOW26-COM-001',       'certificate', 'A4 landscape', 1],
  ['/w/AIHOW26/t/r0',          'ticket',      'A4 portrait',  1],
  ['/w/AIHOW26/cards',         'id cards',    'A4 portrait',  0],
  ['/w/AIHOW26/attendance',    'attendance',  'A4 portrait',  0],
];

const PAPER = { 'A4 portrait': [210, 297], 'A4 landscape': [297, 210] };
const mm = (pt) => +(pt * 25.4 / 72).toFixed(1);
const near = (a, b) => Math.abs(a - b) <= 1.5;

const probe = await fetch(BASE).catch(() => null);
if (!probe || !probe.ok) {
  console.error(`NOTHING SERVING ${BASE} — run \`npm run harness\` first.`);
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), 'print-audit-'));
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let bad = 0;
for (const [route, name, want, wantPages] of DOCS) {
  await page.goto(`${BASE}/?at=${encodeURIComponent(route)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);

  const file = join(dir, `${name.replace(/\s+/g, '-')}.pdf`);
  await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true });

  const raw = readFileSync(file, 'latin1');
  const sizes = [...new Set([...raw.matchAll(
    /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g,
  )].map((m) => [mm(+m[3] - +m[1]), mm(+m[4] - +m[2])].join('x')))];
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;

  const [w, h] = PAPER[want];
  const ok = sizes.length === 1 && near(+sizes[0].split('x')[0], w) && near(+sizes[0].split('x')[1], h);
  const pagesOk = !wantPages || pages === wantPages;

  if (!ok || !pagesOk) bad++;
  console.log(
    `${ok && pagesOk ? '  ok  ' : ' FAIL '}${name.padEnd(12)}`
    + `${sizes.join(', ').padEnd(24)} ${String(pages).padStart(2)} page(s)`
    + `${ok && pagesOk ? '' : `   — wanted ${want}${wantPages ? `, ${wantPages} page(s)` : ''}`}`,
  );
}

await browser.close();
console.log(bad ? `\n${bad} document(s) print wrong` : '\nevery document prints on the paper it asks for');
process.exit(bad ? 1 : 0);
