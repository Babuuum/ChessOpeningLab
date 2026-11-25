# MVP 0.1.0 — Final Release Preparation

**BLOCKED**, 2026-11-20 (Europe/Moscow). Implementation and Ubuntu handoff prepared;
mandatory environment/runtime gates and independent review remain open. No commit,
push, tag, image build, Docker deployment, server/firewall/router changes performed.

## Preflight and scope

Branch `feat/mvp-0.1-home`; HEAD `8f02023d75224b29430375c9e531db140316ccd9`.
Index empty throughout. Initial inventory: 8 modified tracked files and 28 untracked
files (earlier commentary count 29 was incorrect). Existing work preserved; original
tracked diff saved at `/tmp/chess-final-evidence/baseline.diff`. No Git history changes.
AGENTS.md absent in repository and ancestors through `/`. No pre-commit config.

Read technical spec v0.3, updated roadmap, OPEN/SEC reports, HOME_RELEASE, core/data/UI
and tests, Docker/Caddy/Compose/build helper, dependency lock/configs and CI.
Skills: quality-gate, review-diff, security-check, docs-update; test-architect for
pre-edit scenario design; execution-control for separately restricted review handoff.
Review skills were used in read-only passes; implementation followed owner authorization.
The explicit 0.1.0 request narrows historical spec/roadmap. No backend, engine, DB,
accounts, statistics, public hosting or unverified popularity claims added.

Environment: Fedora development, Node 22.23.1, npm 10.9.8, Google Chrome binary present.
Docker client 29.9.2 / Compose 5.6.0; daemon denied. Ubuntu host parameters unverified.

## Catalog decision and actual dataset

Pinned local source: lichess-org/chess-openings, CC0-1.0,
commit `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`. No downloads performed.
All 3865 TSV rows validate; no rejects or duplicates. Existing deterministic policy:
10 shortest legal lines per family, ECO/name/UCI lexical tie-breaks; **not popularity**.

Initial 100-line selection had Nimzo-Indian, not Scandinavian. Pinned full TSV already
contains 45 Scandinavian rows: replaced only that selected family. Upstream plain
Queen's Gambit has 1 row; Queen's Gambit Declined has 211. Use the confirmed Declined
family and label it explicitly, preserving 10 variants and reporting the narrower scope.

| Catalog entry | Selected ECO codes | Variants |
|---|---|---:|
| English Opening | A10, A11, A13, A15 | 10 |
| Sicilian Defense | B20 | 10 |
| French Defense | C00 | 10 |
| Caro-Kann Defense | B10, B12 | 10 |
| Ruy Lopez | C60 | 10 |
| Italian Game | C50, C55 | 10 |
| Queen's Gambit (Declined) | D06, D07, D08, D30, D31 | 10 |
| Slav Defense | D10, D11 | 10 |
| King's Indian Defense | E60, E61, E62, E70 | 10 |
| Scandinavian Defense | B01 | 10 |

Exactly 10 top-level catalog cards, each with ECO/name/count and both actions;
variants remain inside expandable sections, searchable by ECO/name. Search can
reduce visible cards. 100 line IDs remain deterministic but last family IDs now
identify Scandinavian, not the earlier Nimzo selection. No persistent ID consumers exist.
Exploration/graph/history and line-specific training preserved. Unit tests replay
all edges and reach every target for both colors.

## Test design and implementation

Pre-edit sources: owner AC, existing core/opening model/tests, importer and infra.
No unknown product semantics block coding. All following scenarios are mandatory:

| Requirement / test | Oracle and level | Risk / isolation / evidence |
|---|---|---|
| Catalog / O01 + R01 | Exactly 10 entries × 10 variants, legal local source and reproducible output; unit/integrity + UI E2E | Medium regression risk; pinned TSV and fresh browser page, no external fixtures; cardinality, source checksums and replay assertions |
| Explore/train / O02–O05, R01 | Exact positions/aliases, history, wrong moves unchanged, both colors, mode switch, mobile width and no external requests; unit + E2E | High functional impact; synthetic PGN/FEN and 100 local targets; state assertions; browser state discarded per test |
| P2-A / RuntimeGuardTests | Neither tool → 0; node only OR npm only → 1; direct shell test | High release guard impact; disposable PATH directory, no real runtime/container mutation; exact process return codes |
| P2-B / BundleTests | Complete candidate + distinct previous ID/config/checksums/evidence; corrupted file/missing manifest rejected; env excluded | High recovery impact; temporary files and mocked Docker only; bytes/metadata assertions; temporary directory cleanup |
| Runtime/LAN | 8080 internal/health, explicit IP host binding and hardened Compose; schema assertions + actual image smoke | High deployment impact; schema tested with synthetic image ID, real image checks BLOCKED; no ports opened |

