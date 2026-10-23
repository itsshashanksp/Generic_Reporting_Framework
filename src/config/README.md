# Configuration files

This directory holds **local application configuration** that Vite bundles at
build time, plus tracked framework TypeScript settings. Application JSON is
intentionally ignored by Git; copy it from `examples/` or maintain it in the
deployment repository.

| Path | Contents |
| --- | --- |
| `reports/*.json` | One report per file; the `id` is the route (`/report/<id>`) |
| `dashboards/*.json` | One dashboard per file, with inline widget definitions |
| `widgets/*.json` | Optional reusable widget definitions for `widgetId` |
| `menu.json` | Sidebar navigation; references report and dashboard IDs |
| `version.ts` | Version label shown in the UI |
| `frontendCapabilities.ts` | Which roles User Management can assign |

Unknown properties are rejected, so typos fail during loading. Every report and data widget uses exactly one data source: a JSON Query `request` or a backend SQL Resource `queryDefinition` (a logical ID such as `catalog/customer-summary`, never a file path or SQL). SQL files live only in the backend.

All JSON paths may be empty and `menu.json` may be absent; the framework then
builds and displays an empty application home. Examples are never loaded
automatically. Copy only the generic definitions needed from `examples/`, adapt
their IDs and illustrative schema, and install matching backend SQL Resources
explicitly. A change reaches users only after a rebuild and redeploy.

The full schema is in [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md), the
installation workflow is in [`docs/EXAMPLES.md`](../../docs/EXAMPLES.md), and
copyable validated definitions are in [`examples/`](../../examples/).
