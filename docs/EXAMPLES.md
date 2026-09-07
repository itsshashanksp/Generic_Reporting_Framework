# Examples and recipes

The snippets below use only properties accepted by the current frontend. Full report files include the required `columns` and `filters` properties.

## 1. Minimal JSON report

```json
{
  "id": "customers",
  "title": "Customers",
  "request": {
    "action": "select",
    "source": { "table": "customers" },
    "fields": ["id", "name"]
  },
  "columns": [
    { "field": "id", "header": "ID" },
    { "field": "name", "header": "Name", "width": 240 }
  ],
  "filters": []
}
```

## 2. Minimal SQL resource report

```json
{
  "id": "revenue",
  "title": "Revenue",
  "queryDefinition": { "format": "sql", "resource": "revenue-report" },
  "columns": [
    { "field": "period", "header": "Period" },
    { "field": "revenue", "header": "Revenue" }
  ],
  "filters": []
}
```

## 3. Text and numeric filters

```json
[
  { "field": "name", "label": "Name", "type": "text", "operator": "contains", "placeholder": "Part of a name" },
  { "field": "amount", "label": "Minimum amount", "type": "number", "operator": "greaterThanOrEqual" }
]
```

## 4. Select and multiselect filters

```json
[
  {
    "field": "status",
    "label": "Status",
    "type": "select",
    "options": [{ "label": "Open", "value": "OPEN" }, { "label": "Closed", "value": "CLOSED" }]
  },
  {
    "field": "region_id",
    "label": "Regions",
    "type": "multiselect",
    "operator": "in",
    "options": [{ "label": "North", "value": 1 }, { "label": "South", "value": 2 }]
  }
]
```

## 5. Date range and null filters

```json
[
  { "field": "created_at", "label": "Created", "type": "daterange", "operator": "between" },
  { "field": "deleted_at", "label": "Is deleted", "type": "date", "operator": "isNotNull" }
]
```

## 6. Request with a join, grouping and having

```json
{
  "action": "select",
  "source": { "table": "orders", "alias": "o" },
  "fields": [
    { "field": "o.customer_id", "alias": "customer_id" },
    { "function": "SUM", "field": "o.total", "alias": "total_amount" }
  ],
  "joins": [
    { "type": "LEFT", "source": { "table": "customers", "alias": "c" }, "on": { "left": "o.customer_id", "operator": "=", "right": "c.id" } }
  ],
  "groupBy": ["o.customer_id"],
  "having": [{ "function": "SUM", "field": "o.total", "operator": ">", "value": 1000 }],
  "sort": [{ "field": "total_amount", "direction": "DESC" }],
  "limit": 100
}
```

## 7. Grid and export configuration

```json
{
  "grid": {
    "pagination": { "enabled": true, "pageSize": 25, "pageSizeOptions": [25, 50] },
    "rowSelection": "multiple"
  },
  "toolbar": { "export": true, "refresh": true, "settings": false, "saveReport": true },
  "export": {
    "enabled": true,
    "formats": ["csv", "excel"],
    "filename": "customer-orders",
    "exportCurrentView": true,
    "exportAll": true
  }
}
```

## 8. Configured grouping columns

```json
{
  "enabled": true,
  "groups": [{ "field": "region", "header": "Region" }],
  "aggregates": [
    { "field": "order_count", "function": "COUNT", "header": "Orders" },
    { "field": "amount", "function": "SUM", "alias": "total_amount", "header": "Total" }
  ]
}
```

The response must already contain `region`, `order_count`, and `total_amount`.

## 9. Inline stat widget

```json
{
  "id": "open-total",
  "type": "stat",
  "title": "Open value",
  "width": 3,
  "request": {
    "action": "select",
    "source": { "table": "orders" },
    "fields": [{ "function": "SUM", "field": "total", "alias": "open_total" }],
    "filters": [{ "field": "status", "operator": "=", "value": "OPEN" }]
  },
  "valueField": "open_total",
  "format": "currency"
}
```

## 10. Inline table widget

```json
{
  "id": "recent-orders",
  "type": "table",
  "title": "Recent orders",
  "width": 8,
  "height": 420,
  "queryDefinition": { "format": "sql", "resource": "recent-orders" },
  "columns": [
    { "field": "id", "header": "Order" },
    { "field": "total", "header": "Total" }
  ],
  "pageSize": 10,
  "pageSizeOptions": [10, 25, 50],
  "export": { "enabled": true, "formats": ["csv"], "exportAll": true }
}
```

## 11. Inline chart widget

```json
{
  "id": "sales-by-month",
  "type": "chart",
  "title": "Sales by month",
  "width": 6,
  "height": 360,
  "queryDefinition": { "format": "sql", "resource": "sales-by-month" },
  "chartType": "line",
  "xField": "month",
  "yField": "sales",
  "showLegend": false,
  "showTooltip": true,
  "showGrid": true,
  "showLabels": false
}
```

## 12. Report-backed widget

```json
{
  "id": "customer-report-panel",
  "type": "report",
  "title": "Customers",
  "reportId": "customers",
  "width": 12
}
```

## 13. Responsive dashboard

```json
{
  "id": "operations",
  "title": "Operations",
  "layout": { "columns": 12, "tabletColumns": 6, "mobileColumns": 1 },
  "autoRefresh": { "enabled": true, "interval": 60000 },
  "filters": [
    { "field": "region", "label": "Region", "type": "select", "options": [{ "label": "North", "value": "N" }] }
  ],
  "widgets": [
    {
      "id": "operations-total",
      "type": "stat",
      "title": "Operations",
      "width": 3,
      "position": { "x": 0, "y": 1 },
      "queryDefinition": { "format": "sql", "resource": "operations-total" },
      "valueField": "total",
      "format": "number"
    }
  ]
}
```

## 14. Navigation group

```json
[
  { "id": "home", "title": "Home", "icon": "dashboard", "dashboardId": "operations" },
  {
    "id": "reporting",
    "title": "Reporting",
    "icon": "reports",
    "children": [
      { "id": "customers-link", "title": "Customers", "icon": "report", "reportId": "customers" }
    ]
  }
]
```

## Common recipes

- **Add a report:** create `src/config/reports/<id>.json`, choose one query mode, add output columns and `filters` (even if empty), then add a `reportId` menu entry.
- **Add a dashboard:** create `src/config/dashboards/<id>.json`, choose the layout and widget sources, then add a `dashboardId` menu entry.
- **Reuse data:** point a report widget at `reportId`; for stat/table/chart, use `reportId` or register a reusable widget and use `widgetId`.
- **Add a backend SQL resource:** register it on the backend, then reference its opaque ID with `{ "format":"sql", "resource":"..." }`; do not add frontend SQL.
- **Add filtering:** ensure the backend accepts the filter field, add a filter definition, and test empty, populated and required states.
