import { test, expect, type Page } from '@playwright/test';
async function square(page:Page, name:string) { return page.locator(`[data-square="${name}"]`).first(); }
async function tapSquare(page:Page,name:string,touch:boolean){const cell=await square(page,name); if(touch) await cell.tap();else await cell.click();}
test.beforeEach(async({page})=>{await page.goto('/');await page.getByRole('button',{name:/Исследовать/}).click();});
test('C06-C10 selection, preview, move, history and side reset',async({page,isMobile})=>{
  const fen=page.getByTestId('fen'); const initial=await fen.textContent();
  await tapSquare(page,'e7',isMobile);
  await expect(page.getByTestId('preview-info')).toContainText('Красные');
  await expect(page.getByTestId('preview-info')).toContainText('Предварительный');
  await expect((await square(page,'e5')).locator(':scope > div')).toHaveCSS('background-image', /linear-gradient/);
  await expect(page.getByTestId('game-status')).toHaveText('Ход белых');
  await expect(fen).toHaveText(initial!);
  await tapSquare(page,'e5',isMobile); await expect(fen).toHaveText(initial!);
  await tapSquare(page,'e2',isMobile); await expect(page.getByTestId('preview-info')).toContainText('Синие');
  await expect((await square(page,'e4')).locator(':scope > div')).toHaveCSS('background-image', /radial-gradient/);
  await tapSquare(page,'e4',isMobile); await expect(page.getByTestId('game-status')).toHaveText('Ход чёрных');
  const moved=await fen.textContent(); await expect(page.getByTestId('preview-info')).toContainText('Выберите фигуру');
  await page.getByRole('button',{name:'Назад',exact:true}).click();await expect(fen).toHaveText(initial!);
  await page.getByRole('button',{name:'Вперёд',exact:true}).click();await expect(fen).toHaveText(moved!);
  await page.getByRole('combobox',{name:'Ваша сторона'}).selectOption('b');await expect(fen).toHaveText(initial!);
  await expect(page.getByRole('button',{name:'Назад',exact:true})).toBeDisabled();
  const a1=await (await square(page,'a1')).boundingBox(),h8=await (await square(page,'h8')).boundingBox();
  expect(a1!.x).toBeGreaterThan(h8!.x);expect(a1!.y).toBeLessThan(h8!.y);
  await tapSquare(page,'e2',isMobile);await expect(page.getByTestId('preview-info')).toContainText('Красные');
  await page.getByRole('button',{name:/Начать заново/}).click();await expect(page.getByTestId('preview-info')).toContainText('Выберите фигуру');
});
test('C11 responsive layout and honest training placeholder',async({page})=>{
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:/Тренировка/}).click();await expect(page.getByText('Это placeholder.',{exact:false})).toBeVisible();
});
test('C11 mouse drag plays e4',async({page,isMobile})=>{
  test.skip(isMobile,'Mouse hardware scenario: mobile uses touch in C06-C10');
  await (await square(page,'e2')).scrollIntoViewIfNeeded();
  const from=await (await square(page,'e2')).boundingBox(),to=await (await square(page,'e4')).boundingBox();
  await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();
  await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});await page.mouse.up();
  await expect(page.getByTestId('game-status')).toHaveText('Ход чёрных');
});
for (const piece of ['Ферзь','Ладья','Слон','Конь']) test(`C04 promotion UI chooses ${piece}`,async({page,isMobile})=>{
  for(const [from,to] of [['a2','a4'],['h7','h5'],['a4','a5'],['h5','h4'],['a5','a6'],['h4','h3'],['a6','b7'],['h3','g2'],['b7','a8']]){
    await tapSquare(page,from,isMobile);await tapSquare(page,to,isMobile);
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  const before=await page.getByTestId('fen').textContent();
  await page.getByRole('button',{name:piece,exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByTestId('board')).toBeFocused();
  const symbol:Record<string,string>={'Ферзь':'Q','Ладья':'R','Слон':'B','Конь':'N'};
  await expect(page.getByTestId('fen')).toContainText(`${symbol[piece]}nbqkbnr`);
  expect(await page.getByTestId('fen').textContent()).not.toBe(before);
});

test('Bugfix 01: promotion traps focus, Escape preserves position and restores focus', async ({ page, isMobile }) => {
  for (const [from, to] of [['a2', 'a4'], ['h7', 'h5'], ['a4', 'a5'], ['h5', 'h4'], ['a5', 'a6'], ['h4', 'h3'], ['a6', 'b7'], ['h3', 'g2']]) {
    await tapSquare(page, from, isMobile);
    await tapSquare(page, to, isMobile);
  }
  const fen = page.getByTestId('fen');
  const before = await fen.textContent();
  await tapSquare(page, 'b7', isMobile);
  await tapSquare(page, 'a8', isMobile);
  const dialog = page.getByRole('dialog');
  const buttons = dialog.getByRole('button');
  await expect(buttons).toHaveCount(5);
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  for (let index = 1; index <= 10; index++) {
    await page.keyboard.press('Tab');
    await expect(buttons.nth(index % 5)).toBeFocused();
  }
  // Even an explicit background focus attempt must not escape the modal.
  await page.locator('select[aria-label="Ваша сторона"]').evaluate(element => element.focus());
  await expect(buttons.first()).toBeFocused();
  await expect(fen).toHaveText(before!);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('board')).toBeFocused();
  await expect(fen).toHaveText(before!);
  await expect(page.getByTestId('game-status')).toHaveText('Ход белых');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(8);
  // Cancelling clears the old selection and markers.
  await expect(page.getByTestId('preview-info')).toContainText('Выберите фигуру');
  await expect((await square(page, 'a8')).locator(':scope > div')).toHaveCSS('background-image', 'none');
  // Reopen through a DOM click while an external control has focus (as can
  // happen with assistive activation), then verify the original focus target.
  await tapSquare(page, 'b7', isMobile);
  const side = page.getByRole('combobox', { name: 'Ваша сторона' });
  await side.focus();
  await (await square(page, 'a8')).evaluate(element => (element as HTMLElement).click());
  await expect(buttons.first()).toBeFocused();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(side).toBeFocused();
  await expect(fen).toHaveText(before!);
});

test('Bugfix 01: checking queen has no unsafe markers; captures and new selections still work', async ({ page, isMobile }) => {
  for (const [from, to] of [['e2', 'e4'], ['f7', 'f6'], ['d1', 'h5']]) {
    await tapSquare(page, from, isMobile);
    await tapSquare(page, to, isMobile);
  }
  const fen = page.getByTestId('fen');
  const before = await fen.textContent();
  await tapSquare(page, 'h5', isMobile);
  for (const target of ['e8', 'g6', 'h7']) {
    await expect((await square(page, target)).locator(':scope > div')).toHaveCSS('background-image', 'none');
  }
  await expect(fen).toHaveText(before!);
  await expect(page.getByTestId('game-status')).toHaveText('Ход чёрных · шах');
  await expect(page.getByRole('button', { name: /^Позиция после/ })).toHaveCount(3);
  await tapSquare(page, 'g7', isMobile);
  await tapSquare(page, 'g6', isMobile);
  await tapSquare(page, 'h5', isMobile);
  // Actual white capture g6: blue solid ring.
  const g6 = (await square(page, 'g6')).locator(':scope > div');
  await expect(g6).toHaveCSS('outline-style', 'solid');
  await expect(g6).toHaveCSS('outline-color', 'rgb(25, 113, 217)');
  await tapSquare(page, 'g6', isMobile);
  await tapSquare(page, 'h7', isMobile);
  // Actual black capture g6: red dashed ring.
  await expect(g6).toHaveCSS('outline-style', 'dashed');
  await expect(g6).toHaveCSS('outline-color', 'rgb(213, 45, 70)');
  await tapSquare(page, 'h7', isMobile);
  await expect(g6).toHaveCSS('background-image', 'none');
});
