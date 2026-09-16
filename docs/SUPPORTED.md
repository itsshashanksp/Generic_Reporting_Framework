# Supported features

Only implemented frontend behavior appears in this inventory. Backend capabilities that are not exposed are listed separately.

## Capability status inventory

| Feature | Status | Current boundary |
| --- | --- | --- |
| JSON Query mode | Supported | Authored `select` requests using the public backend grammar |
| SQL Resource mode | Supported | Minimal discovered IDs plus derived request metadata; no SQL text/path handling |
| Filters and operator mapping | Supported | Configured operator per field; no interactive operator builder |
| Filter logic | Partially supported | Flat configured AND/OR; no nested groups or runtime logic editor |
| Search | Partially supported | Search applies configured backend filters; no global multi-field search |
| Sorting | Supported | Report multi-sort; dashboard table sends its first active sort |
| Query grouping | Supported | Authored JSON `groupBy`/HAVING; SQL grouping remains in the resource |
| Interactive grouping | Not supported | No group builder or expandable client-generated groups |
| Pagination | Supported | Server paging, page size 10, deterministic SQL Resource ordering |
| Column visibility | Supported | Configuration-driven visibility |
| Column ordering/sizing | Partially supported | Runtime grid interaction, not persisted |
| Export | Supported | CSV/Excel current view and configured all-row flows |
| Saved reports | Partially supported | Browser-local filter/sort/page views only |
| Dashboards | Supported | Responsive JSON-authored layouts and shared filters |
| Stat/table widgets | Supported | Shared request pipeline; table paging/sort/export |
| Chart widgets | Partially supported | Basic bar/line/pie rendering only |
| Report actions | Partially supported | Refresh, export, and local save; no write/CRUD actions |
| Responsive/mobile UI | Supported | Labeled cards, compact paging, pull-to-refresh and action sheets |
| Caching | Supported | In-memory TTL cache and in-flight deduplication |
| Error handling | Supported | Validated envelopes, retry UI, status/code/details retention |
| Frontend SQL parser/converter | Removed | Obsolete after server-owned resource discovery |
| Email/scheduling/auth/roles/audit/favorites/drill-down/designers | Planned or deferred | See roadmap; not represented as implemented |

## Query

- Validated JSON Query `select` configuration with fields/aliases, DISTINCT, limit, INNER/LEFT/RIGHT equality joins, flat filters, grouping, aggregate HAVING, sorting, pagination, supported functions, CASE, one-level arithmetic, filter subqueries, and one standard or recursive CTE.
- Backend SQL Resource references using slash-separated discovered IDs; runtime execution columns/filter mappings are derived from normalized columns/filters, with initial sorting at top level.
- A shared POST client, standard read-response validation, public error messages, and structured `ApiClientError` status/code/details.
- In-memory five-minute successful-response caching, bounded eviction, and identical in-flight request deduplication.

## Filtering

- Configured text, number, select, multiselect, boolean, date, date-range, and null-check controls.
- Friendly operators covering comparisons, LIKE/NOT LIKE contains/start/end variants, IN/NOT IN, BETWEEN/NOT BETWEEN, and IS NULL/IS NOT NULL.
- Typed select/boolean values, numeric conversion, required-field validation, and one-sided inclusive date-range filtering.
- Static JSON requests may use IN/NOT IN subqueries and EXISTS/NOT EXISTS.
- Static `filterLogic` supports one flat `AND` or `OR` value.

## Sorting and pagination

- Multi-column server sorting on reports and first-column server sorting on dashboard tables.
- Initial top-level sort is reflected in AG Grid's visible sort state.
- Sortable backend output aliases where permitted.
- Server pagination for report pages/dashboard tables with page size 10 by default and first/previous/next/last controls.
- Shared compact mobile pagination; report widgets use it client-side over their returned rows.

## Grouping and presentation

- Backend JSON Query grouping and aggregate HAVING in authored requests.
- Configured grouped-result columns for responses already aggregated by the backend.
- Configured column visibility, sortability, initial width, drag reordering, resizing, selectable rows, and text selection.
- Presentation-only number, ISO-style date, and datetime formatting without row mutation or timezone conversion.
- One shared report/table frame, grid, mobile sort, compact labeled record cards, pagination, and responsive menu behavior for reports and dashboard tables/widgets.
- Every mobile value remains associated with its configured column header.

## Reports

- JSON and SQL Resource data sources, configured filters, refresh, CSV/Excel export, loading/empty/error states, pull-to-refresh, and browser-local saved views.
- Saved views restore applied filters, sorting, page, and page size; users can save, load, and delete them.

## Dashboards and widgets

- Responsive configured dashboard layout, shared dashboard filters, manual refresh, and interval refresh.
- Inline JSON/SQL Resource definitions, report-backed widgets, and optional reusable widget definitions.
- Report, stat, table, and bar/line/pie chart widgets.
- Table widget server paging, sorting, multiple selection, current-view export, and batched all-row export.

## Export

- CSV and Excel.
- Configurable filenames and current/all scopes.
- Mobile More/Export bottom-sheet presentation using the existing action state/handlers.

## Unsupported frontend features

- Raw SQL, SQL files, SQL parsing/generation/manipulation, resource registration, database paths, credentials, placeholders, or authored execution mappings.
- Interactive nested filter groups, operator selection, global multi-field search, or AG Grid column-filter requests.
- Interactive grouping, client aggregation, expandable group nodes, or grouping personalization.
- Column chooser, runtime show/hide/reset, or persisted column layouts.
- PDF/print/email export, chart export, or scheduled delivery.
- Report create/edit/delete/upsert actions. The backend Write API exists, but the frontend has no mutation schema, forms, or handlers.
- UNION/UNION ALL report configuration, routines, metadata browser, transactions, or bulk writes.
- Authentication, authorization, roles, tenants, favorites, drill-down, audit UI, report designer, or dashboard builder.
- Saved dashboard views, synchronized saved reports, or saved-report rename/update.

See [Backend capability matrix](BACKEND-CAPABILITY-MATRIX.md) for mode-by-mode details and [Roadmap](ROADMAP.md) for planned work.
