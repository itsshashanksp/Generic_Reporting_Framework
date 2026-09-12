# Backend capability matrix

This inventory was verified against the backend documentation and the public validators, normalizer, controllers, repositories, discovery resolver, legacy compatibility registry, and response envelope. “Configured” means a frontend author can place the capability in a report/widget JSON request. “Runtime UI” means an end user can change it in the current interface.

| Backend capability | Frontend before | Frontend after | Status / notes |
| --- | --- | --- | --- |
| JSON `select` | Configured `request` | Same, with stricter validation | Supported |
| SQL Resource `sql` | Legacy basename resource IDs | Migrated to discovered `reports/...` and `widgets/...` IDs | Supported; frontend never derives a file path |
| SQL execution metadata | Not supported by frontend model | `columns`, constrained filter mappings, and `defaultSort` validated and copied to the SQL action | Supported in reviewed configuration |
| SQL Resource runtime filters | UI filters appended against legacy registry metadata | Exact serialization plus reviewed output/source/HAVING logical mappings | Supported only for execution-declared fields |
| SQL Resource discovery | Assumed every resource was manually registered | Uses relative slash-separated IDs without extension | Backend-owned, frontend-consumed |
| Comparison operators | Configurable | Configurable and validated | `=`, `!=`/`<>`, `>`, `<`, `>=`, `<=` |
| LIKE operators | Contains/starts/ends | Added matching NOT LIKE variants | UI config maps wildcards; no raw SQL |
| IN / NOT IN | Multiselect | Same | Value lists supported |
| BETWEEN / NOT BETWEEN | Number/date range | Numeric values normalized; date partial BETWEEN remains `>=`/`<=` | Supported |
| IS NULL / IS NOT NULL | Checkbox emitted `value:null` | Value is omitted per contract | Supported |
| EXISTS / NOT EXISTS | Type allowed but shallowly checked | Static JSON request subqueries validated | Configured JSON only; not an interactive control and not valid in SQL Resource mode |
| Filter logic | Static `AND`/`OR` passed through | Validated | One flat top-level value; no nested groups; SQL Resource OR may not span configured locations |
| Boolean values | Context supported, no dedicated control | Boolean filter control and serialization | Supported |
| Text/number/date/select/multiselect | Configured controls | Retained | Supported |
| Sorting | Report multi-sort; table first sort | Retained; SQL runtime/default sorts use execution columns | Runtime sort replaces `execution.defaultSort` |
| Pagination | Server paging; default 10 | Discovered SQL definitions provide deterministic default sorts where paging is used | Positive page/pageSize; SQL paging requires approved ordering |
| SELECT aliases | Type support, shallow validation | Identifier validation | Supported in configured JSON |
| DISTINCT / TOP (`limit`) | Passed through | Validated | Supported in configured JSON |
| INNER/LEFT/RIGHT joins | Passed through | Shape/type/equality validation | One equality predicate only |
| GROUP BY | Passed through | Identifier validation | Query grouping is backend-side; grid `grouping` is presentation-only |
| Aggregates | Field objects | Function allowlist validation | COUNT, SUM, AVG, MIN, MAX, STRING_AGG |
| HAVING | Passed through | Aggregate/operator validation | Conditions are combined with AND by backend |
| CASE / binary arithmetic | Passed through | Shape/operator validation | One binary arithmetic level; CASE comparison form |
| String/null/conversion/date/math functions | Broad field object | Public function allowlist and required-option checks | Configured JSON supported; backend remains authoritative |
| Window functions | Field objects | Allowlist and required sort validation | ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE; no PARTITION BY |
| Standard/recursive CTE | `with` was untyped/shallow | Standard and recursive branch validation | One top-level CTE; no nested CTE |
| IN subquery | Shallow | One explicit projected field required | Configured JSON only |
| UNION / UNION ALL | Backend only | Documented as not exposed by report configuration | Backend public capability, no frontend runtime/configuration action |
| INTERSECT / EXCEPT | Backend internal/SQL Resource | Not exposed | Use backend-owned SQL Resource |
| FULL/CROSS/APPLY, complex joins | SQL Resource only | Documented boundary | Not exposed in JSON mode |
| Derived tables, PIVOT, JSON/XML, arbitrary SQL functions | SQL Resource only | Documented boundary | Not exposed in JSON mode |
| Routines | Backend actions exist | Documented boundary | Not exposed by report/widget configuration |
| Metadata actions | Backend actions exist | Documented boundary | Not exposed by current UI |
| INSERT/UPDATE/DELETE/UPSERT | Backend registered Write API exists | Documented separately from reads | Not exposed; no mutation controls or `actions` schema in frontend |
| Column visibility/order/width | Presentation config and grid | Retained | Does not rewrite query or SQL |
| Column chooser/personalization | None | None | Not supported |
| Search | “Search” applied filters; unused global context existed | Dead global context removed | No global search operation; Search means apply configured filters |
| Export | CSV/Excel current/all | Retained | Frontend feature; report all-row and dashboard batched behavior differ |
| Saved reports | Local filters/sort/page plus unused grouping snapshot | Unused grouping snapshot removed | Local save/load/delete only |
| Common report/table presentation | Shared grid, mixed frames | Shared frame/grid/mobile cards/pager/menu | Supported across reports and dashboard tables/widgets |
| Standard response | Validated success/meta | Backend error code/details now retained in `ApiClientError` | Supported |
| Authentication/roles/rate limiting | None | None | Backend and frontend do not implement them |

## Verified backend discrepancies

- `TIMEFROMPARTS` appears in the backend internal function list but cannot pass the public field-property validator because `fractions` is not accepted. The frontend does not expose it.
- The discovered Item dashboard table now declares `cl_stock` and `stock_value` in frontend execution columns, so its displayed sortable fields no longer depend on the incomplete legacy registry allowlist.
- Backend query sorting defaults omitted directions to `ASC`; frontend-authored configuration requires an explicit direction for clarity and deterministic state restoration.

## Ownership rule

The frontend never parses, generates, mutates, or executes SQL. SQL Resource mode sends a discovered logical ID, optional reviewed execution metadata, and runtime filter/sort/page values. The backend validates the metadata grammar, resolves the server-owned file, performs filter placement and parameterization, executes SQL Server, and returns the standard response.
