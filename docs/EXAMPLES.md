# Backend-verified examples

These examples use only the backend public request contract. Physical table names in JSON Query examples must exist in the connected database. SQL Resource examples use IDs discovered by the current backend.

## JSON Query: select, filter, sort, and page

```json
{
  "id": "items-json",
  "title": "Items",
  "request": {
    "action": "select",
    "source": { "table": "ItemMasterTable", "alias": "I" },
    "fields": [
      { "field": "I.Item_Code", "alias": "ItemCode" },
      { "field": "I.Item_Desc", "alias": "Description" },
      { "field": "I.Item_MRP", "alias": "MRP" }
    ],
    "filters": [{ "field": "I.Item_MRP", "operator": ">", "value": 0 }],
    "filterLogic": "AND",
    "sort": [{ "field": "ItemCode", "direction": "ASC" }]
  },
  "columns": [
    { "field": "ItemCode", "header": "Item Code" },
    { "field": "Description", "header": "Description" },
    { "field": "MRP", "header": "MRP" }
  ],
  "filters": [
    { "field": "I.Item_Desc", "label": "Description", "type": "text", "operator": "contains" }
  ],
  "grid": {
    "pagination": { "enabled": true, "pageSize": 10, "pageSizeOptions": [10, 25, 50, 100] },
    "rowSelection": "multiple"
  }
}
```

The runtime adds `pagination:{page,pageSize}` and maps `contains` to a prepared `LIKE "%value%"` filter.

## JSON Query: joins, grouping, aggregation, and HAVING

