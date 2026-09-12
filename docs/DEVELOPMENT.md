# Frontend development

See [Getting started](GETTING-STARTED.md) for installation.

## Project structure

```text
src/
├── api/          API transport and response validation
├── components/   grids, filters, toolbars and dashboard widgets
├── config/       report/dashboard/widget/menu JSON
├── engine/       definition validation, runtime state, cache and export
├── pages/        route-level views
├── router/       application routes
├── test/         shared test setup
└── types/        TypeScript contracts
```

The active loaders discover JSON with Vite glob imports. There is no frontend SQL authoring step.

## Commands

```bash
npm run dev
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run preview
```

Run tests, lint, standalone typecheck, and build after a documentation-adjacent configuration or runtime change.

## Configuration workflows

To add a report, create `src/config/reports/<id>.json`, choose one [query mode](QUERY-MODES.md), declare columns and filters, and add a menu reference if it should be reachable.

To add a dashboard, create `src/config/dashboards/<id>.json`, select its layout and give each widget exactly one valid source. Inline widgets are supported. To reuse a non-report widget definition through `widgetId`, create JSON under `src/config/widgets`. To reuse a report, prefer `reportId`.

When changing a schema, update its TypeScript contracts, validator, loader/defaults, focused tests, example configuration, and this documentation together. Remember that accepted schema and wired UI behavior can differ; document both.

## Safety boundaries

Do not commit local `.env` files, credentials, `dist`, or coverage. Backend SQL resources are referenced only by ID from this frontend. Do not introduce frontend SQL parsing, generation, file lookup, paths, placeholders, or raw SQL request fields.

[Configuration reference](CONFIGURATION.md) · [Testing](TESTING.md) · [Contributing](../CONTRIBUTING.md)
