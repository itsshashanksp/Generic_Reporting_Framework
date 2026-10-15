# Frontend Query Source Inventory

Status: **Read-only inventory**, first written 2026-10-06 and updated
2026-10-10. It records which physical sources, SQL Resources, and logical
databases the frontend depends on.

The first version was written to verify backend SSA-03, a deny-by-default
query-source registry (`config/query-sources.php`, `QuerySourceRegistry`,
`QuerySourcePolicy`). That registry was removed from the backend on
2026-10-07 (commit `955dcd1`, "simplify generic authorization for v2.2"; see
the backend `CHANGELOG.md`, "Removed"). The backend no longer has a
per-table allowlist and no longer returns `RESOURCE_ACCESS_DENIED`. This
document therefore makes no registry claims.

## 1. Scope

- **Frontend:** this repository, local branch `dev` (base `859aeed`,
  2026-09-30) plus the uncommitted changes that add optional logical
  database selection. The local branch has no upstream tracking branch, so
  parity with `https://github.com/itsshashanksp/Generic_Reporting_Framework`
  (`dev`) was not verified.
- **Backend (read for comparison only):** the sibling `Backend/` repository
  (`Generic_SQL_API_Framework`, `dev`), in particular `queries/`,
  `app/Repositories/SqlRepository.php`, and the V3 database registry
  (`database/config/databases.json`).
- **Method:** every runtime configuration file (`src/config/`) was read in
  full. All request-building code was traced from configuration to `fetch`.
  Tests and documentation were classified separately from runtime usage.
- **What counts as a physical source:** only real database tables/views. CTE
  aliases, derived-table aliases, SQL Resource IDs, widget/report/dashboard
  names, and test-only fixture names are not physical sources.
- **How the backend controls access today:** callers need the generic
  `sql.execute` permission or frontend access (`frontend.read`); either runs
  any discovered SQL Resource. JSON Query Mode reads any table or view the
  database catalog confirms. SQL Resource runtime source filters resolve
  against the resource's top-level FROM sources, confirmed through the
  catalog (`SqlRepository::resolveSourceColumn`). The V3 database registry is
  the allowlist of logical databases; there is no per-table allowlist.

## 2. Frontend API Request Inventory

All requests go through `src/api/client.ts` (`apiClient`), wrapped by
`src/api/request.ts` (`executeRequest`). Every request is `POST` to `API_URL`
(`VITE_API_URL`, default `/api`) with JSON, `credentials: "include"`, and an
`X-CSRF-Token` header for CSRF-protected actions (`select` and `sql` are not
CSRF-protected). No secrets are embedded in the frontend.

Query-related request patterns:

| # | Frontend file | Function / component | Action | Request fields | SQL/query supplied directly | SQL Resource | Source/table supplied | Filters | Pagination |
|---|---|---|---|---|---|---|---|---|---|
| Q1 | `src/pages/ReportViewer.tsx:84-127` | `ReportViewer` → `loadReport` | `select` (JSON reports) or `sql` | report `request` (including optional `database`) + `filters` + `sort` + pagination | JSON query structure (no SQL text) | Only for `sql` reports (none configured) | Yes for `select` (`source.table`) | Yes (`buildFilters`) | Yes when `grid.pagination.enabled` (both reports: page size 10) |
| Q2 | `src/pages/ReportViewer.tsx:287-310` | `ReportViewer` → `handleExportAll` | same as Q1 | same, `pagination: undefined` | as Q1 | as Q1 | as Q1 | Yes | **No** — single unpaginated request |
| Q3 | `src/components/Dashboard/TableWidget.tsx:155-225` | `TableWidget` | `sql` | optional `database`, `resource`, `execution`, `filters`, `sort`, `pagination` | No | Yes | No | Yes (dashboard filters) | Yes (`page`, `pageSize`, default 10) |
| Q4 | `src/components/Dashboard/TableWidget.tsx:365-385` → `src/engine/ExportEngine/fetchAllRows.ts` | `TableWidget` → `fetchAllRowsForExport` | `sql` | as Q3 | No | Yes | No | Yes | Yes, batches of 5,000 |
| Q5 | `src/components/Dashboard/useDashboardWidgetRequest.ts:31-60` (used by `StatWidget.tsx`, `ChartWidget.tsx`, `ReportWidget.tsx`) | `useDashboardWidgetRequest` | `sql` (all configured stat/chart widgets) | optional `database`, `resource`, `execution`, `filters` | No | Yes | No | Yes | **No** |
| Q6 | `src/components/Filters/useDynamicFilterOptions.ts:35-45` | `useDynamicFilterOptions` | `select` | optional `database`, `source.table`, `fields`, `groupBy`, `sort`, `limit: 1000` | JSON query structure | No | Yes | No | No pagination; explicit `limit` (normalized by the backend to `TOP 1000`) |

