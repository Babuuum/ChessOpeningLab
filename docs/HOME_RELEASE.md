# MVP 0.1.0 — Ubuntu Server / LAN handoff

Статус подготовки и фактические gates: [FINAL_RELEASE_REPORT.md](FINAL_RELEASE_REPORT.md).
Deployment NOT_RUN. Commit, push, tag, сборка/запуск Docker требуют отдельного
разрешения владельца. Эта сессия не меняет сервер, firewall, router или порты.
Текущий запрос ограничивает более широкое ТЗ v0.3: только static frontend,
локальные CC0 данные, исследование и тренировка; без API/Stockfish/БД/аккаунтов.

## Release checklist

- [ ] Владелец принимает diff и выбирает полный release commit; clean checkout.
- [ ] `npm ci`, production/full audit, typecheck, lint, unit, build, E2E, import
  integrity и `git diff --check` выполнены в разрешённой среде на финальных файлах.
- [ ] Независимый review с отдельно подтверждённым read-only доступом завершён.
- [ ] Ubuntu/архитектура (`uname -m`), диск, Docker/Compose, свободный порт,
  частный IPv4 сервера и доверенный LAN CIDR подтверждены владельцем.
- [ ] Официальные base tags проверены и закреплены реальными registry digests.
- [ ] Реальный образ: Caddy validate, health, rootfs/layers, CVE scan,
  browser smoke, restart/recovery проверены; результаты сохранены в VERIFIED.txt.
- [ ] Перенесён полный bundle; проверены checksum, image ID, revision и platform.
- [ ] Резервный проверенный образ перенесён вместе с конфигурацией и metadata;
  rollback отрепетирован. На первом релизе предыдущего образа нет: это открытый gate.
- [ ] Владелец отдельно разрешил deployment. `v0.1.0` не создавать без разрешения.

## How to verify frontend

В среде с разрешёнными npm registry, localhost и Chrome, из accepted checkout:

```bash
cd frontend
npm ci
npm audit --omit=dev
npm audit
npm run typecheck
npm run lint
npm test
npm run build
npm run import:openings -- --check
npm run test:e2e -- --forbid-only --workers=1 --reporter=line,html
cd ..
python3 -B -m unittest discover -s infra -p 'test_*.py' -v
git diff --check
```

Каждую команду выполнять и записывать отдельно: full audit с residual findings может
вернуть nonzero. Не считать последующую успешную команду успехом всего gate.
Chrome установить только если отсутствует и это разрешено на проверяющей машине.

## Конфигурация и env

Runtime Caddy HTTP **8080**; Docker healthcheck использует curl на
`127.0.0.1:8080/healthz`, независимо от опубликованного host port. 200 требует
index.html. Node/npm не копируются в runtime; build и отдельная проверка
`check-runtime-tools.sh` явно завершаются с exit 1 при наличии любого из них.
Отрицательные regression tests: `python3 -B -m unittest discover -s infra -p 'test_*.py' -v`.
Caddy admin/HTTPS отключены; CSP разрешает только same-origin runtime connections.
Inline styles нужны доске. Произвольные LAN-пользователи не аутентифицируются.

Compose: UID 10001, read-only, cap_drop ALL, no-new-privileges, ограниченные tmpfs,
без host mounts, pull_policy never, лимиты и rotation logs. `restart: unless-stopped`
реагирует на падение процесса, но не на unhealthy. Постоянных пользовательских данных нет.

Env создаётся **на сервере вне Git/bundle**: `FRONTEND_IMAGE` — immutable image ID;
`FRONTEND_BIND_IP` — частный IPv4 интерфейса сервера; `FRONTEND_PORT` — свободный
host port (default 8080). Default bind — loopback для безопасного preview;
для LAN его нужно явно заменить адресом интерфейса. Не использовать 0.0.0.0,
публичный IP, host network, UPnP или port forwarding. Docker-published ports могут
обходить UFW: до запуска владелец проверяет ограничения Docker forwarding/DOCKER-USER
для доверенного CIDR и отсутствие WAN forwarding. Команд изменения firewall здесь нет.
HTTP предполагает доверенную домашнюю сеть; TLS в этом ограниченном релизе нет.

