# Chess Core MVP — результат реализации

## Реализовано

- React + TypeScript + Vite, chess.js 1.4.0, react-chessboard 5.12.1; lockfile включён.
- Главная с двумя режимами; исследование работает, тренировка явно обозначена как placeholder.
- Легальные ходы обеих сторон по очереди, рокировки, en passant, выбор четырёх превращений.
- Статус очереди, шах/мат/пат; также ничьи по chess.js.
- SAN-история, начало/назад/вперёд/конец, выбор позиции; новый легальный ход из прошлого обрезает будущее.
- Рестарт, выбор стороны со сбросом партии и разворотом доски.
- Синие точки союзных фигур, красные кресты чужих; взятия — кольца с разной обводкой.
- Preview вне очереди на копии с очищенным en passant; без изменения FEN, очереди, истории.
- Клик, перетаскивание мышью, касания; адаптивный layout.
- Правила/state отдельно от React в `frontend/src/chess/core.ts`.

## Источники

Основной контракт: локальные ТЗ v0.3 и roadmap, ограниченные текущей задачей chess core.
YouTrack MCP доступен: поиск задач `ChessOpening` и проекта `Chess` не дал результатов;
совпавшие статьи относятся к Control Center, не использовались как задачи этого проекта.
Никаких записей в YouTrack не выполнялось. Acceptance до реализации:
`docs/CHESS_CORE_ACCEPTANCE.md` (C01–C11).

## Установка и запуск

Среда проверки: Node.js 22.23.1, npm 10.9.8, Linux, установленный Google Chrome.
Рекомендуемый Node.js: 22.12+.

```bash
cd frontend
npm ci
npm run dev
```

Открыть http://127.0.0.1:5173. Production-артефакт: `npm run build`, каталог `frontend/dist`.
Для браузерных тестов нужен Google Chrome (`channel: chrome` в конфигурации).
Если его нет: `npx playwright install chrome`. Playwright сам запускает локальный Vite
или использует уже запущенный сервер на порту 5173.

## Quality gate

Все команды из `frontend`, кроме `git diff --check` (можно из корня).

| Проверка | Команда | Итог |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS, exit 0 |
| Unit | `npm test` | PASS, exit 0, 27 тестов |
| ESLint | `npm run lint` | PASS, exit 0 |
| Production build | `npm run build` | PASS, exit 0 |
| Browser | `npm run test:e2e` | PASS, exit 0: 13 passed, 1 skipped (mobile mouse); 41.8 s |
| Whitespace | `git diff --check` | PASS, exit 0; новые файлы проверены TS/lint |
| Физические устройства, Firefox, Safari | не запускались | NOT_RUN |

Unit: легальность/очередь; обе рокировки обоих цветов; запрет рокировки без прав,
через шах и из шаха; en passant и истечение права; q/r/b/n обоих цветов; шах, мат,
пат, связка; история/ветвление; сброс/сторона; цвета preview; неизменность FEN,
очереди и SAN-истории; preview специальных ходов; исторические позиции;
повторение позиции после replay и отсутствие просроченного EP в preview.

E2E: desktop Google Chrome и мобильная эмуляция с touch и viewport 375×812;
клики/касания, маркеры (CSS форма), запрет чужого хода вне очереди, неизменный FEN,
навигация, сброс/разворот, очистка выбора, mouse-drag, четыре превращения через
реальную легальную линию, отсутствие горизонтального скролла и training placeholder.
Мобильный mouse-drag намеренно SKIP: мышь проверяется desktop-сценарием, touch —
мобильным сценарием. Физический touch-drag и Safari не подтверждены.

## Ошибки среды и исправления

- npm в sandbox: EAI_AGAIN. Повтор через штатное escalation: ENETUNREACH;
  установка с IPv4 завершилась успешно. Для воспроизводимости создан lockfile.
- Vite в sandbox: EPERM на 127.0.0.1:5173. Browser gate выполнен с разрешением.
- В первом browser run selector `status` совпадал с DnD live-region; добавлен
  однозначный label/test-id. Координатный drag требовал прокрутить исходную клетку
  в viewport; тест исправлен, без ослабления ожидаемого хода.
- Обнаруженный favicon 404 исправлен локальным SVG.
- npm audit сначала: 8 moderate, 2 critical. Vitest обновлён до 5.1.0;
  установка после обновления сообщает **7 moderate**, critical больше нет.
  Остаток относится к dev-инструментам; audit не является PASS. ESLint 9 помечен
  npm как неподдерживаемая ветка. Обновление lint-стека требует отдельной проверки.

## Изменённые файлы

Все перечисленные файлы новые. Ранее staged ТЗ и roadmap не изменялись.

- `.gitignore`
- `README.md`
- `docs/CHESS_CORE_ACCEPTANCE.md`
- `docs/CHESS_CORE_REPORT.md`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/index.html`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `frontend/eslint.config.js`
- `frontend/playwright.config.ts`
- `frontend/public/knight.svg`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/style.css`
- `frontend/src/chess/core.ts`
- `frontend/src/chess/core.test.ts`
- `frontend/tests/chess.spec.ts`

Игнорируются node_modules, dist, test-results, playwright-report и .playwright-mcp.
Git metadata, commit, push и deployment не выполнялись.

## Ручная проверка

1. Главная → «Исследовать». e7: красные кресты; e7-e5 запрещён, FEN не меняется.
2. e2 → синие точки; e4, e5, Nf3. Назад/вперёд, выбрать позицию в истории.
   Из прошлого сделать другой легальный ход: старое будущее исчезает.
3. Сменить сторону на чёрных: чёрные снизу, стартовая позиция, пустая история;
   чёрные фигуры дают синие маркеры. «Начать заново» сохраняет выбранную сторону.
4. После рестарта: e4 e5 Nf3 Nc6 Bc4 Nf6, затем e1-g1 (рокировка).
5. После рестарта: e4 a6 e5 d5, затем e5-d6 (en passant).
6. После рестарта: a4 h5 a5 h4 a6 h3 axb7 hxg2 bxa8; выбрать фигуру.
   Повторить для q/r/b/n. До выбора FEN не меняется; доступна отмена/Escape.
7. После рестарта: f3 e5 g4 Qh4 — мат.
8. Повторить на узком экране касаниями. «Тренировка» открывает placeholder.

## Риски и границы

- Это первый chess core, а не весь R0.2/технический MVP из широкого ТЗ:
  тренировочное дерево, каталог, оценки и backend отложены текущим заданием.
- Preview условной очереди — возможные перемещения на копии, не карта атак
  и не гарантия следующего хода. Даже синяя фигура может быть вне очереди;
  право выполнить ход определяется фактической очередью.
- chess.js определяет ничьи; отдельный процесс заявления ничьей не реализован.
- Партия хранится в памяти и теряется после перезагрузки. История линейная;
  альтернативные ветки не сохраняются. Replay O(n) приемлем для дебютного MVP.
- Браузерный gate покрывает Chromium; физические устройства и другие браузеры NOT_RUN.
- Прямой ввод произвольного FEN и сохранение PGN не входят в текущую область.