How the requests are assembled:

- **JSON reports:** `resolveReportQuery` in
  `src/engine/ReportDefinitionEngine/loader.ts` merges the configured
  `request` (including `database`, when configured) with `sort`/`filterLogic`.
- **SQL Resources:** `buildSqlResourceRequest` (`loader.ts`) sends
  `action: "sql"`, `queryDefinition.database` (only when configured),
  `resource` (unchanged), and `execution.columns`. Any filter field that is
  not an output column becomes `execution.filters.<field> = { placement: "source" }`.
  The `expression` is always omitted, so the backend derives the source column.
- **Dashboard shared filters:** merged into each widget through
  `addSharedFilters` (`src/engine/DashboardEngine/dashboardLoader.ts`), which
  rebuilds the SQL request and keeps `database`.
- **Request cache:** keys serialize the whole request
  (`src/engine/RequestCache/cache.ts`), so identical requests for different
  databases never share a cached response.

Non-query requests, recorded for completeness (no physical sources involved):

- `setup.status` — `src/setup/setupService.ts`
- `auth.csrf`, `auth.login`, `auth.session`, `auth.logout`, and
  `auth.frontendUsers.*` — `src/auth/authService.ts`

## 3. Logical Database Usage

`database` is an optional V3 logical database id (`^[a-z][a-z0-9_-]{0,63}$`),
validated by the frontend and resolved by the backend database registry. It
is never a physical SQL Server database name. When it is omitted, the request
carries no `database` property and the backend uses its default database
(`loyal-ibms` in the current backend registry).

| Configuration | `database` |
|---|---|
| `src/config/reports/customer.json:7`, `src/config/reports/item.json:7` | `loyal-ibms` |
| `src/config/reports/item.json` `UserName` filter options (Q6) | not set (backend default) |
| `src/config/dashboards/bill.json`, six widgets (`:28`, `:65`, `:102`, `:139`, `:180`, `:225`) | `loyal-ibms` |
| `src/config/dashboards/bill.json` `total-purchases` (`:245`) | not set (backend default) |
| `src/config/dashboards/item.json`, `Std_Vat` filter options and all five widgets (`:40`, `:82`, `:157`, `:181`, `:205`, `:226`) | `loyal-ibms` |
| `src/config/dashboards/sales.json`, `purchases.json`, `receipts.json` | not set (backend default) |

There is no database selection UI, and saved reports do not store a database.

## 4. Physical Table/View Inventory

| Physical Source | Type | Evidence | Usage |
|---|---|---|---|
| CustomerTable | unknown physical source (table by name; type not visible) | `src/config/reports/customer.json:9` | `source` of the Customer Report JSON `select` (grouped), runtime filters `Cust_Name`, `StDate` |
| ItemMasterTable | unknown physical source (table by name) | `src/config/reports/item.json:9`, `:57`; `src/config/dashboards/item.json:42` | `source` of the Item Report; `source` of two dynamic filter-option queries (`UserName`, `Std_Vat`) |
| ItemMasterTable | unknown physical source | via SQL Resources `widgets/item-dashboard-table`, `widgets/item-dashboard-stats`, `widgets/item-stock-value-by-category` | Item Dashboard table, stat, and chart widgets; source filters `Item_Desc`, `Br_code`, `Cat_code`, `Std_Vat` |
| BillDetTable | unknown physical source | via `widgets/bill-category-sales-month-wise`, `widgets/bill-top-10-categories`, `widgets/TOP-10-month-Wise-Category-wise`, `widgets/top-10-categories-sales`, `widgets/category-sales-month-wise`, `widgets/date-wise-gst-wise-sales`, `widgets/gst-wise-sales`, `widgets/top-50-item-wise-sales` (backend SQL) | Bill and Sales dashboard tables |
| CategoryTable | unknown physical source | via `bill-category-sales-month-wise`, `bill-top-10-categories`, `TOP-10-month-Wise-Category-wise`, `top-10-categories-sales`, `category-sales-month-wise` (comma joins) and `item-stock-value-by-category` (correlated subqueries) | Bill, Sales, and Item dashboards |
| BillMastTable (written `billmasttable` in one file) | unknown physical source | via `widgets/bill-total-sales`, `widgets/bill-sales-month-wise` (`billmasttable`), `widgets/sales-month-wise`, `widgets/sales-day-wise`, `widgets/total-sales` (backend SQL) | Bill and Sales dashboards |
| PurMastTable | unknown physical source | via `widgets/bill-purchases-month-wise`, `widgets/bill-total-purchases`, `widgets/purchases-month-wise`, `widgets/purchases-day-wise`, `widgets/total-purchases` (backend SQL) | Bill and Purchase dashboards |
| BillRectTable | unknown physical source | via `widgets/daily-collection-summary`, `widgets/payment-mode-wise-collection`, `widgets/monthly-collection-trend`, `widgets/user-wise-day-wise-collection`, `widgets/top-10-largest-receipts` (backend SQL) | Sales Receipts dashboard |
| PayModeTable | unknown physical source | via `widgets/payment-mode-wise-collection`, `widgets/top-10-largest-receipts` (comma join) | Sales Receipts dashboard |

