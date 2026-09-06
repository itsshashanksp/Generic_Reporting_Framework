# Query Engine

`src/engine/ReportQueryEngine` converts a constrained, read-only SQL authoring format into the Generic SQL API's `UniversalQueryRequest` shape. The frontend parses SQL; it does not execute SQL in the browser.

## Pipeline

1. `sqlLoader` resolves a configured `.sql` resource.
2. The SQL contract validator rejects malformed or unsupported input.
3. `parseReportSql` produces a typed `QueryDefinition`.
4. The converter combines that definition with runtime filters, sorting, and pagination.
5. The API client sends the generated universal JSON request to the backend.

Parser and resource-resolution failures expose typed error codes so the UI and tests can distinguish invalid syntax, unsupported features, invalid resources, and configuration errors.

## Supported Authoring Subset

The current contract supports one read-only `SELECT` statement with:

- fields, aliases, aggregates, approved scalar functions, limited arithmetic, simple `CASE`, and supported window expressions
- `DISTINCT` and positive integer `TOP`
- one base `FROM` source with an optional explicit `AS` alias
- ordered `INNER`, `LEFT`, and `RIGHT` equality joins
- static `WHERE` predicates joined by `AND`
- `GROUP BY` with aggregate-safe select validation
- aggregate `HAVING` predicates joined by `AND`
- static `ORDER BY`

Important exclusions include multiple statements, SQL comments, mutations, subqueries, CTEs, unions, static `OR`, arbitrary expressions, quoted identifiers, and unsupported vendor-specific syntax. Unsupported input fails explicitly instead of being approximated.

The authoritative grammar and mapping rules live in [`src/engine/ReportQueryEngine/SQL_CONTRACT.md`](../src/engine/ReportQueryEngine/SQL_CONTRACT.md).

## Base Rules and Runtime State

Authored `WHERE` conditions become immutable base filters, and authored `ORDER BY` becomes base sorting. Runtime UI state is merged without discarding those rules. A guarded conversion error is raised where the flat backend filter contract cannot faithfully represent a combination.

[Documentation index](README.md) · [SQL / JSON Separation](SQL-JSON-SEPARATION.md) · [Development](DEVELOPMENT.md)
