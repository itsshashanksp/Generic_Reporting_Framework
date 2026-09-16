# Query modes

Every report and non-report data widget selects exactly one active data source. Do not configure both.

## JSON request mode

Use top-level `request` with `action: "select"`. The request is sent to the Generic SQL API after runtime filter, sort and pagination state is merged into it.

```json
{
  "id": "orders",
  "title": "Orders",
  "request": {
    "action": "select",
    "source": { "table": "orders", "alias": "o" },
    "fields": [
      { "field": "o.id", "alias": "order_id" },
      { "field": "o.total", "alias": "total" }
    ],
    "filters": [{ "field": "o.status", "operator": "=", "value": "OPEN" }]
  },
  "columns": [
    { "field": "order_id", "header": "Order", "width": 120 },
    { "field": "total", "header": "Total" }
  ],
  "filters": [],
  "sort": [{ "field": "order_id", "direction": "DESC" }]
}
```

The source requires `table`; `alias` is optional. `fields` must be non-empty and each item is either a string or an expression object. Expression objects must provide at least one of `field`, `function`, `case`, or `expression`. Accepted expression keys are `field`, `fields`, `function`, `alias`, `sort`, `case`, `expression`, `buckets`, `offset`, `default`, `separator`, `datatype`, `style`, `value`, `values`, `index`, `datepart`, `number`, `start`, `end`, `year`, `month`, `day`, `hour`, `minute`, `second`, `millisecond`, `precision`, `power`, `part`, `length`, `search`, `replace`, `pattern`, `format`, `condition`, `true`, and `false`.

| Section | Shape |
| --- | --- |
| `filters` | `{field?, operator, value?, query?}[]`; `field` may be absent for `EXISTS`/`NOT EXISTS`, and null operators need no value |
| `joins` | `{type, source:{table,alias?}, on:{left,operator:"=",right}}[]`; type is `INNER`, `LEFT`, or `RIGHT` |
| `groupBy` | Non-empty field-name strings in an array |
| `having` | `{function,field,operator,value}[]`; functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `STRING_AGG`; comparison operators only |
| `sort` | Runtime query capability; report/widget initial sorting is authored at the definition's top level |
| `pagination` | Runtime query capability generated from grid/widget paging; `{page,pageSize}`, both positive integers |
| `distinct` | boolean |
| `limit` | positive integer |
| `filterLogic` | Runtime query capability derived from top-level `filterLogic`; `AND` or `OR` for the flat filter list |
| `with` | One standard `{name,query}` or recursive `{name,anchor,recursive}` CTE; branches are nested SELECT bodies |

The frontend validator checks identifiers, the public operator/function allowlists, fields, filters and subqueries, joins, grouping, HAVING, CTE branches, sort, pagination, DISTINCT, and limit. The backend remains authoritative and additionally validates live table/column metadata.

## SQL resource mode

Use `queryDefinition` with exactly this frontend shape:

```json
{
  "id": "monthly-sales",
  "title": "Monthly sales",
  "queryDefinition": {
    "format": "sql",
    "resource": "widgets/bill-sales-month-wise"
  },
  "columns": [
    { "field": "Month", "header": "Month" },
    { "field": "Sales", "header": "Sales", "dataType": "number" }
  ],
  "filters": [],
  "sort": [{ "field": "Month", "direction": "DESC" }]
}
```

The resource is a slash-separated logical ID such as `reports/customer` or
`widgets/bill-sales-month-wise`, relative to the backend discovery root and
without `.sql`. Each segment matches `[A-Za-z0-9][A-Za-z0-9_-]*`. The frontend
does not construct a path or inspect the file.

`queryDefinition` intentionally contains only `format` and `resource`.
The loader translates the normalized definition into the backend SQL action:

- top-level `columns` become constrained execution output columns;
- a top-level filter not present in `columns` receives a constrained source
  mapping using the same logical identifier;
- top-level `sort` becomes the initial runtime sort;
- top-level `filterLogic` becomes the backend-supported flat `AND`/`OR` value.

This translation is infrastructure, not a second authoring surface. Complex
source/HAVING expressions and resource-specific coercions remain backend-owned
capabilities and are not expressed by frontend presentation JSON.

`queryDefinition.format: "json"` is not a supported JSON mode. Use top-level `request`.

## Runtime merge rules

- Applied UI filters are appended to configured request filters.
- Current grid sorting replaces configured `sort` after the user/grid state is established.
- Enabled grid pagination supplies `pagination.page` and `pagination.pageSize`.
- Authored JSON report/widget requests reject `sort`, `pagination`, and `filterLogic` because their top-level presentation settings are the source of truth. These fields remain part of the generated runtime API request contract.
- SQL resource mode sends the same runtime fields beside `action`, `resource`, and derived `execution` metadata; the backend validates and interprets them.

## Deliberately unexposed backend actions

The backend also accepts UNION/UNION ALL, routines, metadata, and registered write actions. Report and widget configuration currently supports read-only `select` and `sql` only. Use a backend-owned SQL Resource for complex read-only SQL outside the JSON SELECT allowlist. Do not add another frontend SQL parser or converter.