Not physical runtime sources:

- **Test-only fixtures** (API mocked, or pure unit tests): `Orders`, `Customers`,
  `Suppliers`, `Bills`, `Inventory`, `items`, `Company`, `SlowDashboard`,
  `FastDashboard`, in `src/components/Dashboard/__tests__/widgets.test.tsx`,
  `src/engine/DashboardEngine/__tests__/dashboardEngine.test.ts`,
  `src/engine/ReportDefinitionEngine/__tests__/validator.test.ts`,
  `src/engine/ReportDefinitionEngine/__tests__/databaseSelection.test.ts`,
  `src/engine/FilterEngine/__tests__/filterRuntime.test.tsx`, and
  `src/components/Filters/__tests__/DynamicSelectFilter.test.tsx`.
- **Documentation examples only:** `Orders`/`orders`, `Customers`, `Items`,
  `Bills` (`docs/EXAMPLES.md`, `docs/API-REFERENCE.md`, `docs/QUERY-MODES.md`)
  and `Inventory` (`src/config/README.md:94`). `ActiveItems`
  (`docs/EXAMPLES.md:118`) is a CTE alias.
- **CTE aliases:** `SalesData` and `RankedData`, in backend
  `queries/widgets/TOP-10-month-Wise-Category-wise.sql`.
- **SQL table aliases:** `BIL`, `CAT`, `REC`, `PAY`, `ITM`.

## 5. SQL Resource Inventory

The frontend contains **no SQL text**. It references 26 distinct SQL Resources,
all under `widgets/`, used by 29 dashboard widget instances. **All 26 exist** in
backend `queries/widgets/`, and each identifier resolves to its own `.sql`
file through backend resource discovery (asserted by the backend
`tests/SqlResourceDiscoveryTest.php`).

17 of them were missing until 2026-10-10 and made those widgets fail with
`INVALID_SQL_RESOURCE`. They were added following the legacy report SQL stored
in the application database (`REPORTTABLE`/`REPORT_SQL`) and the widget
configurations (§7). `reports/item` and `reports/customer` exist in the backend
but are referenced only in documentation (`src/config/README.md:33`,
`docs/EXAMPLES.md`, `docs/API-REFERENCE.md`).

The API action is always `sql`.

