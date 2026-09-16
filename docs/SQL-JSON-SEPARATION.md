# SQL resource and JSON request responsibilities

The browser always sends JSON. There are two configuration modes:

| Mode | Frontend authors | Backend owns |
| --- | --- | --- |
| JSON request | Top-level universal `request` with source, fields and optional clauses | Validation, authorization and database execution |
| SQL resource | `queryDefinition:{format:"sql",resource:"reports/id"}` plus top-level presentation config | Resource discovery/resolution, execution-metadata validation, SQL text, credentials, parameter application and execution |

Presentation remains frontend JSON: columns, filter controls, grid, toolbar, export, dashboard layout and widget rendering.

SQL Resource IDs are slash-separated names relative to the backend discovery root, without extensions. The frontend runtime derives the API's constrained execution columns and filter mappings from top-level `columns` and `filters`; initial sorting comes from top-level `sort`. The frontend neither locates the file nor parses the resource SQL, and the backend remains authoritative for accepting those capabilities.

See [Query modes](QUERY-MODES.md) for request merge behavior and [Configuration reference](CONFIGURATION.md) for presentation schemas.
