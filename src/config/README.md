# Configuration format

All files in this directory use the runtime configuration schema. Unknown properties are rejected so a misspelling or misplaced setting cannot be silently ignored.

## Canonical order

Report files use this top-level order: `id`, `title`, `description`, `queryDefinition`, `request`, `columns`, `filters`, `grid`, `toolbar`, `export`.

Dashboard files use: `id`, `title`, `description`, `layout`, `autoRefresh`, `filters`, `widgets`. Each widget starts with `id`, `type`, `title`, and `description`, followed by layout (`width`, `height`, `visible`, `position`), `request`, and then type-specific settings.

Menu entries use: `id`, `title`, `icon`, one destination, `visible`, and `children` for groups. The file is an array because that is the structure consumed by `NavigationEngine`.

## Supported report properties

- Query source: exactly one of `queryDefinition` or `request` is required. SQL-backed reports use `queryDefinition` with `format: "sql"` and a flat `.sql` resource filename; legacy reports continue to use `request`. SQL-backed definitions are normalized to the existing Universal request shape during loading.
- Request: `action`, `source`, `fields`, `filters`, `joins`, `groupBy`, `having`, `sort`, `pagination`, `distinct`, `limit`, `filterLogic`, and `with`.
- Column: `field`, `header`, `visible`, `sortable`, `width`.
- Filter: `field`, `label`, `type`, `operator`, `options`, `visible`, `required`, `placeholder`.
- Grid: `pagination` (`enabled`, `pageSize`, `pageSizeOptions`), `rowSelection`, and `grouping` (`enabled`, `groups`, `aggregates`).
- Toolbar: `export`, `refresh`, `settings`, `saveReport`.
- Export: `enabled`, `formats`, `filename`, `exportAll`, `exportCurrentView`.

`settings` currently controls whether the disabled settings placeholder is displayed; settings functionality is therefore only partially supported.

## Supported dashboard properties

- Layout: `columns`, `tabletColumns`, `mobileColumns`.
- Auto refresh: `enabled`, `interval`.
- Filters use the same schema and behavior as report filters.
- Common widget properties: `id`, `type`, `title`, `description`, `width`, `height`, `visible`, `position` (`x`, `y`).
- Report widget: `reportId`.
- Stat widget: `request`, `format`.
- Table widget: `request`, `pageSize`, `pageSizeOptions`, `export`.
- Chart widget: `request`, `xField`, `yField`, `chartType`, `showLegend`, `showTooltip`, `showGrid`, `showLabels`.
- Widget requests use the same universal request contract as reports. Table pagination is configured on the widget and is sent at runtime as `pagination: { page, pageSize }`.

## Supported navigation properties

Each item supports `id`, `title`, `icon`, `visible`, and exactly one of `route`, `reportId`, `dashboardId`, or `children`. Routes must start with `/`. Report and dashboard references are checked against the loaded configuration IDs; filenames are not routing IDs.

## Intentionally not configurable

The runtime does not expose `autoHeight`, `autoWidth`, `minHeight`, `minWidth`, `colSpan`, `size`, or `showSavedReports`. Likewise, the former type-only fields `icon` (report), `search` (toolbar), `filterable`, `exportable`, and `type` (column), `format` (filter), and `value` (widget) are not part of JSON configuration.
