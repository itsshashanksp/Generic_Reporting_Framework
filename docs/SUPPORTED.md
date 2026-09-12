# Supported features

Only implemented frontend behavior appears in this inventory. Backend capabilities that are not exposed are listed separately.

## Query

- Validated JSON Query `select` configuration with fields/aliases, DISTINCT, limit, INNER/LEFT/RIGHT equality joins, flat filters, grouping, aggregate HAVING, sorting, pagination, supported functions, CASE, one-level arithmetic, filter subqueries, and one standard or recursive CTE.
- Backend SQL Resource references using an opaque resource ID.
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
- Sortable backend output aliases where permitted.
- Server pagination for report pages/dashboard tables with page size 10 by default and first/previous/next/last controls.
- Shared compact mobile pagination; report widgets use it client-side over their returned rows.

## Grouping and presentation

- Backend JSON Query grouping and aggregate HAVING in authored requests.
- Configured grouped-result columns for responses already aggregated by the backend.
- Configured column visibility, sortability, initial width, drag reordering, resizing, selectable rows, and text selection.
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

- Raw SQL, SQL files, SQL parsing/generation/manipulation, resource registration, database paths, credentials, filter placement, or placeholders.
- Interactive nested filter groups, operator selection, global multi-field search, or AG Grid column-filter requests.
- Interactive grouping, client aggregation, expandable group nodes, or grouping personalization.
- Column chooser, runtime show/hide/reset, or persisted column layouts.
- PDF/print/email export, chart export, or scheduled delivery.
- Report create/edit/delete/upsert actions. The backend Write API exists, but the frontend has no mutation schema, forms, or handlers.
- UNION/UNION ALL report configuration, routines, metadata browser, transactions, or bulk writes.
- Authentication, authorization, roles, tenants, favorites, drill-down, audit UI, report designer, or dashboard builder.
- Saved dashboard views, synchronized saved reports, or saved-report rename/update.

See [Backend capability matrix](BACKEND-CAPABILITY-MATRIX.md) for mode-by-mode details and [Roadmap](ROADMAP.md) for planned work.
