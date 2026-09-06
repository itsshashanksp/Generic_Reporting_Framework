# Widgets

Reusable widget data definitions live in `src/config/widgets` as paired SQL and JSON resources. Widget SQL owns the query; widget JSON identifies the resource and may supply presentation metadata that is genuinely shared by all consumers.

Dashboard JSON owns the presentation and layout of each widget instance. The supported widget types are `report`, `stat`, `table`, and `chart`.

## Widget Types

- A `stat` selects one SQL result property through dashboard `valueField` and formats it as a number, decimal, or currency. It does not require `widget.json.columns`.
- A `table` uses configured columns because headers, sizes, alignment, and formatting are table presentation. It supports server pagination, sorting, filters, and configured export behavior.
- A `chart` maps SQL result properties through `xField` and `yField`, with dashboard-owned chart type and display options.
- A `report` embeds an existing report definition in the dashboard.

For a stat, the flow is direct:

```text
dashboard valueField -> matching property in widget SQL result -> displayed value
```

Keep fields needed by a widget in its SQL `SELECT`. Keep labels, formats, position, size, visibility, and chart options in dashboard JSON. Do not introduce JSON query objects as a replacement for SQL-backed widget definitions.

[Documentation index](README.md) · [Dashboards](DASHBOARDS.md) · [SQL / JSON Separation](SQL-JSON-SEPARATION.md)