```json
{
  "action": "select",
  "source": { "table": "Orders", "alias": "O" },
  "fields": [
    "C.CustomerName",
    { "function": "SUM", "field": "O.Amount", "alias": "TotalAmount" }
  ],
  "joins": [{
    "type": "INNER",
    "source": { "table": "Customers", "alias": "C" },
    "on": { "left": "O.CustomerId", "operator": "=", "right": "C.CustomerId" }
  }],
  "groupBy": ["C.CustomerName"],
  "having": [{ "function": "SUM", "field": "O.Amount", "operator": ">", "value": 1000 }],
  "sort": [{ "field": "TotalAmount", "direction": "DESC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

JSON joins are limited to INNER/LEFT/RIGHT and one equality condition. HAVING entries are aggregate comparisons combined with AND.

## JSON Query: DISTINCT, CASE, arithmetic, and functions

```json
{
  "action": "select",
  "source": { "table": "Items" },
  "distinct": true,
  "limit": 100,
  "fields": [
    "ItemCode",
    {
      "case": {
        "when": [{ "condition": { "field": "Status", "operator": "=", "value": "A" }, "then": "Active" }],
        "else": "Inactive"
      },
      "alias": "StatusText"
    },
    { "expression": { "left": "Amount", "operator": "*", "right": 1.18 }, "alias": "GrossAmount" },
    { "function": "COALESCE", "fields": ["PreferredName", "Name"], "default": "Unknown", "alias": "DisplayName" },
    { "function": "ROUND", "field": "Amount", "precision": 2, "alias": "RoundedAmount" }
  ]
}
```

## JSON Query: subqueries and CTE

```json
{
  "action": "select",
  "source": { "table": "Customers", "alias": "C" },
  "fields": ["C.CustomerCode", "C.Name"],
  "filters": [{
    "field": "C.CustomerCode",
    "operator": "IN",
    "query": {
      "source": { "table": "Bills" },
      "fields": ["CustomerCode"],
      "filters": [{ "field": "Amount", "operator": ">", "value": 1000 }]
    }
  }]
}
```

```json
{
  "action": "select",
  "with": {
    "name": "ActiveItems",
    "query": {
      "source": { "table": "Items" },
      "fields": ["ItemCode"],
      "filters": [{ "field": "Active", "operator": "=", "value": true }]
    }
  },
  "source": { "table": "ActiveItems" },
  "fields": ["ItemCode"]
}
```

Only IN/NOT IN/EXISTS/NOT EXISTS accept filter subqueries. Nested bodies cannot sort, paginate, or define another CTE.

## Runtime filter configurations

```json
[
  { "field": "Name", "label": "Name", "type": "text", "operator": "notContains" },
  { "field": "Amount", "label": "Amount", "type": "number", "operator": "between" },
  { "field": "Status", "label": "Status", "type": "multiselect", "operator": "notIn", "options": [{ "label": "Closed", "value": "Closed" }] },
  { "field": "Active", "label": "Active", "type": "boolean", "operator": "equals" },
  { "field": "BillDate", "label": "Bill date", "type": "daterange", "operator": "between" },
  { "field": "DeletedAt", "label": "Deleted", "type": "date", "operator": "isNull" }
]
```

Representative emitted filters:

```json
[
  { "field": "Name", "operator": "NOT LIKE", "value": "%Acme%" },
  { "field": "Amount", "operator": "BETWEEN", "value": [10, 20] },
  { "field": "Status", "operator": "NOT IN", "value": ["Closed"] },
  { "field": "Active", "operator": "=", "value": true },
  { "field": "DeletedAt", "operator": "IS NULL" }
]
```

The UI uses a configured operator per filter. EXISTS/NOT EXISTS are available only in an authored JSON request because they require a query rather than an end-user value.

All configurable UI operators map as follows:

| UI operator | Backend operator/value |
| --- | --- |
| `equals`, `notEquals` | `=`, `!=` |
| `contains`, `notContains` | `LIKE`, `NOT LIKE` with `%value%` |
| `startsWith`, `notStartsWith` | `LIKE`, `NOT LIKE` with `value%` |
| `endsWith`, `notEndsWith` | `LIKE`, `NOT LIKE` with `%value` |
| `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual` | `>`, `<`, `>=`, `<=` |
| `in`, `notIn` | `IN`, `NOT IN` with an array |
| `between`, `notBetween` | `BETWEEN`, `NOT BETWEEN` with two values |
| `isNull`, `isNotNull` | `IS NULL`, `IS NOT NULL` with no `value` property |

The authored JSON Query contract additionally accepts `<>`, `EXISTS`, and `NOT EXISTS`.

## Actual SQL Resource: item

Frontend report source:

```json
{
  "queryDefinition": {
    "format": "sql",
    "resource": "reports/item",
    "execution": {
      "columns": ["Item_Code", "Item_Desc", "Item_MRP"],
      "defaultSort": [{ "field": "Item_Code", "direction": "ASC" }]
    }
  }
}
```

Runtime request:

```json
{
  "action": "sql",
  "resource": "reports/item",
  "execution": {
    "columns": ["Item_Code", "Item_Desc", "Item_MRP"],
    "defaultSort": [{ "field": "Item_Code", "direction": "ASC" }]
  },
  "filters": [{ "field": "Item_Desc", "operator": "LIKE", "value": "%pen%" }],
  "sort": [{ "field": "Item_Code", "direction": "ASC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

Flow: frontend ID `reports/item` → backend discovery/resolution → server-owned resource → SQL Server → standard response with `Item_Code`, `Item_Desc`, and `Item_MRP`. The frontend never constructs or sends the server file path.

The selected resource resolves on the backend to:

```sql
SELECT
    Item_Code,
    Item_Desc,
    Item_MRP
FROM ItemMasterTable
```

An abbreviated response is:

```json
{
  "success": true,
  "message": "Query executed successfully.",
  "data": [{ "Item_Code": "PEN-01", "Item_Desc": "Blue pen", "Item_MRP": 20 }],
  "meta": { "page": 1, "pageSize": 10, "totalRows": 1, "rowsReturned": 1, "executionTime": 4 }
}
```

## Actual SQL Resource: customer

Frontend report source:

```json
{
  "queryDefinition": {
    "format": "sql",
    "resource": "reports/customer",
    "execution": {
      "columns": ["Cust_Name", "TotalCustomers", "MinimumBill", "MaximumBill"],
      "filters": {
        "Cust_Name": { "expression": "Cust_Name", "placement": "source" },
        "StDate": { "expression": "StDate", "placement": "source", "valueType": "integer-date" }
      },
      "defaultSort": [{ "field": "Cust_Name", "direction": "ASC" }]
    }
  }
}
```

Runtime request:

```json
{
  "action": "sql",
  "resource": "reports/customer",
  "execution": {
    "columns": ["Cust_Name", "TotalCustomers", "MinimumBill", "MaximumBill"],
    "filters": {
      "Cust_Name": { "expression": "Cust_Name", "placement": "source" },
      "StDate": { "expression": "StDate", "placement": "source", "valueType": "integer-date" }
    },
    "defaultSort": [{ "field": "Cust_Name", "direction": "ASC" }]
  },
  "filters": [
    { "field": "Cust_Name", "operator": "LIKE", "value": "A%" },
    { "field": "StDate", "operator": "BETWEEN", "value": ["2021-04-01", "2022-03-31"] }
  ],
  "filterLogic": "AND",
  "sort": [{ "field": "MaximumBill", "direction": "DESC" }],
  "pagination": { "page": 1, "pageSize": 10 }
}
```

Flow: frontend ID `reports/customer` → backend discovery/resolution → server-owned Customer resource → backend-validated source placement and integer-date conversion → grouped standard response. `execution` is copied from reviewed configuration; runtime users supply only filter values.

The backend-owned SQL resource is:

```sql
SELECT
    Cust_Name,
    COUNT(Cust_Name) AS TotalCustomers,
    MIN(Bill_Amt) AS MinimumBill,
    MAX(Bill_Amt) AS MaximumBill
FROM CustomerTable
/*__RUNTIME_FILTERS__*/
GROUP BY Cust_Name
```

The existing marker is part of the backend-owned file and is harmless in discovered mode. It is neither known nor sent by the frontend.

## Actual dashboard SQL Resources

The current dashboards use these discovered IDs:

- `widgets/item-dashboard-table`, `widgets/item-dashboard-stats`
- `widgets/bill-total-sales`, `widgets/bill-total-purchases`
- `widgets/bill-sales-month-wise`, `widgets/bill-purchases-month-wise`
- `widgets/bill-top-10-categories`, `widgets/bill-category-sales-month-wise`
- `widgets/TOP-10-month-Wise-Category-wise`

Dashboard JSON contains a logical resource ID, reviewed execution metadata when runtime controls need it, and presentation fields. It never contains the backend file path or SQL text.

## Column visibility

```json
{
  "columns": [
    { "field": "Item_Code", "header": "Item Code", "visible": true },
    { "field": "InternalNote", "header": "Internal note", "visible": false }
  ]
}
```

Visibility affects only `GenericGrid`; it does not change a JSON projection or SQL Resource query.
