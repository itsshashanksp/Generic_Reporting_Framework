# Examples

Application JSON is deployment-owned: `src/config/**/*.json` and
`src/config/menu.json` are intentionally ignored, while this directory is the
tracked reference library. Examples are never loaded automatically.

For a complete opt-in application, copy
`examples/complete/retail-reference/config/` into `src/config/`, then copy the
matching backend `examples/sql-resources/reports/` and `widgets/` files into the
backend `queries/` directories. Review the logical database IDs and physical
retail schema first. To author a smaller application, copy one validated report,
dashboard, widget, or menu example and change its globally unique `id` and
references. Reports use exactly one `request` (JSON Query) or `queryDefinition`
(SQL Resource); dashboards may define inline widgets or refer to a tracked local
widget by `widgetId`.

Run `npm test -- --run src/config/__tests__/exampleLibrary.test.ts` after edits.
See the [capability matrix](EXAMPLE-CAPABILITY-MATRIX.md) for coverage and the
distinction between structural validation and live database execution.

## Example files

[`examples/`](../examples/) holds complete definitions you can copy into `src/config/`. They use real backend SQL Resource IDs, plus the field names of the checked-in configuration.

| File | Copy to | Shows |
| --- | --- | --- |
| [`reports/json-query-report.json`](../examples/reports/json-query-report.json) | `src/config/reports/` | JSON Query mode, text/number/dynamic-select filters, paging, toolbar, CSV/Excel export |
| [`reports/sql-resource-report.json`](../examples/reports/sql-resource-report.json) | `src/config/reports/` | SQL Resource mode with `database`, `sort`, `filterLogic` |
| [`reports/database-selector-report.json`](../examples/reports/database-selector-report.json) | `src/config/reports/` | Runtime database switching between `database1` and `database2` (illustrative IDs; use your registry's IDs) |
| [`dashboards/minimal-dashboard.json`](../examples/dashboards/minimal-dashboard.json) | `src/config/dashboards/` | The smallest valid dashboard: one stat widget |
| [`dashboards/database-selector-dashboard.json`](../examples/dashboards/database-selector-dashboard.json) | `src/config/dashboards/` | Dashboard database switch: two widgets inherit it, one keeps `loyal-ibms` (illustrative IDs) |
| [`dashboards/date-filtered-dashboard.json`](../examples/dashboards/date-filtered-dashboard.json) | `src/config/dashboards/` | Layout, a required shared date range, `dateFilterBehavior`, `filterFields`, table export, stat, chart |
| [`widgets/item-stock-value-by-category.json`](../examples/widgets/item-stock-value-by-category.json) | `src/config/widgets/` | A reusable widget definition, referenced by `widgetId` |
| [`menu.json`](../examples/menu.json) | merge into `src/config/menu.json` | Grouped dashboard and report entries plus a route |

How they were checked (2026-10-16): each file was run through the repository's own validators and loaders, without errors or warnings. Reports went through `getReportValidationErrors` and `loadDefinition`, the reusable widget through the same with `columnsRequired: false`, dashboards through `validateDashboard`, `loadDashboardConfiguration`, and `resolveDashboardWidgetRequest`, and the menu through `loadNavigation`. They were **not** run against a live backend. The IDs must be unique: the example IDs end in `-example` or `-example-dashboard`, so they don't clash with the checked-in files. To show a copied report or dashboard in the sidebar, add a menu entry for it.

## JSON Query report → runtime request

Source: `examples/reports/json-query-report.json` (trimmed):

```json
{
  "id": "item-example",
  "title": "Item Report (example)",
  "request": {
    "action": "select",
    "database": "loyal-ibms",
    "source": { "table": "ItemMasterTable" },
    "fields": ["Item_Code", "Item_Desc", "Item_MRP"]
  },
  "columns": [
    { "field": "Item_Code", "header": "Item Code", "dataType": "number", "width": 140 },
    { "field": "Item_Desc", "header": "Item Description", "width": 320 },
    { "field": "Item_MRP", "header": "Item MRP", "dataType": "number" }
  ],
  "sort": [{ "field": "Item_Code", "direction": "ASC" }],
  "filters": [
    { "field": "Item_Desc", "label": "Item Description", "type": "text", "operator": "contains" }
  ]
}
```

The normalized request produced by `loadDefinition`:

```json
{
  "action": "select",
  "database": "loyal-ibms",
  "source": { "table": "ItemMasterTable" },
  "fields": ["Item_Code", "Item_Desc", "Item_MRP"],
  "sort": [{ "field": "Item_Code", "direction": "ASC" }]
}
```

At runtime, `ReportViewer` appends the applied filters and adds the paging. With "pen" typed into the description filter:

```json
{
  "action": "select",
  "database": "loyal-ibms",
  "source": { "table": "ItemMasterTable" },
  "fields": ["Item_Code", "Item_Desc", "Item_MRP"],
  "filters": [{ "field": "Item_Desc", "operator": "LIKE", "value": "%pen%" }],
  "sort": [{ "field": "Item_Code", "direction": "ASC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

## SQL Resource report → runtime request

`examples/reports/sql-resource-report.json` references the backend resource `reports/customer`. That resource exists in the backend, but the checked-in Customer report uses JSON Query mode instead.

```json
{
  "id": "customer-sql-example",
  "title": "Customer Report (SQL Resource example)",
  "queryDefinition": { "format": "sql", "database": "loyal-ibms", "resource": "reports/customer" },
  "columns": [
    { "field": "Cust_Name", "header": "Customer" },
    { "field": "TotalCustomers", "header": "Total", "dataType": "number" },
    { "field": "MinimumBill", "header": "Minimum", "dataType": "number" },
    { "field": "MaximumBill", "header": "Maximum", "dataType": "number" }
  ],
  "sort": [{ "field": "Cust_Name", "direction": "ASC" }],
  "filters": [{ "field": "Cust_Name", "label": "Customer", "type": "text", "operator": "startsWith" }],
  "filterLogic": "AND"
}
```

The derived request (`execution.columns` comes from `columns`):

```json
{
  "action": "sql",
  "database": "loyal-ibms",
  "resource": "reports/customer",
  "execution": { "columns": ["Cust_Name", "TotalCustomers", "MinimumBill", "MaximumBill"] },
  "sort": [{ "field": "Cust_Name", "direction": "ASC" }],
  "filterLogic": "AND"
}
```

`Cust_Name` is a displayed column, so it needs no source mapping. A filter on a field that is **not** displayed gets one, `{ "placement": "source" }`, with no `expression`. The backend derives the source column (see the dashboard example below).

The frontend never sends the file path or SQL text. The backend resolves `reports/customer` to its server-owned SQL, places the runtime filters, and executes it.

## Dashboard → widget requests

From `examples/dashboards/date-filtered-dashboard.json`, before any filter is applied (the output of `resolveDashboardWidgetRequest`):

```json
{
  "action": "sql",
  "database": "loyal-ibms",
  "resource": "widgets/bill-purchases-month-wise",
  "execution": {
    "columns": ["Month", "Purchases"],
    "filters": { "GIN_Date": { "placement": "source" } }
  },
  "sort": [{ "field": "Month", "direction": "DESC" }]
}
```

The shared filter is `Bill_Date`; this widget's `filterFields` renames it to `GIN_Date`. A stat or chart widget without `columns` sends only the filter mapping:

```json
{
  "action": "sql",
  "database": "loyal-ibms",
  "resource": "widgets/bill-total-sales",
  "execution": { "filters": { "Bill_Date": { "placement": "source" } } }
}
```

Because this dashboard uses `"dateFilterBehavior": "required"`, no widget request is sent until **Search** applies both dates. After that, each request also carries `"filters": [{ "field": "Bill_Date", "operator": "BETWEEN", "value": ["2021-04-01", "2021-11-21"] }]` (or `GIN_Date` for the purchases widget). Table widgets also send `pagination`.

## Dashboard SQL Resources in use

| Dashboard | SQL Resource IDs |
| --- | --- |
| Item | `widgets/item-dashboard-table`, `widgets/item-dashboard-stats`, `widgets/item-stock-value-by-category` |
| Bill | `widgets/bill-sales-month-wise`, `widgets/bill-purchases-month-wise`, `widgets/bill-top-10-categories`, `widgets/bill-category-sales-month-wise`, `widgets/bill-total-sales`, `widgets/bill-total-purchases`, and the shared `widgets/sales-top-10-month-wise-category-wise` |
| Sales | `widgets/sales-month-wise`, `widgets/top-10-categories-sales`, `widgets/sales-top-10-month-wise-category-wise`, `widgets/category-sales-month-wise`, `widgets/sales-day-wise`, `widgets/date-wise-gst-wise-sales`, `widgets/gst-wise-sales`, `widgets/top-50-item-wise-sales`, `widgets/total-sales` |
| Purchases | `widgets/purchases-month-wise`, `widgets/purchases-day-wise`, `widgets/total-purchases` |
| Sales Receipts | `widgets/daily-collection-summary`, `widgets/payment-mode-wise-collection`, `widgets/monthly-collection-trend`, `widgets/user-wise-day-wise-collection`, `widgets/top-10-largest-receipts` |

The Bill and Sales dashboards share one TOP-10 month-wise category resource. Bill requests it from the `loyal-ibms` database and Sales from the default database, and each sends its own applied `Bill_Date` range. The previously released ID `widgets/TOP-10-month-Wise-Category-wise` no longer exists. For the physical tables behind each resource, see the [Query source inventory](security/Frontend-Query-Source-Inventory.md).

## JSON Query request fragments

These are wire-format request bodies (what reaches the API), not report files. In a report file, `sort` and `pagination` belong at the top level or in `grid`, not inside `request`. Each fragment passes the frontend's `getJsonQueryRequestValidationErrors`. The table names `Orders`, `Customers`, `Items`, and `Bills` are **illustrative** and don't exist in the application database.

### Joins, grouping, aggregation, and HAVING

```json
{
  "action": "select",
  "source": { "table": "Orders", "alias": "O" },
  "fields": [
    "C.CustomerName",
    { "function": "SUM", "field": "O.Amount", "alias": "TotalAmount" }
  ],
  "joins": [{
    "type": "INNER",
    "source": { "table": "Customers", "alias": "C" },
    "on": { "left": "O.CustomerId", "operator": "=", "right": "C.CustomerId" }
  }],
  "groupBy": ["C.CustomerName"],
  "having": [{ "function": "SUM", "field": "O.Amount", "operator": ">", "value": 1000 }],
  "sort": [{ "field": "TotalAmount", "direction": "DESC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

JSON joins are limited to INNER, LEFT, and RIGHT, with one equality condition. HAVING entries are aggregate comparisons combined with AND.

### DISTINCT, CASE, arithmetic, and functions

```json
{
  "action": "select",
  "source": { "table": "Items" },
  "distinct": true,
  "limit": 100,
  "fields": [
    "ItemCode",
    {
      "case": {
        "when": [{ "condition": { "field": "Status", "operator": "=", "value": "A" }, "then": "Active" }],
        "else": "Inactive"
      },
      "alias": "StatusText"
    },
    { "expression": { "left": "Amount", "operator": "*", "right": 1.18 }, "alias": "GrossAmount" },
    { "function": "COALESCE", "fields": ["PreferredName", "Name"], "default": "Unknown", "alias": "DisplayName" },
    { "function": "ROUND", "field": "Amount", "precision": 2, "alias": "RoundedAmount" }
  ]
}
```

### Subqueries and CTE

```json
{
  "action": "select",
  "source": { "table": "Customers", "alias": "C" },
  "fields": ["C.CustomerCode", "C.Name"],
  "filters": [{
    "field": "C.CustomerCode",
    "operator": "IN",
    "query": {
      "source": { "table": "Bills" },
      "fields": ["CustomerCode"],
      "filters": [{ "field": "Amount", "operator": ">", "value": 1000 }]
    }
  }]
}
```

```json
{
  "action": "select",
  "with": {
    "name": "ActiveItems",
    "query": {
      "source": { "table": "Items" },
      "fields": ["ItemCode"],
      "filters": [{ "field": "Active", "operator": "=", "value": true }]
    }
  },
  "source": { "table": "ActiveItems" },
  "fields": ["ItemCode"]
}
```

Only IN, NOT IN, EXISTS, and NOT EXISTS accept filter subqueries. Nested bodies cannot sort, paginate, or define another CTE.

## Filter definitions → emitted filters

```json
[
  { "field": "Name", "label": "Name", "type": "text", "operator": "notContains" },
  { "field": "Amount", "label": "Amount", "type": "number", "operator": "between" },
  { "field": "Status", "label": "Status", "type": "multiselect", "operator": "notIn", "options": [{ "label": "Closed", "value": "Closed" }] },
  { "field": "Active", "label": "Active", "type": "boolean", "operator": "equals" },
  { "field": "BillDate", "label": "Bill date", "type": "daterange", "operator": "between" },
  { "field": "DeletedAt", "label": "Deleted", "type": "date", "operator": "isNull" }
]
```

Representative emitted filters:

```json
[
  { "field": "Name", "operator": "NOT LIKE", "value": "%Acme%" },
  { "field": "Amount", "operator": "BETWEEN", "value": [10, 20] },
  { "field": "Status", "operator": "NOT IN", "value": ["Closed"] },
  { "field": "Active", "operator": "=", "value": true },
  { "field": "DeletedAt", "operator": "IS NULL" }
]
```

| UI operator | Backend operator / value |
| --- | --- |
| `equals`, `notEquals` | `=`, `<>` |
| `contains`, `notContains` | `LIKE`, `NOT LIKE` with `%value%` |
| `startsWith`, `notStartsWith` | `LIKE`, `NOT LIKE` with `value%` |
| `endsWith`, `notEndsWith` | `LIKE`, `NOT LIKE` with `%value` |
| `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual` | `>`, `<`, `>=`, `<=` |
| `in`, `notIn` | `IN`, `NOT IN` with an array |
| `between`, `notBetween` | `BETWEEN`, `NOT BETWEEN` with two values |
| `isNull`, `isNotNull` | `IS NULL`, `IS NOT NULL` with no `value` property |

An authored JSON Query request also accepts `!=`, `EXISTS`, and `NOT EXISTS`. EXISTS forms need a subquery rather than an end-user value, so no UI control produces them.

## Response

An abbreviated successful response:

```json
{
  "success": true,
  "message": "Query executed successfully.",
  "data": [{ "Item_Code": 1001, "Item_Desc": "Blue pen", "Item_MRP": 20 }],
  "meta": { "page": 1, "pageSize": 10, "totalRows": 1, "rowsReturned": 1, "executionTime": 4 }
}
```

The message text comes from the backend. The frontend checks only that it is a string. The values shown are illustrative.
