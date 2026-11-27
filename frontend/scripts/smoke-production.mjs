import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080');
assert(base.protocol === 'http:' && base.hostname === '127.0.0.1' && !base.username && !base.password,
  'Smoke tests require an explicit IPv4 loopback HTTP address');
const revision = process.env.EXPECTED_COMMIT;
assert(/^[a-f0-9]{40}$/.test(revision || ''), 'Set EXPECTED_COMMIT to the accepted full SHA');
const artifacts = fileURLToPath(new URL('../test-results/home-smoke/', import.meta.url));
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, options] of [['desktop', {}], ['mobile', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }]]) {
    const context = await browser.newContext(options);
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== base.origin) external.push(request.url());
    });
    page.on('websocket', socket => external.push(socket.url()));
    try {
      const root = await context.request.get(`${base.origin}/`);
      assert.equal(root.status(), 200);
      const html = await root.text();
      assert.match(root.headers()['content-type'], /text\/html/);
      assert.equal(root.headers()['x-content-type-options'], 'nosniff');
      assert.equal(root.headers()['x-frame-options'], 'DENY');
      assert.equal(root.headers()['referrer-policy'], 'no-referrer');
      assert.match(root.headers()['content-security-policy'], /script-src 'self'/);
      assert.match(root.headers()['cache-control'], /no-store/);
      const health = await context.request.get(`${base.origin}/healthz`);
      assert.equal(health.status(), 200); assert.equal(await health.text(), 'ok');
      const release = await context.request.get(`${base.origin}/release.json`);
      assert.equal(release.status(), 200); assert.equal((await release.json()).revision, revision);
      const deep = await context.request.get(`${base.origin}/release-smoke/deep-link`);
      assert.equal(deep.status(), 200); assert.equal(await deep.text(), html);
      for (const path of ['/assets/missing-release-smoke.js', '/.env', '/src/App.tsx']) {
        assert.equal((await context.request.get(`${base.origin}${path}`)).status(), 404);
      }
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(match => match[1]);
      assert(assets.length > 0, 'Built HTML must reference assets');
      for (const asset of assets) {
        const response = await context.request.get(`${base.origin}${asset}`);
        assert.equal(response.status(), 200);
        assert.match(response.headers()['cache-control'], /immutable/);
      }
      await page.goto(`${base.origin}/release-smoke/deep-link`);
      await page.getByRole('button', { name: /Исследовать/ }).click();
      async function move(from, to) {
        for (const square of [from, to]) {
          const cell = page.locator(`[data-square="${square}"]`).first();
          if (options.isMobile) await cell.tap(); else await cell.click();
        }
      }
      await move('e2', 'e4');
      await expect(page.getByTestId('game-status')).toHaveText('Ход чёрных');
      await page.getByRole('button', { name: 'Каталог', exact: true }).click();
      await page.getByRole('searchbox').fill('C60 Ruy Lopez');
      await page.getByRole('button', { name: 'Исследовать C60 Ruy Lopez', exact: true }).click();
      await expect(page.getByTestId('selected-opening')).toContainText('C60 Ruy Lopez');
      await expect(page.getByTestId('opening-next')).toHaveText('e4');
      await page.getByRole('button', { name: 'Тренировка ↗', exact: true }).click();
      await page.getByRole('searchbox').fill('C60 Ruy Lopez');
      await page.getByRole('button', { name: 'Тренировать C60 Ruy Lopez', exact: true }).click();
      const initial = await page.getByTestId('fen').textContent();
      await move('d2', 'd4');
      await expect(page.getByRole('alert')).toContainText('не ведёт');
      await expect(page.getByTestId('fen')).toHaveText(initial);
      await move('e2', 'e4'); await move('g1', 'f3'); await move('f1', 'b5');
      await expect(page.getByTestId('training-status')).toHaveText('Линия завершена!');
      await page.getByRole('combobox', { name: 'Ваша сторона' }).selectOption('b');
      await move('e7', 'e5'); await move('b8', 'c6');
      await expect(page.getByTestId('training-status')).toHaveText('Линия завершена!');
      assert(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
      assert.deepEqual(errors, [], 'Browser errors/CSP violations');
      assert.deepEqual(external, [], 'Unexpected external runtime requests');
      process.stdout.write(`PASS production smoke: ${name}, ${revision}\n`);
    } catch (error) {
      await page.screenshot({ path: `${artifacts}/${name}-failure.png`, fullPage: true });
      throw error;
    } finally {
      await context.tracing.stop({ path: `${artifacts}/${name}-trace.zip` });
      await context.close();
    }
  }
} finally { await browser.close(); }