| Resource | Used by (dashboard / widget (type) — evidence) | Backend file exists |
|---|---|---|
| `widgets/bill-sales-month-wise` | bill / sales-month-wise (table) — `src/config/dashboards/bill.json:29` | Yes |
| `widgets/bill-purchases-month-wise` | bill / purchases-month-wise (table) — `src/config/dashboards/bill.json:66` | Yes |
| `widgets/bill-top-10-categories` | bill / top-10-categories (table) — `src/config/dashboards/bill.json:103` | Yes |
| `widgets/TOP-10-month-Wise-Category-wise` | bill / top-10-month-wise-category-wise (table) — `src/config/dashboards/bill.json:140`<br>sales / top-10-month-wise-category-wise (table) — `src/config/dashboards/sales.json:124` | Yes |
| `widgets/bill-category-sales-month-wise` | bill / category-sales-month-wise (table) — `src/config/dashboards/bill.json:181` | Yes |
| `widgets/bill-total-sales` | bill / total-sales (stat) — `src/config/dashboards/bill.json:226` | Yes |
| `widgets/bill-total-purchases` | bill / total-purchases (stat) — `src/config/dashboards/bill.json:245` | Yes |
| `widgets/item-dashboard-table` | item / item-table (table) — `src/config/dashboards/item.json:83` | Yes |
| `widgets/item-dashboard-stats` | item / total-Items (stat) — `src/config/dashboards/item.json:158`<br>item / minimum-sp-item (stat) — `src/config/dashboards/item.json:182`<br>item / maximum-sp-item (stat) — `src/config/dashboards/item.json:206` | Yes |
| `widgets/item-stock-value-by-category` | item / stock-value (chart) — `src/config/dashboards/item.json:227` | Yes (added 2026-10-10) |
| `widgets/purchases-month-wise` | purchases / purchases-month-wise (table) — `src/config/dashboards/purchases.json:36` | Yes (added 2026-10-10) |
| `widgets/purchases-day-wise` | purchases / purchases-day-wise (table) — `src/config/dashboards/purchases.json:80` | Yes (added 2026-10-10) |
| `widgets/total-purchases` | purchases / total-purchases (stat) — `src/config/dashboards/purchases.json:125` | Yes (added 2026-10-10) |
| `widgets/daily-collection-summary` | receipts / daily-collection-summary (table) — `src/config/dashboards/receipts.json:36` | Yes (added 2026-10-10) |
| `widgets/payment-mode-wise-collection` | receipts / payment-mode-wise-collection (table) — `src/config/dashboards/receipts.json:95` | Yes (added 2026-10-10) |
| `widgets/monthly-collection-trend` | receipts / monthly-collection-trend (table) — `src/config/dashboards/receipts.json:158` | Yes (added 2026-10-10) |
| `widgets/user-wise-day-wise-collection` | receipts / user-wise-day-wise-collection (table) — `src/config/dashboards/receipts.json:207` | Yes (added 2026-10-10) |
| `widgets/top-10-largest-receipts` | receipts / top-10-largest-receipts (table) — `src/config/dashboards/receipts.json:270` | Yes (added 2026-10-10) |
| `widgets/sales-month-wise` | sales / sales-month-wise (table) — `src/config/dashboards/sales.json:36` | Yes (added 2026-10-10) |
| `widgets/top-10-categories-sales` | sales / top-10-categories (table) — `src/config/dashboards/sales.json:80` | Yes (added 2026-10-10) |
| `widgets/category-sales-month-wise` | sales / category-sales-month-wise (table) — `src/config/dashboards/sales.json:176` | Yes (added 2026-10-10) |
| `widgets/sales-day-wise` | sales / sales-day-wise (table) — `src/config/dashboards/sales.json:228` | Yes (added 2026-10-10) |
| `widgets/date-wise-gst-wise-sales` | sales / date-wise-gst-wise-sales (table) — `src/config/dashboards/sales.json:277` | Yes (added 2026-10-10) |
| `widgets/gst-wise-sales` | sales / gst-wise-sales (table) — `src/config/dashboards/sales.json:345` | Yes (added 2026-10-10) |
| `widgets/top-50-item-wise-sales` | sales / top-50-item-wise-sales (table) — `src/config/dashboards/sales.json:400` | Yes (added 2026-10-10) |
| `widgets/total-sales` | sales / total-sales (stat) — `src/config/dashboards/sales.json:449` | Yes (added 2026-10-10) |

Physical sources of every resource, from backend SQL (the SQL is not present
in the frontend):

| Resource | Physical sources | Joins | Subqueries | Unions | CTEs |
|---|---|---|---|---|---|
| `widgets/bill-sales-month-wise` | `billmasttable` | — | — | — | — |
| `widgets/bill-purchases-month-wise` | `PurMastTable` | — | — | — | — |
| `widgets/bill-top-10-categories` | `BillDetTable`, `CategoryTable` | implicit inner (comma) join | — | — | — |
| `widgets/TOP-10-month-Wise-Category-wise` | `BillDetTable`, `CategoryTable` (in the CTE body) | implicit inner (comma) join inside `SalesData` | — | — | `SalesData`, `RankedData` (aliases) |
| `widgets/bill-category-sales-month-wise` | `BillDetTable`, `CategoryTable` | implicit inner (comma) join | — | — | — |
| `widgets/bill-total-sales` | `BillMastTable` | — | — | — | — |
| `widgets/bill-total-purchases` | `PurMastTable` | — | — | — | — |
| `widgets/item-dashboard-table` | `ItemMasterTable` | — | — | — | — |
| `widgets/item-dashboard-stats` | `ItemMasterTable` | — | — | — | — |
| `widgets/sales-month-wise`, `widgets/sales-day-wise`, `widgets/total-sales` | `BillMastTable` | — | — | — | — |
| `widgets/top-10-categories-sales`, `widgets/category-sales-month-wise` | `BillDetTable`, `CategoryTable` | implicit inner (comma) join | — | — | — |
| `widgets/date-wise-gst-wise-sales`, `widgets/gst-wise-sales`, `widgets/top-50-item-wise-sales` | `BillDetTable` | — | — | — | — |
| `widgets/purchases-month-wise`, `widgets/purchases-day-wise`, `widgets/total-purchases` | `PurMastTable` | — | — | — | — |
| `widgets/daily-collection-summary`, `widgets/monthly-collection-trend`, `widgets/user-wise-day-wise-collection` | `BillRectTable` | — | — | — | — |
| `widgets/payment-mode-wise-collection`, `widgets/top-10-largest-receipts` | `BillRectTable`, `PayModeTable` | implicit inner (comma) join | — | — | — |
| `widgets/item-stock-value-by-category` | `ItemMasterTable`; `CategoryTable` only in correlated subqueries | — | `CategoryTable` lookup and `EXISTS` | — | — |

