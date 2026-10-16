# Feature behavior

## Filtering and Search

Reports and dashboards render only configured filter controls. Editing a control does not fetch data; **Search** validates required controls and applies the form as a batch. **Clear** applies an empty state. Dashboard filters are appended to every visible widget request.

The interface has no global free-text search box. The previous unused search context was removed. “Search” on the filter form means apply configured filters; it has no debounce behavior.

There is no advanced/nested filter builder. Authored definitions can choose one flat top-level `filterLogic` of `AND` or `OR`, but the UI neither edits that value nor builds nested condition groups. A static request filter may carry backend-owned `query` content.

## Sorting

Clicking a sortable report column updates the API sort and returns to page 1. Report grids can emit multiple sorted columns through AG Grid. Dashboard table widgets intentionally send only the first user-selected sort item. Both query modes declare initial sorting with top-level `sort`; AG Grid initializes its visible sort arrows and multi-sort order from that state, and runtime grid state replaces it. SQL Resource sort fields must reference configured display columns.

## Pagination

Reports use configured server pagination and show the current row range, rows-per-page choice, and first/previous/next/last controls. Dashboard table widgets always use server pagination. Paginated SQL Resources should define a deterministic top-level `sort`. A report with pagination disabled has no paging footer or injected runtime page. Authored `request.pagination` is rejected; runtime paging is generated from grid/widget state.

Configured `date` and `datetime` columns format ISO-style values for display in desktop and mobile grids. Formatting does not mutate response rows or shift encoded wall-clock values between timezones; null remains an em dash.

Report widgets render through the same grid and compact mobile pager. Desktop retains AG Grid client pagination over the returned response.

## Columns and personalization

`sortable` controls whether a header can sort. `visible:false` means the column is never created; users cannot show it.

On report pages, a signed-in user can personalize the configured columns:

- **Columns** (toolbar button, or the mobile "More" sheet) opens a dialog. It can show or hide each column, move it up or down, and **Reset columns** to the configured layout. At least one column always stays visible.
- Dragging a header to reorder it, or a header edge to resize it, is saved too.
- The layout is stored per signed-in user and report under the local-storage key `generic-report-column-layout:user:<user>:report:<reportId>`. It is not synced to the account, and it is separate from saved views (a saved view does not restore columns). When the configuration changes, removed fields are ignored and new fields appear at the end. Corrupt entries and storage errors fall back to the configured layout.
- A hidden column stays in the grid as hidden, so a sort on it is kept.
- **Exports**: current-view **CSV** follows the layout (only shown columns, in the shown order). Current-view **Excel** and **All rows** exports contain every field of the response rows, as before.
- There is no chooser when `toolbar.columns` is `false`, when the report uses configured `grid.grouping`, when it has fewer than two configured columns, or when no user is signed in. Dashboards (table and report widgets) are not personalized.

Automated tests cover the dialog, storage, and the grid's handling of AG Grid's drag and resize events (with AG Grid itself mocked). Real drag and resize in a browser has not been checked.

## Grouping

Configured grouping replaces the displayed columns with group and aggregate output columns. It does not aggregate rows on the client, create expandable group nodes, or inject `groupBy`; data must already have matching output fields. There is no interactive group-by control. The unused saved-report grouping snapshot was removed.

## Exports

Only CSV and Excel are supported.

