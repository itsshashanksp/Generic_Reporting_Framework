# SQL resource and JSON request responsibilities

The browser always sends JSON. There are two configuration modes:

| Mode | Frontend authors | Backend owns |
| --- | --- | --- |
| JSON request | Top-level universal `request` with source, fields and optional clauses | Validation, authorization and database execution |
| SQL resource | `queryDefinition:{format:"sql",resource:"id"}` | Resource allowlist/lookup, SQL text, credentials, parameter application and execution |

Presentation remains frontend JSON: columns, filter controls, grid, toolbar, export, dashboard layout and widget rendering.

SQL resource identifiers are opaque. The backend response fields must match configured columns and type-specific fields; runtime filter and sort names must also be meaningful to the resource. The frontend neither finds a same-named SQL file nor parses the resource SQL.

See [Query modes](QUERY-MODES.md) for request merge behavior and [Configuration reference](CONFIGURATION.md) for presentation schemas.