Planned execution follows actual scripts: npm gate below, Python infra unittest,
Docker/production smoke only after owner authorization. Mocked packaging proves file
selection/guards, not Docker load, architecture execution, image correctness or recovery.
Independent review must assess this limitation and final diff; handoff below.

Aggregate training test initially timed out at 5s under concurrent checks (44/45 passed).
Replaced one aggregate with 100 individually reported line cases; all original assertions
and both colors retained, default timeout unchanged. Final unit result 144/144.

## Actual verification

Logs in `/tmp/chess-final-evidence/` are temporary local evidence, not portable release
artifacts. Checks cover final code; docs changes do not invalidate frontend checks.

| Command/check | Actual result |
|---|---|
| `npm ci --fetch-retries=0 --fetch-timeout=15000` | BLOCKED, exit 1: esbuild postinstall spawnSync EPERM; ordinary clean install not proven here |
| `npm ci --ignore-scripts --offline --no-audit --logs-dir /tmp/chess-final-evidence/npm-logs` | PASS exit 0, 203 packages, for investigation/check tooling only; does not satisfy npm ci gate |
| `npm audit --omit=dev --fetch-retries=0 --fetch-timeout=15000` | BLOCKED exit 1, registry DNS EAI_AGAIN |
| `npm audit --json --fetch-retries=0 --fetch-timeout=15000` | BLOCKED exit 1, same DNS failure; no vulnerability inventory returned |
| `npm audit fix --dry-run --json --fetch-retries=0 --fetch-timeout=15000` | BLOCKED exit 1, DNS; no dependency remediation applied |
| `npm run typecheck` | PASS exit 0 |
| `npm run lint` | PASS exit 0 |
| `npm test` | PASS exit 0, 3 files, 144 tests |
| `npm run build` | PASS exit 0, Vite 7.3.8, 38 modules, static dist |
| `npm run test:e2e -- --forbid-only --workers=1 --reporter=line` | BLOCKED exit 1 before browser assertions; debug repeat proves localhost connect EPERM |
| `npm run test:e2e -- --list` | PASS exit 0, 24 tests discovered; not browser acceptance |
| `npm run import:openings -- --check` | PASS exit 0, 3865 valid rows, 100 selected, checksums/generated outputs exact |
| `python3 -B -m unittest discover -s infra -p 'test_*.py' -v` | PASS exit 0, 3 tests, including both forbidden runtime tools and cross-host fixture/tamper checks |
| `sh -n infra/check-runtime-tools.sh infra/build-image.sh` | PASS exit 0 |
| `docker compose ... config --format json` default + explicit `FRONTEND_BIND_IP=192.168.1.50` | PASS exit 0, schema/assertions; no listener/container created |
| Production lock entries vs HEAD, manifest/lock unchanged by this session | PASS; production dependencies unchanged |
| Scoped secret patterns / tracked env inventory | PASS, zero pattern matches, no tracked env; not a complete history/image audit |
| `git diff --check` + whitespace check of untracked text | PASS exit 0 |
| pre-commit | NOT APPLICABLE, not configured |
| Docker image build/Caddy validate/rootfs/CVE/browser smoke/restart/rollback | NOT_RUN: daemon denied, no selected clean release commit/base digests/backup image or deployment authorization |
| Independent enforced read-only review | BLOCKED before session initialization, CLI exit 1; no findings received |

Mobile layout, browser mode switching, actual production CSP and absence of runtime
network requests are covered by E2E/smoke definitions but **not verified by browser
execution in this session**. Static implementation has no external runtime fetch.

## Security findings and reconciliation

Owner-provided current Fedora evidence: `npm ci` PASS, production audit **0**, full audit
**7 moderate minimatch dev-only**. Preserve those counts as supplied evidence, not fresh
results from this restricted session. Fresh audits/dry-run here failed DNS; no claim
that the 7 findings were fixed. No force fix, override, new production dependency or
lockfile rewrite was performed. The starting dirty lock already contains
`typescript-eslint@8.73.0`, nested `minimatch@11.0.9`, root `minimatch@3.1.5` and
`picomatch@4.0.7`; historical SEC report referred to an older state. An unchanged old
package version alone does not establish a current advisory. Need fresh audit to
associate current advisories, paths and compatible fixes. Residual dev-only risk remains
OPEN; do not expose Vite/Vitest to LAN or process untrusted repos/configs with secrets.

No secret pattern matches or tracked env; only static dist/licensing copied to runtime.
P2-A now explicit exit on either Node/npm (build-time and runtime invocation).
Read-only self-review caught the new guard missing from Docker context whitelist;
`.dockerignore` now includes it. This was fixed before final handoff.
P2-B packaging includes previous verified archive/config and metadata; checksum manifest
covers transfer. Local env created on Ubuntu, not copied from Fedora; whitelist excludes
secrets. Checksum is integrity evidence, not authentication; use trusted transfer and
separately compare transfer-manifest digest. Real image/layer/CVE results unavailable.

