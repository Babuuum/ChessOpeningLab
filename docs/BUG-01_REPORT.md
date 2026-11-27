# BUG-01 — Opening Exploration and Restart

2026-11-27. **BLOCKED** on required npm ci / browser execution, implementation ready
for review. Branch `feat/mvp-0.1-home`, baseline HEAD
`7035a8620a0297f399123abb2529306183c02a9a`. Starting worktree/index clean.
No AGENTS.md found in repository or ancestors. Applied review-diff and quality-gate.
No commit/push/deploy, dependency or infrastructure/data/security changes.

## Reproduction and cause

Before edits, a focused Vitest reproduction passed: `loadOpening(C60 Ruy Lopez)`
returns history `e4 e5 Nf3 Nc6 Bb5`. App used it directly on catalog selection,
so the board opened at the terminal position. App also had no selected exploration
line state, so restart could not retain that choice.

The reported repeated e5 was **not reproduced in the model**: starting normally,
resolvePosition offers e5 after e4 and removes it after black e5; preview of the
white pawn e4 also excludes occupied e5. No e5 cause was inferred from the unrelated
conditional-preview mechanism. Browser reproduction is unavailable: Vite listen on
127.0.0.1:5173 fails EPERM. Exact original UI steps/display remain unknown.

Checked App.tsx, loadOpening, restart, resolvePosition and preview. loadOpening remains
an explicit terminal replay utility, no longer used by the exploration entry action.
Core rules, preview generation, graph indexing and training implementation unchanged.

## Final behavior and regression contract

- Catalog exploration opens standard initial position, empty history and selected-line
  panel. Ruy Lopez guidance: e4 → e5 → Nf3 → Nc6 → Bb5 → complete.
- Guidance is derived from the viewed position of that line, including history and
  transpositions, not side orientation or move cursor. Counters ignored; side,
  castling rights and legal en passant retained by existing positionKey.
- An off-line position has no selected-line recommendation. Returning to a selected
  position restores guidance. Legal exploration deviations remain allowed.
- Restart and side change reset the board/history while retaining selected line.
- “Свободная доска” and “Исследовать позицию” drop both line contexts and keep the
  viewed board/history. The home free-board entry starts a fresh standard board.
  Restart there returns to the standard position, without selected guidance.
- Conditional preview keeps the existing rules/colors, adds a dotted outline for
  non-captures and an explicit unavailable-now label. It never changes selected-line
  guidance or authorizes an out-of-turn move. Actual turn previews are labelled legal.
- Training auto-replies and history restrictions unchanged; entering training clears
  the exploration context. Existing both-color training tests retained.

Pre-edit test plan: unit Ruy sequence, legal/conditional separation, viewed-history
recommendations, branching without mutation, reset both orientations and synthetic
transposition; Playwright desktop/mobile selected context, e5 removal, marker cleanup,
restart/side/free-board transition and real D31 transposition. Existing training suite
is the regression boundary. Fresh in-memory games/browser pages, no external services.

## Changed files

- `frontend/src/App.tsx`: exploration context, initial entry, explicit mode transitions,
  line guidance panel and preview distinction.
- `frontend/src/openings/model.ts`: openingProgress, replay-utility comment.
- `frontend/src/openings/bug01.test.ts`: three unit regressions.
- `frontend/tests/openings.spec.ts`: update old terminal-load expectation; two new
  scenarios run in desktop/mobile projects.
- `frontend/scripts/smoke-production.mjs`: update UI assertion to selected initial line;
  HTTP/security assertions unchanged. Actual production smoke NOT_RUN.
- This report.

## Actual checks

| Command (frontend unless stated) | Result |
|---|---|
| `npm ci --fetch-retries=0 --fetch-timeout=15000` | BLOCKED, exit 1: esbuild postinstall spawnSync EPERM |
| `npm ci --ignore-scripts --offline --no-audit --logs-dir /tmp/chess-bug01/npm-logs` | PASS exit 0, tooling recovery only, not equivalent to npm ci |
| `npm run typecheck` | PASS exit 0 |
| `npm run lint` | PASS exit 0 |
| `npm test` | PASS exit 0, 147 tests in 4 files, including both-color training |
| `npm run build` | PASS exit 0, static Vite build |
| `DEBUG=pw:webserver npm run test:e2e` | BLOCKED exit 1 before assertions: localhost EPERM |
| `npm run test:e2e -- --list` | PASS discovery only, not a browser test pass |
| `git diff --check` (root) + untracked whitespace check | PASS exit 0 |

The failed ordinary install temporarily left missing npm tool links; the offline
ignore-scripts install restored them. Final checks above ran after that recovery.
Dependencies and lockfile unchanged. Pre-commit not configured.
Evidence logs: `/tmp/chess-bug01/`, temporary and not release artifacts.

Read-only self-review checked final diff, original AC, tests, transitions and untouched
training/core/data/infra boundaries. No additional correctness finding identified;
actual browser validation remains missing and prevents READY_FOR_REVIEW acceptance.
No separate reviewer session was requested/launched for this bugfix.

## How to verify and limitations

In an environment permitting npm lifecycle processes, localhost and Chrome:

```bash
cd frontend
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
cd ..
git diff --check
```

Open catalog → C60 Ruy Lopez → Исследовать. Confirm empty history/e4 recommendation;
play e4 and e5, confirm Nf3 rather than e5. Navigate back/forward, branch with c5,
restart, change orientation, then enter free board and restart. Repeat both training
colors. Playwright definitions include all these boundaries but have not executed
browser assertions here. Unit success does not establish actual layout/highlight UX.

Exploration remains permissive outside the selected line. Reload discards state as
before. For a line containing a repeated position, guidance uses its last occurrence;
the current 100 selected lines have no repeated position keys. No engine evaluation
or new recommendation outside the selected canonical path is introduced.
