# SQL and JSON Responsibility Separation

The frontend uses a strict ownership rule: SQL defines data/query behavior, while JSON defines UI/UX and presentation. Runtime interaction state is added only while the application is running.

## Ownership

| Concern | Owner | Examples |
| --- | --- | --- |
| Data source and selected fields | SQL | `FROM`, selected columns, aliases, aggregates |
| Immutable query rules | SQL | joins, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `DISTINCT`, limits |
| Report presentation | Report JSON | title, columns, filters, grid, toolbar, export options |
| Reusable widget data | Widget SQL | the query shared by dashboard widget instances |
| Shared widget metadata | Widget JSON | widget identity and SQL resource reference; table columns when shared |
| Dashboard composition | Dashboard JSON | widget type, title, layout, visibility, value/chart fields, formatting |
| User interaction | Runtime state | entered filters, selected sorting, current page, page size |

## Authoring Rules

- Do not put SQL strings, sources, selected fields, joins, base filters, grouping, HAVING, or base sorting in presentation JSON.
- Do not put labels, widths, formats, visibility, controls, or layout in SQL.
- Do not add legacy JSON `request` definitions to SQL-backed production reports or widgets.
- Do not create a dashboard SQL file. Each dashboard widget resolves its own report or widget data source.
- Keep table columns in JSON because column headers, widths, alignment, and formatting are presentation.
- A stat widget does not need shared `widget.json.columns`. Its dashboard entry supplies `valueField`; the stat reads that named field from the SQL result.

For example, SQL can return `COUNT(Item_Code) AS TotalItems`, while the dashboard JSON selects `"valueField": "TotalItems"`, supplies the title and number format, and determines placement.

## Runtime Composition

The loader parses authored SQL into a `QueryDefinition`. The converter then combines it with current filters, sorting, and pagination to create a `UniversalQueryRequest`. This generated request is transport data; it does not transfer authorship from SQL or JSON.

[Documentation index](README.md) · [Architecture](ARCHITECTURE.md) · [Reports](REPORTS.md)
