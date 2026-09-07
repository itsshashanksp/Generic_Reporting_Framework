# Supported and unsupported behavior

This table distinguishes active UI/runtime behavior from schemas or code that merely exist.

| Area | Supported now | Not supported / important limitation |
| --- | --- | --- |
| Query source | Top-level JSON select request; backend SQL resource ID | Frontend SQL files; active SQL parsing; `queryDefinition.format:"json"` |
| Filtering | Configured text, number, select, multiselect, date, range and null controls | Advanced/nested filter UI; UI logic selector; global search |
| Sorting | Server sorting from grid headers; multiple sort on reports | Table widgets send only the first sort |
| Paging | Server paging for reports and table widgets | Report-widget footer/server pager |
| Columns | Configured visibility/sortability/width; drag reorder and resize | Column chooser, runtime show/hide/reset, persisted personalization |
| Grouping | Display columns for backend-grouped output | Client aggregation, expandable groups, interactive group builder |
| Charts | Bar, line, pie with one X and one numeric Y | Additional chart types, series configuration or chart export |
| Export | CSV/Excel, current/all where configured | PDF, print; batched all-row export for reports |
| Saved reports | Browser-local save/load/delete of filters/sort/page | Rename/update UI, sync, column restoration, dynamic grouping restoration |
| Dashboards | Responsive grid, shared filters, manual/interval refresh | Saved dashboards; widget-local filter/grid/toolbar wiring |
| Cache | Five-minute in-memory successful-response cache and in-flight dedup | Persistence, production controls, manual UI invalidation, backend cache guarantee |
| Navigation | Routes/reports/dashboards and one visible child level | Reliable rendering of deeper nested groups |
| Selection | Single/multiple grid highlighting | Actions consuming selected rows |
| Toolbar settings | Schema flag/default | Settings panel |
| Legacy query engine | Isolated parser/converter tests | Active report/dashboard request path |

## Known implementation gaps

- Successful response parsing requires `meta`, while a TypeScript API declaration marks it optional.
- Inline widget `filters`, `grid`, and `toolbar` pass schema validation but are not used by dashboard rendering.
- Saved state records grouping but load does not apply it, and does not store column state.
- Search context/engine exists without a user-facing global search feature.
- Report all-row export makes one unpaginated request and may be unsuitable for very large data sets.
- Dashboard refresh feedback uses a one-second timer rather than request completion.

Treat these as current constraints, not promised roadmap items.
