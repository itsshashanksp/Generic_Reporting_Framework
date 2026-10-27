# Testing

The frontend uses Vitest 4, React Testing Library, and jsdom (configured in `vite.config.ts`, with setup in `src/test/setup.ts`). Tests run without a backend and mock their network responses. The shared setup rejects any unmocked `fetch`.

## Validation commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Use `npm test -- --watch` while developing, or `npm test -- <path-or-name>` to run a subset. `npm run typecheck` checks both the application project (`tsconfig.app.json`) and the Node/tooling project (`tsconfig.node.json`). The root `tsconfig.json` only lists project references, so a bare `tsc --noEmit` checks no files. `tooling/typecheckConfig.test.ts` enforces this, and also checks that the README, CONTRIBUTING, and these guides document `npm run typecheck`.

Current Phase 3.5 baseline: 64 test files and 637 tests pass; lint, typecheck,
and build pass. The build continues to warn that the main chunk exceeds 500 kB.

## What is covered

Tests live in `__tests__` directories next to the code they cover, and in `tooling/`:

| Area | Examples |
| --- | --- |
| Configuration | The configuration tests validate tracked examples, local `src/config` JSON when present, runtime widget resolution, and SQL/JSON responsibility separation |
| Definitions and requests | Report/dashboard validators and loaders, both query modes, database selection, filter serialization, `filterFields`, `dateFilterBehavior` |
| API | Envelope validation, error details, CSRF actions and rotation (`src/api/__tests__`) |
| Auth and setup | Session parsing, login flow, route protection, expiry, cross-tab sync, user-switch remount, user management |
| UI | Grid, filters, widgets, report and dashboard pages, sidebar, settings |
| Export and cache | CSV formula neutralization, Excel, batched all-row fetch, limits, request cache |
| Tooling | Production API-URL rule, typecheck configuration, dependency usage |

Configuration tests matter most, because Vite glob discovery loads deployment
definitions. `exampleLibrary.test.ts` validates every tracked example with its
appropriate validator. It additionally loads local `src/config` reports,
dashboards, and reusable widgets when those ignored files exist, then resolves
inline dashboard definitions through the runtime loader. If configuration and
tests disagree during a migration, report the mismatch rather than weakening
validation.

## Browser checks

Automated tests do not cover these; check them in a browser: responsive layout, native AG Grid drag and resize, chart presentation, downloaded files, and integration with a real backend (sign-in, CSRF, data). The runtime database selector has a written procedure: [Live validation: database selector](validation/DATABASE-SELECTOR-LIVE-TEST.md).

## CI

`.github/workflows/frontend-ci.yml` runs on every push and pull request: Node 22, `npm ci`, then test, lint, typecheck, and build.

[Development](DEVELOPMENT.md) · [Supported behavior](SUPPORTED.md)
