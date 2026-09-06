# Architecture

The frontend turns declarative SQL and JSON resources into requests for the Generic SQL API and renders the returned rows as reports or dashboard widgets.

## Responsibility Layers

| Layer | Responsibility |
| --- | --- |
| `src/config` | Authored SQL data definitions and JSON presentation definitions |
| Definition engines | Load and validate reports, widgets, dashboards, columns, filters, and navigation |
| `ReportQueryEngine` | Validate and parse the supported SQL subset |
| Runtime/query builders | Merge immutable SQL intent with user-selected filter, sort, and page state |
| `src/api` | Send universal JSON requests and normalize request errors |
| Response and state engines | Parse API responses, cache requests, and provide React state contexts |
| Components and pages | Render grids, filters, toolbars, widgets, dashboards, and application states |

## End-to-End Flow

```text
report.sql / widget.sql
          +
presentation JSON
          |
          v
configuration loader and validator
          |
          v
parsed QueryDefinition + presentation definition
          |
       runtime state
 (filters, sort, page)
          |
          v
UniversalQueryRequest -> Generic SQL API -> ApiResponse
          |
          v
report grid or dashboard widget
```

SQL-provided filters and sorting remain immutable base query rules. Runtime selections are combined during request conversion without rewriting the authored SQL.

## Main Subsystems

- `ReportDefinitionEngine` resolves paired report JSON/SQL files and produces runtime report definitions.
- `ReportQueryEngine` owns the SQL contract, parsing, loading, and conversion to the universal API request.
- `DashboardEngine` validates dashboards and resolves report-backed or reusable widget-backed data requests.
- `WidgetEngine`, `ColumnEngine`, and `FilterEngine` load presentation configuration for their respective concerns.
- `RequestCache` caches completed responses and deduplicates equivalent in-flight requests.
- `GenericGrid`, filter components, toolbar components, and dashboard widgets render the configured experience.

## Application State

React contexts isolate dashboard, grid, filter, search, and theme state. The request cache stores completed responses and coordinates equivalent in-flight requests. Report views also persist explicitly saved view state in browser storage; it is presentation/runtime state, not query authorship.

## Design Boundary

The browser never executes SQL. It parses the supported authoring form into the backend's universal JSON request contract. The backend remains responsible for validating and executing that request against its configured data source.

[Documentation index](README.md) · [SQL / JSON Separation](SQL-JSON-SEPARATION.md) · [Query Engine](QUERY-ENGINE.md)