`item-stock-value-by-category` reads `CategoryTable` only through subqueries so
that the Item dashboard's `Cat_code` source filter resolves uniquely to
`ItemMasterTable` (a top-level join would make it ambiguous).

## 6. Dashboard / Widget / Report Mapping

| Frontend feature | Widget / report | SQL Resource | Physical table/view |
|---|---|---|---|
| Customer Report (`/report/customer`) | grid + export | — (JSON `select`) | CustomerTable |
| Item Report (`/report/item`) | grid + export; `UserName` filter options | — (JSON `select`) | ItemMasterTable |
| Item Dashboard | `item-table` | `widgets/item-dashboard-table` | ItemMasterTable |
| Item Dashboard | `total-Items`, `minimum-sp-item`, `maximum-sp-item` | `widgets/item-dashboard-stats` | ItemMasterTable |
| Item Dashboard | `stock-value` chart | `widgets/item-stock-value-by-category` | ItemMasterTable, CategoryTable |
| Item Dashboard | `Std_Vat` filter options | — (JSON `select`) | ItemMasterTable |
| Bill Dashboard | `sales-month-wise` | `widgets/bill-sales-month-wise` | BillMastTable (`billmasttable`) |
| Bill Dashboard | `purchases-month-wise` | `widgets/bill-purchases-month-wise` | PurMastTable |
| Bill Dashboard | `top-10-categories` | `widgets/bill-top-10-categories` | BillDetTable, CategoryTable |
| Bill Dashboard | `top-10-month-wise-category-wise` | `widgets/TOP-10-month-Wise-Category-wise` | BillDetTable, CategoryTable |
| Bill Dashboard | `category-sales-month-wise` | `widgets/bill-category-sales-month-wise` | BillDetTable, CategoryTable |
| Bill Dashboard | `total-sales` | `widgets/bill-total-sales` | BillMastTable |
| Bill Dashboard | `total-purchases` | `widgets/bill-total-purchases` | PurMastTable |
| Sales Dashboard | `top-10-month-wise-category-wise` | `widgets/TOP-10-month-Wise-Category-wise` | BillDetTable, CategoryTable |
| Sales Dashboard | `sales-month-wise`, `sales-day-wise`, `total-sales` | same-named resources | BillMastTable |
| Sales Dashboard | `top-10-categories`, `category-sales-month-wise` | `widgets/top-10-categories-sales`, `widgets/category-sales-month-wise` | BillDetTable, CategoryTable |
| Sales Dashboard | `date-wise-gst-wise-sales`, `gst-wise-sales`, `top-50-item-wise-sales` | same-named resources | BillDetTable |
| Purchase Dashboard | `purchases-month-wise`, `purchases-day-wise`, `total-purchases` | same-named resources | PurMastTable |
| Sales Receipts Dashboard | `daily-collection-summary`, `monthly-collection-trend`, `user-wise-day-wise-collection` | same-named resources | BillRectTable |
| Sales Receipts Dashboard | `payment-mode-wise-collection`, `top-10-largest-receipts` | same-named resources | BillRectTable, PayModeTable |

Domain names such as "inventory", "suppliers", "customers", "receipts", "sales",
and "item stock" were not assumed to be tables. "Suppliers" and "Inventory"
appear only in tests and documentation.

## 7. Business Logic of the Added Resources

Each added resource follows the legacy report SQL in the application database
(`REPORTTABLE` titles, `REPORT_SQL` text) and the widget's title, columns, and
sort. Verified on 2026-10-10 against the `loyal-ibms` database (SQL Server,
compatibility level 100).

