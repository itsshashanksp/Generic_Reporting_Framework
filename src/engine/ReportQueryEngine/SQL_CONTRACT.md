# report.sql authoring contract (initial version)

`report.sql` is a frontend authoring resource. The parser accepts one read-only
statement with this grammar:

```text
query       := SELECT [DISTINCT] [TOP positive_integer] select_item ("," select_item)* FROM table_ref join* [WHERE predicate (AND predicate)*] [GROUP BY field ("," field)*] [HAVING having_predicate (AND having_predicate)*] [ORDER BY sort_item ("," sort_item)*] [";"]
join        := [INNER | LEFT | RIGHT] JOIN table_ref ON field "=" field
table_ref   := table [AS alias]
select_item := "*"
             | field [AS alias]
             | aggregate "(" (field | "*") ")" [AS alias]
             | supported_function "(" supported_arguments ")" [AS alias]
             | (field | number) arithmetic (field | number) AS alias
             | simple_case AS alias
             | supported_window OVER "(" ORDER BY sort_item ("," sort_item)* ")" AS alias
aggregate   := COUNT | SUM | AVG | MIN | MAX
predicate   := field comparison literal
             | field (LIKE | NOT LIKE) string_literal
             | field (IN | NOT IN) "(" literal ("," literal)* ")"
             | field (BETWEEN | NOT BETWEEN) literal AND literal
             | field (IS NULL | IS NOT NULL)
having_predicate := aggregate "(" (field | "*") ")" comparison literal
comparison  := = | != | <> | > | < | >= | <=
field       := identifier | identifier "." identifier
table       := identifier
literal     := number | single-quoted string | TRUE | FALSE
sort_item   := field [ASC | DESC]
arithmetic  := + | - | * | / | %
```

Identifiers are unquoted ASCII identifiers beginning with a letter or
underscore. Keywords are case-insensitive. A single trailing semicolon is
allowed. SQL comments and multiple statements are not allowed. Static `OR`,
parenthesized predicates, bare `NULL` literals, quoted identifiers, and
database-specific syntax are outside the initial grammar.
Static WHERE predicates are joined only by `AND`. SQL `OR` and parentheses stay
unsupported because the flat public `filterLogic` cannot preserve
`(static A OR static B) AND runtime C` after UI filters are added.

`DISTINCT` maps to `distinct: true`; `TOP n` maps to the static `limit: n` and
requires a positive integer. Neither changes runtime pagination.

The supported scalar subset maps only to verified public function objects:

- unary field functions: `UPPER`, `LOWER`, `LTRIM`, `RTRIM`, `TRIM`, `LEN`,
  `YEAR`, `MONTH`, `DAY`, `ISDATE`, `ABS`, `CEILING`, `FLOOR`, `SQRT`, `EXP`,
  and `LOG`;
- zero-argument functions: `GETDATE()`, `SYSDATETIME()`, and
  `CURRENT_TIMESTAMP`;
- named-option forms: `ROUND`, `POWER`, `LEFT`, `RIGHT`, `SUBSTRING`, and
  `NULLIF`;
- field-only `CONCAT`, fields plus a final literal default for `COALESCE`, and
  `STRING_AGG(field, separator)`.

Nested function calls and the remaining backend functions stay unsupported
until their SQL argument grammar can be mapped without ambiguity. Arithmetic is
limited to two field/number operands and requires an alias. CASE supports one or
more simple literal-comparison WHEN clauses, a literal ELSE, and an alias.

