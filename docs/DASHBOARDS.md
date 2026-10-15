# Dashboards

A dashboard is one JSON file in `src/config/dashboards` containing layout, optional shared filters/refresh, and widgets.

## Layout

The rendered column defaults are 12 desktop, 6 tablet and 1 mobile. Desktop honors widget `position.x` (zero-based), `position.y` (one-based CSS row), width and pixel height. Position and width must fit desktop columns. At 1024px and 768px breakpoints, explicit positions are removed and widths are proportionally scaled upward with `ceil`.

Widgets without explicit position flow through the CSS grid. Invisible widgets are omitted.

## Filters and refresh

Dashboard filters use the same controls and operators as reports. **Search** applies the current form to all widgets; **Clear** removes applied dashboard filters.

A shared filter with `"required": true` gates the whole dashboard: its widgets are not shown, so they send no requests and offer no refresh or export, until **Search** applies a complete value. A required `daterange` needs both its start and its end date. Searching with a missing or partial required value shows an error, keeps the form editable, and removes results from an earlier search; **Clear** removes them too. Dashboards without required filters load immediately, as before.

### Per-widget filter fields

Every widget receives every shared filter under the filter's `field`. When one widget's data names that column differently, its optional `filterFields` maps the shared field to the widget's field:

```json
{
  "id": "total-purchases",
  "type": "stat",
  "filterFields": { "Bill_Date": "GIN_Date" },
  "queryDefinition": { "format": "sql", "resource": "widgets/bill-total-purchases" }
}
```

With a shared `Bill_Date` date range, this widget declares and sends `GIN_Date` instead (in SQL Resource mode, the source filter declaration and the runtime filter both name `GIN_Date`), while other widgets keep `Bill_Date`. Only the field name changes: the label, type, operator and values, including start-only and end-only date ranges, stay those of the shared filter. An empty selection sends no runtime filter, and table exports use the same mapped filters as the table.

Validation rejects a mapping unless:

- it is a non-empty object;
- each key is the `field` of a shared dashboard filter;
- each value is a plain field name (letters, digits and underscores, not starting with a digit), different from its key;
- no two keys map to the same field, and no value equals another shared filter's or the widget's own filter's field (compared without case).

`filterFields` renames a field; it is never SQL. The backend resolves the mapped name exactly as it would a shared filter's name, and access scopes check that name.

Auto-refresh requires a positive millisecond interval when enabled. The timer refreshes all widget request keys. Manual refresh does the same. The page indicator ends after a fixed one second and is not a promise that all widgets finished.

## Data composition

A dashboard may mix inline JSON requests, inline SQL resource references, report-backed widgets and reusable widget references. An empty widget list is allowed but warns during validation.

See [Widgets](WIDGETS.md), [Configuration reference](CONFIGURATION.md#dashboard-definition), and the [responsive dashboard example](EXAMPLES.md#13-responsive-dashboard).
