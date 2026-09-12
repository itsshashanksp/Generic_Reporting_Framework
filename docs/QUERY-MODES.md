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
    "filters": [{ "field": "o.status", "operator": "=", "value": "OPEN" }],
    "sort": [{ "field": "o.id", "direction": "DESC" }]
  },
  "columns": [
    { "field": "order_id", "header": "Order", "width": 120 },
    { "field": "total", "header": "Total" }
  ],
  "filters": []
}
```

The source requires `table`; `alias` is optional. `fields` must be non-empty and each item is either a string or an expression object. Expression objects must provide at least one of `field`, `function`, `case`, or `expression`. Accepted expression keys are `field`, `fields`, `function`, `alias`, `sort`, `case`, `expression`, `buckets`, `offset`, `default`, `separator`, `datatype`, `style`, `value`, `values`, `index`, `datepart`, `number`, `start`, `end`, `year`, `month`, `day`, `hour`, `minute`, `second`, `millisecond`, `precision`, `power`, `part`, `length`, `search`, `replace`, `pattern`, `format`, `condition`, `true`, and `false`.

| Section | Shape |
| --- | --- |
| `filters` | `{field?, operator, value?, query?}[]`; `field` may be absent for `EXISTS`/`NOT EXISTS`, and null operators need no value |
| `joins` | `{type, source:{table,alias?}, on:{left,operator:"=",right}}[]`; type is `INNER`, `LEFT`, or `RIGHT` |
| `groupBy` | Non-empty field-name strings in an array |
| `having` | `{function,field,operator,value}[]`; functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `STRING_AGG`; comparison operators only |
| `sort` | `{field,direction}[]`, direction `ASC` or `DESC` |
| `pagination` | `{page,pageSize}`, both positive integers |
| `distinct` | boolean |
| `limit` | positive integer |
| `filterLogic` | `AND` or `OR` for the flat request filter list |
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
    "resource": "monthly-sales"
  },
  "columns": [{ "field": "month", "header": "Month" }],
  "filters": []
}
```

The resource must match `[A-Za-z0-9][A-Za-z0-9_-]*`. The loader normalizes this to `{ "action": "sql", "resource": "monthly-sales" }`. The frontend does not resolve a `.sql` file. The backend must recognize the resource, expose output names matching configured columns and sort fields, explicitly allowlist any runtime filter fields (which may be source fields not returned by an aggregate resource), apply the runtime controls at the correct query level, and return the standard response envelope.

`queryDefinition.format: "json"` is not a supported JSON mode. Use top-level `request`.

## Runtime merge rules

- Applied UI filters are appended to configured request filters.
- Current grid sorting replaces configured `sort` after the user/grid state is established.
- Enabled grid pagination supplies `pagination.page` and `pagination.pageSize`.
- Disabling grid pagination stops the UI from adding pagination, but a manually authored `request.pagination` remains because the base request is spread first. Prefer `grid.pagination` for interactive reports.
- SQL resource mode sends the same runtime fields beside `action` and `resource`; the backend owns their interpretation.

## Deliberately unexposed backend actions

The backend also accepts UNION/UNION ALL, routines, metadata, and registered write actions. Report and widget configuration currently supports read-only `select` and `sql` only. Use a backend-owned SQL Resource for complex read-only SQL outside the JSON SELECT allowlist. Do not add another frontend SQL parser or converter.
