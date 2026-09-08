/**
 * Capture README screenshots against a running demo instance.
 * Usage: BASE_URL=http://localhost:3000 node scripts/screenshots.mjs
 * Requires the app running in DEMO_MODE with the seed applied.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: 'dashboard', path: '/?preset=all_time' },
  { name: 'projects', path: '/projects?status=ALL' },
  { name: 'finance', path: '/finance' },
  { name: 'categories', path: '/settings/categories' },
  { name: 'history', path: '/history' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

// establish the demo session
await page.goto(`${BASE}/`);
await page.waitForLoadState('networkidle');

for (const s of shots) {
  await page.goto(`${BASE}${s.path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: false });
  console.log(`✓ ${s.name}.png`);
}

// one project card
const link = page.locator('a[href^="/projects/c"]').first();
if (await link.count()) {
  await link.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/project-card.png` });
  console.log('✓ project-card.png');
}

await browser.close();
