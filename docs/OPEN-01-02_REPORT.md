# OPEN-01/02 — Opening Data MVP

> Обновление 2026-11-20: Каталог теперь содержит 10 основных записей × 10 вариантов; Nimzo-Indian заменён Scandinavian из уже включённых TSV, Queen’s Gambit представлен Declined. Актуальное evidence и блокеры — [FINAL_RELEASE_REPORT.md](FINAL_RELEASE_REPORT.md).

## Scope и preflight

Запрос OPEN-01/02 сужает широкие ТЗ v0.3 §3/§7/AC-03 и roadmap R0.3 до
статической тестовой выборки и тренировки без backend. Прочитаны ТЗ, roadmap,
Chess Core, tests, npm/Playwright/TS/Vite configs, Git inventory и применимые
skills quality-gate, review-diff, docs-update; перед реализацией применён
test-architect для определения оракулов и обязательных сценариев.

Baseline: `8f02023d75224b29430375c9e531db140316ccd9`, ветка `chore/rel-02-ci`;
локальные main/origin/main `0d733d9`. Изначально untracked только
`docs/SEC-01_DEPENDENCY_SECURITY.md`; этот пользовательский отчёт сохранён.
AGENTS.md в проекте и родительских каталогах не найден. YouTrack MCP вернул пустые
результаты поиска проекта Chess и issues ChessOpening/OPEN-01/OPEN-02; внешних
записей не делалось. Авторитетный контракт этой задачи — запрос пользователя.

Не заданы обязательные семейства, ранжирование и политика ответов соперника.
Принято: 10 семейств × 10 коротких линий; порядок не означает популярность.
Соперник предпочитает исходную линию, иначе выбирает известное продолжение,
ведущее к той же цели, детерминированно. Локализация upstream названий не задана:
они сохранены на английском. Full database/statistics/engine/accounts не входят.

## Acceptance и тестовый контракт

Все сценарии были PLANNED до реализации. Изоляция: синтетические PGN/FEN для
unit, pinned локальные TSV для проверки происхождения, новая страница/context
Playwright для UI. Внешние сервисы для runtime и тестовых партий не нужны.
Побочные файлы — игнорируемые dist/node_modules/test-results/playwright-report;
скрипты проверки целостности исходники не меняют.

| ID / риск, обязательность | Оракул и сценарии | Уровень / evidence |
|---|---|---|
| O01 / high, mandatory | Реальные TSV, SHA и checksum; malformed/illegal PGN отклонён; exact duplicates удалены; стабильная выборка 100 из 10 семейств | unit integrity/import + `import:openings --check`, утверждения о содержимом/ошибках и byte equality |
| O02 / high, mandatory | Только terminal position даёт имя; префикс не получает имя будущего варианта; aliases и транспозиции; turn/castling/legal EP включены, счётчики исключены | unit, заранее заданные FEN/PGN и replay каждого ребра через chess.js |
| O03 / high, mandatory | Пользователь ходит своей стороной; автоответ только из графа; неверный/нелегальный ход сохраняет state; завершение по позиции; оба цвета, restart/history, транспозиции и циклы | unit fixtures + все 100 shipped targets за оба цвета |
| O04 / medium, mandatory | Поиск ECO/name; выбор линии; exact recognition и сброс к префиксу; открытие/reload не вызывает внешних запросов | Playwright desktop/mobile, DOM/FEN/history/network assertions |
| O05 / high, mandatory | Тренировка Ruy Lopez за белых/чёрных, ошибка без изменения FEN, завершение, повтор и история | Playwright desktop/mobile |
| C01–C11 / high, regression gate | Существующие core unit и browser сценарии сохраняются; placeholder assertion заменён проверкой работающего каталога | исходная suite; один прежний mobile mouse-drag SKIP сохранён |

## Источник, лицензия и результат импорта