LAN uses explicitly supplied private IPv4, default loopback; Caddy/health internal port
8080 consistent. LAN is unauthenticated HTTP; verify Docker firewall forwarding and no
WAN/router port forwarding before launch. This session changes no network settings.

## Handoff, missing evidence and risks

Exact Ubuntu commands, build, transfer verification, dual-image load, server-local env,
health/browser acceptance and offline cross-host rollback: [HOME_RELEASE.md](HOME_RELEASE.md).
Reviewer source/AC/access envelope: [FINAL_REVIEW_HANDOFF.md](FINAL_REVIEW_HANDOFF.md).
Read-only review launch failed with `Read-only file system (os error 30)` before
app-server initialization. No independently confirmed reviewer rights/session exist.
A workspace-write child is not an enforced read-only substitute (execution-control).

Owner must provide/confirm Ubuntu version/architecture, LAN interface IP/CIDR, port,
Docker rights/resources, real base digests, accepted commit, runtime image scan/test
results, two distinct verified image bundles for rollback rehearsal and separately
restricted review. No need to add backend services to resolve these gates.

First-release `--first-release` bundle intentionally has no previous image: rollback
remains unproven, emergency action is stop. Pack helper refuses dirty checkout and
image/checkout revision mismatch. Bundle packaging is prepared, no real bundle/image
was manufactured. Do not call this release deployed or fully accepted.

History resets on reload. Training target is one chosen line, with known graph
transpositions and no cycles; no Stockfish judgement or arbitrary alternative moves.
Short one-ply variants can finish automatically when training black; select a longer
variant. Selected lines are limited, not full family theory or popularity coverage.
HTTP access assumes trusted LAN. Live browser tabs may need reload after upgrade/rollback.

## Files changed by this final-preparation session

Existing workspace edits retained. Exact final-preparation changes relative to the
starting workspace (including edits to already-untracked files):

- `.dockerignore`, `Dockerfile`, `README.md`.
- `docs/HOME_RELEASE.md`, `docs/OPEN-01-02_REPORT.md`, `docs/SEC-01_DEPENDENCY_SECURITY.md`.
- `docs/FINAL_RELEASE_REPORT.md`, `docs/FINAL_REVIEW_HANDOFF.md` (new).
- `frontend/src/App.tsx`, `frontend/src/style.css`.
- `frontend/src/openings/OpeningCatalog.tsx`, `catalog.ts`, `import.ts`, `data.json`, `openings.test.ts`.
- `frontend/tests/openings.spec.ts`.
- `infra/compose.home.yaml`, `infra/env.home.example`.
- `infra/check-runtime-tools.sh`, `infra/release-bundle.py`, `infra/test_release.py` (new).

Source TSV/source.lock/license and import-report contents, chess core, production
dependencies, existing lock/manifest edits, CI, build helper and production smoke
script were preserved. `.dockerignore` explicitly includes the new runtime guard.

## Final Git inventory relative to HEAD

No staged entries. Full paths below include preserved pre-existing work as well as
this session's changes; ignored runtime artifacts are not release source files.

```text
 M README.md
 M frontend/package-lock.json
 M frontend/package.json
 M frontend/src/App.tsx
 M frontend/src/style.css
 M frontend/tests/chess.spec.ts
 M frontend/tsconfig.json
 M frontend/vite.config.ts
?? .dockerignore
?? Dockerfile
?? docs/FINAL_RELEASE_REPORT.md
?? docs/FINAL_REVIEW_HANDOFF.md
?? docs/HOME_RELEASE.md
?? docs/OPEN-01-02_REPORT.md
?? docs/SEC-01_DEPENDENCY_SECURITY.md
?? frontend/data/chess-openings/COPYING.txt
?? frontend/data/chess-openings/a.tsv
?? frontend/data/chess-openings/b.tsv
?? frontend/data/chess-openings/c.tsv
?? frontend/data/chess-openings/d.tsv
?? frontend/data/chess-openings/e.tsv
?? frontend/data/chess-openings/import-report.json
?? frontend/data/chess-openings/source.lock.json
?? frontend/scripts/import-openings.mjs
?? frontend/scripts/opening-integrity.mjs
?? frontend/scripts/opening-integrity.test.mjs
?? frontend/scripts/smoke-production.mjs
?? frontend/src/openings/OpeningCatalog.tsx
?? frontend/src/openings/catalog.ts
?? frontend/src/openings/data.json
?? frontend/src/openings/import.ts
?? frontend/src/openings/model.ts
?? frontend/src/openings/openings.test.ts
?? frontend/tests/openings.spec.ts
?? infra/Caddyfile
?? infra/build-image.sh
?? infra/check-runtime-tools.sh
?? infra/compose.home.yaml
?? infra/env.home.example
?? infra/release-bundle.py
?? infra/test_release.py
```
