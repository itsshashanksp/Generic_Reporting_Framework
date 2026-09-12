# Generic Reporting Framework

A configuration-driven React frontend for building reusable reports, widgets, and dashboards on top of the Generic SQL API.

## Overview

The framework keeps responsibilities explicit:

```text
JSON report/dashboard/widget configuration
        -> validation and defaults
        -> runtime filters, sorting and pagination
        -> JSON request to the Generic SQL API
        -> report grid or dashboard widget
```

Data can be described by a top-level universal JSON request or by a discovered SQL Resource ID. Reviewed frontend definitions may include the backend-validated execution metadata required for filtering, sorting, and pagination. SQL text, discovery, path resolution, and execution remain backend responsibilities; the frontend does not load SQL files.

## Features

- JSON request and backend SQL-resource query modes
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
| [Configuration reference](docs/CONFIGURATION.md) | Complete report, dashboard, widget and menu properties |
| [Query modes](docs/QUERY-MODES.md) | JSON requests, SQL resource IDs and runtime merging |
| [Feature behavior](docs/FEATURES.md) | Filtering, grid, export, saved views and cache details |
| [Examples](docs/EXAMPLES.md) | Valid configurations and authoring recipes |
| [Reports](docs/REPORTS.md) | Report definition and rendering architecture |
| [Widgets](docs/WIDGETS.md) | Reusable widget definitions and widget types |
| [Dashboards](docs/DASHBOARDS.md) | Dashboard configuration and runtime behavior |
| [Testing](docs/TESTING.md) | Test strategy, commands, and CI |
| [Supported behavior](docs/SUPPORTED.md) | Capability matrix and known gaps |
| [Backend capability matrix](docs/BACKEND-CAPABILITY-MATRIX.md) | Backend capabilities and frontend exposure |
| [API reference](docs/API-REFERENCE.md) | Exact read requests, runtime merge, responses and errors |
| [Roadmap](docs/ROADMAP.md) | Implemented, next, planned and deferred work |
| [Changelog](CHANGELOG.md) | Frontend change history |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

## License

This project is available under the [MIT License](LICENSE).
