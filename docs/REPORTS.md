# Reports

A report is defined by a same-named pair in `src/config/reports`:

```text
item.sql   query/data logic
item.json  report presentation and controls
```

The JSON file references its SQL resource through `queryDefinition`. It owns the report title, column definitions, filter controls, grid behavior, toolbar, and export configuration.

## Runtime Flow

The report loader resolves and parses SQL, validates the presentation definition, and creates a runtime report definition. `ReportViewer` applies current filter, sort, and pagination state, sends the universal request, parses the API response, and renders loading, empty, error, or populated states.

`GenericGrid` maps configured columns to AG Grid, supports column resizing and reordering, and applies configured grouping. Pagination is server-driven: changing the page or page size issues an updated request. Sort and filter controls likewise update runtime state rather than authored configuration.

## Toolbar and Saved Views

When enabled in report JSON, the toolbar can refresh data, open settings, save the current report view, and offer exports. Saved views persist filter, sort, pagination, column, and grouping state in browser storage. They do not alter SQL or report JSON.

CSV and Excel export can use the current loaded view. Configurations that enable all-row export use bounded batched API requests and expose progress, cancellation, and failure states.

## Adding a Report

1. Add a unique `<id>.sql` using the supported SQL contract.
2. Add `<id>.json` with the same ID and a `queryDefinition` reference.
3. Define the table columns and optional filters, grid, toolbar, and export presentation.
4. Add a visible navigation entry only when the report should be reachable from the menu.
5. Run the checks described in [Testing](TESTING.md).

[Documentation index](README.md) · [Query Engine](QUERY-ENGINE.md) · [Development](DEVELOPMENT.md)
