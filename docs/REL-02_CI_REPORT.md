# REL-02 — CI: требования и приёмка

Проверка 2026-11-18. Область: CI принятого браузерного Chess Core, без deployment.

## Критерии приёмки

- `.github/workflows/frontend-ci.yml`: push/main, pull_request/main, workflow_dispatch;
  только `contents: read`, GitHub-hosted Ubuntu и Node.js 22.
- npm cache по `frontend/package-lock.json`, команды из `frontend`, установка `npm ci`.
- Обязательные typecheck, lint, unit, build, установка Chrome с системными
  библиотеками, E2E; ошибка любого шага делает job failed. Без continue-on-error.
- При сбое сохраняются Playwright HTML report и test-results (trace включён
  существующим config). Один существующий mobile mouse-drag skip допустим;
  дополнительные пропуски требуют review. `test.only` запрещён в CI.
- Нет push, deploy, production dependencies и изменений шахматной логики.
- Локальные проверки и GitHub run учитываются раздельно; GitHub run до запуска NOT_RUN.
- Security findings раскрыты, зависимости исправляются отдельным изменением после
  проверки совместимости; наличие CI не означает security approval релиза.

## Исходное состояние и inventory

`HEAD = main = origin/main = 7f49b19c5eb714db03db4629c50f9410a6833107`
по локальным refs. HEAD содержит только ТЗ и roadmap. Chess Core, manifest,
lockfile и остальные 18 файлов MVP есть в index (`A`), но **не в commit**.
Исходный staging сохранён; commit/push не выполнялись.
`git ls-remote origin refs/heads/main` завершился exit 128: системный SSH config
имеет неподходящие owner/permissions. Актуальность удалённой main не подтверждена.

AGENTS.md в проекте и родительских каталогах не найден; `.agents`/`.codex` в
проекте отсутствуют. Прочитаны четыре запрошенных SKILL.md. Локальных workflow,
Docker/CD, npmrc и других package manifests не найдено.

Полный inventory исходных файлов (без внутренностей Git, node_modules и генерации):

```text
.gitignore
README.md
docs/CHESS_CORE_ACCEPTANCE.md
docs/CHESS_CORE_REPORT.md
docs/ChessOpening_Lab_ROADMAP_updated.md
docs/ChessOpening_Lab_TECHNICAL_SPEC_v0.3.md
frontend/eslint.config.js
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/playwright.config.ts
frontend/public/knight.svg
frontend/src/App.tsx
frontend/src/chess/core.test.ts
frontend/src/chess/core.ts
frontend/src/main.tsx
frontend/src/style.css
frontend/tests/chess.spec.ts
frontend/tsconfig.json
frontend/vite.config.ts
```

Игнорируемые каталоги: `.playwright-mcp`, `frontend/node_modules`, `frontend/dist`,
`frontend/test-results`; проверка с HTML reporter также создаёт игнорируемый
`frontend/playwright-report`. Новые файлы REL-02: workflow и этот отчёт;
изменён README. Manifest, lockfile, src и tests не изменены.

## Решение CI

Существующие scripts: `typecheck = tsc --noEmit`, `lint = eslint .`,
`test = vitest run`, `build = tsc --noEmit && vite build`,
`test:e2e = playwright test`. Playwright сам поднимает Vite на 127.0.0.1:5173,
запускает desktop и mobile Chromium через **Google Chrome channel**.
Установка обычного Chromium не удовлетворяет этому config.

В workflow добавлены `--forbid-only`, один worker и line/html reporters.
Retries не добавлены; любой FAIL остаётся FAIL. Путь upload-artifact считается
от корня workspace, поэтому явно содержит `frontend/`. Если проверка падает до
E2E, отсутствие browser artifacts даёт warning, исходный FAIL сохраняется.