## Сборка после разрешения

В clean checkout принятого commit, shell `set -eu`, остановиться при любой ошибке.
Сначала проверить актуальность официальных Node/Caddy tags в Dockerfile/helper;
если они недоступны, не подменять digest или tag вслепую. Архитектуру взять с сервера.

```bash
export RELEASE_COMMIT=$(git rev-parse HEAD)
export TARGET_PLATFORM=linux/amd64 # заменить на подтверждённую архитектуру
node_digest=$(docker buildx imagetools inspect node:22.23.5-bookworm-slim --format '{{printf "%s" .Manifest.Digest}}')
caddy_digest=$(docker buildx imagetools inspect caddy:2.11.9-alpine --format '{{printf "%s" .Manifest.Digest}}')
export NODE_IMAGE="node:22.23.5-bookworm-slim@$node_digest"
export CADDY_IMAGE="caddy:2.11.9-alpine@$caddy_digest"
sh infra/build-image.sh "$RELEASE_COMMIT"
export CANDIDATE_IMAGE=$(docker image inspect --format '{{.Id}}' "chessopening-lab:git-$RELEASE_COMMIT")
docker image inspect "$CANDIDATE_IMAGE"
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --tmpfs /config:uid=10001,gid=10001 --tmpfs /data:uid=10001,gid=10001 \
  --entrypoint caddy "$CANDIDATE_IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint sh "$CANDIDATE_IMAGE" -ec '
    sh /usr/local/bin/check-runtime-tools
    test "$(id -u)" = 10001
    test -z "$(find /usr/share/caddy -name node_modules -o -name .env -o -name package-lock.json -o -name "*.tsv")"
    test -f /usr/share/caddy/release.json'
```

Base refs записываются в image labels, revision — в label и release.json.
Просмотреть runtime layers и scan CVE отдельно; npm audit не проверяет Alpine/Caddy.
Для browser smoke использовать временный loopback preview на разрешённой машине,
Compose с env и **тем же image ID**. Затем:

```bash
EXPECTED_COMMIT="$RELEASE_COMMIT" SMOKE_BASE_URL=http://127.0.0.1:8080 \
  node frontend/scripts/smoke-production.mjs
```

Smoke требует dev dependencies и Chrome на проверяющей машине, не на runtime
сервере. Проверяет desktop/mobile, CSP/headers, release SHA, health, 404, историю,
каталог, тренировку обоих цветов, отсутствие внешних запросов/JS errors.
Отдельно проверить restart и recovery с ростом RestartCount при падении Caddy,
не маскируя результат ручным compose up. Сохранить логи/результаты и base refs
в проверенном acceptance-файле вне Git, например `/tmp/VERIFIED.txt`.

## Полный переносимый bundle — P2-B

После успешной проверки образа собрать bundle вне checkout. Указать предыдущий
**проверенный** bundle, а не имя tag из текущего checkout:

```bash
python3 infra/release-bundle.py pack --image "$CANDIDATE_IMAGE" \
  --evidence /tmp/VERIFIED.txt --previous /path/to/previous-verified-bundle \
  --output "/path/to/releases/$RELEASE_COMMIT"
```

Только для первого образа вместо `--previous` разрешён явный `--first-release`;
он не создаёт резервный образ и не доказывает rollback. До rehearsal со вторым
различным проверенным образом rollback gate остаётся открытым.

Bundle содержит image.tar, image-inspect.json, metadata.json (ID/SHA/platform/base
refs), VERIFIED.txt, Compose, Caddyfile, Dockerfile, env **example**, runtime guard,
SHA256SUMS и verifier. В `rollback/` — полный предыдущий набор без рекурсивного
накопления старых образов. TRANSFER.sha256 покрывает весь перенос, включая verifier.
Ни .env.home, ни секреты не копируются. Evidence перед упаковкой просмотреть на секреты.
Проверка checksum доказывает целостность, а не доверие к отправителю; переносить
весь каталог по доверенному каналу, digest TRANSFER.sha256 сверить отдельно.

