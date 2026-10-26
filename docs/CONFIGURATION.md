# Configuration reference

The frontend has two kinds of configuration:

1. **Environment variables**, read by Vite at build time.
2. **JSON definitions** in `src/config/`, bundled at build time and validated when they load. Unknown properties are rejected, so a misspelled or misplaced key fails with an error instead of being silently ignored.

Authenticated users can also choose a frontend-wide default under **Settings → Database Selection**. The choice is stored per username in browser storage and is accepted only after the current `metadata.databases` response confirms that it is enabled, available, and authorized. **Use Backend Default** removes the choice and preserves the backend's normal fallback.

Validated example files for every definition type are in [`examples/`](../examples/). [Examples](EXAMPLES.md) shows the requests they produce.

## Environment variables

| Name | Purpose | Default | Required | Format | Consumed by |
| --- | --- | --- | --- | --- | --- |
| `VITE_API_URL` | The single endpoint for every API call | `/api` (when empty or unset) | No | A same-origin path (`/api`) or an absolute http(s) URL | `src/api/client.ts`; production check in `vite.config.ts` → `tooling/productionApiUrl.ts` |

This is the only variable the source reads; there are no other `VITE_*` references.

- **Build-time only.** Vite inlines the value into the JavaScript bundle. Changing it requires a rebuild, and there is no runtime configuration file.
- **Public.** Every `VITE_*` value ends up in the browser bundle. Never put secrets in one (`.env.example` says the same).
- **Files.** `.env.example` (committed) holds the development value `http://localhost:8000/index.php`. `.env.production` (committed) holds `/api` for `vite build`. Local `.env` and `.env.*.local` files are git-ignored.
- **Production rule.** `npm run build` fails if the value is a loopback host, invalid, has surrounding whitespace, or uses a non-http(s) scheme.
- **Development.** When both the page and the API are on `localhost` or `127.0.0.1`, the client rewrites the API host to match the page, so the `SameSite=Lax` session cookie is still sent.

Other settings that live in source rather than in the environment:

