# Testing

The frontend uses Vitest, React Testing Library and jsdom. Tests are frontend-only and should mock network responses; shared setup rejects accidental unmocked fetch calls.

## Validation commands

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Use `npm test -- --watch` while developing. The build already invokes a TypeScript project build, but the standalone check makes type failures easier to isolate.

Tests are colocated in `__tests__` directories and cover definition validators/loaders, filters, report and dashboard request flow, widgets, grid behavior, exports, saved state, caching and navigation. Legacy query-parser tests cover that isolated engine, not proof that it participates in active report execution.

Configuration tests are especially important because Vite glob discovery loads checked-in production definitions. If configuration and tests disagree during a migration, report that mismatch rather than weakening validation.

Browser verification is still appropriate for responsive layout, native AG Grid drag/resize interactions, chart presentation, downloaded files and backend integration.

CI is defined in `.github/workflows/frontend-ci.yml` and uses the locked npm dependencies.

[Development](DEVELOPMENT.md) · [Supported behavior](SUPPORTED.md)
