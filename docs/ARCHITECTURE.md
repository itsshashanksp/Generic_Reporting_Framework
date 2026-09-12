# Frontend architecture

The application is a configuration-driven React client. It discovers JSON files at build time, validates and normalizes them, adds user-selected state to a request, calls one Generic SQL API endpoint, and renders rows.

```text
src/config/*.json
  -> definition loader and validator
  -> normalized report/dashboard/widget definition
  -> filters, sort and page state
  -> UniversalQueryRequest (JSON over HTTP)
  -> API response validation and request cache
  -> report grid or dashboard widget
```

## Responsibility map

| Area | Responsibility |
| --- | --- |
| `src/config` | Reports, dashboards, menu entries and optional reusable widgets |
| `ReportDefinitionEngine` | Discovers, validates and defaults report definitions |
| `DashboardEngine` | Discovers dashboards and resolves inline, report-backed or reusable widget requests |
| `WidgetEngine` | Loads optional reusable widget JSON definitions |
| `FilterEngine` | Validates filters and converts applied values to API filters |
| `ReportEngine` | Builds report runtime requests |
| `src/api` | Posts requests and validates the response envelope |
| `RequestCache` | Caches successful responses and deduplicates identical in-flight calls |
| pages/components/contexts | Own UI state and rendering |

The frontend never reads, parses, generates, modifies, or executes SQL. In SQL Resource mode it sends an opaque resource identifier to the backend. SQL files, credentials, allowlisting, filter placement, parameterization, and execution belong to the backend. The obsolete frontend SQL parser/converter has been removed.

## Discovery and startup

Vite `import.meta.glob` discovers reports in `src/config/reports/*.json`, dashboards in `src/config/dashboards/*.json`, and reusable widgets in `src/config/widgets/*.json`. The navigation loader validates `src/config/menu.json` and verifies referenced report/dashboard IDs. Invalid definitions fail loudly; warnings cover non-fatal conditions such as an empty dashboard.

The router opens reports and dashboards by ID. The sidebar hides entries with `visible: false`, persists collapse/group expansion in local storage, and renders one visible child level. Keep menu nesting to one level even though recursive validation accepts deeper children.

The `/` Home route redirects to the first visible dashboard entry in `menu.json`, including a dashboard nested in a visible group. With the current menu ordering this is the Item Dashboard.

## Runtime data flow

For a report, `ReportViewer` starts with the configured request, appends applied UI filters, replaces sort with the grid sort model, and adds pagination when grid pagination is enabled. Dashboard widgets follow the same API contract, with behavior varying by widget type. A refresh bypasses a completed cache entry; identical in-flight work may still be shared.

The API endpoint is `VITE_API_URL` and receives a JSON POST. A successful response must contain `success`, `message`, an array of object rows in `data`, and valid `meta`. Pagination values in `meta` may be `null`; row counts are non-negative and `executionTime` is null or non-negative.

## State boundaries

- Filter form state is separate from applied filter state; **Search** applies it.
- Sort and page state live in the report or widget component.
- Dashboard filters and grid state use React contexts.
- Saved reports use browser local storage.
- Request caching is in-memory and is cleared by a page reload.

See [Configuration reference](CONFIGURATION.md), [Query modes](QUERY-MODES.md), and [Feature behavior](FEATURES.md).
