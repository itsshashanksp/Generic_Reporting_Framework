# Development

Start with [Getting Started](GETTING-STARTED.md) for installation and environment setup. This guide covers the repository layout and the workflows used to extend the frontend.

## Project Structure

```text
src/
├── api/          Generic SQL API transport and request errors
├── components/   shared UI, grids, filters, toolbars, and dashboard widgets
├── config/       report/widget SQL, presentation JSON, dashboards, and menu
├── engine/       parsing, loading, validation, runtime state, caching, and export
├── pages/        route-level report, dashboard, and settings views
├── router/       application routes
├── styles/       global styling
├── test/         shared automated test setup
└── types/        TypeScript contracts
```

Current authored configuration is separated by feature:

```text
src/config/
├── dashboards/
├── reports/
├── widgets/
├── menu.json
└── README.md
```

Read `src/config/README.md` for the accepted JSON keys and ordering conventions.

## Common Commands

```bash
npm run dev          # Vite development server
npm test             # deterministic Vitest run
npm run lint         # ESLint
npx tsc --noEmit     # standalone TypeScript check
npm run build        # TypeScript project build and Vite production bundle
npm run preview      # preview an existing production build
```

Run all four validation commands before proposing a change: tests, lint, type-check, and build.

## Add or Change a Report

1. Create matching `src/config/reports/<id>.sql` and `<id>.json` files.
2. Keep query semantics in SQL and presentation in JSON.
3. Reference the SQL file with `queryDefinition`.
4. Add `menu.json` navigation only if the report should be directly reachable.
5. Add focused parser, configuration, or component coverage for new behavior.

## Add or Change a Widget

Create matching widget SQL/JSON when data should be reusable, then reference its ID from dashboard JSON. Stat presentation belongs to the dashboard and uses `valueField`; table columns remain JSON presentation. A report widget may instead reference an existing report.

## Add or Change a Dashboard

Define layout and widget references in `src/config/dashboards`. Do not create dashboard SQL or embed query request objects. Confirm every referenced report or widget exists and that field mappings match the selected SQL aliases.

## Change the SQL Parser

Parser work must remain representable by the public universal API contract. Update the authoring contract, validation, parser mapping, typed errors, converter tests, and documentation together. Reject unsupported syntax explicitly rather than producing an approximate request.

## Scope and Configuration Safety

Do not commit `.env` files, credentials, generated `dist` output, or coverage output. Frontend changes must not modify the backend repository. Preserve strict SQL/JSON ownership and avoid reintroducing legacy production `request` definitions.

[Documentation index](README.md) · [Testing](TESTING.md) · [Contributing](../CONTRIBUTING.md)
