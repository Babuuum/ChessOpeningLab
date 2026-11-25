# SEC-01 — Dependency Security

> Обновление 2026-11-20: Текущий исходный lockfile уже содержит typescript-eslint 8.73.0 и nested minimatch 11.0.9. Предоставленный владельцем результат Fedora: prod audit 0, full audit 7 moderate minimatch dev-only, npm ci PASS. Это не результат audit этой сессии; прежние high/blocked выводы ниже являются историческими. Актуальное evidence и блокеры — [FINAL_RELEASE_REPORT.md](FINAL_RELEASE_REPORT.md).

Дата: 2026-11-18. Итог: **BLOCKED** для завершения security hardening и первого
релиза. Подтверждены две известные advisory, но свежий audit, исправление moderate
advisory и полный Quality Gate недоступны. Остаточный риск не принят от имени владельца.

## Baseline и scope

- Ветка `chore/rel-02-ci`, HEAD и локальный origin этой ветки:
  `8f02023d75224b29430375c9e531db140316ccd9`.
- Локальные main/origin/main: `0d733d9` (Chess Core MVP). В отличие от прошлого
  REL-02 preflight, MVP, manifest и lockfile теперь находятся в commit.
- Исходный `git status --short` пуст. AGENTS.md в проекте и родительских каталогах
  не найден; `.agents` и `.codex` пусты. Применены security-check, review-diff,
  quality-gate. Среда: Node 22.23.1, npm 10.9.8, Linux.
- `git ls-remote origin refs/heads/main`: exit 128, owner/permissions системного
  `/etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`. Удалённая main не проверена.
- Изменён только этот security report. Зависимости, lockfile, шахматная логика,
  UI, CI/CD и инфраструктура не изменены. Commit/push/deploy не выполнялись.

## Audit и цепочки

Команды выполнялись из `frontend`, npm logs направлялись в `/tmp/chess-sec01-logs`.

| Команда | Результат |
|---|---|
| `npm audit --json` | BLOCKED, exit 1, EAI_AGAIN registry.npmjs.org; ответ содержит ошибку, не inventory vulnerabilities |
| `npm audit --omit=dev` | BLOCKED, exit 1, тот же registry/DNS failure |
| `npm audit fix --dry-run` | BLOCKED, exit 1, тот же registry/DNS failure; изменений не сделал |
| `npm ls picomatch minimatch` | PASS, exit 0; цепочки ниже |

Точный текущий счётчик vulnerabilities и отсутствие иных advisory **не установлены**.
Ранее упомянутые 12 / 6 high / 6 moderate не объявляются результатом нового audit.
Нулевой offline audit не используется как security evidence.

```text
eslint@9.39.5
  → minimatch@3.1.5
  → @eslint/config-array@0.21.2 → minimatch@3.1.5 (deduped)
  → @eslint/eslintrc@3.3.7 → minimatch@3.1.5 (deduped)
typescript-eslint@8.72.2
  → @typescript-eslint/typescript-estree@8.72.2 → minimatch@10.2.6
vite@7.3.8
  → picomatch@4.0.7
  → fdir@6.5.0 → picomatch@4.0.7 (optional peer, deduped)
  → tinyglobby@0.2.17 → picomatch@4.0.7 (deduped)
vitest@5.1.0 → picomatch@4.0.7 (deduped)
```

Дополнительные пути: typescript-estree использует tinyglobby; Vitest также
использует tinyglobby и peer Vite; @vitejs/plugin-react — peer Vite.
Все указанные уязвимые пакеты имеют `dev: true` в lockfile.

## Findings и решения

### High: picomatch 4.0.7

[GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf):
затронуты версии <=4.0.7, исправленная версия на дату проверки **не указана**.
Уязвимость — exponential regex backtracking при контролируемых атакующим
single-branch repeated extglobs и строках. Upstream package.json также остаётся
[4.0.7](https://github.com/micromatch/picomatch/blob/master/package.json).

Достижимость: tinyglobby `dist/index.mjs` вызывает picomatch при создании matchers;
Vite `dist/node/chunks/config.js` и Vitest `dist/chunks/cli-api.COfZo8lK.js`
используют picomatch непосредственно. Это исполняемый dev/build/test код,
а не только неиспользуемая запись lockfile. Текущие globs задаются проектом
(`src/**/*.test.ts`, стандартные include/exclude), UI не передаёт ходы/FEN в glob API.
Эксплуатация через обычный шахматный сценарий не найдена; репозиторий, конфигурация
и сторонние plugins являются границей доверия. Враждебный PR способен исполнять
произвольный код и помимо этой advisory.

**Решение:** finding остаётся OPEN. Не менять major Vite/Vitest ради счётчика;
не вводить неподтверждённый fork, monkeypatch или override на выдуманную версию.
Перепроверять upstream fix и npm audit перед релизом. Существующие ограничения
снижают риск dev/CI, но не исправляют пакет: Vite слушает loopback, workflow не
получает секреты проекта, job ограничен 20 минутами. Не запускать недоверенные
ветки/конфиги на машине с секретами; не отдавать Vite/Vitest в домашнюю сеть или
интернет. Эти меры описаны, конфигурация CI и инфраструктура здесь не менялись.

### Moderate: nested minimatch 10.2.6

[GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249):
публичный GitHub Database range на дату проверки — >=7.0.0 <11.0.1;
исправление — 11.0.1. Описан рост globParts в `firstPhasePreProcess` и квадратичная
работа `secondPhasePreProcess` при `optimizationLevel >= 2` и недоверенном glob.

Достижимость: nested minimatch `dist/commonjs/index.js` содержит указанный код.
В установленном typescript-estree единственный найденный runtime import minimatch
находится в `dist/useProgramFromProjectService.js`: `filePathMatchedBy` вызывает
`minimatch(filePath, pattern, { dot: true })`. Default optimizationLevel у minimatch
равен 1. Текущий eslint.config не включает projectService/allowDefaultProject.
Следовательно, путь к описанному optimizer из текущего lint **не подтверждён**;
это ограниченный вывод о текущей конфигурации, а не оправдание хранения уязвимости.

**Минимальный обоснованный update:** typescript-eslint 8.72.2 → **8.73.0**.
Официальный [release v8.73.0](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.73.0)
и его [typescript-estree manifest](https://github.com/typescript-eslint/typescript-eslint/blob/v8.73.0/packages/typescript-estree/package.json)
подтверждают переход на minimatch `^11.0.1`. Это поддержанный upstream minor update
прямой devDependency, предпочтительнее принудительного major override вложенного
minimatch. Обновление семейством должно сохранить согласованные версии parser,
plugin, utils и typescript-estree. Node 22 подходит engines minimatch 11.0.1.

**Изменение пока не применено.** В `/tmp/chess-sec01-candidate` на копиях manifest
и lockfile выполнен `npm install --package-lock-only --offline --ignore-scripts
--no-audit --save-dev 'typescript-eslint@^8.73.0'` с существующим npm cache.
Exit 1 ENOTCACHED; повтор с `--full-metadata` дал тот же результат. Cache metadata
содержит сведения о release, но npm не получил пригодный ответ для установки;
наличие metadata не доказывает наличие полного набора пакетов. Registry недоступен.
Lockfile вручную не переписывался, integrity/resolved не выдумывались.
Finding остаётся OPEN до установки, проверки итогового дерева и полного Gate.

### Применимость к root minimatch 3.1.5

Это та же GHSA, а не третья уникальная advisory. По текущему Database range 3.1.5
исключён. Независимо от диапазона проверен установленный `minimatch/minimatch.js`:
в нём отсутствуют `firstPhasePreProcess`, `secondPhasePreProcess`, `optimizationLevel`.
`make()` выполняет brace expansion, split и parse без описанного optimizer.
Такой механизм GHSA к проверенному 3.1.5 **не применим**.

Версии и содержимое обеих копий minimatch и picomatch проверены по npm tarballs
из cache: SHA512 каждого архива совпал с lockfile integrity, все файлы архивов
совпали с установленными файлами. Это подтверждает проверенные payloads, но не
является аудитом поставщика или подписей registry.

```text
minimatch@3.1.5 minimatch.js SHA256:
746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d
minimatch@10.2.6 dist/commonjs/index.js SHA256:
d224f71f20d7c206fcc5b7e9f747324c7698345a0b2c28d717dd9cf698306783
picomatch@4.0.7 lib/parse.js SHA256:
4e1e05447668aa1e94366c5516a2bcd8f5fff800cc92b1d0cd7d77703b8618c4
```

Малый bounded probe (8 секунд внешнего timeout, V8 heap 128 MiB) подтвердил, что
3.1.5 не читает optimizationLevel при конструировании короткого `**/../` pattern,
а 10.2.6 читает. Это corroboration исходников, не стресс-тест и не доказательство
общей безопасности. Другие потенциальные ReDoS старого minimatch не исключены;
fresh audit недоступен. Глобальный override 3→11 сломал бы legacy callable API
потребителей ESLint и здесь не применялся.

## Production runtime и install scripts

Production build дополнительно проверен через временный Vite plugin generateBundle
(скрипт и JSON inventory только в `/tmp`). В emitted JS chunk: **33 модуля**,
нет модулей picomatch/minimatch/Vite/Vitest/ESLint/typescript-eslint, нет внешних
static/dynamic JS imports. Build выдаёт статические HTML/CSS/JS и knight.svg;
для исполнения этого frontend в браузере Node/npm и dev-tools не требуются.
Это подтверждает текущий bundle, не будущие изменения и не общий security PASS.

В lockfile `hasInstallScript` есть у:

- `esbuild@0.28.2`, dev: `node install.js` проверяет платформенный бинарник,
  при его отсутствии способен запустить npm/download fallback с registry.npmjs.org.
  Это реальное выполнение кода во время npm ci; считать установку пассивной нельзя.
- `fsevents@2.3.3`, dev/optional/Darwin: платформенная native установка;
  Linux runner её не использует. Исполнение на macOS в этой проверке не тестировалось.

Root manifest не содержит preinstall/install/postinstall/prepare; скрипты запускают
локальные vite/tsc/eslint/vitest/playwright. `resolved` всех пакетов указывает
на HTTPS registry.npmjs.org; Git/file/нестандартных источников не найдено.
Новых install scripts и зависимостей не добавлено. `--ignore-scripts` использован
только для исследования кандидата, не как замена нормальному Quality Gate.
Полный аудит нативных бинарников и каждого transitive package не выполнялся.

Проверены 22 tracked файла: по ограниченному набору шаблонов приватных ключей,
GitHub/AWS tokens и credential assignments совпадений не найдено (значения не
выводились). Tracked .env, ключей, node_modules, dist, test-results, Playwright
reports нет. `.gitignore` исключает эти артефакты и .env. Это scoped scan,
не гарантия отсутствия всех секретов и не проверка полной истории Git.

## Quality Gate

Изменений зависимостей не было; ниже текущая baseline verification, а не gate
для ещё не установленного typescript-eslint 8.73.0.

| Команда | Результат |
|---|---|
| `npm ci --cache /home/babuuum/.npm --logs-dir /tmp/chess-sec01-logs --prefix /tmp/chess-sec01-clean` на копии manifest/lockfile | BLOCKED, exit 1: esbuild postinstall `spawnSync …/bin/esbuild EPERM`; исходный node_modules сохранён |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm test` | PASS, exit 0; 32 tests |
| `npm run build` | PASS, exit 0; Vite 7.3.8 |
| `npm run test:e2e` | BLOCKED, exit 1; webServer не стартует |
| `DEBUG=pw:webserver npm run test:e2e` | диагностический повтор: loopback EPERM, не ошибка assertion |
| Bundle inventory build | PASS, exit 0; 33 modules, dev-tool modules 0, external imports 0 |
| `git diff --check`, manifest/lockfile/CI/UI/core equality with HEAD | PASS, exit 0; whitespace нового отчёта проверен отдельно, так как он untracked |
| Независимый security review | NOT_RUN; отдельная сессия с подтверждённым read-only доступом не установлена |

Успех локальных checks относится к существующему node_modules; он не заменяет
успешный clean install. Старый mobile mouse-drag skip не менялся; E2E outcome
17 passed / 1 skipped ожидается по suite, но здесь не подтверждён запуском.

## YouTrack и открытые вопросы

MCP доступен как инструмент, но соединение нестабильно: find_projects по `Chess`
и полный список дали transport errors, поиск `ChessOpening` вернул пустой список.
Поиск issues `"SEC-01" or "ChessOpening"` также пуст. У пользователя запрошен
точный issue ID/ключ проекта. Записи не делались в посторонние проекты.
Публикация findings **BLOCKED** до получения подтверждённого назначения и
работоспособного соединения; содержимое этого отчёта готово для записи.

Неизвестны: полный свежий audit inventory, production audit, доступность новых
tarballs, результаты Gate после исправления, решение владельца по residual high,
актуальный remote main. Условия домашнего hosting и доверие к локальной сети
не заданы; предложение раздавать только dist не является сделанной настройкой.

## How to verify / следующий шаг

В среде с npm registry и разрешёнными localhost/browser/process operations:

```bash
cd frontend
npm audit --json
npm audit --omit=dev
npm ls picomatch minimatch
npm audit fix --dry-run
# После проверки registry metadata/доступности release:
npm install --save-dev 'typescript-eslint@^8.73.0'
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm ls picomatch minimatch
npm audit --json
npm audit --omit=dev
git diff -- package.json package-lock.json
git diff --check
```

Проверить: production dependencies неизменны; семейство typescript-eslint
согласовано; nested minimatch >=11.0.1; root minimatch 3.1.5 не заменён слепым
override; не добавлены неожиданные lifecycle scripts/источники. Затем независимый
security reviewer должен проверить findings, достижимость, реальные результаты
audit/Gate и решение по residual high. `npm audit fix --force` запрещён.
Наличие build PASS не является разрешением на домашний релиз.

## Review handoff

Self-review по security-check/review-diff выполнен отдельным проходом: сверены
источники GHSA, разделены advisory range и достижимость, исключено смешение
baseline PASS с gate предполагаемого update, подтверждено отсутствие изменений
существующих tracked файлов. Блокеры не устранены и не скрыты.

Независимый review не заменялся self-review. Для его подготовки прочитан
[execution-control](/home/babuuum/.codex/skills/execution-control/SKILL.md):
“Read-only reviewers must have mutation tools denied independently”. Native
reviewer наследует workspace-write и доступ к mutation tools; отдельный
подтверждённый read-only контекст не установлен. Review не запущен. Это ограничение
доказательств и доступа, не найденный дефект шахматного приложения.

Пакет для отдельного reviewer:

- Task SEC-01, source — запрос пользователя SEC-01, project ChessOpeningLab;
  repo/cwd `/home/babuuum/PycharmProjects/ChessOpeningLab`.
- Baseline `8f02023d75224b29430375c9e531db140316ccd9`, ветка chore/rel-02-ci;
  diff — только новый `docs/SEC-01_DEPENDENCY_SECURITY.md`.
- Операция — независимый security review, без правок, установок, запуска lifecycle
  scripts, Git mutations и remote writes. Нужен отдельный effective read-only
  доступ; модель/profile не предписаны. Requested sandbox read-only; effective
  sandbox новой сессии NOT_VERIFIED до её запуска.
- AC: оценить обе GHSA и minimatch 3.1.5, цепочки/достижимость, обоснованность
  update 8.73.0 и сохранения residual high, production bundle, scripts/secrets,
  честность Quality Gate. Не менять UI, core, CI/CD, инфраструктуру.
- Evidence: этот отчёт и ссылки, исходный package-lock/configs, установленные
  пакеты, `/tmp/chess-sec01-quality/*.log`, `/tmp/chess-sec01-bundle.json`
  (временные evidence-файлы могут отсутствовать в другой сессии; тогда повторить
  только разрешённые проверки либо указать NOT_VERIFIED).
- Output: приоритизированные findings с file/line evidence, отдельно blockers
  окружения и дефекты, verdict READY_FOR_REVIEW/BLOCKED. Не принимать residual
  risk за владельца. Вторая независимая личность/сессия пока NOT_RUN.
