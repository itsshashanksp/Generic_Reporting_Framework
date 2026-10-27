# Frontend development

See [Getting started](GETTING-STARTED.md) for installation.

## Project structure

```text
.
├── src/
│   ├── api/          the only fetch caller: credentials, CSRF, response validation, errors
│   ├── auth/         session context, login/logout and user-management services
│   ├── setup/        setup-status gate
│   ├── components/   grid, filters, toolbar, saved reports, dashboard widgets, layout
│   ├── config/       report/dashboard/menu JSON, version, frontend capabilities
│   ├── engine/       validation, normalization, runtime state, cache, export
│   ├── pages/        route-level views (reports, dashboards, login, settings, users)
│   ├── router/       application routes and guards
│   ├── styles/       global, component and page CSS
│   ├── test/         shared Vitest setup
│   └── types/        TypeScript contracts for configuration and API
├── tooling/          build-time checks (production API URL) and their tests
├── examples/         validated example definitions (not bundled)
├── docs/             documentation
└── .github/workflows/frontend-ci.yml
```

The loaders discover JSON with Vite glob imports at build time. There is no SQL authoring step in the frontend.

## Commands

| Command | What it runs |
| --- | --- |
| `npm run dev` | `vite`, the development server with hot reload |
| `npm test` | `vitest run`: every `*.test.ts(x)` in jsdom |
| `npm test -- --watch` | Vitest in watch mode |
| `npm run lint` | `eslint .` |
| `npm run typecheck` | `tsc -p tsconfig.app.json && tsc -p tsconfig.node.json` |
| `npm run build` | `tsc -b && vite build` into `dist/` |
| `npm run preview` | `vite preview` of `dist/` |

Prettier is installed as a dev dependency, but it has no script or configuration file; formatting is not enforced.

## Configuration workflows

**Add a report.** Create `src/config/reports/<name>.json` with a unique `id`. Choose one [query mode](QUERY-MODES.md), then declare `columns`, `filters` (use `[]` for none), and an optional top-level `sort`. To make it reachable from the sidebar, add a `reportId` entry to `src/config/menu.json`. Start from [`examples/reports/`](../examples/reports/).

**Add a dashboard.** Create `src/config/dashboards/<name>.json`. Choose the layout, and give each widget exactly one source. Inline `queryDefinition`/`request` is the usual choice; prefer `reportId` when you want to reuse a report. Then add a `dashboardId` menu entry. Start from [`examples/dashboards/`](../examples/dashboards/).

**Add a reusable widget.** Create `src/config/widgets/<name>.json` and reference it with `widgetId`.

After any configuration change, run `npm test`. The configuration tests always
validate the tracked public examples and also discover and validate local,
Git-ignored `src/config` definitions when they are present. Inline dashboard
widgets are resolved through the runtime loader as well as schema-validated.
Remember that the JSON is bundled: deployed sites change only after a rebuild.

**Change a schema.** Update the TypeScript contract (`src/types/`), the validator, the loader/defaults, the focused tests, the example files, and the documentation together. Accepted schema and wired-up UI behavior can differ; document both.

## Safety boundaries

- Never commit `.env` files (other than `.env.example` and `.env.production`), credentials, `dist/`, or `coverage/`.
- Refer to backend SQL Resources only by their discovered logical ID. Do not add authored execution mappings, SQL parsing or generation, file lookup, paths, placeholders, or raw SQL request fields.
- Route all network access through `src/api/client.ts`, so credentials, CSRF, and response validation stay in one place.
- To add a write action, both the client CSRF list and `frontendCapabilities.write` must change. That is roadmap item 37; it needs its design first.

[Configuration reference](CONFIGURATION.md) · [Testing](TESTING.md) · [Contributing](../CONTRIBUTING.md)
