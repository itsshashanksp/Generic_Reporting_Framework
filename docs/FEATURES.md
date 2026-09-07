# Feature behavior

## Filtering and Search

Reports and dashboards render only configured filter controls. Editing a control does not fetch data; **Search** validates required controls and applies the form as a batch. **Clear** applies an empty state. Dashboard filters are appended to every visible widget request.

The interface has no global free-text search box. `SearchEngine` and its context exist in source but have no current UI consumer or request integration. “Search” on the filter form means apply configured filters; it has no debounce behavior.

There is no advanced/nested filter builder. Authored JSON requests can choose one flat `filterLogic` of `AND` or `OR`, but the UI neither edits that value nor builds nested condition groups. A static request filter may carry backend-owned `query` content.

## Sorting

Clicking a sortable report column updates the API sort and returns to page 1. Report grids can emit multiple sorted columns through AG Grid. Dashboard table widgets intentionally send only the first sort item. SQL resources must expose sortable output names. JSON requests may declare an initial sort; runtime grid state replaces it.

## Pagination

Reports use configured server pagination and show the current row range, rows-per-page choice, and first/previous/next/last controls. Dashboard table widgets always use server pagination. A report with pagination disabled has no paging footer or injected runtime page; avoid a base `request.pagination` if an unpaged report is intended.

Report widgets render their returned rows in a report grid but do not use the report page footer. Their grid may use AG Grid's client pagination setting over the response.

## Columns and personalization

Configured visible columns can be resized and reordered in AG Grid. `sortable` controls whether a header can sort. `visible:false` prevents column creation. The current UI has no column chooser, show/hide action, reset action, or persisted column width/order/visibility. The toolbar `settings` flag is accepted/defaulted but does not currently expose a settings panel.

## Grouping

Configured grouping replaces the displayed columns with group and aggregate output columns. It does not aggregate rows on the client, create expandable group nodes, or inject `groupBy`; data must already have matching output fields. There is no interactive group-by control. A saved report records the configured grouping snapshot, but loading it does not apply a different grouping.

## Exports

Only CSV and Excel are supported.

| Surface | Current view | All rows |
| --- | --- | --- |
| Report | CSV uses AG Grid's presented current page/columns; Excel serializes raw current response rows | One unpaginated request with applied filters/current sort |
| Dashboard table | Serializes raw rows on the current page | Fetches pages in batches of 5,000 until `totalRows`, with progress and cancellation |

Current-view actions default on unless `exportCurrentView:false`; all-row actions require `exportAll:true`. Report all-row export is a single request rather than a batched fetch. Export filenames may be configured. PDF and print export are not implemented.

## Saved reports

When `toolbar.saveReport` is enabled (the default), the report toolbar can save, load, and delete browser-local views. A saved view records applied filters, sorting, current page/page size, and a grouping snapshot. Loading restores filters, sort and pagination; it does not restore columns or dynamically apply grouping. Each UI save creates a new timestamped record—there is no rename/update workflow.

Records live under local-storage key `generic-report-saved-reports`. They are neither account-synced nor shared, and there is no storage schema migration. Invalid records are filtered and storage errors fall back to an empty list. Dashboards do not have saved views.

## Request caching

The request cache is an in-memory map of successful completed responses:

- TTL: five minutes.
- Capacity: 100 completed entries; the least recently accessed is evicted after overflow.
- Key: scope plus the full recursively stabilized request. Object key order and `undefined` properties do not matter; array order does.
- Scopes: `report:<reportId>` and `dashboard:<dashboardId>:<widgetId>`.
- Exact simultaneous requests share one underlying call. Each consumer may abort; the underlying call aborts only when no consumers remain.
- Dashboard widget effects abort their consumer and invalidate its request sequence during cleanup. Navigation therefore discards late results even if the transport or server cannot stop work already in progress; intentional aborts do not render errors.
- Refresh and retry bypass completed entries but may still join identical in-flight work.
- Failures are not cached. Expiration, eviction, or page reload removes entries.

There is no production configuration switch, manual invalidation UI, persistent cache, or implied backend cache. `clearRequestCache` is primarily used by tests.

Cancellation is local to a mounted browser component and its cache consumer. Different browser sessions/users do not share controllers or cancellation flags. Aborting `fetch` closes the client's interest in the HTTP request, but the current PHP ODBC path does not expose a safe SQL Server statement-cancellation operation; an already executing query may continue until completion or a server/driver timeout. Production request concurrency is therefore also dependent on the PHP web-server/process configuration.

## Dashboard refresh and error states

Dashboard auto-refresh uses `setInterval` with the configured interval and increments a refresh key for all widgets. The refresh indicator clears after a fixed one second; it does not await every request. Widgets independently show loading, error, empty, and retry states. Manual dashboard refresh triggers the same refresh key behavior.

## Grid selection

Reports pass configured `single` or `multiple` row selection to AG Grid; table widgets use multiple selection. No current report/dashboard workflow consumes selected rows, so selection has no action beyond grid highlighting.
