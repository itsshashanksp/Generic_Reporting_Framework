# Example capability matrix

“Validated” means the repository schema/runtime tests pass; database execution
still depends on an operator-provided schema and authorized backend.

| Capability | Public example | Status |
|---|---|---|
| JSON Query report | `reports/json-query-report.json` | Supported and validated |
| SQL Resource report | `reports/sql-resource-report.json` | Supported and validated; backend resource must be installed |
| Text, number, select, multiselect, boolean, date and date-range filters | `reports/filter-catalog-report.json` | Supported and validated |
| Static and dynamic options | filter catalog and JSON Query report | Supported and validated |
| Sorting, paging, grouping, selection and export | report examples | Supported and validated |
| Minimal and mixed dashboards | `dashboards/` | Supported and validated |
| Required/optional shared date filters and field mapping | date-filtered and widget-catalog dashboards | Supported and validated |
| Report, stat, table and chart widgets | widget catalog | Supported and validated |
| Bar, line and pie charts | widget catalog | Supported and validated |
| Reusable widget reference | `widgets/customer-summary.json` | Supported and validated |
| Independent widget runtime filters | `dashboards/widget-runtime-filters.json` | Supported and validated for table and chart widgets |
| Combined dashboard and widget filter scopes | `dashboards/combined-dashboard-widget-filters.json` | Supported and validated; fields must not conflict |
| Dynamic widget filter options | `dashboards/dynamic-widget-runtime-filters.json` | Supported and validated; option queries inherit effective database |
| Widget-instance filters with `widgetId` and `reportId` | `dashboards/referenced-widget-runtime-filters.json` | Supported and validated; referenced definitions must also be installed |
| Database selection, inheritance and explicit pinning | database-selector examples | Conditional on backend registry |
| Nested navigation and direct routes | `menu.json` | Supported and validated |
| Procedures, metadata and writes | none | Backend-only; not presented as frontend functionality |

Public examples use a coherent illustrative Orders/Customers schema. Historical
application fixtures used by regression tests are isolated under
`tests/fixtures/` and are not part of the example or production configuration
surface.
