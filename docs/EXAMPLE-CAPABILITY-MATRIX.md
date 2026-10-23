# Example capability and integration matrix

This is the maintained audit of the opt-in examples. “Structural” means the
repository validators and contract tests pass; it does not claim that the SQL
ran against a live customer database.

## Frontend capability matrix

| Capability | Implementation | Canonical docs | Current/example evidence | Backend dependency | Status | Example/action |
|---|---|---|---|---|---|---|
| JSON Query report | `ReportDefinitionEngine`, `ReportViewer` | [Query modes](QUERY-MODES.md) | `json-query-report.json`, complete retail reports | `select` | Supported, exercised by tests | Keep standalone and complete examples |
| SQL Resource report | report loader/request builder | [Query modes](QUERY-MODES.md) | `sql-resource-report.json`, contract map | `sql.execute` and installed resource | Supported; live DB conditional | Copy matching backend SQL first |
| Report columns/grid | report validator, AG Grid | [Configuration](CONFIGURATION.md) | filter catalog: formats, visibility, sorting, widths, grouping, selection | Stable output aliases | Supported, exercised structurally | `filter-catalog-report.json` |
| Filters | filter validator/runtime builder | [Features](FEATURES.md) | text, number, select, multiselect, boolean, date, daterange; static/dynamic options; AND/OR | Accepted backend operators/fields | Supported, exercised structurally | `filter-catalog-report.json` |
| Pagination/multi-sort | report runtime builder | [Features](FEATURES.md) | standalone and catalog reports | Server paging/sort | Supported, exercised | Existing examples |
| CSV/Excel/current/all export | export services | [Features](FEATURES.md) | filter catalog toolbar/export settings | Export-all performs paged reads | Supported, exercised in app tests | Filter catalog |
| Saved report views | saved-report store | [Features](FEATURES.md) | filter catalog enables saved reports | Stable authenticated user ID | Supported, exercised in tests | Filter catalog |
| Dashboard report widget | dashboard resolver/components | [Dashboards](DASHBOARDS.md) | widget catalog | Referenced report data source | Supported, structurally exercised | Widget catalog |
| Stat/table widgets | dashboard components | [Dashboards](DASHBOARDS.md) | number/currency/decimal stats and exported paged table | Resource aliases | Supported, exercised | Widget catalog |
| Bar/line/pie charts | chart component | [Dashboards](DASHBOARDS.md) | every chart type and supported display option | Resource aliases | Supported, exercised structurally | Widget catalog |
| Inline/reusable widgets | widget loader/resolver | [Dashboards](DASHBOARDS.md) | inline widgets and `widgetId` reference | Matching resource | Supported, exercised | Widget catalog + reusable widget |
| Shared/date filters | dashboard resolver | [Dashboards](DASHBOARDS.md) | required and optional ranges, field mapping | Filter-compatible resource | Supported, exercised | Date and widget catalog dashboards |
| Database selection | report/dashboard runtime | [Configuration](CONFIGURATION.md) | selector examples, inheritance, per-widget override | Registered enabled database | Conditional/environment-dependent | Replace illustrative IDs when installing |
| Navigation | `NavigationEngine`, `Sidebar`, router | [Configuration](CONFIGURATION.md) | standalone and complete menu; missing menu test | Referenced local IDs | Supported, exercised | Menu is optional; no hardcoded default route |
| Write/CRUD, routines | none | [Supported](SUPPORTED.md) | none | Backend supports separate APIs | Backend-only, not supported in UI | Kept out of frontend examples |

## Backend capability matrix

| Capability | Implementation/validator | Docs | Example | Security/database prerequisites | Status/action |
|---|---|---|---|---|---|
| Read-only SQL Resource discovery | `SqlResourceRepository`, `SqlResourceStatement` | Backend SQL Resource docs | preserved reports/widgets and `catalog/basic-orders.sql` | Installed under `queries/`, `sql.execute`, access scope | Supported; examples remain outside discovery |
| Runtime output/source/HAVING filters, sort, paging | SQL Resource request and execution validators | Backend filtering docs | `api/sql-resource/runtime-filtered.json` | Declared execution metadata and compatible aliases | Supported; structurally validated |
| SELECT/WHERE/TOP/ORDER/CASE | SQL statement analyzer | Backend authoring docs | `catalog/basic-orders.sql` | SQL Server schema shown is illustrative | Supported; live execution conditional |
| JOIN/aggregate/GROUP/HAVING | analyzer/executor | Backend authoring docs | `catalog/customer-summary.sql` | Matching tables | Supported; live execution conditional |
| CTE/window/date/derived table | analyzer/executor | Backend query docs | `catalog/advanced-ranking.sql` | SQL Server | Supported; live execution conditional |
| Subquery/set operations | analyzer/executor | Backend query docs | `catalog/set-and-subquery.sql` | SQL Server | Supported; live execution conditional |
| Cross-database placeholders | statement resolver/database registry | Backend authoring docs | `catalog/cross-database.sql` | Registered databases on one server profile | Conditionally supported |
| Advanced JSON Query | `QueryRequestValidator`, query builder | Backend JSON request reference | `api/json-query/advanced-select.json` | Authorized registered database | Supported; request validated |
| Metadata | request validator/metadata controller | Backend metadata docs | `api/metadata/tables.json` | Metadata permission/access scope | Backend-only example; request validated |
| Procedure/write actions | request validator/controllers | Backend routine/write docs | `api/backend-only/` | Explicit permissions; may mutate data | Backend-only; validation only, never auto-run |
| Internal metadata SQL | metadata repositories | Backend architecture | `queries/system/*.sql` | Internal call paths only | Framework-owned; excluded from public discovery |

## Cross-repository integration matrix

The machine-readable, per-resource inventory is
[`examples/sql-resource-contracts.json`](../examples/sql-resource-contracts.json).
It records every frontend example reference, backend example path, output fields,
and filter fields; the example test verifies file existence and aliases.

| Frontend family | Source mode / resource IDs | Backend examples | Database assumption | Filters/sort/paging | Verification |
|---|---|---|---|---|---|
| Customer and item reports | JSON Query and `reports/customer`, `reports/item` | `examples/sql-resources/reports/` | Retail sample tables; configured logical DB | Report filters, default sort, server paging | Schema/request/alias contract passed; no live DB |
| Item dashboard | `widgets/item-*` | matching `examples/sql-resources/widgets/` | Retail inventory tables | source/output filters, widget sort/paging | References and aliases passed; no live DB |
| Bill/sales/purchases dashboards | `widgets/bill-*`, `sales-*`, `purchases-*`, shared resource | matching widget SQL | Retail transaction tables | date mappings, output sort, table paging | References and aliases passed; no live DB |
| Receipt dashboard | collection/receipt widget resources | matching widget SQL | Retail receipt tables | date/source filters and output sort | References and aliases passed; no live DB |
| Standalone catalog | JSON Query or catalog SQL | `examples/sql-resources/catalog/` | Illustrative `Orders`/`Customers` schema | varies by example | Structural validation only |

## Audit discrepancies and disposition

- A missing `menu.json` was imported directly and the root route assumed
  `item-dashboard`. Navigation is now optional and an empty installation shows a
  neutral home state.
- Static select options were incorrectly sent through dynamic-option validation.
  The validator now accepts either supported form, as the documented schema says.
- One preserved SQL Resource ended in a semicolon rejected by the statement
  analyzer; only that terminator was removed, without changing SQL semantics.
- Database IDs and physical retail schemas are deployment-owned. Passing JSON
  validation is not evidence of live execution.
- Backend routine, metadata, and mutation examples are explicitly backend-only.
