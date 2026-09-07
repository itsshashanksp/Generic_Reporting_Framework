# Dashboard widgets

Dashboard widgets are either report renderers or focused stat, table, and chart views.

## Source matrix

| Widget type | Allowed source |
| --- | --- |
| `report` | Exactly `reportId` |
| `stat`, `table`, `chart` | Exactly one of inline `request`, inline SQL `queryDefinition`, `reportId`, or reusable `widgetId` |

Inline definitions keep dashboard configuration self-contained. Reusable definitions in `src/config/widgets/*.json` remain supported for `widgetId` compatibility. Report reuse shares the report request and columns.

## Runtime behavior

Dashboard filters are appended to every widget request. Each widget has independent loading, empty, error and retry states and its own dashboard/widget cache scope.

- Stat reads `valueField` from the first row (or the first property) and formats using the Indian locale.
- Table uses server pagination, supports sorting and optional CSV/Excel export. Missing columns are inferred from the first row.
- Chart uses Recharts and supports bar, line and pie charts. Non-numeric Y values become zero.
- Report renders a report grid inside its card.

Although inline widget schema accepts `filters`, `grid`, and `toolbar`, the current dashboard renderer does not wire these widget-local controls through. Configure dashboard-level filters and type-specific widget settings instead.

See [Configuration reference](CONFIGURATION.md#dashboard-widget-sources) and [Examples](EXAMPLES.md).
