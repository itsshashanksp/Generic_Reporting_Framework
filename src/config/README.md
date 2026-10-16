# Configuration files

This directory holds the definitions that Vite bundles at build time:

| Path | Contents |
| --- | --- |
| `reports/*.json` | One report per file; the `id` is the route (`/report/<id>`) |
| `dashboards/*.json` | One dashboard per file, with inline widget definitions |
| `widgets/*.json` | Optional reusable widget definitions for `widgetId` (none checked in) |
| `menu.json` | Sidebar navigation; references report and dashboard IDs |
| `version.ts` | Version label shown in the UI |
| `frontendCapabilities.ts` | Which roles User Management can assign |

Unknown properties are rejected, so typos fail during loading. Every report and data widget uses exactly one data source: a JSON Query `request` or a backend SQL Resource `queryDefinition` (a logical ID such as `widgets/bill-total-sales`, never a file path or SQL). SQL files live only in the backend.

The full schema, defaults, and validation messages are in [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md). Copyable, validated starting points are in [`examples/`](../../examples/). A configuration change reaches users only after a rebuild and redeploy.