| Measure | Definition | Legacy source |
|---|---|---|
| Sales (bill level) | `Bill_Nett` | "Total Sales Month Wise - YTD", "Sales Report For A Period" |
| Sales (item/category level) | `Item_Value - Disc_Amt - Item_RndOff`, negated for returns (`Status <> 'S'`) | "Top 10 Category Sales - YTD", "Month Wise Category Wise Sales - YTD" |
| GST sales | sale value without GST, `Vat_Amount`, and total, grouped by `Vat` | "Bill Sale Summary", "Classified Sales Summary" |
| Purchases | `Inv_Nett` | "Purchases Month Wise" |
| Collection | `Amount - Com_Amt`; commission is `Com_Amt` | "Userwise / Nodewise / Receipt Mode Wise Sales Summary", "Sales Summary Report" |
| Stock value | `Sale_Rate * Cl_Stock` | "Stock Valuation"; existing `item-dashboard-stats` |

- **"In Lakhs"** widgets divide by 100,000 and round to two decimals.
- **"Current financial year"** widgets (`sales-month-wise`, `total-sales`,
  `top-10-categories-sales`, `category-sales-month-wise`,
  `purchases-month-wise`, `purchases-day-wise`, `total-purchases`) use the
  legacy 1 April – 31 March window derived from the current date. The
  development data ends on 2021-11-21, so these widgets return no rows there;
  their logic was verified with the window anchored at 2021-06-15.
- **Dates:** widgets that sort by a hidden raw date column display
  `dd/mm/yyyy`; widgets that sort on the displayed value use `YYYY-MM` or
  `YYYY-MM-DD` so the order is chronological.

Assumptions that still need business confirmation:

- "No Of Bills" (`Receipt_Count`) counts distinct `Bill_No`, not receipt rows;
  split-payment bills make these differ (176,587 bills vs 178,993 rows).
- "Average Bill Amount" is collection divided by that bill count.
- Top-50 item "Sales" uses the item/category net sales measure.
- `gst-wise-sales` regroups the legacy date-and-GST measures by GST rate only.
- `item-stock-value-by-category` excludes the three items whose `Cat_Code` has
  no category, matching the legacy category reports.

## 8. Query Structure Inventory

- **Frontend JSON queries** (Q1, Q6): single-table `select` with `fields`,
  aggregates, `groupBy`, `sort`, `limit`, and an optional `database`. **No
  `joins`, filter subqueries, `union`/`unionAll`, or `with` (CTE)** appear in
  any runtime configuration. These constructs occur only in tests and
  documentation examples.
- **Joins:** backend resources use implicit comma joins
  (`BillDetTable`/`CategoryTable` on `Cat_Code`; `BillRectTable`/`PayModeTable`
  on `Mode_Rec`). `TOP-10-month-Wise-Category-wise` has its join inside CTE
  `SalesData`.
- **CTEs:** only `widgets/TOP-10-month-Wise-Category-wise`. Its top-level
  `FROM` is the CTE `RankedData`.
- **Subqueries:** only `widgets/item-stock-value-by-category` (correlated
  `CategoryTable` lookup and `EXISTS`).
- **UNION / UNION ALL:** none in runtime configuration or resource SQL.
- **TOP:** `bill-top-10-categories`, `top-10-categories-sales`,
  `top-50-item-wise-sales`, and `top-10-largest-receipts`. The backend keeps
  the authored `ORDER BY` inside its pagination and count wrappers, so rows are
  ranked before `TOP` limits them on both the OFFSET/FETCH and the
  ROW_NUMBER (compatibility level below 110) paths.

## 9. Routine / Procedure / Function Usage

No frontend routine/procedure/function usage was identified.

No `procedure`, `function`, or `tableFunction` actions, `EXEC`/`CALL`, or
procedure/function name fields exist in runtime code or configuration. The
only `functionName` hits are aggregate/window function names validated in
`src/engine/ReportDefinitionEngine/validator.ts`.

## 10. Dynamic Source Usage

No dynamically selected physical sources or databases were found.

| Mechanism | File | Values | Physical source determinable |
|---|---|---|---|
| Report selected by route `/report/:reportId` | `src/pages/ReportViewer.tsx:34`, `src/router/AppRouter.tsx:77` | Only statically bundled reports (`import.meta.glob` in `src/engine/ReportEngine/reportLoader.ts:5`): `customer`, `item` | Yes |
| Dashboard selected by route `/dashboard/:dashboardId` | `src/pages/DashboardViewer.tsx:7`, `src/router/AppRouter.tsx:72` | Static bundle (`src/engine/DashboardEngine/dashboardLoader.ts:39`): item, sales, receipts, purchase, bill | Yes |
| Widget definitions by `widgetId` | `src/engine/WidgetEngine/widgetLoader.ts:5` | `src/config/widgets/*.json`; the directory does not exist, so there are none | n/a |
| Saved reports | `src/engine/SavedReportEngine/storage.ts` | `localStorage` stores only filters, sorting, and pagination (`src/types/savedReport.ts`), never sources, resources, or databases | n/a |

