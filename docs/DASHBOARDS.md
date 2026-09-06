# Dashboards

Dashboard JSON in `src/config/dashboards` composes report-backed and reusable widget-backed views. A dashboard is a presentation container; it does not own SQL or query logic.

## Configuration Responsibilities

Each dashboard widget declares its type, title, visibility, position, and dimensions. Type-specific properties select presentation behavior:

- stat widgets use `widgetId`, `valueField`, and `format`
- table widgets use a report or widget source plus paging and export options
- chart widgets use `xField`, `yField`, `chartType`, and display flags
- report widgets reference a configured report

The dashboard validator rejects unknown properties, invalid layouts, unresolved references, and incompatible widget settings before rendering.

## Runtime Flow

1. `DashboardEngine` loads and validates the requested dashboard JSON.
2. Each visible widget resolves its report or reusable widget definition.
3. SQL is parsed and combined with dashboard/runtime filters, sorting, and pagination where applicable.
4. Equivalent requests share cached or in-flight results.
5. The widget frame renders loading, error, empty, and success states.

Dashboard-level filters can feed compatible widget requests. Table widgets maintain server-side page and sort state; stats and charts map response fields specified by their dashboard definitions. Widget failures are contained so one failed request does not replace the entire dashboard.

There is intentionally no `dashboard.sql`: query ownership remains with the report or widget referenced by each dashboard entry.

[Documentation index](README.md) · [Widgets](WIDGETS.md) · [Architecture](ARCHITECTURE.md)
