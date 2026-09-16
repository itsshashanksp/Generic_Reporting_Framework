# Dashboard widgets

Dashboard widgets are either report renderers or focused stat, table, and chart views.

## Source matrix

| Widget type | Allowed source |
| --- | --- |
| `report` | Exactly `reportId` |
| `stat`, `table`, `chart` | Exactly one of inline `request`, inline SQL `queryDefinition`, `reportId`, or reusable `widgetId` |

Inline definitions keep dashboard configuration self-contained. SQL widgets use minimal discovered `widgets/...` references; their top-level columns, filters, and sort are translated into the API request. Reusable definitions in `src/config/widgets/*.json` remain supported for `widgetId` compatibility. Report reuse shares the normalized report definition.

## Runtime behavior

Dashboard filters are merged into every resolved inline, `reportId`, or `widgetId` definition and then appended to each widget request. This lets the SQL translator derive required filter mappings without duplicating shared controls inside widgets. Each widget has independent loading, empty, error and retry states and its own dashboard/widget cache scope.

- Stat reads `valueField` from the first row (or the first property) and formats using the Indian locale.
- Table uses server pagination, supports sorting and optional CSV/Excel export. Missing columns are inferred from the first row.
- Chart uses Recharts and supports bar, line and pie charts. Non-numeric Y values become zero.
- Report renders through the shared report/table frame and grid, including compact mobile pagination over returned rows.

Inline reusable definitions may carry presentation-compatible `filters`, `grid`, and `toolbar`, but dashboard-level filters are the active controls. Configure paging/export and chart/stat behavior with the widget's type-specific settings.

See [Configuration reference](CONFIGURATION.md#dashboard-widget-sources) and [Examples](EXAMPLES.md).
