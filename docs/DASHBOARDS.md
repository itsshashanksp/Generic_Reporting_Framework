# Dashboards

A dashboard is one JSON file in `src/config/dashboards` containing layout, optional shared filters/refresh, and widgets.

## Layout

The rendered column defaults are 12 desktop, 6 tablet and 1 mobile. Desktop honors widget `position.x` (zero-based), `position.y` (one-based CSS row), width and pixel height. Position and width must fit desktop columns. At 1024px and 768px breakpoints, explicit positions are removed and widths are proportionally scaled upward with `ceil`.

Widgets without explicit position flow through the CSS grid. Invisible widgets are omitted.

## Filters and refresh

Dashboard filters use the same controls and operators as reports. **Search** applies the current form to all widgets; **Clear** removes applied dashboard filters.

Auto-refresh requires a positive millisecond interval when enabled. The timer refreshes all widget request keys. Manual refresh does the same. The page indicator ends after a fixed one second and is not a promise that all widgets finished.

## Data composition

A dashboard may mix inline JSON requests, inline SQL resource references, report-backed widgets and reusable widget references. An empty widget list is allowed but warns during validation.

See [Widgets](WIDGETS.md), [Configuration reference](CONFIGURATION.md#dashboard-definition), and the [responsive dashboard example](EXAMPLES.md#13-responsive-dashboard).