Window authoring supports `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `LAG`,
`LEAD`, `FIRST_VALUE`, and `LAST_VALUE` with a logical `ORDER BY` inside `OVER`.
It maps that ordering to the field object's existing `sort` array. An alias is
required. `PARTITION BY`, frames, expressions, and positional ordering are
rejected because the public request has no matching partition/frame shape.

`GROUP BY` accepts one or more normal or table-qualified source fields after
FROM and the optional WHERE clause. Field order is preserved. Positional values,
SELECT aliases, expressions, empty list entries, `ROLLUP`, `CUBE`, and
`GROUPING SETS` are rejected. Every non-aggregate selected field must appear in
the group list using the same logical field reference; `SELECT *` cannot be
combined with grouping.

`HAVING` follows `GROUP BY` and maps to the existing aggregate-condition API
shape: `{ function, field, operator, value }`. It supports `COUNT`, `SUM`,
`AVG`, `MIN`, and `MAX` comparisons joined by `AND`; only `COUNT` may use `*`.
Predicate order is preserved. This initial subset requires `GROUP BY` and
rejects aliases, plain fields, positional references, arbitrary expressions,
unsupported functions, and `OR`. HAVING conditions remain separate from WHERE
base filters because they filter aggregate results rather than source rows.

## Basic JOIN mapping

Bare `JOIN` and `INNER JOIN` map to `type: "INNER"`; `LEFT JOIN` and
`RIGHT JOIN` map to `LEFT` and `RIGHT`. Each join becomes the existing Universal
API shape:

```json
{
  "type": "LEFT",
  "source": { "table": "ItemMasterTable", "alias": "related" },
  "on": {
    "left": "base.Item_Code",
    "operator": "=",
    "right": "related.Item_Code"
  }
}
```

Joins are kept in author order. Each join supports exactly one column-to-column
equality. Qualified fields remain logical strings and are not stripped. Explicit
`AS` aliases are supported for the base and joined tables because both existing
API source shapes carry an alias. Implicit aliases are rejected.

`FULL`, `FULL OUTER`, `LEFT OUTER`, `RIGHT OUTER`, and `CROSS` joins are outside
this initial authoring subset, as are multiple `ON` predicates, non-equality
operators, expressions, subqueries, `USING`, and vendor-specific join syntax.

## SELECT and FROM mapping

The parser maps `FROM CustomerTable` to:

```json
{ "source": { "table": "CustomerTable" } }
```

Explicit FROM aliases are supported as `{ table, alias }`; implicit aliases and
qualified table names are unsupported. A qualified column such as
`CustomerTable.Cust_Name` is allowed because the Universal API already
represents field names as strings.

SELECT mappings use the existing `QueryField` contract:

| SQL | `QueryDefinition.fields` entry |
| --- | --- |
| `*` | `"*"` |
| `Cust_Name` | `"Cust_Name"` |
| `Cust_Name AS Name` | `{ "field": "Cust_Name", "alias": "Name" }` |
| `COUNT(*) AS Total` | `{ "function": "COUNT", "field": "*", "alias": "Total" }` |
| `SUM(Bill_Amt)` | `{ "function": "SUM", "field": "Bill_Amt" }` |

The Universal API uses `field`, not `column`, inside function objects. Only
`COUNT` accepts `*`; `SUM(*)`, `AVG(*)`, `MIN(*)`, and `MAX(*)` are invalid.
Expressions and functions outside the explicitly supported forms above fail
validation rather than receiving an ad-hoc representation.

## WHERE and immutable base filters

Each WHERE predicate becomes a `baseFilters` entry. For example,
`WHERE IsDeleted = 0 AND Status = 'Active'` maps to:

```json
[
  { "field": "IsDeleted", "operator": "=", "value": 0 },
  { "field": "Status", "operator": "=", "value": "Active" }
]
```

Base filters belong to `QueryDefinition` and are immutable. UI values belong
to `QueryRuntimeState.filters`; changing them never changes the SQL text.

With runtime `filterLogic: "AND"`, conversion safely produces one AND list:

```text
(base A) AND (runtime A) AND (runtime B)
```

The current Universal request has only one top-level `filterLogic`. It cannot
express the required grouping for:

```text
(base A) AND (runtime A OR runtime B)
```

Consequently, conversion rejects a base-filter request containing multiple
runtime OR filters with `UnsupportedRuntimeFilterGroupingError`. Supporting
this requires an API representation for nested
filter groups (or distinct base/runtime groups) and corresponding backend
support. No such shape is added in this phase.

## Feature classification

| Feature | Initial status |
| --- | --- |
| SELECT / DISTINCT / TOP / FROM / JOIN / WHERE / GROUP BY / HAVING / ORDER BY | Supported within the grammar above |
| Scalar functions | Partial; exact supported forms are listed above |
| Arithmetic and simple searched CASE | Supported within the restricted forms above |
| Window functions | Supported without PARTITION BY or frames |
| WITH / CTE | Unsupported initially |
| UNION / UNION ALL | Unsupported initially |
| Filter subqueries / EXISTS | Public API shape exists, but unsupported in report.sql until recursive parsing and runtime composition are introduced |
| INSERT, UPDATE, DELETE, EXEC, stored procedures, dynamic SQL | Unsupported |
| INTERSECT / EXCEPT and routines | Unsupported in report.sql |

Existing JSON reports may continue using Universal API features that are not
yet part of this SQL subset.

## Resources and safety

SQL resources live directly in `src/config/reports/` for standalone reports
and `src/config/widgets/` for reusable data-driven widgets. Each category is
bundled by its own explicit Vite static glob and resolved only through its
corresponding registry. A reference is a case-sensitive basename, for example:

```json
{ "format": "sql", "resource": "customer.sql" }
```

References must match `[A-Za-z0-9][A-Za-z0-9._-]*.sql`. Subdirectories,
absolute paths, `..`, query strings, fragments, and URLs are rejected. A valid
but absent resource returns `undefined` from that category's low-level lookup
and makes report/widget resolution fail clearly. The report loader never scans
widget resources, and the widget loader never scans report resources. Duplicate
basenames within a registry make registry construction fail.

These SQL files are static authoring resources, not secrets. They must not
contain credentials, passwords, connection strings, or API secrets. The loader
does not execute SQL, connect to a database, or send SQL to the backend. The
backend remains responsible for database access, credentials, parameterization,
execution, and security.

## Runtime separation

`QueryDefinition` contains the static source, fields, base filters, joins,
grouping, HAVING, DISTINCT, TOP/limit, and authored base sorting. Runtime sorting
overrides authored base sorting. `QueryRuntimeState` contains UI filters and
their logic, logical-field sorting, and `{ page, pageSize }` pagination. Search
application state and future runtime grouping selections remain UI concerns.
Neither authored nor runtime sorting uses positional values such as `ORDER BY
1`. No runtime state is interpolated into SQL text.

SQL is the only production authoring format for anything that changes database
results or computation. Report and widget JSON may describe columns, labels,
filter controls, grid behavior, pagination controls, export, and presentation,
but must not duplicate SELECT fields, aggregates, joins, static filters,
GROUP BY, HAVING, or static ORDER BY. The JSON `queryDefinition` object only
identifies the statically bundled SQL resource. User-entered filters, sorting,
and pagination remain runtime state and are merged only after SQL parsing.