No table, view, resource, or database name comes from the backend or from user
input; logical database ids come only from bundled configuration.

## 11. Metadata Usage

No frontend usage of `metadata.tables`, `metadata.columns`, `metadata.views`,
`metadata.procedures`, `metadata.schema`, or `metadata.databases` was found.
Users cannot select tables, views, or databases, and metadata does not drive
query building.

## 12. SQL Resource Filter Usage

Dashboard shared filters are sent as runtime `filters`. Any field that is not a
widget output column is also declared as `execution.filters.<field> =
{ placement: "source" }`, with no explicit `expression`, so the backend resolves
it against the resource's top-level FROM sources. Date filters carry
`type: "daterange"` (`src/engine/FilterQueryBuilder/builder.ts`). The backend
resolves a semantic date filter to its source column when exactly one
top-level FROM source has that column (otherwise it stays an output filter)
and converts the values to `YYYYMMDD` integers for integer-backed columns.

| Dashboard (filter definition) | Widgets / resources sending a `source` filter | Column | Resolved source |
|---|---|---|---|
| Item (`item.json:17`: `Item_Desc`, `Br_code`, `Cat_code`, `Std_Vat`) | `item-table` (`Br_code`, `Cat_code`); 3 stat widgets on `item-dashboard-stats` and `stock-value` (all four fields) | as listed | `ItemMasterTable` |
| Purchase (`purchases.json:14`: `GIN_Date`, daterange) | `purchases-month-wise`, `purchases-day-wise`, `total-purchases` | `GIN_Date` | `PurMastTable` |
| Sales Receipts (`receipts.json:14`: `Bill_Date`, daterange) | `monthly-collection-trend`, `top-10-largest-receipts`; the other 3 widgets output `Bill_Date` and the date filter still resolves to the source | `Bill_Date` | `BillRectTable` |
| Sales (`sales.json:14`: `Bill_Date`, daterange) | `sales-month-wise`, `top-10-categories-sales`, `TOP-10-month-Wise-Category-wise`, `category-sales-month-wise`, `gst-wise-sales`, `top-50-item-wise-sales`, `total-sales`; `sales-day-wise` and `date-wise-gst-wise-sales` output `Bill_Date` | `Bill_Date` | `BillMastTable` or `BillDetTable`; **`TOP-10-month-Wise-Category-wise` does not resolve** (top-level FROM is CTE alias `RankedData`; §15, R1) |
| Bill | no dashboard filters | — | — |

JSON report filters (`customer.json:61`: `Cust_Name`, `StDate`; `item.json:38`:
`Item_Code`, `Item_Desc`, `UserName`) are ordinary `select` filters on the
report's single source. No filter references a joined table, a subquery, a
derived alias, or an explicit mapped `expression`.

## 13. Pagination and Result Size

| Pattern | Requests | Status |
|---|---|---|
| Paginated | Q1 report grids (customer, item; `pageSize` 10), Q3 table widgets (22 instances; `pageSize` 10), Q4 table-widget export (1,000-row batches, smaller when the backend `maxPageSize` is lower) | Paginated |
| Explicitly limited | Q6 dynamic filter options (`limit: 1000`, `item.json:59`, `reports/item.json:74`) | Bounded at 1,000 |
| Unpaginated | Q2 report "Export all" (`ReportViewer.tsx:301`, `pagination: undefined`) | **Can exceed `GENERIC_MAX_RESULT_ROWS`** (default 10,000) |
| Unpaginated | Q5 stat (7) and chart (1) widgets | Aggregate resources, small results |

Capable of large unpaginated results:

- **Item Report "Export all"** returns every `ItemMasterTable` row matching the
  filters (`Item_Code`, `Item_Desc`, `Item_MRP`, no grouping). Above
  `GENERIC_MAX_RESULT_ROWS` rows the backend returns `413 RESULT_TOO_LARGE`;
  nothing is truncated.
- **Customer Report "Export all"** is grouped by `Cust_Name`. Its size is the
  number of distinct customers (1,285 in the development database).
- **`item-stock-value-by-category` chart** returns one row per category in use
  (279 in the development database).

## 14. Sources That Cannot Be Determined

None. Every SQL Resource the frontend references exists, and its physical
sources are listed in §5. No dynamically selected or backend-provided sources
exist (§10).

## 15. Known Issues

