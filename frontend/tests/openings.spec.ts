import { test, expect, type Page } from '@playwright/test';

async function move(page: Page, from: string, to: string, mobile: boolean) {
  for (const square of [from, to]) {
    const cell = page.locator(`[data-square="${square}"]`).first();
    if (mobile) await cell.tap(); else await cell.click();
  }
}
test('O04 catalog search, opening recognition, branches, history, and offline reload', async ({ page, isMobile }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173')) external.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: /Исследовать/ }).click();
  // An initial shared prefix must not inherit a future named variant.
  await expect(page.getByTestId('opening-names')).toContainText('точное именованное совпадение не достигнуто');
  await move(page, 'e2', 'e4', isMobile); await move(page, 'c7', 'c5', isMobile);
  await expect(page.getByTestId('opening-names')).toContainText('B20 Sicilian Defense');
  await page.getByRole('button', { name: 'Каталог', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Поиск по названию или ECO' });
  await search.fill('C60 Ruy Lopez');
  await page.getByRole('button', { name: 'Исследовать C60 Ruy Lopez', exact: true }).click();
  await expect(page.getByTestId('selected-opening')).toContainText('C60 Ruy Lopez');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(0);
  for (const [from, to] of [['e2','e4'], ['e7','e5'], ['g1','f3'], ['b8','c6'], ['f1','b5']]) await move(page, from, to, isMobile);
  await expect(page.getByTestId('opening-names')).toContainText('C60 Ruy Lopez');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(5);
  await page.getByRole('button', { name: 'В начало', exact: true }).click();
  await expect(page.getByTestId('opening-names')).not.toContainText('Ruy Lopez');
  await page.reload();
  await page.getByRole('button', { name: /Исследовать/ }).click();
  expect(external).toEqual([]);
});

test('O05 training rejects wrong/illegal moves, completes, restarts and switches color', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Тренировать/ }).click();
  await page.getByRole('searchbox', { name: 'Поиск по названию или ECO' }).fill('C60 Ruy Lopez');
  await page.getByRole('button', { name: 'Тренировать C60 Ruy Lopez', exact: true }).click();
  const before = await page.getByTestId('fen').textContent();
  await move(page, 'e2', 'e5', isMobile);
  await expect(page.getByRole('alert')).toContainText('Нелегальный');
  await expect(page.getByTestId('fen')).toHaveText(before!);
  // Deselect the pawn left selected after the rejected drop/click.
  await page.locator('[data-square="e2"]').first().click();
  await move(page, 'd2', 'd4', isMobile);
  await expect(page.getByRole('alert')).toContainText('не ведёт');
  await expect(page.getByTestId('fen')).toHaveText(before!);
  await move(page, 'e2', 'e4', isMobile);
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(2);
  await move(page, 'g1', 'f3', isMobile);
  await move(page, 'f1', 'b5', isMobile);
  await expect(page.getByTestId('training-status')).toHaveText('Линия завершена!');
  await page.getByRole('button', { name: /Начать заново/ }).click();
  await expect(page.getByTestId('fen')).toHaveText(before!);
  await page.getByRole('combobox', { name: 'Ваша сторона' }).selectOption('b');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(1);
  await move(page, 'e7', 'e5', isMobile);
  await move(page, 'b8', 'c6', isMobile);
  await expect(page.getByTestId('training-status')).toHaveText('Линия завершена!');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByTestId('training-status')).toContainText('Просмотр истории');
  await page.getByRole('button', { name: 'В конец', exact: true }).click();
  await expect(page.getByTestId('training-status')).toHaveText('Линия завершена!');
});


