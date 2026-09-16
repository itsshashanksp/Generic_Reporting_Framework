# Configuration format

All files in this directory use the runtime configuration schema. Unknown
properties are rejected so misspellings and misplaced settings fail during
configuration loading.

The reporting runtime supports two data modes while sharing the same filters,
grid, toolbar, export, cache, cancellation, and response handling.

## Query modes

JSON Query mode uses the backend's public SELECT request in `request`:

```json
{
  "request": {
    "action": "select",
    "source": { "table": "CustomerTable" },
    "fields": ["Cust_Name"]
  }
}
```

It is sent unchanged, apart from the existing runtime filter, sort, and
pagination merge, and is handled by the backend `QueryController`.

Backend SQL mode uses only a discovered logical resource identifier:

```json
{
  "queryDefinition": {
    "format": "sql",
    "resource": "reports/item"
  },
  "columns": [{ "field": "Item_Code", "header": "Item Code" }],
  "filters": [],
  "sort": [{ "field": "Item_Code", "direction": "ASC" }]
}
```

The loader derives the SQL API execution columns/filter mappings from the
top-level presentation fields and copies top-level `sort` into the request.
`reports/item` is
relative to the backend discovery root, without `.sql`; the frontend never
constructs that path. The frontend neither loads nor
parses SQL and never sends SQL text. Report JSON continues to own UI metadata.
A report must define exactly one of `request` or `queryDefinition`.

## Canonical order

Report files use this top-level order: `id`, `title`, `description`,
`queryDefinition` or `request`, `columns`, `sort`, `filters`, `grid`, `toolbar`,
`export`.

Dashboard files use: `id`, `title`, `description`, `layout`, `autoRefresh`,
`filters`, `widgets`. Each widget starts with `id`, `type`, `title`, and
`description`, followed by layout, its inline definition or widget/report
reference, and type-specific presentation settings.

## Supported report presentation

- Column: `field`, `header`, `visible`, `sortable`, `width`.
- Filter: `field`, `label`, `type`, `operator`, `options`, `visible`, `required`, `placeholder`.
- Grid: `pagination` (`enabled`, `pageSize`, `pageSizeOptions`), `rowSelection`, and `grouping` (`enabled`, `groups`, `aggregates`).
- Toolbar: `export`, `refresh`, `saveReport`.
- Export: `enabled`, `formats`, `filename`, `exportAll`, `exportCurrentView`.

Column visibility remains a frontend grid concern. It does not alter either a
Universal JSON projection or a backend SQL resource.

## Dashboards and widgets

- Layout: `columns`, `tabletColumns`, `mobileColumns`.
- Auto refresh: `enabled`, `interval`.
- Filters use the same schema and behavior as report filters.
- A `select` or `multiselect` filter may replace static `options` with
  `dynamicOptions`. Its reviewed JSON Query request should return one row per
  value (normally with `groupBy`), and may return a frequency field produced by
  `COUNT`. `valueField`, optional `labelField`, and optional `countField` map
  those rows into searchable choices. Choices are cached by request, sorted by
  descending frequency, and selection still updates the normal filter state.
  Because this request is independent of the report data request, it also works
  for SQL Resource reports and dashboard widgets without exposing SQL or table
  names to the filter UI.

```json
{
  "field": "Category",
  "label": "Category",
  "type": "select",
  "dynamicOptions": {
    "request": {
      "action": "select",
      "source": { "table": "Inventory" },
      "fields": [
        "Category",
        { "function": "COUNT", "field": "*", "alias": "Frequency" }
      ],
      "groupBy": ["Category"],
      "sort": [{ "field": "Frequency", "direction": "DESC" }],
      "limit": 100
    },
    "valueField": "Category",
    "countField": "Frequency",
    "searchable": true
  }
}
```

Filter fields and display columns are independent. In SQL Resource mode, the
runtime derives a constrained source-filter mapping for a filter-only field; it
does not need to be added to `columns`.
- Report widget: `reportId`.
- Stat widget: inline SQL `queryDefinition`/JSON `request`, or `widgetId`/compatible `reportId`, plus `valueField` and `format`.
- Table widget: inline SQL `queryDefinition`/JSON `request`, or `widgetId`/compatible `reportId`, plus `columns`, `pageSize`, `pageSizeOptions`, and `export`.
- Chart widget: inline SQL `queryDefinition`/JSON `request`, or `widgetId`/compatible `reportId`, plus `xField`, `yField`, `chartType`, `showLegend`, `showTooltip`, `showGrid`, and `showLabels`.

Data-driven widgets may contain their full definition inline. Inline definitions
are loaded by the same report-definition pipeline as reusable widget files.
`widgetId` values resolve through the widget loader. Each widget selects exactly one data source. Both forms use the
same two request modes as reports; SQL-backed widgets contain a backend resource
ID, not a frontend `.sql` file. Dashboard JSON continues to own layout and
instance presentation. Table pagination is merged into the resolved request at
runtime. Stat definitions need no `columns`; table definitions can retain them
for table presentation.

Configuration directories have explicit responsibilities: `reports/` contains
standalone report JSON, `dashboards/` contains dashboard layout plus optional
inline widget definitions, and `widgets/` contains reusable widget JSON. SQL
files live only in the backend controlled resource directories.

## Navigation

Each menu item supports `id`, `title`, `icon`, `visible`, and exactly one of
`route`, `reportId`, `dashboardId`, or `children`. Routes must start with `/`.
Report and dashboard references are checked against loaded configuration IDs;
filenames are not routing IDs.

## Current runtime boundaries

The existing report runtime sends filters, sort, pagination, and `filterLogic`
when present. Authored grouping stays in the query/resource and grid grouping
stays presentation-side. Search state and AG Grid column filters are not wired
into report API requests today, so SQL mode does not claim server support for
them. Selection and column visibility are client-side UI state.

The runtime does not expose `autoHeight`, `autoWidth`, `minHeight`, `minWidth`,
`colSpan`, `size`, or `showSavedReports`. The former type-only fields `icon`
(report), `search` (toolbar), `filterable`, `exportable`, and `type` (column),
`format` (filter), and `value` (widget) are not JSON configuration properties.
