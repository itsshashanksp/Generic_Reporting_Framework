# Generic Reporting Framework

A configuration-driven React frontend for building reusable reports, widgets, and dashboards on top of the Generic SQL API.

## Overview

The framework keeps responsibilities explicit:

```text
SQL authoring resources  -> query and data logic
JSON configuration       -> presentation and interaction choices
Runtime state            -> filters, sorting, and pagination selected by the user
Universal JSON request   -> request sent to the Generic SQL API
```

This boundary lets report authors change data selection independently from the user interface. The frontend loads SQL and JSON configuration, validates both, converts the result to the backend's universal request shape, and renders the response through reusable React components.

## Features

- SQL-authored reports and widget data definitions with validation and typed parser errors
- JSON-configured columns, filters, grids, toolbars, widgets, dashboards, and navigation
- Reusable report, stat, table, and chart dashboard widgets
- Runtime filtering, sorting, and server-side pagination
- AG Grid-based `GenericGrid` with column resizing, reordering, and configured grouping
- Request caching and in-flight request deduplication
- Current-view and all-row CSV/Excel exports where enabled by configuration
- Browser-local saved report views
- Automated Vitest and React Testing Library coverage
- GitHub Actions checks for tests, lint, type-checking, and production builds

The application is built with React, TypeScript, Vite, Material UI, AG Grid, and Recharts.

## Architecture

The frontend is organized into configuration, definition/query engines, API integration, shared state, and presentation components. See the [architecture guide](docs/ARCHITECTURE.md) and the [SQL/JSON responsibility rules](docs/SQL-JSON-SEPARATION.md).

## Getting Started

```bash
git clone git@github.com:itsshashanksp/Generic_Reporting_Framework.git
cd Generic_Reporting_Framework
npm ci
npm run dev
```

Set `VITE_API_URL` in a local `.env` file to the Generic SQL API endpoint used for live data. See [Getting Started](docs/GETTING-STARTED.md) for details.

Run the project checks with:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## Documentation

| Document | Description |
| --- | --- |
| [Documentation index](docs/README.md) | Navigation for all project documentation |
| [Architecture](docs/ARCHITECTURE.md) | Overall frontend architecture and request flow |
| [Getting Started](docs/GETTING-STARTED.md) | Installation, configuration, and first run |
| [Development](docs/DEVELOPMENT.md) | Project structure and developer workflows |
| [Query Engine](docs/QUERY-ENGINE.md) | SQL parsing and universal request generation |
| [SQL / JSON Separation](docs/SQL-JSON-SEPARATION.md) | Configuration responsibility rules |
| [Reports](docs/REPORTS.md) | Report definition and rendering architecture |
| [Widgets](docs/WIDGETS.md) | Reusable widget definitions and widget types |
| [Dashboards](docs/DASHBOARDS.md) | Dashboard configuration and runtime behavior |
| [Testing](docs/TESTING.md) | Test strategy, commands, and CI |
| [Roadmap](docs/ROADMAP.md) | Completed and planned work |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

## License

This project is available under the [MIT License](LICENSE).
