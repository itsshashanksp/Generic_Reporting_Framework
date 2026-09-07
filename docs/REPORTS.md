# Reports

A report is a validated JSON definition in `src/config/reports`. It must have an ID, title, exactly one query source, non-empty columns, and a filters array.

## Lifecycle

1. Vite discovers JSON report files.
2. `ReportDefinitionEngine` validates and applies defaults.
3. `ReportViewer` combines the base request with applied filters, current sort and enabled pagination.
4. The request cache supplies or fetches a validated API response.
5. `GenericGrid`, the pager, metrics and configured toolbar actions render.

The filter form applies only on **Search**. Sorting returns to page 1. Refresh bypasses completed cache. Response metrics display rows returned and execution time.

## Authoring notes

- Output column fields must match response object keys and be unique.
- Include `filters: []` when no filters are needed.
- Use top-level `request` for JSON mode or SQL `queryDefinition` for backend resources.
- Prefer `grid.pagination` over embedding pagination in the base request.
- A hidden column is excluded, not interactively restorable.
- Configured grouping is a display contract for data already grouped by the backend.

Saved reports persist applied filters, sorting and paging locally. See [Feature behavior](FEATURES.md#saved-reports).

For every property and defaults, see [Configuration reference](CONFIGURATION.md#report-definition). For complete files, see [Examples](EXAMPLES.md).
