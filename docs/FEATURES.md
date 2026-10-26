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

Configured visible columns can be resized and reordered in AG Grid. `sortable` controls whether a header can sort. `visible:false` prevents column creation. The current UI has no column chooser, show/hide action, reset action, or persisted column width/order/visibility. The former disabled Settings placeholder and schema flag were removed.

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

## Database selector

A report that sets `databaseSelection` (see [Configuration](CONFIGURATION.md#runtime-database-selection)) shows a **Database** dropdown at the start of the report toolbar, beside **Refresh**; on phones it sits beside **More**.

Reports and dashboards share the same selection logic (`src/components/Toolbar/useDatabaseSelection.ts`). The backend registry, read with `metadata.databases`, authorizes every option and fallback:

1. **Options:** every database returned by the authorized listing that is **enabled**, labelled with its backend display name. Databases whose availability gate is closed are shown as "(unavailable)" and can't be chosen. Disabled rows are left out.
2. **Configured initial selection:** reports prefer their explicit JSON database, then the browser-local global default. Dashboards prefer the global default. The value is used only when present in the authorized, enabled, available listing.
3. **Registry fallback:** otherwise, the listing's available **default**, then the **first** enabled and available result.
4. **None usable:** "No database available" is shown, and **nothing is requested**.
5. **Listing fails** (for example `403` when an enforced access scope lacks `listDatabases`): "Database list unavailable" is shown, with **Try again**. No IDs are offered and **nothing is requested**.

Until a database is resolved, no report or widget request is sent, so nothing can silently fall back to the backend default by omitting `database`. Frontend JSON contains no selector IDs or names. The listing contains only logical metadata, never connection details, and is cached for 5 minutes. Authentication identity changes clear that cache before the next user can load data.

- **Reopening:** opening the report again, or another report, resolves its initial selection again. Manual page choices are not saved, do not change the global setting, and saved views do not record them.
- **Switching** reruns the report on the chosen database, from page 1, with the same applied filters, filter logic, and sort. Refresh, paging, sorting, saved-view loading, and **All rows** export then all use the chosen database. A request still running for the previous database is aborted, and its late result is ignored. The selector is disabled while an export runs.
- **Caching:** the cache key includes the database, so rows from one database are never shown for another. Switching back to a database can be answered from its own cached entry.
- **Errors:** a failing database (for example `DATABASE_UNAVAILABLE`, or `403` when an access scope does not grant it) shows the backend's error in the grid area. The selector stays usable, so the user can switch back.
- **Dynamic filter options:** requests without their own `database` follow the resolved selection and wait while discovery is unresolved. An explicitly pinned filter request keeps its configured database.
- **Dashboards** have a dashboard-level equivalent that switches only widgets without their own database; see [Dashboards](DASHBOARDS.md#database-selector).

All of this is covered by mocked tests. It has not been run against a live backend with two registered databases.

## Saved reports

When `toolbar.saveReport` is enabled (the default), the report toolbar can save, load, and delete browser-local views. A saved view records applied filters, sorting, and current page/page size. Loading restores those fields. It does not restore columns or grouping. Each UI save creates a new timestamped record—there is no rename/update workflow.

Records are stored per signed-in user under the local-storage key `generic-report-saved-reports:user:<URL-encoded username>`. The old shared key `generic-report-saved-reports` is deleted when the identity changes, and its views are not migrated. Records are neither synced to the account nor shared, and there is no storage schema migration. Invalid records are filtered out, and storage errors fall back to an empty list. Browser storage is a convenience, not a security boundary. Dashboards do not have saved views.

## Request caching

The request cache is an in-memory map of successful completed responses:

- TTL: five minutes.
- Capacity: 100 completed entries; the least recently accessed is evicted after overflow.
- Key: scope plus the full recursively stabilized request. Object key order and `undefined` properties do not matter; array order does.
- Scopes: `report:<reportId>`, `dashboard:<dashboardId>:<widgetId>`, `dynamic-filter-options` (shared by every filter with the same options request), and `metadata-databases` (the database listing behind the report and dashboard database selectors).
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
