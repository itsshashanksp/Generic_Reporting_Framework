# Configuration format

All files in this directory use the runtime configuration schema. Unknown properties are rejected so a misspelling or misplaced setting cannot be silently ignored.

SQL is the single source of truth for data and query logic: selected fields,
sources, joins, static filters, grouping, HAVING, static ordering, aggregates,
aliases, and supported expressions belong in `.sql`. JSON is the single source
of truth for UI/UX and interaction configuration: labels, visible columns,
filter controls, pagination controls, toolbar/export behavior, grid behavior,
dashboard layout, and widget presentation. A JSON `queryDefinition` is only a
safe reference to the authoritative SQL resource; it is not query logic.

## Canonical order

Report files use this top-level order: `id`, `title`, `description`, `queryDefinition`, `request`, `columns`, `filters`, `grid`, `toolbar`, `export`.

Dashboard files use: `id`, `title`, `description`, `layout`, `autoRefresh`, `filters`, `widgets`. Each widget starts with `id`, `type`, `title`, and `description`, followed by layout (`width`, `height`, `visible`, `position`), its widget/report reference, and then type-specific presentation settings.

Menu entries use: `id`, `title`, `icon`, one destination, `visible`, and `children` for groups. The file is an array because that is the structure consumed by `NavigationEngine`.

## Supported report properties

- Query source: production reports use `queryDefinition` with `format: "sql"` and a flat `.sql` resource filename. Legacy configurations remain readable through `request` for compatibility, but production query logic belongs exclusively in SQL. SQL-backed definitions are normalized to the existing Universal request shape during loading.
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
- Stat widget: `widgetId` (or compatible `reportId`/legacy `request`), `valueField`, `format`.
- Table widget: `widgetId` (or compatible `reportId`/legacy `request`), `pageSize`, `pageSizeOptions`, `export`.
- Chart widget: `widgetId` (or compatible `reportId`/legacy `request`), `xField`, `yField`, `chartType`, `showLegend`, `showTooltip`, `showGrid`, `showLabels`.
- Data-driven widgets resolve `widgetId` through the explicit widget loader. A widget definition's `.sql` file owns the data query, while dashboard JSON owns layout and presentation. Legacy embedded Universal requests remain accepted for compatibility, but a widget must provide exactly one query source. Table pagination is configured on the dashboard widget and is sent at runtime as `pagination: { page, pageSize }`.
- Reusable stat definitions do not declare `columns`; each dashboard stat supplies its own `title`, `valueField`, `format`, visibility, and layout. The stat reads that named field from the SQL result. Table widget definitions retain `columns` because table column presentation is shared by the table definition.

Configuration directories have explicit responsibilities: `reports/` contains standalone report JSON/SQL pairs, `dashboards/` contains dashboard layout and widget placement, and `widgets/` contains reusable data-driven widget JSON/SQL pairs. Report and widget SQL use separate static registries but share the same parser, `QueryDefinition`, converter, and Universal JSON API pipeline. SQL text and resource names are never included in API requests.

## Supported navigation properties

Each item supports `id`, `title`, `icon`, `visible`, and exactly one of `route`, `reportId`, `dashboardId`, or `children`. Routes must start with `/`. Report and dashboard references are checked against the loaded configuration IDs; filenames are not routing IDs.

## Intentionally not configurable

The runtime does not expose `autoHeight`, `autoWidth`, `minHeight`, `minWidth`, `colSpan`, `size`, or `showSavedReports`. Likewise, the former type-only fields `icon` (report), `search` (toolbar), `filterable`, `exportable`, and `type` (column), `format` (filter), and `value` (widget) are not part of JSON configuration.
