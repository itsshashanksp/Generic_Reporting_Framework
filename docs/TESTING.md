# Testing

The frontend uses Vitest, React Testing Library and jsdom. Tests are frontend-only and should mock network responses; shared setup rejects accidental unmocked fetch calls.

## Validation commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Use `npm test -- --watch` while developing. `npm run typecheck` checks the application (`tsconfig.app.json`) and Node/tooling (`tsconfig.node.json`) projects. The root `tsconfig.json` only lists project references, so a bare `tsc --noEmit` checks no files. The build also runs a TypeScript project build.

Tests are colocated in `__tests__` directories and cover definition validators/loaders, JSON and discovered SQL Resource request modes, normalized-config request translation, filter serialization, report and dashboard request flow, standard responses/errors, widgets, grid behavior, exports, saved state, caching, and navigation.

Configuration tests are especially important because Vite glob discovery loads checked-in production definitions. If configuration and tests disagree during a migration, report that mismatch rather than weakening validation.

Browser verification is still appropriate for responsive layout, native AG Grid drag/resize interactions, chart presentation, downloaded files and backend integration.

CI is defined in `.github/workflows/frontend-ci.yml` and uses the locked npm dependencies.

[Development](DEVELOPMENT.md) · [Supported behavior](SUPPORTED.md)