## Ubuntu: проверка переноса и запуск после разрешения

На сервере достаточно Docker/Compose, Python 3.11+ и coreutils; Node/npm/Git/Chrome
для runtime не нужны. Перенести весь каталог, включая rollback, не один image.tar.
Команды ниже предполагают shell `set -eu` и реальный путь в `release_dir`:

```bash
cd "$release_dir"
sha256sum --check TRANSFER.sha256
python3 release-bundle.py verify .
(cd rollback && sha256sum --check SHA256SUMS) # отсутствует на первом релизе
python3 release-bundle.py verify rollback
# Загрузить оба образа до rollout, пока source host доступен:
docker image load --input image.tar
docker image load --input rollback/image.tar
image_id=$(python3 -c 'import json; print(json.load(open("metadata.json"))["imageId"])')
previous_id=$(python3 -c 'import json; print(json.load(open("rollback/metadata.json"))["imageId"])')
test "$(docker image inspect --format '{{.Id}}' "$image_id")" = "$image_id"
test "$(docker image inspect --format '{{.Id}}' "$previous_id")" = "$previous_id"
docker image inspect --format '{{.Os}}/{{.Architecture}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$image_id" "$previous_id"
```

Сверить platform/SHA с обоими metadata и сервером. Для первого релиза пропустить
только rollback-команды, зафиксировав отсутствие backup; аварийная процедура — stop.
Локальный env не переносить с Fedora, чтобы не наследовать её IP/port:

```bash
umask 077
test ! -e server.env
cp env.home.example server.env
# Вручную записать проверенные FRONTEND_IMAGE, FRONTEND_BIND_IP и FRONTEND_PORT.
docker compose --env-file server.env -f compose.home.yaml config --quiet
docker compose --env-file server.env -f compose.home.yaml up -d --no-build --wait --wait-timeout 60
docker compose --env-file server.env -f compose.home.yaml ps
```

Проверить `http://<частный-IP>:<порт>/healthz` с сервера и другого устройства LAN;
получить `ok`. На LAN-клиенте проверить /release.json (revision), UI/историю,
варианты, обе стороны тренировки, viewport 375px и Network без внешних requests.
Для автоматического production smoke с проверяющей машины использовать loopback
через заранее разрешённый SSH tunnel; SMOKE_BASE_URL принимает только loopback.
Не устанавливать browser/dev-инструменты в production image.

## Rollback без source host

Владельцу сохранить env вне bundle/Git; новый `rollback.env` создать локально из
`rollback/env.home.example`, указать предыдущий immutable ID и **те же** server LAN
IP/host port. Предыдущий Compose использует прежнюю схему env. Если это старый
bundle с loopback-only Compose, его LAN-доступ отдельно проверяется до rollout.

```bash
cd "$release_dir"
(cd rollback && sha256sum --check SHA256SUMS)
python3 release-bundle.py verify rollback
docker image load --input rollback/image.tar
docker compose --env-file rollback.env -f rollback/compose.home.yaml config --quiet
docker compose --env-file rollback.env -f rollback/compose.home.yaml up -d --no-build --force-recreate --wait --wait-timeout 60
```

После rollback проверить health, предыдущий release SHA и browser smoke через
разрешённый loopback/tunnel. Сохранять полный bundle и оба image до окончания
периода отката; не выполнять image/system prune. При отсутствии проверенного
backup остановить сервис: `docker compose --env-file server.env -f compose.home.yaml stop frontend`.
Нет migrations/volume data. Reload сбрасывает историю; открытым вкладкам после
upgrade/rollback требуется reload. Логи могут содержать IP/URL — просмотреть перед передачей.