| Setting | File | Effect |
| --- | --- | --- |
| `APPLICATION_VERSION` | `src/config/version.ts` | Version label shown in the sidebar and on the login page (currently `1.0.0-dev`) |
| `frontendCapabilities` | `src/config/frontendCapabilities.ts` | Which roles User Management can assign (see [Authentication](AUTHENTICATION.md#roles-in-this-frontend)) |

## Definition files

| Path | Discovered by | Contents |
| --- | --- | --- |
| `src/config/reports/*.json` | `engine/ReportEngine/reportLoader.ts` | One report per file. The `id`, not the filename, is the route ID (`/report/<id>`) |
| `src/config/dashboards/*.json` | `engine/DashboardEngine/dashboardLoader.ts` | One dashboard per file (`/dashboard/<id>`) |
| `src/config/widgets/*.json` | `engine/WidgetEngine/widgetLoader.ts` | Optional reusable widget data definitions, referenced by `widgetId`. None are checked in |
| `src/config/menu.json` | `engine/NavigationEngine/loader.ts` | Sidebar navigation |

Recommended key order (it is not enforced): reports use `id`, `title`, `description`, `request` or `queryDefinition`, `columns`, `sort`, `filters`, `filterLogic`, `grid`, `toolbar`, `export`; dashboards use `id`, `title`, `description`, `layout`, `autoRefresh`, `dateFilterBehavior`, `filters`, `widgets`.

## Report definition

Validated by `getReportValidationErrors` in `engine/ReportDefinitionEngine/validator.ts`. Defaults come from `ReportDefinitionEngine/defaults.ts` and `ColumnEngine/defaults.ts`.

| Property | Required | Type / default | Behavior |
| --- | --- | --- | --- |
| `id` | yes | non-empty string | Unique registry and route ID |
| `title` | yes | non-empty string | Page title, and the default saved-view name |
| `description` | no | string | Supporting page text |
| `request` | exactly one of these two | JSON Query request | JSON Query mode ([Query modes](QUERY-MODES.md#json-request-mode)) |
| `queryDefinition` | exactly one of these two | `{ format: "sql", resource, database? }` | SQL Resource mode ([Query modes](QUERY-MODES.md#sql-resource-mode)) |
| `columns` | yes | non-empty array | Grid output columns. Fields must be unique and match the response keys |
| `filters` | yes | array | Filter form controls. Use `[]` when there are none |
| `sort` | no | `{ field, direction: "ASC" \| "DESC" }[]` | Initial sort in either mode. In SQL Resource mode, each field must be a displayed column |
| `filterLogic` | no | `"AND"` \| `"OR"` | How the applied filters are combined (one flat level) |
| `grid` | no | object | Paging, row selection, grouping display |
| `toolbar` | no | object | Toolbar switches |
| `export` | no | object | Export formats and scope |
| `databaseSelection` | no | `true` | Uses the authorized backend database list for runtime switching ([details](#runtime-database-selection)) |

Defaults when omitted: toolbar `export`, `refresh`, and `saveReport` are all `true`; `grid.pagination` is `{ enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50, 100] }`; `grid.rowSelection` is `"single"`; each column is `visible: true`, `sortable: true`, `width: 150`.

In JSON Query mode, `request.sort`, `request.pagination`, and `request.filterLogic` are **rejected** in authored files. The runtime generates them from the top-level `sort`, the grid or widget paging, and the top-level `filterLogic`.

### Columns

```json
{ "field": "Item_Desc", "header": "Item Description", "width": 320, "visible": true, "sortable": true, "dataType": "text" }
```

| Key | Required | Notes |
| --- | --- | --- |
| `field` | yes | Response object key |
| `header` | yes | Column header and mobile label |
| `width` | no | Positive integer (pixels); default 150 |
| `visible` | no | `false` means AG Grid never creates the column, so the user cannot restore it |
| `sortable` | no | Whether the header can be sorted |
| `dataType` | no | `text`, `number`, `boolean`, `date`, `datetime`. Needed to format numeric strings and to sort them numerically. Date/datetime formatting does not convert timezones or change row data. `null` renders as an em dash |

### Filters

Each filter requires `field`, `label`, and `type`. The optional keys are `operator`, `options` **or** `dynamicOptions` (not both), `visible` (default `true`), `required` (default `false`), and `placeholder` (text and number controls only). Validated by `engine/FilterEngine/validator.ts`.

| Type | Default operator | Allowed operators |
| --- | --- | --- |
| `text` | `contains` | `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `notStartsWith`, `endsWith`, `notEndsWith`, `isNull`, `isNotNull` |
| `number` | `equals` | `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `between`, `notBetween`, `isNull`, `isNotNull` |
| `select` | `equals` | `equals`, `notEquals`, `isNull`, `isNotNull` |
| `multiselect` | `in` | `in`, `notIn`, `isNull`, `isNotNull` |
| `boolean` | `equals` | `equals`, `notEquals`, `isNull`, `isNotNull` |
| `date` | `equals` | `equals`, `notEquals`, comparison operators, `isNull`, `isNotNull` |
| `daterange` | `between` | `between`, `notBetween`, `isNull`, `isNotNull` |

- `select` and `multiselect` need non-empty `options` or `dynamicOptions`, except with the null operators. Static options are `{ label, value }`, where `value` is a string, number, or boolean. Values must be unique.
- Serialization: friendly operators map to `=`, `<>`, `>`, `>=`, `<`, `<=`, `LIKE`, `NOT LIKE`, `BETWEEN`, `NOT BETWEEN`, `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL`. The contains/starts/ends variants add `%` wildcards. Numbers are sent as numbers and booleans as booleans. Empty controls are omitted, and null filters omit `value`.
- Dates stay as `YYYY-MM-DD` strings. A complete `between` range sends both dates. A one-sided range becomes `>=` or `<=`, unless a dashboard's `dateFilterBehavior` or `required` demands both dates. `notBetween` always needs both. No database-specific date conversion happens.
- In SQL Resource mode, a filter whose `field` is not a displayed column is still allowed: the loader adds a source mapping for it. Filter fields and display columns are independent.

#### Dynamic options

A `select` or `multiselect` filter can load its choices from a JSON Query request instead of static `options`. It works with both report modes and on dashboards, because the options request is separate from the data request.

```json
{
  "field": "UserName",
  "label": "User Name",
  "type": "select",
  "dynamicOptions": {
    "request": {
      "action": "select",
      "source": { "table": "ItemMasterTable" },
      "fields": ["UserName", { "function": "COUNT", "field": "*", "alias": "Frequency" }],
      "groupBy": ["UserName"],
      "sort": [{ "field": "Frequency", "direction": "DESC" }],
      "limit": 1000
    },
    "valueField": "UserName",
    "countField": "Frequency",
    "searchable": true
  }
}
```

| Key | Required | Notes |
| --- | --- | --- |
| `request` | yes | Must be a JSON Query with `action: "select"`, a `source` object, and a `fields` array. Unlike a report's `request`, it may contain `sort`; use `limit` to bound the result |
| `valueField` | yes | Row key used as the option value. Rows whose value is not a string, number, or boolean are skipped |
| `labelField` | no | Row key used as the label (defaults to the value) |
| `countField` | no | Numeric row key. Options are sorted by descending count, then by label |
| `searchable` | no | Shows the option search box unless it is `false` |
| `searchPlaceholder` | no | Defaults to `Search <label>` |

Duplicate values are collapsed. Results are cached under the `dynamic-filter-options` scope (see [Feature behavior](FEATURES.md#request-caching)). Consumer: `components/Filters/useDynamicFilterOptions.ts`.

### Grid

```json
{
  "grid": {
    "pagination": { "enabled": true, "pageSize": 10, "pageSizeOptions": [10, 25, 50, 100] },
    "rowSelection": "multiple",
    "grouping": {
      "enabled": true,
      "groups": [{ "field": "region", "header": "Region" }],
      "aggregates": [{ "field": "amount", "function": "SUM", "alias": "total", "header": "Total" }]
    }
  }
}
```

The pagination values are positive integers. `rowSelection` is `single` or `multiple`; no workflow currently uses the selected rows. The aggregate functions are `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`; `alias` and `header` are optional. **Grouping is display-only**: it replaces the displayed column set, but the response must already contain the grouped output. Put the grouping itself in the JSON `groupBy` or in the SQL Resource.

### Runtime database selection

```json
{
  "request": { "action": "select", "source": { "table": "ItemMasterTable" }, "fields": ["Item_Code", "Item_Desc"] },
  "databaseSelection": true
}
```

- `true` opts in. IDs and display names are never registered in frontend configuration; `metadata.databases` is the only option source.
- An authorized explicit report database initializes a report selector, followed by the browser-local global default and then the backend registry default. A manual page choice overrides that initial value. A switchable report may omit `request.database` / `queryDefinition.database`, because the selected backend ID is supplied at runtime.
- Omit `databaseSelection` to keep the report on its configured database, as before. Reusable widget files accept the key but ignore it, and dashboard widgets reject it. Dashboards have their own dashboard-level form ([Dashboards](DASHBOARDS.md#database-selector)).
- Any value other than `true`, including the former `{ databases: [...] }` shape, is rejected.
- Example: [`examples/reports/database-selector-report.json`](../examples/reports/database-selector-report.json). Runtime behavior: [Feature behavior](FEATURES.md#database-selector).

The Settings default fills only otherwise omitted database values. For a switchable report, explicit JSON initializes the selector ahead of the global and metadata defaults; a manual page choice then wins. On dashboards, explicit widget databases remain pinned, dashboard runtime selection controls unpinned widgets, and an authorized global value initializes that selector ahead of the metadata default. Dynamic filter requests follow the same effective database unless they specify their own.

### Toolbar and export

- `toolbar`: the boolean keys `export`, `refresh`, and `saveReport`, all `true` by default.
- `export`: requires `enabled` and `formats` (a non-empty subset of `"csv"` and `"excel"`). Optional keys are `filename` (without an extension), `exportCurrentView` (shown unless it is `false`), and `exportAll` (shown only when it is `true`).
- Export controls appear only when both `toolbar.export` and `export.enabled` are true. Behavior and limits: [Feature behavior](FEATURES.md#exports).

## Dashboard definition

Validated by `validateDashboard` in `engine/DashboardValidator.ts`. Allowed top-level keys: `id`, `title`, `description`, `layout`, `autoRefresh`, `filters`, `dateFilterBehavior`, `widgets`.

| Property | Required | Type / default |
| --- | --- | --- |
| `id`, `title` | yes | non-empty strings |
| `description` | no | string |
| `layout` | no | positive integers `columns`, `tabletColumns`, `mobileColumns`; rendered defaults `12`/`6`/`1` |
| `autoRefresh` | no | `{ enabled?: boolean, interval?: positive integer (ms) }`; `interval` is required when `enabled` is `true` |
| `filters` | no | the same filter definitions as reports; default `[]`. They are shared by every widget |
| `dateFilterBehavior` | no | `"required"` or `"optional"`; needs a shared `daterange` filter ([details](DASHBOARDS.md#date-filter-behavior)) |
| `databaseSelection` | no | `true`: an authorized backend-driven database switch for widgets that name no database of their own ([details](DASHBOARDS.md#database-selector)) |
| `widgets` | yes | array. An empty array is allowed but produces a warning |

### Widgets

Every widget requires a unique `id`, a `type` (`report`, `stat`, `table`, `chart`), and a `title`.

| Key | Applies to | Notes |
| --- | --- | --- |
| `description`, `visible` | all | `visible: false` omits the widget |
| `width` | all | Positive integer in desktop columns; default 12 |
| `height` | all | Positive integer in pixels |
| `position` | all | `{ x, y }`: `x` is zero-based, `y` is a one-based CSS grid row, and `x + width` must not exceed `layout.columns`. Ignored at tablet and mobile widths |
| `filterFields` | all | Renames shared filter fields for this widget ([details](DASHBOARDS.md#per-widget-filter-fields)) |
| `runtimeFilters` | all | Optional widget-local runtime controls using the standard filter definition shape. They affect only this widget ([details](DASHBOARDS.md#widget-level-runtime-filters)) |
| `reportId` | `report` (required); `stat`/`table`/`chart` (one source) | Reuses a report definition |
| `request` / `queryDefinition` / `widgetId` | `stat`/`table`/`chart` | Exactly one source in total, counting `reportId` |
| `columns`, `sort`, `grid`, `toolbar`, `filters` | inline `stat`/`table`/`chart` | Same shapes as in reports. Dashboard-level filters are the active controls |
| `valueField`, `format` | `stat` | `valueField` defaults to the first key of the first row. `format`: `number`, `decimal`, or `currency` (`en-IN` locale, INR; decimal and currency use two fraction digits) |
| `pageSize`, `pageSizeOptions`, `export` | `table` | Defaults `10` and `[10, 25, 50, 100]`. Columns are inferred from the first row when omitted |
| `chartType`, `xField`, `yField`, `showLegend`, `showTooltip`, `showGrid`, `showLabels` | `chart` | `chartType` is `bar` (default), `line`, or `pie`. `xField` and `yField` are required. Defaults: legend `false`, tooltip `true`, grid `true`, labels `false` |

### Reusable widget files

A file in `src/config/widgets/*.json` has `id`, `title`, one query source, and `filters` (use `[]`). Optional keys are `description`, `columns` (optional here, unlike in reports), `sort`, `filterLogic`, `grid`, `toolbar`, and `export`. It is loaded by the same report-definition pipeline with `columnsRequired: false`. Example: [`examples/widgets/item-stock-value-by-category.json`](../examples/widgets/item-stock-value-by-category.json).

## Menu

`src/config/menu.json` is an array of entries:

| Key | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique across the whole menu |
| `title` | yes | Sidebar label |
| `icon` | yes | `dashboard`, `reports`, `report`, `settings`, or `user` |
| `visible` | no | Default `true` |
| `route` / `reportId` / `dashboardId` / `children` | exactly one | `route` must start with `/`. `reportId` and `dashboardId` must match a **successfully loaded** definition. `children` is a non-empty array |

The validator accepts deeper nesting, but the sidebar renders only one child level, so keep menus one level deep. `/` redirects to the first visible `dashboardId` entry. An invalid menu stops the application at startup.

## Common mistakes

These are the actual validator messages:

| Mistake | Message |
| --- | --- |
| Both `request` and `queryDefinition` | `Report must contain exactly one of request or queryDefinition.` |
| `sort` inside `request` | `Report request sort must be configured at top-level sort.` |
| `pagination` inside `request` | `Report request pagination must be configured in frontend pagination settings.` |
| `filters` omitted | `Report filters must be an array.` |
| Resource ID with `.sql` or a path | `Report queryDefinition resource must be a safe backend resource identifier.` |
| `queryDefinition.format: "json"` | `Report queryDefinition format must be sql.` |
| Database ID with capitals or spaces | `Report request database must be a logical database id (lowercase letters, digits, "_" or "-", starting with a letter).` |
| SQL Resource sort on a non-displayed field | `Report sort field at index 0 must reference a displayed column.` |
| Old or unknown key, such as `filterable` on a column | `Report column at index 0 contains unknown property "filterable".` |
| Widget with two sources | `stat widget "total-sales" requires exactly one of queryDefinition, widgetId, reportId, or request.` |
| Widget overflowing the grid | `Widget "sales-month-wise" position and width exceed dashboard columns (12).` |
| `autoRefresh.enabled` without `interval` | `Dashboard autoRefresh interval is required when auto refresh is enabled.` |
| `"optional"` with a required range | `Dashboard dateFilterBehavior "optional" conflicts with required daterange filter "Bill_Date"; remove one.` |
| `dateFilterBehavior` without a shared range | `Dashboard dateFilterBehavior "required" requires at least one shared daterange filter.` |
| `filterFields` mapping a field to itself | `Widget "purchases-month-wise" filterFields maps "Bill_Date" to itself; remove the mapping.` |

The following are **not** configuration properties, and using them is rejected: `autoHeight`, `autoWidth`, `minHeight`, `minWidth`, `colSpan`, `size`, `showSavedReports`, report `icon`, toolbar `search`, column `filterable`/`exportable`/`type`, filter `format`, and widget `value`.

## Response shape

Every successful read must return:

```json
{
  "success": true,
  "message": "OK",
  "data": [{ "id": 1 }],
  "meta": { "page": 1, "pageSize": 10, "totalRows": 1, "rowsReturned": 1, "executionTime": 12 }
}
```

`page`, `pageSize`, and `executionTime` may be `null`. The counts must be non-negative numbers. Failures may include `error: { code, details }`. See [API reference](API-REFERENCE.md#standard-response).
