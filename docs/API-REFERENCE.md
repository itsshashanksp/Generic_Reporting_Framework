# Backend API reference for frontend developers

The frontend sends JSON by `POST` to `VITE_API_URL` with `Content-Type: application/json`. Report and widget data use one of two read modes and converge on the same response/rendering pipeline.

## JSON Query mode

Configure a report with a top-level `request`:

```json
{
  "action": "select",
  "source": { "table": "Orders", "alias": "O" },
  "fields": ["O.OrderId", { "field": "O.Amount", "alias": "Amount" }],
  "filters": [{ "field": "O.Status", "operator": "=", "value": "Open" }],
  "filterLogic": "AND",
  "sort": [{ "field": "O.OrderId", "direction": "ASC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

The backend accepts `source`, `fields`, `filters`, `joins`, `groupBy`, `having`, `sort`, `pagination`, `distinct`, `limit`, `filterLogic`, and one standard or recursive `with`. Unknown properties are rejected. See [Examples](EXAMPLES.md) for validated joins and grouping.

JSON Query filters accept `=`, `!=`, `<>`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `BETWEEN`, `NOT BETWEEN`, `IS NULL`, `IS NOT NULL`, `EXISTS`, and `NOT EXISTS`. IN/NOT IN may use a non-empty values list or one-column subquery; EXISTS forms require a subquery and omit `field`. There is one flat `filterLogic`, not nested groups.

Public JSON field functions are:

- Aggregates: COUNT, SUM, AVG, MIN, MAX, STRING_AGG.
- String/null/conversion: UPPER, LOWER, LTRIM, RTRIM, TRIM, LEN, CONCAT, LEFT, RIGHT, SUBSTRING, REPLACE, CHARINDEX, PATINDEX, FORMAT, COALESCE, ISNULL, NULLIF, CAST, CONVERT.
- Date/time: YEAR, MONTH, DAY, DATEPART, DATENAME, GETDATE, SYSDATETIME, CURRENT_TIMESTAMP, DATEADD, DATEDIFF, EOMONTH, ISDATE, DATEFROMPARTS, DATETIMEFROMPARTS.
- Conditional/math: IIF, CHOOSE, ABS, CEILING, FLOOR, SQRT, EXP, LOG, ROUND, POWER.
- Windows: ROW_NUMBER, RANK, DENSE_RANK, NTILE, LAG, LEAD, FIRST_VALUE, LAST_VALUE; all require `sort`, and PARTITION BY is not public.

TIMEFROMPARTS is intentionally omitted because the current backend public validator cannot accept its required `fractions` property.

## SQL Resource mode

Frontend configuration:

```json
{
  "queryDefinition": { "format": "sql", "resource": "customer" }
}
```

Normalized runtime request:

```json
{
  "action": "sql",
  "resource": "customer",
  "filters": [{ "field": "Cust_Name", "operator": "LIKE", "value": "A%" }],
  "filterLogic": "AND",
  "sort": [{ "field": "MaximumBill", "direction": "DESC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

`customer` is an opaque, case-sensitive backend registry key. It is not SQL text, a filename, or a path. SQL action requests accept only `action`, `resource`, `filters`, `filterLogic`, `sort`, and `pagination`. Runtime fields must be allowlisted for that resource. SQL Resource filters do not accept subqueries or EXISTS.

SQL Resource runtime filters accept every value/list/range/null operator above except EXISTS/NOT EXISTS. A non-empty runtime sort replaces the registered default sort; otherwise the backend resource default applies. Multiple sort entries are supported. Pagination requires positive integers and normally uses a separate total count.

## Runtime merge

The runtime appends configured UI filters to static request filters, uses the current grid sort, and supplies page/pageSize when pagination is enabled. UI filter definitions select a fixed operator; there is no interactive operator builder or nested Boolean-group editor.

Filter values are never SQL fragments. List and range values remain arrays. `IS NULL` and `IS NOT NULL` omit `value`. SQL Resource placement (`output`, `where`, or `having`), integer-date conversion, expressions, and parameter placeholders are backend registry concerns.

## Standard response

```json
{
  "success": true,
  "message": "Data Loaded Successfully",
  "data": [{ "Item_Code": "A001" }],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalRows": 37,
    "rowsReturned": 10,
    "executionTime": 2.41
  }
}
```

The frontend requires object rows and valid metadata on successful responses. On failure the backend returns `success:false`, `data:[]`, no `meta`, and may include `error:{code,details}`. The client exposes HTTP status, backend code, and details through `ApiClientError`; screens show the public message and retry controls.

## Backend capabilities not exposed by this frontend

The backend also has public UNION/UNION ALL, routine, metadata, and registered write actions. Current report/widget configuration intentionally exposes only `select` and `sql`. There is no create/edit/delete/upsert UI, transaction UI, routine runner, metadata browser, raw SQL field, or SQL-resource registration feature.

[Capability matrix](BACKEND-CAPABILITY-MATRIX.md) · [Query modes](QUERY-MODES.md) · [Configuration](CONFIGURATION.md)