На 2026-11-18 проверены официальные latest releases:
[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
[upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2).
Их action.yml используют Node 24 для самого action; приложение отдельно получает
Node 22. Требование Node 24 actions — runner >=2.327.1
([setup-node](https://github.com/actions/setup-node#breaking-changes-in-v5));
используется управляемый GitHub-hosted runner, не self-hosted.
Выбран [Ubuntu 24.04](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
вместо плавающего ubuntu-latest, переходящего на 26.04. Фактическая версия runner
и выполнение actions подтверждаются только первым GitHub run.
Release tags закреплены до patch, но не являются immutable SHA pins.

## Security findings

Свежий `npm audit --json` завершился exit 1: EAI_AGAIN registry.npmjs.org.
Число **12 (6 high, 6 moderate) из задачи не воспроизведено**. Offline audit
вернул 0, однако без актуального registry response это не доказательство
отсутствия уязвимостей и не security PASS.

Вместо выдумывания списка использованы сохранённые npm advisory cache
2026-11-16/17, сопоставление с lockfile, `npm explain picomatch minimatch` и
актуальные страницы GitHub Advisory Database. Найдены две уникальные advisory,
подходящие установленным версиям. Счётчик npm включает зависимые пакеты
(metavulnerabilities), а не только уникальные GHSA.

| ID / severity | Пакет и цепочка | Применимость | Безопасный путь исправления |
|---|---|---|---|
| [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), high | `picomatch@4.0.7`; `vite@7.3.8` / `vitest@5.1.0` → `tinyglobby@0.2.17` → picomatch; Vite → `fdir@6.5.0` → optional peer picomatch; `@vitejs/plugin-react@5.2.0` → peer Vite. Также typescript-eslint → typescript-estree → tinyglobby | Dev-only по lockfile. ReDoS требует контролируемых атакующим glob patterns и строк. В UI Chess Core нет передачи ходов/FEN в glob API; browser runtime путь не найден. Build/test/lint обрабатывают код и конфигурацию PR, поэтому риск CI/dev остаётся | На дату проверки patched versions: **None**. Обновление major Vite само по себе не исправляет picomatch. Отдельно дождаться проверенного upstream fix/замены, обновить lockfile и повторить audit + все gates. До этого loopback dev server, изолированный CI, без секретов, ограничение job 20 минут — mitigation, не исправление |
| [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate | `typescript-eslint@8.72.2` → parser / eslint-plugin → utils / type-utils → `@typescript-eslint/typescript-estree@8.72.2` → nested `minimatch@10.2.6` | Dev-only. CPU/memory DoS при attacker-controlled patterns и `optimizationLevel >= 2`. Приложение не принимает glob patterns; такая настройка в проекте не найдена. Прямой exploit path текущего lint не подтверждён. Root `minimatch@3.1.5` ESLint не входит в диапазон этой advisory | Исправлено в **11.0.1**; текущий потребитель требует `^10.2.2`. Предпочтителен совместимый upstream update typescript-eslint с исправленной зависимостью. Scoped override на 11.0.1 допустим лишь отдельным проверяемым изменением после проверки API/engines и lint/typecheck/unit/build/E2E; слепой major override не применялся |

High metachain в cache: picomatch, fdir, tinyglobby, vite, vitest,
@vitejs/plugin-react. Moderate metachain затрагивает nested minimatch и семейство
typescript-eslint (parser, eslint-plugin, typescript-estree, utils, type-utils,
typescript-eslint). Точное распределение счётчика 6/6 требует свежего audit JSON;
cache содержит разные snapshots, агрегировать их в точный текущий счётчик нельзя.

Старые cache advisories Vitest/@vitest/mocker GHSA-82fw-gwwq-j7x9 и
GHSA-qxg6-89mg-rqv8 не подходят версии 5.1.0; tinypool отсутствует в lockfile.
Они не включены в текущие findings. ESLint 9.39.5 дополнительно выдаёт deprecation
warning; это отдельный вопрос поддержки, не третья уникальная advisory.

Production dependencies не добавлены. Установленные runtime зависимости:
chess.js, React/React DOM, react-chessboard и DnD transitive dependencies;
для названных двух advisory runtime-пакеты не затронуты. Общий production audit
не подтверждён. Релиз **не объявлен безопасным**. Dependency remediation отделён
от CI: manifest/lockfile сохранены, `npm audit fix --force` не запускался.

Security review workflow: contents/read; checkout не сохраняет credentials;
обычный pull_request, без pull_request_target, secrets, внешних команд из PR title,
push и deploy. В приложении нет auth/webhooks/БД, новых таких путей не добавлено.
Артефакты ограничены Playwright directories, скрытые файлы не включаются.

## Локальная валидация

Среда: Linux, Node 22.23.1, npm 10.9.8; существующий node_modules.

| Проверка / команда | Итог |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm test` | PASS, exit 0, 32 unit tests |
| `npm run build` | PASS, exit 0; Vite 7.3.8, dist собран |
| `npm ls --all --json` | PASS, exit 0, дерево зависимостей валидно |
| `npm ci --offline --no-audit --cache /home/babuuum/.npm --logs-dir /tmp/chess-rel02-npm-logs --prefix /tmp/chess-rel02-install` после копии manifest/lockfile | BLOCKED, exit 1: esbuild postinstall spawnSync EPERM. Основной node_modules сохранён. Это не успешный clean install |
| `CI=true npm run test:e2e` | BLOCKED, exit 1: Vite webServer не стартует; диагностический повтор `DEBUG=pw:webserver` подтвердил EPERM loopback 127.0.0.1:5173 |
| `npx --no-install playwright test --list --forbid-only --workers=1 --reporter=line,html` | PASS, exit 0: 18 тестов; ожидаемый browser outcome — 17 passed, 1 mobile mouse-drag skipped, ещё не подтверждён запуском |
| `npx --no-install playwright install --with-deps --dry-run chrome` | BLOCKED, exit 1: локальная ОС не поддерживается, apt-get отсутствует. Установка на Ubuntu runner NOT_RUN |
| YAML parse PyYAML BaseLoader + assertions triggers/permissions/cwd | PASS, exit 0; это не actionlint |
| actionlint | BLOCKED: бинарник отсутствует; полноценная Actions schema validation NOT_RUN |
| `git diff --check`, `git diff --cached --check` | PASS, exit 0 |
| Реальный GitHub Actions run / failure artifact upload | NOT_RUN |

Старые цифры 27 unit / 13 browser passed из CHESS_CORE_REPORT относятся к прошлому
срезу; текущая suite содержит дополнительные Bugfix 01 тесты. Tests не менялись.

## Review и оставшиеся неизвестные

Отдельный read-only проход по итоговому diff выполнен тем же исполнителем по
review-diff и security-check: проверены triggers, рабочие пути, npm scripts,
Chrome channel, propagation ошибок, reports/trace, permissions и отсутствие
изменений src/manifest/lockfile. Блокирующих дефектов самого workflow при чтении
не найдено. Это **self-review**, независимый reviewer: **NOT_RUN**.

Общий статус REL-02: **BLOCKED** до закрытия отсутствующих доказательств:
свежий audit JSON и точный 6/6 inventory; clean install, E2E и Actions validation
в подходящей среде; независимый review. Также неизвестны удалённый main,
настройки Actions/rulesets, разрешение Actions v7 политикой организации,
доступность загрузок npm/Chrome/apt на runner. Наличие MVP в commit не подтверждено.

## Как проверить на GitHub

1. Владелец отдельным разрешённым действием должен включить в проверяемый commit
   весь Chess Core с manifest/lockfile и файлы REL-02. Один workflow на текущем
   HEAD неработоспособен: frontend там отсутствует.
2. После публикации ветки открыть PR с base `main`: найти `Frontend CI` →
   `Frontend checks`; сверить SHA, Node 22, runner Ubuntu 24.04, все шаги и E2E
   summary 17 passed / 1 skipped. Никакой обязательный шаг не должен быть failed.
3. После появления workflow в default branch проверить Actions → Frontend CI →
   Run workflow (`workflow_dispatch`); push/main проверяется очередным изменением main.
4. В отдельной тестовой ветке временно нарушить assertion E2E и убедиться:
   job красный, `playwright-failure` доступен, HTML и trace читаются. Перед merge
   убрать пробное нарушение и получить зелёный run. Негативный тест NOT_RUN.
5. В Settings → Rulesets/branch protection сделать `Frontend checks` required,
   если требуется блокировать merge. Workflow делает job failed, но сам по себе
   не включает защиту main. Настройки репозитория здесь не изменялись.
6. В среде с registry выполнить `npm audit --json` и `npm audit --omit=dev --json`,
   сохранить полный inventory advisory/цепочек; применить согласованные исправления
   отдельным diff и повторить все gates. Нулевой offline audit не использовать.

## Handoff REL-03 Docker/Caddy

Вход: `frontend`, Node 22.12+, `npm ci`, `npm run build`; результат —
`frontend/dist`. У приложения нет обязательных env vars/API/БД/секретов.
Будущий контейнер должен раздавать только статические build artifacts;
dev server, node_modules и dev-инструменты не нужны в runtime image.
Dockerfile/Caddyfile/CD здесь не создавались. Домены, TLS, hosting, routing/fallback,
порты и rollback пока не определены — согласовать в REL-03.
Перед релизом закрыть security findings или оформить явное решение о риске,
подтвердить CI и независимый review; этот handoff не является разрешением deploy.
