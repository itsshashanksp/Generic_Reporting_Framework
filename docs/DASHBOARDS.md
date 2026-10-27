# Dashboards and widgets

A dashboard is one JSON file in `src/config/dashboards/`. It contains a layout, optional shared filters and refresh settings, and its widgets. Every property is listed in the [Configuration reference](CONFIGURATION.md#dashboard-definition). Validated examples: [`examples/dashboards/minimal-dashboard.json`](../examples/dashboards/minimal-dashboard.json) and [`examples/dashboards/date-filtered-dashboard.json`](../examples/dashboards/date-filtered-dashboard.json).

Checked-in dashboards: `item-dashboard`, `sales-dashboard`, `receipts-dashboard`, `purchase-dashboard`, and `bill-dashboard`.

## Layout

The rendered column defaults are 12 on desktop, 6 on tablet, and 1 on mobile. On desktop, a widget's `position.x` (zero-based), `position.y` (one-based CSS row), `width`, and pixel `height` are honored; the position and width must fit the desktop columns. At the 1024px and 768px breakpoints, explicit positions are dropped and widths are scaled up proportionally with `ceil`.

Widgets without an explicit position flow through the CSS grid. Invisible widgets are left out.

## Widget types and sources

| Type | Allowed source | Renders |
| --- | --- | --- |
| `report` | exactly `reportId` | The report's columns and grid, in the shared report/table frame, with compact mobile pagination over the returned rows |
| `stat` | exactly one of `request`, `queryDefinition`, `reportId`, `widgetId` | One value: `valueField` of the first row (or its first property), formatted with `format` in the `en-IN` locale |
| `table` | as `stat` | A server-paginated table with sorting, multiple row selection, and optional CSV/Excel export. When `columns` is omitted, they are inferred from the first row |
| `chart` | as `stat` | A Recharts `bar`, `line`, or `pie` chart of `xField` against `yField`. Non-numeric Y values become zero |

- **Inline** `request` or `queryDefinition` keeps the dashboard self-contained. This is what every checked-in dashboard uses.
- **`reportId`** reuses a normalized report definition (request and columns).
- **`widgetId`** references a file in `src/config/widgets/`. It is supported, but no such files are checked in.

Each widget has its own loading, empty, error, and retry states, and its own cache scope `dashboard:<dashboardId>:<widgetId>`. A dashboard table widget sends only its first active sort column (reports can send several). Its paging and export are configured on the widget itself (`pageSize`, `pageSizeOptions`, `export`).

## Shared filters and Search

Dashboard filters use the same controls and operators as report filters. They are merged into every resolved widget definition (inline, `reportId`, or `widgetId`) before the request is built. That is how the SQL Resource translator derives filter mappings without repeating the controls in each widget.

Editing the filter form changes only its draft values. Widgets keep using the applied values until **Search** validates the form and applies it, once, to every widget. **Clear filters** empties the form and removes every applied filter. Searching again with the values already applied sends no new requests (the cache may answer). **Refresh** asks again.

A shared filter with `"required": true` gates the whole dashboard. Its widgets are not shown (so they send no requests and offer no refresh or export) until **Search** applies a complete value. A required `daterange` needs both its start and its end date. Searching with a missing or partial required value shows an error, keeps the form editable, and removes the results of the earlier search. **Clear** removes them too.

### Date filter behavior

The optional dashboard property `dateFilterBehavior` decides how the dashboard's shared `daterange` filters work:

| Value | Before the first Search | Search |
| --- | --- | --- |
| `"required"` | Nothing loads. Every shared date range is treated as required, so the gate above applies | Needs both dates of every range. A missing or partial range is refused, and earlier results are removed |
| `"optional"` | Every widget loads without a date runtime filter | Applies a range only when both dates are set. A range with one date is refused, and the results already shown keep their range. Both dates empty searches without a date range |
| omitted | Filters behave as configured. A filter marked `required` gates the dashboard. An unmarked range may be searched with only a start (`>=`) or only an end (`<=`) | As configured |

Current use: Bill is `"required"`; Sales, Purchases, and Receipts are `"optional"`; Item omits it.

Dashboards that set `dateFilterBehavior` show which date range the displayed results use ("Showing results for Start Date … to …" or "Showing results without a Start Date range"). That way, dates that were edited but not searched aren't mistaken for the range of the results on screen.

Validation rejects any other value, `dateFilterBehavior` on a dashboard without a shared `daterange` filter, and `"optional"` together with a `daterange` filter marked `"required": true`.

The applied range reaches each widget through that widget's `filterFields`, if it has one (see below). A widget whose date column has another name therefore still receives the range under its own field. `"optional"` only leaves out the frontend's runtime date filter. A SQL Resource that limits dates in its own SQL still returns only those dates.

Implementation: `engine/DashboardEngine/dateFilterBehavior.ts` and `src/pages/Dashboard.tsx`. Status: implemented and unit-tested. Validation against SQL Server is still pending (roadmap 47 / E1).

### Per-widget filter fields

Every widget receives every shared filter under the filter's `field`. When one widget's data names that column differently, its optional `filterFields` maps the shared field to the widget's field:

```json
{
  "id": "purchases-month-wise",
  "type": "table",
  "title": "Purchases Month Wise",
  "filterFields": { "Bill_Date": "GIN_Date" },
  "queryDefinition": { "format": "sql", "database": "loyal-ibms", "resource": "widgets/bill-purchases-month-wise" },
  "columns": [
    { "field": "Month", "header": "Month" },
    { "field": "Purchases", "header": "Purchases", "dataType": "number" }
  ],
  "sort": [{ "field": "Month", "direction": "DESC" }]
}
```

With a shared `Bill_Date` date range, this widget declares and sends `GIN_Date` instead. In SQL Resource mode, both the source-filter declaration and the runtime filter use `GIN_Date`. Other widgets keep `Bill_Date`. Only the field name changes: the label, type, operator, and values (including start-only and end-only date ranges) stay those of the shared filter. An empty selection sends no runtime filter, and table exports use the same mapped filters as the table.

Validation rejects a mapping unless:

- it is a non-empty object;
- each key is the `field` of a shared dashboard filter;
- each value is a plain field name (letters, digits, and underscores, not starting with a digit) that differs from its key;
- no two keys map to the same field, and no value equals another shared filter's field or one of the widget's own filter fields (compared case-insensitively).

`filterFields` renames a field; it is never SQL. The backend resolves the mapped name exactly as it would resolve a shared filter's name, and access scopes check that name.

## Widget-level runtime filters

An optional `runtimeFilters` array on a dashboard widget adds independent controls inside that widget. It uses the same filter definitions, types, operators, static options, and `dynamicOptions` as report and dashboard filters. It works with inline JSON Queries, inline SQL Resources, `widgetId`, and `reportId` widgets.

```json
{
  "id": "open-orders",
  "type": "table",
  "title": "Open Orders",
  "queryDefinition": { "format": "sql", "resource": "widgets/open-orders" },
  "runtimeFilters": [
    { "field": "Customer", "label": "Customer", "type": "text", "operator": "contains" }
  ]
}
```

The widget header shows **Filter** only when at least one local filter is visible. Editing is draft-only; **Apply** reloads that widget, and **Reset** clears only that widget. Dashboard Search and Clear do not alter widget-local values. An active marker appears after local values are applied.

Date and numeric range controls must be empty or complete, valid, and ordered before Apply succeeds. When a widget's effective database changes, its draft values, applied values, open panel, and validation error are cleared; dynamic options and data then load in the new database context. A widget pinned to an explicit database keeps its local filters when the dashboard selector changes because its effective database did not change.

Dashboard and widget filters are appended to existing authored request filters:

```text
authored request filters + mapped dashboard filters + widget runtime filters
```

They use the request's existing flat `filterLogic`; grouped scope-specific AND/OR logic is not supported. Repeated effective fields are retained as separate backend conditions and produce an actionable configuration warning rather than being overwritten. With `OR`, authored, dashboard, and widget conditions are all alternatives—not separate mandatory scopes—so mixed-source OR also produces a warning.

For SQL Resources, fields remain logical runtime identifiers and must be permitted by the backend resource contract. The frontend never constructs SQL. A backend rejection is shown only in the owning widget.

The frontend does not receive complete SQL placement metadata. It therefore cannot predict whether an SQL Resource's `OR` filters span output, CTE, WHERE, or HAVING locations. The backend remains authoritative and rejects unsupported multi-placement OR requests; the owning report/widget shows a filtered, actionable error without exposing SQL. JSON Query behavior is unaffected.

Dynamic option requests inherit the owning widget's effective database—explicit widget database, dashboard selection, or global fallback—unless the option request explicitly names its own database. Existing authorization and database access scopes still apply.

Table widgets apply the same local filters to screen requests and **All rows** exports. Applying a local filter returns the table to page 1 while preserving sort and page size. Cache keys include the complete filtered request.

Dashboard and widget filters together:

```json
{
  "filters": [
    { "field": "Bill_Date", "label": "Date", "type": "daterange" }
  ],
  "widgets": [
    {
      "id": "sales-by-category",
      "type": "chart",
      "title": "Sales by Category",
      "reportId": "sales",
      "xField": "Category",
      "yField": "Amount",
      "runtimeFilters": [
        {
          "field": "Region",
          "label": "Region",
          "type": "select",
          "dynamicOptions": {
            "request": { "action": "select", "source": { "table": "Regions" }, "fields": ["Region"] },
            "valueField": "Region"
          }
        }
      ]
    }
  ]
}
```

Existing `filters` on reports and reusable definitions retain their prior metadata meaning and are not automatically exposed as widget controls. Declare `runtimeFilters` on the dashboard widget instance to opt in.

## Database selector

A dashboard can let users switch the database its widgets read from:

```json
{
  "databaseSelection": true
}
```

- **Inheritance rule:** a widget whose resolved request names **no** `database` follows the selection. A widget that names its own `database` (inline, or through its `reportId` or `widgetId` definition) **always keeps it**. The selection never overrides it.
- `true` enables the selector. IDs and labels come only from the authorized backend listing. The initial selection, fallback, empty state, and fail-closed listing state follow [Feature behavior](FEATURES.md#database-selector). Until a database is resolved **no widget is mounted**, pinned widgets included, and Refresh is disabled. The dashboard is invalid unless at least one visible widget inherits: "Dashboard databaseSelection needs at least one visible widget whose request names no database; …".
- **Opting in an existing dashboard:** remove the per-widget `database` from the widgets that should follow. The Item Dashboard does this and starts on the authorized global default when configured, otherwise the registry default. Bill still pins `loyal-ibms` on every widget. Sales, Purchases, and Receipts name none, so their widgets would inherit right away.
- The **Database** dropdown sits beside **Refresh**. Its options are the enabled rows from `metadata.databases` (see [Feature behavior](FEATURES.md#database-selector)).
- **Switching:** every inheriting widget reruns on the chosen database, keeping the applied filters. Table widgets return to page 1. Refresh, auto-refresh, table paging, sorting, and **All rows** export then use the chosen database. A running table export is cancelled when the database changes, so it never saves the previous database's rows. Late results from before a switch are ignored, and cache entries are per database.
- A running **All rows** export is also cancelled if applied dashboard/widget filters or table sorting change. Draft-only filter edits do not cancel it. Current-page export remains an immediate export of the rows already displayed.
- The selection is resolved again when the dashboard is opened again. Shared `dynamicOptions` requests inherit it unless they explicitly pin their own database.

Example: [`examples/dashboards/database-selector-dashboard.json`](../examples/dashboards/database-selector-dashboard.json). Covered by mocked tests (`src/pages/__tests__/DashboardDatabaseSelector.test.tsx`); not yet run against a live backend.

## Refresh

Auto-refresh requires a positive millisecond `interval` when it is enabled. The timer (`setInterval`) bumps a refresh key for all widgets, and manual **Refresh** does the same. The page indicator ends after a fixed one second. It does not mean that every widget has finished.

See [Configuration reference](CONFIGURATION.md#widgets), [Feature behavior](FEATURES.md), and [Examples](EXAMPLES.md#dashboard-sql-resources-in-use).
