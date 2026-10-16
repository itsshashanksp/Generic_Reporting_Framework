# Frontend documentation

These documents describe the current frontend implementation. If you are new, read them in this order: [Getting started](GETTING-STARTED.md) → [Architecture](ARCHITECTURE.md) → [Configuration](CONFIGURATION.md) with [`examples/`](../examples/).

## Using and configuring

| Guide | Contents |
| --- | --- |
| [Getting started](GETTING-STARTED.md) | Prerequisites, install, `.env`, first run |
| [Configuration reference](CONFIGURATION.md) | Environment variables; report, filter, grid, export, dashboard, widget, and menu schemas; common mistakes |
| [Query modes](QUERY-MODES.md) | JSON Query versus SQL Resource, database selection, runtime merge rules |
| [Dashboards and widgets](DASHBOARDS.md) | Layout, widget types, shared filters, date-filter behavior, `filterFields`, refresh |
| [Feature behavior](FEATURES.md) | Filtering, sorting, paging, columns, grouping, exports, saved views, caching |
| [Examples](EXAMPLES.md) | The validated example files and the requests they produce |
| [Authentication](AUTHENTICATION.md) | Setup gate, sessions, CSRF, roles, user management |

## Building, running, and maintaining

| Guide | Contents |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Startup, routing, data flow, state, error handling, the ownership boundary |
| [Development](DEVELOPMENT.md) | Project layout, scripts, configuration and schema workflows |
| [Testing](TESTING.md) | Test strategy, coverage areas, CI |
| [Deployment and hosting](DEPLOYMENT.md) | Build, hosting requirements, server examples, post-deploy checks, rollback |
| [Troubleshooting](TROUBLESHOOTING.md) | Error messages and their fixes |
| [Live validation: database selector](validation/DATABASE-SELECTOR-LIVE-TEST.md) | Manual two-database test procedure (roadmap V3; outstanding) |

## Contracts and status

| Document | Contents |
| --- | --- |
| [API reference](API-REFERENCE.md) | Every action the frontend sends, and the response contract |
| [Supported features](SUPPORTED.md) | The current capability boundary and known gaps |
| [Backend capability matrix](BACKEND-CAPABILITY-MATRIX.md) | Point-in-time record of the 36A backend alignment |
| [Query source inventory](security/Frontend-Query-Source-Inventory.md) | Dated audit of the tables, SQL Resources, and databases the frontend depends on, with known issues |
| [Roadmap](ROADMAP.md) | The authoritative status of completed, next, and planned work |
| [Design: Report actions](design/REPORT-ACTIONS.md) | Draft design and open decisions for roadmap 37 (not implemented) |
| [Changelog](../CHANGELOG.md) | Change history |

Where documents overlap, this one wins: the **Configuration reference** for the schema, **Feature behavior** for runtime behavior, and the **Roadmap** for status.