| # | Feature / widget | SQL Resource | Impact | Evidence | Recommended follow-up |
|---|---|---|---|---|---|
| R1 | Sales `top-10-month-wise-category-wise` with a `Bill_Date` filter | `TOP-10-month-Wise-Category-wise` | Once a date range is applied, the request fails with `INVALID_SQL_RUNTIME_FIELD` ("SQL runtime source field could not be resolved"): the top-level FROM is CTE alias `RankedData`, which has no catalog columns. Verified 2026-10-10. Pre-existing. | `sales.json:14`, `:124`; §12 | Rewrite the resource with a physical top-level FROM, or map the filter explicitly |
| R2 | "Current financial year" widgets (§7) | 7 added resources | Empty on the development database because its data ends on 2021-11-21. Expected behaviour; not a defect. | §7 | None; verify on current data |
| R3 | Item Report "Export all" | — (JSON `select`) | `413 RESULT_TOO_LARGE` if more rows match than `GENERIC_MAX_RESULT_ROWS` | `ReportViewer.tsx:301` | Consider paginated export (as table widgets already do) |
| R4 | Documentation and test examples | — | `Orders`, `Customers`, `Items`, `Bills`, `Suppliers`, `Inventory` do not exist in the application database. No runtime effect (tests mock the API). | §4 | None |

## 16. Files Inspected

Read in full or in their relevant request-building parts (paths relative to
the repository root):

- **Configuration:** `src/config/reports/customer.json`,
  `src/config/reports/item.json`, `src/config/dashboards/bill.json`,
  `item.json`, `purchases.json`, `receipts.json`, `sales.json`,
  `src/config/menu.json`, `src/config/README.md`
- **API layer:** `src/api/client.ts`, `src/api/request.ts`, `src/types/api.ts`,
  `src/types/report.ts`
- **Query building:** `src/engine/ReportDefinitionEngine/loader.ts`,
  `runtime.ts`, `validator.ts`, `src/engine/DashboardValidator.ts`,
  `src/engine/FilterQueryBuilder/builder.ts`,
  `src/engine/DashboardEngine/dashboardLoader.ts`,
  `src/engine/ReportEngine/reportLoader.ts`,
  `src/engine/WidgetEngine/widgetLoader.ts`,
  `src/engine/RequestCache/cache.ts`
- **Components and pages:** `src/components/Dashboard/useDashboardWidgetRequest.ts`,
  `TableWidget.tsx`, `ReportWidget.tsx`, `StatWidget.tsx`, `ChartWidget.tsx`
  (request usage), `src/components/Filters/useDynamicFilterOptions.ts`,
  `src/engine/ExportEngine/fetchAllRows.ts`, `src/pages/ReportViewer.tsx`,
  `src/pages/DashboardViewer.tsx`, `src/router/AppRouter.tsx`
- **Saved reports:** `src/engine/SavedReportEngine/storage.ts`,
  `src/types/savedReport.ts`
- **Non-query services:** `src/setup/setupService.ts`, `src/auth/authService.ts`
  (action names only)
- **Tests** (source fixtures and API mocking): the files listed in §4 and
  `src/pages/__tests__/ReportViewer.test.tsx`,
  `src/config/__tests__/configurationSeparation.test.ts`,
  `src/api/__tests__/client.test.ts`
- **Documentation:** `docs/EXAMPLES.md`, `docs/API-REFERENCE.md`,
  `docs/QUERY-MODES.md`

Backend files read for comparison: `queries/reports/*.sql`,
`queries/widgets/*.sql`, `config/sql-resources.php`,
`app/Resources/SqlResourceDiscovery.php`, `app/Repositories/SqlRepository.php`,
`app/Requests/QueryRequestValidator.php`, `app/Requests/SqlRequestValidator.php`,
`app/Database/DatabaseRegistry.php`, `database/config/databases.json` (logical
ids only), and `CHANGELOG.md`.

## 17. Conclusion

- The runtime frontend reads directly (JSON `select`) only `CustomerTable` and
  `ItemMasterTable`.
- Through its 26 SQL Resources, the frontend also depends on `BillDetTable`,
  `BillMastTable`, `PurMastTable`, `CategoryTable`, `BillRectTable`, and
  `PayModeTable`.
- All 26 referenced SQL Resources exist and resolve. The 17 added on
  2026-10-10 follow the legacy report SQL; five interpretations still need
  business confirmation (§7).
- Reports and dashboards may name a logical database; omitted ids use the
  backend default (`loyal-ibms`). Access is governed by the generic
  authorization model and the database registry; the former query-source
  registry no longer exists.
- Open follow-ups: R1 (CTE resource with a date filter) and R3 (unpaginated
  report export).