Единственный источник: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings),
commit [`3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`](https://github.com/lichess-org/chess-openings/commit/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39),
**CC0-1.0**. Полный COPYING.txt сохранён рядом с TSV.
Данные получены через GitHub MCP на этапе импорта (shell DNS недоступен).
Каждый скачанный файл дополнительно совпал по Git blob SHA с tree этого commit.

`frontend/data/chess-openings/source.lock.json` содержит для a–e.tsv и COPYING.txt
размер, SHA256 и Git blob SHA. Скрипт проверяет все файлы до генерации. Изменение
источника требует явного нового commit/checksums и review, не подхватывается с master.

Точные checksums хранятся в одном [manifest](../frontend/data/chess-openings/source.lock.json), без ручного дублирования.
Валидация: **3 865 / 3 865 PGN легальны**, rejected 0, exact duplicates 0.
Включено **100 вариантов**, остальные 3 765 валидных строк исключены детерминированной
политикой выборки, а не ошибками. Результат: `src/openings/data.json`, **12 096 байт**;
полный raw source нужен для повторного импорта и не попадает в Vite dist.
Отчёт импорта — `data/chess-openings/import-report.json`.

Это 100 именованных линий и **94 уникальные пары ECO/name**: альтернативные порядки
ходов с одинаковым названием сохранены как отдельные линии. Каталог показывает SAN
каждой линии для различения; граф объединяет их общие позиции/рёбра и aliases.

Семейства: English, Sicilian, French, Caro-Kann, Ruy Lopez, Italian,
Queen's Gambit Declined, Slav, King's Indian, Nimzo-Indian. Выбираются 10 самых
коротких линий на семейство с tie-break ECO/name/UCI. Это учебная выборка,
не полный R0.3, не покрытие популярных партий и не статистика частот.

## Реализация

- `src/openings/import.ts`: strict chess.js PGN parsing, отчёт о row/reason,
  дедупликация одинаковых ECO/name/UCI, стабильный выбор и IDs в рамках snapshot.
- `scripts/import-openings.mjs`, `opening-integrity.mjs`: offline regeneration,
  `--check` без записи, явный `--download` с pinned URL и проверкой checksum.
- `src/openings/model.ts`: граф по первым четырём полям нормализованного FEN.
  chess.js выводит EP только при легальном взятии; есть тест pinned EP.
  Рёбра дедуплицированы по UCI в позиции; названия привязаны только к endpoints.
  Несколько названий одной позиции отображаются как aliases, не выбираются случайно.
- Каталог ищет по ECO и частям английского имени без учёта регистра. Исследование
  загружает линию целиком, сохраняет свободные легальные ходы, историю/ветвление,
  подсветку, restart и side switching. Продолжения из графа можно сыграть кнопкой.
- Тренировка начинает с initial position и автоматически делает первый ход белых,
  если выбраны чёрные. Цель — позиция выбранного варианта. Разрешены только рёбра
  из выборки, откуда достижима цель без возврата в уже посещённые позиции.
  Принимаются известные альтернативные порядки ходов, включая более длинные;
  graph reachability пересчитывается с учётом посещённых узлов для защиты от циклов.
  Неверный легальный и нелегальный ход дают разные сообщения и не меняют state.
  История тренировки доступна для просмотра; продолжение — только из её конца.
  Restart/side switch сохраняет выбранную линию и начинает её заново.
- Полная исходная история/подсветка/диалог превращения остаются в Chess Core;
  `src/chess/core.ts` не изменён. Ошибка выбранного хода теперь остаётся видимой.

Новых production/dev dependencies и изменений lockfile нет. Приложение импортирует
только компактный JSON. Нет fetch к Lichess/GitHub при открытии, вычисления статистики,
выдуманных winrate/frequency/popularity или Stockfish evaluation. Нет backend/CD.

## How to verify

```bash
cd frontend
npm ci
npm run import:openings -- --check
# Для повторной генерации из включённых TSV, без сети:
npm run import:openings
# Только для явного повторного скачивания того же snapshot:
npm run import:openings -- --download
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install --with-deps chrome
npm run test:e2e
npm run dev
```

Node 22.12+ (проверено на 22.23.1), npm 10+, env vars не требуются.
Приложение: http://127.0.0.1:5173. В исследовании: Каталог → поиск `C60 Ruy Lopez`
→ выбрать → проверить имя, пять полуходов истории, «В начало» и продолжения.
В тренировке: тот же вариант, за белых e4/Nf3/Bb5; за чёрных e5/Nc6. Ввести d4
в начале белой тренировки — легальный, но неверный ход; e2-e5 — нелегальный.
Оба сохраняют FEN. Проверить завершение, повтор, смену стороны, историю и touch.

## Quality gate и review

Реализация завершена; **приёмка BLOCKED** до успешного clean install и E2E
в подходящей среде. Все результаты ниже получены на текущем feature diff,
Node 22.23.1 / npm 10.9.8, без изменения зависимостей.

| Проверка | Результат |
|---|---|
| `npm run import:openings` | PASS, exit 0: 3865 valid, 0 rejected, 100 selected |
| `npm run import:openings -- --check` | PASS, exit 0: checksum и byte-for-byte актуальность обоих generated outputs |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm test` | PASS, exit 0: **45 tests** в трёх файлах (32 прежних core + 13 новых) |
| `npm run build` | PASS, exit 0: 38 modules; JS 363.35 kB / gzip 112.24 kB |
| `npx --no-install playwright test --list` | PASS, exit 0: **22 cases** в двух файлах, включая desktop/mobile для новых сценариев |
| `npm run test:e2e` | BLOCKED, exit 1: Playwright webServer/Vite не стартует в sandbox; диагностический DEBUG=pw:webserver подтвердил loopback EPERM; assertions не выполнялись |
| `npm ci --offline --cache /home/babuuum/.npm --logs-dir /tmp/chess-open0102-npm-logs --prefix /tmp/chess-open0102-ci-PqGKin` на копии manifest/lockfile | BLOCKED, exit 1: esbuild postinstall spawnSync EPERM; основной node_modules сохранён |
| `git diff --check`, whitespace новых файлов | PASS, exit 0 |
| Lockfile/core/CI/Playwright config equality with HEAD | PASS; версии dependencies/devDependencies и lockfile не изменены |
| Повторный download через CLI, браузерная сеть/реальные устройства, GitHub Actions | NOT_RUN; исходный download выполнен GitHub MCP, CLI download в этой среде ограничен DNS |

Ожидаемый browser outcome при успешном запуске: 21 passed / 1 прежний mobile
mouse-drag skipped. Это ожидание, **не результат** выполненного browser gate.
Unit-тесты доказывают логику, но не заменяют UI/browser assertions.
Логи последнего gate: `/tmp/chess-open0102-quality` (не коммитятся, недолговечны).

Отдельный read-only проход по review-diff выполнен после реализации: проверены
источники, точное распознавание/aliases/EP, достижимость training target, отказ при
цикле, feedback без мутации, история, restart/side switch, отсутствие runtime fetch,
границы зависимостей и новые тесты. Исправлены потеря feedback после неправильного
клика и возврат в устаревшую тренировку с главной. Это self-review, не независимый
review другого исполнителя. Остаточный риск — ещё не выполненные browser сценарии.

## Changed files

- `README.md`, этот `docs/OPEN-01-02_REPORT.md`: запуск, импорт, контракт и evidence.
- `frontend/data/chess-openings/{a,b,c,d,e}.tsv`, `COPYING.txt`, `source.lock.json`,
  `import-report.json`: pinned source, лицензия и provenance.
- `frontend/scripts/import-openings.mjs`, `opening-integrity.mjs`,
  `opening-integrity.test.mjs`: importer, checksum guard и regression test.
- `frontend/src/openings/{import.ts,model.ts,catalog.ts,OpeningCatalog.tsx,data.json,openings.test.ts}`:
  selection, граф, тренировка, каталог, generated data и unit tests.
- `frontend/src/App.tsx`, `frontend/src/style.css`: подключение режимов/UI.
- `frontend/package.json`: только import script; `frontend/tsconfig.json`:
  JSON imports; `frontend/vite.config.ts`: включение integrity test в unit gate.
- `frontend/tests/openings.spec.ts`, `frontend/tests/chess.spec.ts`: новые E2E
  и замена устаревшего placeholder assertion без ослабления core checks.

19 новых feature files и 7 изменённых tracked files. SEC-01 report не относится
к diff этой задачи. Git index не изменялся; generated runtime/build/test artifacts
остаются в игнорируемых каталогах.

## Ограничения и риски

- E2E требует доступного localhost и Chrome; запрет sandbox не считать PASS.
- Импорт проверен chess.js 1.4.0; обновление этой зависимости требует повторной
  проверки PGN, position keys и generated output. Нет обещания совместимости
  selection IDs между разными snapshots или изменёнными selection policies.
- Транспозиции распознаются по позиции независимо от порядка ходов. В тренировке
  принимаются только известные графу пути к выбранной цели, не любые возможные
  шахматные пути. Намеренные повторения позиций не поддерживаются.
- Очень короткая линия может завершиться автоматически при выборе чёрных, если
  она содержит только первый ход белых. Для практики выбрать более длинный вариант.
- Состояние не сохраняется после reload. Нет случайной вариативности соперника,
  подсказок теории, оценки силы/качества хода или обучения на партиях.
- Остаточные dependency findings SEC-01 не исправлялись этой задачей; текущий
  feature gate не является разрешением релиза. Commit/push/deploy отсутствуют.
