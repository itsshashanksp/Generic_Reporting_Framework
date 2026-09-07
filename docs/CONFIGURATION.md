# Configuration reference

All configuration is JSON. Unknown top-level report keys are rejected, and definitions are validated during loading.

## Report definition

| Property | Required | Type/default | Behavior |
| --- | --- | --- | --- |
| `id` | yes | non-empty string | Unique registry and route ID |
| `title` | yes | non-empty string | Page title and default saved-report name |
| `description` | no | string | Supporting page text |
| `request` | exactly one source | JSON request | Active JSON mode |
| `queryDefinition` | exactly one source | `{format:"sql",resource:string}` | Active SQL resource mode |
| `columns` | yes | non-empty array | Grid output columns; fields must be unique |
| `filters` | yes | array | Filter form; use `[]` for none |
| `grid` | no | object | Grid, paging and configured grouping |
| `toolbar` | no | object | Toolbar feature switches |
| `export` | no | object | Export formats/scope |

Omitted report defaults are: all toolbar flags enabled; pagination enabled with page size `50` and options `[25,50,100]`; row selection `single`; each column visible and sortable with width `150`.

## Columns

```json
{ "field": "customer_name", "header": "Customer", "width": 240, "visible": true, "sortable": true }
```

`field` and `header` are required strings. `width` is a positive integer. `visible` and `sortable` are booleans. A hidden column is not created in AG Grid, so it cannot be restored interactively.

## Filters

Each filter requires `field`, `label`, and `type`. Optional properties are `operator`, `options`, `visible` (default `true`), `required` (default `false`), and `placeholder`. `placeholder` applies only to text and number controls. Select options have `{label, value}` where value is a string or number; typed option values must be unique.

| Type | Default operator | Allowed operators |
| --- | --- | --- |
| `text` | `contains` | `equals`, `notEquals`, `contains`, `startsWith`, `endsWith`, `isNull`, `isNotNull` |
| `number` | `equals` | `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between`, `notBetween`, `isNull`, `isNotNull` |
| `select` | `equals` | `equals`, `notEquals`, `isNull`, `isNotNull` |
| `multiselect` | `in` | `in`, `notIn`, `isNull`, `isNotNull` |
| `date` | `equals` | `equals`, `notEquals`, comparison operators, `isNull`, `isNotNull` |
| `daterange` | `between` | `between`, `notBetween`, `isNull`, `isNotNull` |

`select` and `multiselect` require non-empty `options` except for null operators. The runtime maps friendly operators to `=`, `<>`, `>`, `>=`, `<`, `<=`, `LIKE`, `BETWEEN`, `NOT BETWEEN`, `IN`, `NOT IN`, `IS NULL`, and `IS NOT NULL`. Contains/start/end operators add `%` wildcards. Empty controls are omitted. A one-sided date `between` becomes `>=` or `<=`; `notBetween` requires both endpoints. Null filters are applied only when their checkbox is selected.

## Grid

```json
{
  "grid": {
    "pagination": { "enabled": true, "pageSize": 25, "pageSizeOptions": [25, 50, 100] },
    "rowSelection": "multiple",
    "grouping": {
      "enabled": true,
      "groups": [{ "field": "region", "header": "Region" }],
      "aggregates": [{ "field": "amount", "function": "SUM", "alias": "total", "header": "Total" }]
    }
  }
}
```

Pagination fields use positive integers. Row selection is `single` or `multiple`. Group aggregate functions are `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`; `alias` and `header` are optional. Configured grouping changes the displayed column set only—the response must already contain grouped output. There is no interactive grouping builder.

## Toolbar and export

Toolbar boolean keys are `export`, `refresh`, `settings`, and `saveReport`, all defaulting to `true`.

Export requires `enabled`; optional keys are `formats` (non-empty subset of `csv`, `excel`), `filename`, `exportAll`, and `exportCurrentView`. Export controls appear only when both toolbar export and export configuration are enabled.

## Dashboard definition

| Property | Required | Type/default |
| --- | --- | --- |
| `id`, `title` | yes | non-empty strings |
| `description` | no | string |
| `layout` | no | positive `columns`, `tabletColumns`, `mobileColumns`; rendered defaults `12/6/1` |
| `autoRefresh` | no | `{enabled:boolean, interval?:positive integer}`; interval required when enabled |
| `filters` | no | same filter definitions; loader default `[]` |
| `widgets` | yes | array; empty is permitted with a warning |

Every widget requires unique `id`, supported `type`, and `title`. Common optional keys are `description`, positive `width`, positive pixel `height`, `visible`, and `position:{x,y}`. Desktop `x` is zero-based and `y` is a one-based CSS grid row; `x + width` cannot exceed desktop columns. Width defaults to 12. At tablet/mobile breakpoints, explicit positions are ignored and widths are scaled with `ceil`.

## Dashboard widget sources

A `report` widget must have only `reportId`. A `stat`, `table`, or `chart` widget must have exactly one of:

- `request`: inline JSON request.
- `queryDefinition`: inline SQL resource reference.
- `reportId`: reuse a report's request and columns.
- `widgetId`: resolve an external reusable widget definition.

Inline non-report widgets accept `columns`, `filters`, `grid`, and `toolbar` for schema compatibility. Currently the dashboard renderer consumes the normalized request and columns but does not pass widget-level filters, grid, or toolbar to the widget UI. Dashboard-level filters are the active controls.

### Type-specific widget options

| Type | Properties and defaults |
| --- | --- |
| `report` | `reportId`; displays report columns/grid and receives dashboard filters |
| `stat` | `valueField` (otherwise first key), `format`: `number`, `decimal`, or `currency`; Indian locale, currency INR, two fractional digits for decimal/currency |
| `table` | `columns` optional (inferred from first row), `pageSize` default 10, `pageSizeOptions` default `[10,25,50,100]`, optional export; server paging and multiple selection |
| `chart` | `chartType`: `bar` default, `line`, or `pie`; required `xField`, `yField`; `showLegend` false, `showTooltip` true, `showGrid` true, `showLabels` false |

## Reusable widget files

Files under `src/config/widgets/*.json` are auto-discovered for `widgetId` references. The supported reusable definition has `id`, `title`, SQL `queryDefinition`, optional `description`, `columns`, `grid`, `toolbar`, `export`, and a `filters` array (use `[]`). The current repository may use inline dashboard widgets exclusively; the registry remains supported for backward compatibility.

## Menu

`src/config/menu.json` is an array. Each entry requires globally unique `id`, `title`, and icon (`dashboard`, `reports`, `report`, `settings`, or `user`); `visible` defaults true. It must define exactly one of `route`, `reportId`, `dashboardId`, or non-empty `children`. Routes begin with `/`, and registry references must exist.

## Request and response details

See [Query modes](QUERY-MODES.md) for request sections and merge rules. The API response shape is:

```json
{
  "success": true,
  "message": "OK",
  "data": [{ "id": 1 }],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalRows": 1,
    "rowsReturned": 1,
    "executionTime": 12
  }
}
```

Although some TypeScript declarations mark `meta` optional, the response parser currently requires valid metadata for successful runtime responses.

Failed envelopes may include `error:{code,details}`, where each detail is a string or `{path?,message?}`. Transport failures, invalid envelopes, backend failures and cancellations are normalized by the API layer; report/widget views render retryable errors, while an intentional abort is not treated as a new failure.
