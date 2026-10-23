# Generic Reporting Framework — Frontend

A configuration-driven React single-page application for reports and dashboards on top of the Generic SQL API. You define a report or dashboard in JSON. The frontend validates it, adds the user's filters, sorting, and paging, sends a JSON request to the API, and renders the rows in a grid, stat, table, or chart.

The frontend never reads, generates, or executes SQL. SQL text, resource discovery, authorization, and execution belong to the backend. The frontend sends either a constrained JSON Query (`select`) or the ID of a backend-owned SQL Resource (`sql`).

## Capabilities

- Reports and dashboards defined entirely in JSON under `src/config/`, validated on load (unknown properties are rejected).
- Two query modes: **JSON Query** (`request`) and backend **SQL Resource** (`queryDefinition`), each with optional logical database selection. Reports and dashboards can also offer a runtime **Database** dropdown.
- Configured filters (text, number, select/multiselect with static or dynamic options, boolean, date, date range, null checks), applied with **Search**.
- Server-side sorting and pagination; AG Grid Community grid with resizing and reordering; mobile card layout.
- Dashboard widgets: `report`, `stat`, `table`, `chart` (bar/line/pie). Dashboards add shared filters, date-filter behavior, per-widget field mapping, and manual or interval refresh.
- CSV and Excel export of the current view or all rows (capped at 100,000 rows; CSV formulas neutralized).
- Browser-local saved report views, kept per signed-in user.
- Sign-in against the backend session, protected routes, and admin-only Frontend User Management.
- In-memory response cache (5-minute TTL) with in-flight request deduplication.

## Architecture at a glance

```text
src/config/*.json ──► validators + loaders ──► normalized report / dashboard
                                                    │
               user filters, sort, page ───────────►│
                                                    ▼
                         JSON request (select | sql) ──► POST VITE_API_URL
                                                    │      (session cookie, CSRF for auth actions)
                                                    ▼
                    response validation + request cache ──► grid / widget
```

At startup the app checks `setup.status`, restores the session with `auth.session`, and only then renders the protected routes. See [Architecture](docs/ARCHITECTURE.md) and [Authentication](docs/AUTHENTICATION.md).

## Technology

React 19, TypeScript 6, Vite 8, React Router 7, AG Grid Community 32, Recharts 3, `write-excel-file`, and `lucide-react`. Tests use Vitest 4, React Testing Library, and jsdom. Exact versions are pinned in `package-lock.json`.

## Quick start

Prerequisites: Node.js 22 (the CI version) and npm. Live data needs a running Generic SQL API backend whose user setup is complete.

```bash
npm ci
cp .env.example .env        # sets VITE_API_URL=http://localhost:8000/index.php
npm run dev                 # open the URL Vite prints, then sign in
```

Set `VITE_API_URL` to your local backend endpoint. Details and first-run checks are in [Getting started](docs/GETTING-STARTED.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm test` | Vitest suite (single run) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` for the app and Node/tooling projects |
| `npm run build` | TypeScript project build and production bundle in `dist/` |
| `npm run preview` | Serve the built `dist/` locally |

CI (`.github/workflows/frontend-ci.yml`) runs `npm ci`, then test, lint, typecheck, and build, on every push and pull request.

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `.env` (development), `.env.production` (build) | The single API endpoint. It defaults to `/api` and is embedded at **build time**. See [Configuration](docs/CONFIGURATION.md#environment-variables) |
| Reports | `src/config/reports/*.json` | Local, ignored; discovered automatically |
| Dashboards | `src/config/dashboards/*.json` | Local, ignored; discovered automatically |
| Reusable widgets | `src/config/widgets/*.json` | Local, ignored and optional |
| Navigation | `src/config/menu.json` | Local, ignored and optional |

Validated, tracked starting points are in [`examples/`](examples/). They are
opt-in and never bundled until copied into `src/config/`; the framework also
builds safely with no application JSON.

## Deployment

`npm run build` produces a static bundle in `dist/`. Serve it from the **root** of a site, with a fallback to `index.html` for client-side routes, and serve the API on the same origin at `/api`. See [Deployment and hosting](docs/DEPLOYMENT.md).

## Documentation

| Document | Contents |
| --- | --- |
| [Documentation index](docs/README.md) | Every guide, and which one to read first |
| [Getting started](docs/GETTING-STARTED.md) | Local setup and first run |
| [Architecture](docs/ARCHITECTURE.md) | Runtime structure, data flow, and ownership boundary |
| [Configuration reference](docs/CONFIGURATION.md) | Environment variables and every JSON property |
| [Query modes](docs/QUERY-MODES.md) | JSON Query versus SQL Resource, and runtime merging |
| [Dashboards and widgets](docs/DASHBOARDS.md) | Layout, shared filters, date behavior, and widget types |
| [Feature behavior](docs/FEATURES.md) | Filtering, sorting, paging, export, saved views, and caching |
| [Authentication](docs/AUTHENTICATION.md) | Setup gate, sessions, roles, CSRF, and user management |
| [Examples](docs/EXAMPLES.md) | Annotated configurations and request/response pairs |
| [Example capability matrix](docs/EXAMPLE-CAPABILITY-MATRIX.md) | Frontend, backend, and integration coverage and verification status |
| [API reference](docs/API-REFERENCE.md) | The requests the frontend sends and the responses it accepts |
| [Deployment and hosting](docs/DEPLOYMENT.md) | Build, hosting requirements, and checks |
| [Testing](docs/TESTING.md) | Test strategy and CI |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common errors and fixes |
| [Roadmap](docs/ROADMAP.md) | What is done and what comes next |
| [Changelog](CHANGELOG.md) | Change history |

## Known limitations

- The app must be hosted at the site root. Assets are root-absolute, and the router has no base path.
- `VITE_API_URL` is fixed at build time, so each API origin needs its own build.
- There are no write/CRUD actions, column personalization, drill-down, or scheduling. See [Supported features](docs/SUPPORTED.md).
- The production bundle is one ~1.8 MB JavaScript chunk, and Vite warns about its size.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Licensed under the [MIT License](LICENSE).