test('R01 ten catalog entries, variants, mode switches and mobile width', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:5173') external.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Тренировать/ }).click();
  await expect(page.getByTestId('catalog-entry')).toHaveCount(10);
  await expect(page.getByTestId('catalog-entry').filter({ hasText: 'Вариантов: 10' })).toHaveCount(10);
  const entry = page.getByTestId('catalog-entry').filter({ has: page.getByRole('heading', { name: 'Scandinavian Defense', exact: true }) });
  await entry.getByRole('button', { name: 'Исследовать дебют Scandinavian Defense', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Исследование', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Каталог', exact: true }).click();
  await page.getByRole('button', { name: 'Тренировать дебют Scandinavian Defense', exact: true }).click();
  await expect(page.getByTestId('training-status')).toContainText('Ваш ход');
  await page.getByRole('button', { name: 'Исследовать позицию', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Исследование', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(external).toEqual([]);
});

test('BUG-01 Ruy Lopez starts at move one, follows history and retains selection on reset', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Исследовать/ }).click();
  await page.getByRole('button', { name: 'Каталог', exact: true }).click();
  await page.getByRole('searchbox').fill('C60 Ruy Lopez');
  await page.getByRole('button', { name: 'Исследовать C60 Ruy Lopez', exact: true }).click();
  const context = page.getByTestId('selected-opening');
  const next = page.getByTestId('opening-next');
  const fen = page.getByTestId('fen');
  const initial = await fen.textContent();
  await expect(context).toContainText('C60 Ruy Lopez');
  await expect(next).toHaveText('e4');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(0);
  await page.locator('[data-square="e7"]').first()[isMobile ? 'tap' : 'click']();
  await expect(page.getByTestId('preview-info')).toHaveAttribute('data-preview-kind', 'conditional');
  await expect(page.getByTestId('preview-info')).toContainText('сейчас недоступны');
  await expect(next).toHaveText('e4');
  await expect(fen).toHaveText(initial!);
  await move(page, 'e2', 'e4', isMobile);
  await expect(next).toHaveText('e5');
  await expect(page.getByTestId('preview-info')).toHaveAttribute('data-preview-kind', 'none');
  await move(page, 'e7', 'e5', isMobile);
  await expect(next).toHaveText('Nf3');
  await page.locator('[data-square="e4"]').first()[isMobile ? 'tap' : 'click']();
  await expect(page.getByTestId('preview-info')).toHaveAttribute('data-preview-kind', 'legal');
  await expect(page.locator('[data-square="e5"]').first().locator(':scope > div')).toHaveCSS('background-image', 'none');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(next).toHaveText('e5');
  await page.getByRole('button', { name: 'Вперёд', exact: true }).click();
  await expect(next).toHaveText('Nf3');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await move(page, 'c7', 'c5', isMobile);
  await expect(page.getByTestId('opening-progress')).toContainText('вне выбранной линии');
  await expect(next).toHaveCount(0);
  await expect(context).toContainText('C60 Ruy Lopez');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(2);
  await page.getByRole('button', { name: /Начать заново/ }).click();
  await expect(fen).toHaveText(initial!);
  await expect(next).toHaveText('e4');
  await expect(context).toContainText('C60 Ruy Lopez');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(0);
  await move(page, 'e2', 'e4', isMobile);
  await page.getByRole('combobox', { name: 'Ваша сторона' }).selectOption('b');
  await expect(fen).toHaveText(initial!);
  await expect(next).toHaveText('e4');
  await expect(context).toContainText('C60 Ruy Lopez');
  await expect(page.getByTestId('preview-info')).toHaveAttribute('data-preview-kind', 'none');
  const a1 = await page.locator('[data-square="a1"]').first().boundingBox();
  const h8 = await page.locator('[data-square="h8"]').first().boundingBox();
  expect(a1!.x).toBeGreaterThan(h8!.x);
  await page.getByRole('button', { name: 'Свободная доска', exact: true }).click();
  await expect(context).toHaveCount(0);
  await expect(next).toHaveCount(0);
  await move(page, 'e2', 'e4', isMobile);
  await page.getByRole('button', { name: /Начать заново/ }).click();
  await expect(fen).toHaveText(initial!);
});

test('BUG-01 transposed move order rejoins the selected position', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Исследовать/ }).click();
  await page.getByRole('button', { name: 'Каталог', exact: true }).click();
  await page.getByRole('searchbox').fill("D31 Queen's Knight");
  await page.getByRole('button', { name: "Исследовать D31 Queen's Gambit Declined: Queen's Knight Variation", exact: true }).click();
  // Canonical source: d4 d5 c4 e6 Nc3. Alternate order reaches the same position.
  for (const [from, to] of [['c2','c4'], ['e7','e6'], ['d2','d4'], ['d7','d5']]) await move(page, from, to, isMobile);
  await expect(page.getByTestId('opening-next')).toHaveText('Nc3');
  await move(page, 'b1', 'c3', isMobile);
  await expect(page.getByTestId('opening-progress')).toHaveText('Выбранная линия пройдена.');
  await expect(page.getByTestId('opening-next')).toHaveCount(0);
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.getByTestId('opening-next')).toHaveText('Nc3');
});