| Surface | Current view | All rows |
| --- | --- | --- |
| Report | CSV uses AG Grid's presented current page/columns; Excel serializes raw current response rows | The same paged fetch as dashboard tables, with the report's applied filters, filter logic, database, and current sort on every page, and "Preparing export… N of M rows" progress |
| Dashboard table | Serializes raw rows on the current page | Fetches pages of 1,000 rows (the backend's default `maxPageSize`) until `totalRows`, with progress and cancellation; if the backend refuses the first page size as above its configured maximum, retries with 500, 250, 100, 50, 25, 10, then 1 |

Current-view actions default on unless `exportCurrentView:false`; all-row actions require `exportAll:true`. Both all-row flows use `fetchAllRowsForExport`. Pages are addressed by `page` and `pageSize`, so a stable result needs a deterministic sort: rows that tie on the sort columns can move between pages if the database orders them differently on different requests. That stays a limitation of offset paging; configure a unique sort column where it matters. Export filenames may be configured. PDF and print export are not implemented.

Safety limits (`src/engine/ExportEngine`):

- "All rows" stops at **100,000 rows** (`DEFAULT_EXPORT_MAX_ROWS`). Every row is held in browser memory before the file is written, so a larger export is refused with "… exceeds the 100,000-row export limit. Narrow the filters and try again." Nothing is saved.
- Inconsistent paging is refused rather than exported: a short page before `totalRows` ("…incomplete export result."), a page that repeats the previous page's rows, a page with more rows than requested or than remain, and a `totalRows` that changes between pages ("The matching rows changed while the export was running. Try again."). Reports add "Nothing was exported." A page whose rows are all identical is not treated as a repeat, because such data can legitimately repeat.
- CSV cells that begin with a spreadsheet formula trigger (`=`, `+`, `-`, `@`, including full-width forms and leading control characters) are prefixed with `'`, which stops them from running as formulas. Numeric values stay unchanged.
- Excel files are written with `write-excel-file`. A failure to create the file is shown as a message instead of being lost silently.

## Saved reports

When `toolbar.saveReport` is enabled (the default), the report toolbar can save, load, and delete browser-local views. A saved view records applied filters, sorting, and current page/page size. Loading restores those fields. It does not restore columns or grouping. Each UI save creates a new timestamped record—there is no rename/update workflow.

Records are stored per signed-in user under the local-storage key `generic-report-saved-reports:user:<URL-encoded username>`. The old shared key `generic-report-saved-reports` is deleted when the identity changes, and its views are not migrated. Records are neither synced to the account nor shared, and there is no storage schema migration. Invalid records are filtered out, and storage errors fall back to an empty list. Browser storage is a convenience, not a security boundary. Dashboards do not have saved views.

## Request caching

The request cache is an in-memory map of successful completed responses:

- TTL: five minutes.
- Capacity: 100 completed entries; the least recently accessed is evicted after overflow.
- Key: scope plus the full recursively stabilized request. Object key order and `undefined` properties do not matter; array order does.
- Scopes: `report:<reportId>`, `dashboard:<dashboardId>:<widgetId>`, and `dynamic-filter-options` (shared by every filter with the same options request).
- Exact simultaneous requests share one underlying call. Each consumer may abort; the underlying call aborts only when no consumers remain.
- Dashboard widget effects abort their consumer and invalidate its request sequence during cleanup. Navigation therefore discards late results even if the transport or server cannot stop work already in progress; intentional aborts do not render errors.
- Refresh and retry bypass completed entries but may still join identical in-flight work.
- Failures are not cached. Expiration, eviction, page reload, or a change of signed-in user removes entries.

There is no production configuration switch, manual invalidation UI, persistent cache, or implied backend cache. `clearRequestCache` is primarily used by tests.

Cancellation is local to a mounted browser component and its cache consumer. Different browser sessions/users do not share controllers or cancellation flags. Aborting `fetch` closes the client's interest in the HTTP request, but the current PHP ODBC path does not expose a safe SQL Server statement-cancellation operation; an already executing query may continue until completion or a server/driver timeout. Production request concurrency is therefore also dependent on the PHP web-server/process configuration.

## Dashboard refresh and error states

Dashboard auto-refresh uses `setInterval` with the configured interval and increments a refresh key for all widgets. The refresh indicator clears after a fixed one second; it does not await every request. Widgets independently show loading, error, empty, and retry states. Manual dashboard refresh triggers the same refresh key behavior.

## Grid selection

Reports pass configured `single` or `multiple` row selection to AG Grid; table widgets use multiple selection. No current report/dashboard workflow consumes selected rows, so selection has no action beyond grid highlighting.
