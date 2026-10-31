# Configuration reference

The complete cross-scope inventory and automated coverage rules are maintained in the [configuration feature registry](CONFIGURATION-FEATURE-REGISTRY.md). Runtime validators and loaders remain the executable source of truth.

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

### Authoring and validation workflow

The TypeScript types document the supported shape, while the runtime validators
are the authoritative strict authoring schema. They reject unknown keys,
missing core properties, invalid enum values, misplaced widget-only options,
and invalid conditional objects without making optional features mandatory.
This preserves older valid definitions while still catching newly authored
mistakes. Run `npm test -- --run src/config/__tests__/exampleLibrary.test.ts`
to validate every public example and every local `src/config` report,
dashboard, and reusable widget present in the checkout. The same definitions
are validated again by their production loaders. A separate JSON Schema is not
maintained because it would duplicate these executable validators and their
cross-reference checks.

## Report definition

A standalone report owns exactly one primary grid: its top-level `columns`, `grid`, filters, toolbar, request/query definition, and export settings all describe that grid. Dashboard-style arrays of independent report tables are not part of the report schema and are rejected rather than partially rendered. `grid.pagination.pageSize` is optional; normalization supplies the framework default of 10 while preserving any explicitly authored positive value and page-size options.

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
| `databaseSelection` | no | deprecated `true` | Accepted for compatibility. Selector visibility is controlled by the browser-local Settings toggle ([details](#runtime-database-selection)) |

Defaults when omitted: toolbar `export`, `refresh`, and `saveReport` are all `true`; `grid.pagination` is `{ enabled: true, style: "modern", pageSize: 10, pageSizeOptions: [10, 25, 50, 100], showTotalRecords: true, showPageNumbers: true, showFirstLast: false }`; `grid.rowSelection` is `"single"`; each column is `visible: true`, `sortable: true`, `width: 150`.

Modern pagination remains server-side for report and dashboard table requests. `showTotalRecords` displays the backend-provided exact total only; the frontend does not calculate or fabricate a total. `showPageNumbers: false` retains Previous/Next navigation without numbered buttons, and `showFirstLast` controls the optional First/Last buttons. The shared footer responds to its grid container: wide grids show numbered navigation, medium grids wrap it, and narrow grids replace the numbered window with `Page X of Y` while retaining configured First/Last, Previous/Next, and page-size controls. These presentation changes do not change or reset page state. Page-size options must be unique positive integers (at most 20).

In JSON Query mode, `request.sort`, `request.pagination`, and `request.filterLogic` are **rejected** in authored files. The runtime generates them from the top-level `sort`, the grid or widget paging, and the top-level `filterLogic`.

Authored request filters and applied runtime filters are appended to the same flat list. With `AND`, every condition constrains the result. With `OR`, every authored and runtime condition is an alternative; authored conditions do not remain mandatory. Valid mixed-source `OR` configurations are preserved and produce a configuration warning rather than being rewritten or rejected. Grouped Boolean expressions are not supported.

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
| `dataType` | no | `text`, `number`, `currency`, `percentage`, `boolean`, `date`, `datetime`. All headers remain left-aligned; number/currency/percentage cells are right-aligned automatically. INR currency uses `₹`, `en-IN` grouping, and compact lakh/crore notation while preserving raw values. Date/datetime formatting does not convert timezones or change row data. `null` renders as an em dash |
| `currency` | no | three-letter uppercase ISO 4217 display code for a `currency` column; default `INR`. This changes presentation only and never converts values |

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
- Dates stay as `YYYY-MM-DD` strings and no database-specific date conversion happens.
- Date ranges must be completely empty (when optional) or contain two valid dates in chronological order. Numeric `between` and `notBetween` filters likewise require two finite numbers with the lower value not greater than the upper value. Partial, invalid, and reversed ranges are rejected before requests are sent; they are never converted to one-sided conditions.
- A filter cannot combine `visible: false` with `required: true`. The current filter schema has no default-value property, so there would otherwise be no supported way for the user to satisfy it. Hidden optional filters remain valid.
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

If an option request fails, the control shows an accessible **Retry** action. Retry uses the current request definition and effective database, preserves current filter values, and remains covered by the normal in-flight deduplication. It is never automatic.

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
      "aggregates": [{ "field": "amount", "function": "SUM", "header": "Total" }],
      "expandedByDefault": true,
      "showSubtotals": true,
      "showGrandTotal": true,
      "showGroupTotalsInHeader": true,
      "subtotalPosition": "bottom",
      "exportMode": "grouped"
    }
  }
}
```

The pagination values are positive integers. `rowSelection` is `single` or `multiple`; no workflow currently uses the selected rows. When grouping is omitted or disabled, the standard server-paged grid is unchanged.

Enabled grouping creates nested, expandable presentation groups from ordinary result rows. At least one unique `groups` field is required. Group and aggregate fields must reference configured columns. The aggregate functions are `COUNT`, `SUM`, `AVG`, `MIN`, and `MAX`; `alias` and `header` remain optional for legacy compatibility. `COUNT` counts non-null values. The numeric functions use finite numbers and numeric strings and ignore null, empty, non-numeric, and non-finite values.

`expandedByDefault`, `showSubtotals`, and `showGrandTotal` default to `true`; `showGroupTotalsInHeader` defaults to `false`; `subtotalPosition` defaults to `bottom`. When header totals are enabled, the existing group aggregates are displayed in their configured columns for both expanded and collapsed groups. They are informational and do not add aggregation inputs or exported rows.

Generated group/detail/subtotal rows use client pagination, while the grand total remains outside that pagination. Dashboard reporting grids use the shared stable table viewport so expanding, collapsing, or paging does not move adjacent dashboard content; long results scroll internally, column headings and the grand total remain sticky, and pagination stays below the scrolling body. Collapsed groups may leave intentional empty viewport space. Content-aware group/numeric widths protect totals while descriptive columns flex and use an accessible full-value title; narrow viewports scroll inside the grid only when the calculated minimum cannot fit. Standalone reports retain natural height unless explicitly bounded. The frontend obtains the complete filtered result through the existing bounded all-row paging flow before computing totals, and fails safely if the result exceeds the 100,000-row export bound or paging metadata is inconsistent. It does not change the backend query grammar or inject `groupBy`.

`exportMode` defaults to `source`. `grouped` exports the complete generated group/subtotal/grand-total result; `source` exports the complete filtered source rows. Reporting grids suppress current-page export because their visible page contains generated rows owned by the presentation component. Use configured all-row export instead. See `examples/reports/reporting-grid-report.json`.

### Runtime database selection

```json
{
  "request": { "action": "select", "source": { "table": "ItemMasterTable" }, "fields": ["Item_Code", "Item_Desc"] },
  "databaseSelection": true
}
```

- Enable page switching once under **Settings → Database Selection → Enable Page-Level Database Selection**. IDs and display names are never registered in frontend configuration; `metadata.databases` is the only option source.
- An authorized explicit report database initializes a report selector, followed by the browser-local global default and then the backend registry default. A manual page choice overrides that initial value. A switchable report may omit `request.database` / `queryDefinition.database`, because the selected backend ID is supplied at runtime.
- Legacy `databaseSelection: true` remains valid but is deprecated and does not override an explicitly disabled Settings toggle. Any other value remains invalid.
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
| `filters` | no | the same filter definitions as reports; default `[]`. Optional `targetGrids` limits a page filter to stable table/report widget IDs; omission preserves shared behavior |
| `widgets[].pageFilterExclusions` | no | dashboard filter field names omitted from this widget only; default `[]`. Entries must be unique fields declared by the same dashboard. Works for stat, table, chart, report, JSON Query, and SQL Resource widgets |
| `dateFilterBehavior` | no | `"required"` or `"optional"`; needs a shared `daterange` filter ([details](DASHBOARDS.md#date-filter-behavior)) |
| `databaseSelection` | no | deprecated `true`; accepted for compatibility but Settings controls selector visibility ([details](DASHBOARDS.md#database-selector)) |
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
| `valueField`, `format`, `currency` | `stat` | `valueField` defaults to the first key of the first row. `format`: `number`, `decimal`, `currency`, or `percentage`. Optional `currency` is an ISO 4217 code used only with currency format; default `INR`. Presentation never converts the source value |
| `pageSize`, `pageSizeOptions`, `pagination`, `export` | `table` | Legacy defaults are `10` and `[10, 25, 50, 100]`. Optional `pagination` supports `style: "modern"`, `pageSize`, `pageSizeOptions`, `showTotalRecords`, `showPageNumbers`, and `showFirstLast`. `pagination.pageSize` and `pagination.pageSizeOptions` take precedence over the legacy sibling properties. Columns are inferred from the first row when omitted |
| `runtimeFilterDisplay` | all | Optional `"inline"` (default) or `"dialog"`. Dialog edits are drafts until Apply; Cancel, Close, or Escape discards unapplied edits |
| `chartType`, `xField`, `yField`, `chartOptions`, `showLegend`, `showTooltip`, `showGrid`, `showLabels`, `export` | `chart` | `chartType` supports `bar` (default), `line`, `area`, `pie`, `doughnut`, `treemap`, and `radial-bar`. `xField` and `yField` retain their category/value meaning. Legacy Pie with `chartOptions.appearance: "donut"` normalizes to Doughnut. Legacy Funnel loads as an unsupported state and cannot be newly saved. The UI presents vertical `bar` as **Column** and horizontal `bar` as **Bar**; existing `chartOptions.orientation` remains canonical and is not rewritten merely by loading. |

Chart `chartOptions` supports legacy `appearance: "pie" | "donut"`, `orientation: "vertical" | "horizontal"`, `numberFormat: "full" | "compact" | "compact-indian"`, `valueFormat: "number" | "decimal" | "currency"`, optional ISO 4217 `currency` (default `INR`), `showLegend`, `showLabels`, `showDataLabels`, `showCenterTotal`, `showGrid`, `smooth`, `showPoints`, `topN` (1–100), `showOthers`, `othersLabel`, `seriesColors`, and `categoryColors`. Axes default to compact Indian units (`K`, `L`, `Cr`); tooltips always show full `en-IN` values. CSV/Excel exports retain source numbers and no conversion is performed.

Column and horizontal Bar charts display compact formatted values by default. Line and Area display direct values for up to eight points; denser trends retain the complete persistent accessible category/value summary. Pie, Doughnut, Treemap, and Radial Bar charts enable a category legend by default when neither legend flag is authored. Their complete category, full value, and percentage data is also exposed to assistive technology. Pie and Doughnut additionally enable collision-aware `Category: value` labels by default; small or colliding slices remain identifiable through the legend and full-value tooltip. Set `showLegend: false` or `showLabels: false` (including the legacy `showDataLabels: false`) to override those defaults.

Dashboard rendering and the Customize preview share the same chart renderer. Pie always uses a zero inner radius; Doughnut uses a visible center hole, including after repeated type changes. Dense Column, Line, and Area charts receive a bounded horizontal canvas only when their category spacing would become unreadable. Horizontal Bar charts use bounded vertical scrolling when many categories exceed the available height. Cartesian domains, first/last category padding, and type-specific margins reserve room for signed endpoint labels and top labels; switching chart type or orientation recalculates the viewport and resets stale chart scroll without affecting ordinary data refreshes. Proportional, Treemap, and Radial Bar charts adapt in place. In narrow proportional charts, direct labels are reduced while the category legend, tooltip, and accessible summary remain available. These policies are automatic and add no JSON properties.

`seriesColors` maps a bar or line chart's stable `yField` to a six-digit HEX color. `categoryColors` maps pie/donut category values (the raw `xField` values) to colors. Both properties are optional; missing entries use the built-in palette. Application Administrators use the dedicated **Customize** action to preview a compatible `bar`, `line`, or `pie` type and edit colors without refetching data; exports remain under **Export** grouped into Chart Image and Chart Data. Saving persists chart type and both color maps through the authorized configuration API, updates only the selected widget, and rejects stale revisions. Deployments must set `GENERIC_FRONTEND_DASHBOARD_CONFIG_DIR` on the backend API worker to the dashboard JSON directory. Reset selects the recoverable authored type/colors as a draft and persists them only when Save is pressed. The backend may add `chartCustomizationDefaults` to local runtime JSON while overrides exist; this snapshot is backend-owned and removed after reset.

Top-N aggregates duplicate category names, ranks signed aggregate values descending, and resolves ties by first appearance. Null/empty categories use `Uncategorized`; missing numeric values do not contribute. When enabled, `Others` is the signed sum of remaining categories, so positive and negative values may offset. The query response is never mutated and backend paging/filtering is unchanged.

Pie/donut charts do not render negative values as positive slices. When any displayed value is negative, the widget explains that a signed bar or line chart is required. All-zero pie data also produces a clear empty visualization. Bar and line charts preserve signed values and include zero in their numeric domain. Missing line values remain gaps and are not interpolated.

Chart export accepts `png`, `svg`, `csv`, and `excel`. PNG and SVG export the displayed chart, including presentation transformations. CSV and Excel export the complete filtered source chart rows using the configured `xField` and `yField`, even when Top-N/Others is displayed. Existing spreadsheet formula-injection protection and typed Excel numeric cells are reused. No additional backend request is made.

### Widget presentation switching

Table and chart widgets may opt into identity-preserving presentation switching with `presentation`. Switching is exposed through the widget's single **Customize Widget** dialog alongside settings for the selected table or chart view; there is no second presentation dropdown. Existing widgets need no migration and render exactly as before when this property is absent or `allowSwitching` is `false`, including the legacy authorized chart-customization dialog.

```json
{
  "presentation": {
    "allowSwitching": true,
    "defaultView": "table",
    "allowedViews": ["table", "column", "bar", "pie", "doughnut"],
    "table": {
      "columns": [
        { "field": "Category", "header": "Category", "dataType": "text" },
        { "field": "Value", "header": "Value", "dataType": "currency" }
      ],
      "pagination": { "pageSize": 10, "pageSizeOptions": [10, 25, 50] },
      "export": { "enabled": true, "formats": ["csv", "excel"] }
    },
    "chart": {
      "xField": "Category",
      "yField": "Value",
      "chartOptions": { "valueFormat": "currency" },
      "export": { "enabled": true, "formats": ["png", "svg", "csv", "excel"] }
    }
  }
}
```

`column` is the shared Bar renderer with vertical orientation; `bar` is horizontal. Supported views are `table`, `column`, `bar`, `line`, `area`, `pie`, `doughnut`, `treemap`, and `radial-bar`. A table view requires authored column metadata. When columns are supplied for a chart source, `xField` must reference a category column and `yField` must reference a `number`, `currency`, or `percentage` column. Line and Area additionally require a date, datetime, or numeric category. No aggregation is inferred.

A table-origin chart must define `presentation.chart.request` or `presentation.chart.queryDefinition`. This mandatory separate complete/aggregated source prevents a server-paged table from being misrepresented as a chart of only its current page. The frontend never performs an unrestricted fetch-all. Chart-origin table views may reuse the chart's complete intended request and paginate it normally. Presentation-specific requests pass through the same SQL Resource/JSON Query validation, database inheritance, filters, permissions, caching, cancellation, and stale-response protection as ordinary widgets.

The universal dialog is also used by legacy dashboard table and chart widgets, without enabling cross-presentation switching unless their configuration permits it. Chart drafts preview through the normal presentation resolver, filters, database inheritance, request cache, and shared chart renderer. Table mode intentionally opens directly on settings and performs no preview request; the real table continues using server-side pagination. **Cancel** discards the draft, **Save Changes** applies the selected view and its table/chart settings without resetting the current table page, and **Reset to Default** restores authored defaults as a draft. Table page, page size, sorting, and column visibility remain controller-owned while chart views are active. Authorized chart colors and supported chart presentation settings continue to use the existing dashboard/widget persistence endpoint. Page-filter exclusions and widget runtime filters remain widget-level and therefore apply to every view. Table and chart export blocks are independent, so image formats never leak into table export and table-only options never appear in chart export. See [`examples/dashboards/presentation-switching-dashboard.json`](../examples/dashboards/presentation-switching-dashboard.json).

Chart tooltips use the same boundary-aware renderer in widgets and customization previews. Full category/value text is preserved, while placement flips and clamps to the visible chart viewport so long content is not clipped by card or chart scrolling boundaries.

### Reusable widget files

A file in `src/config/widgets/*.json` has `id`, `title`, one query source, and `filters` (use `[]`). Optional keys are `description`, `columns` (optional here, unlike in reports), `sort`, `filterLogic`, `grid`, `toolbar`, and `export`. It is loaded by the same report-definition pipeline with `columnsRequired: false`. Example: [`examples/widgets/customer-summary.json`](../examples/widgets/customer-summary.json).

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
