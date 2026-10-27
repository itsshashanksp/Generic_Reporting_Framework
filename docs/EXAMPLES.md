# Examples

Application JSON is deployment-owned. Files under `src/config/` are local and
ignored by Git; the small, tracked `examples/` library is never loaded
automatically. Copy only the definitions an application needs, give them stable
IDs, update menu references, and rebuild.

| Example | Demonstrates |
|---|---|
| `reports/json-query-report.json` | JSON Query, dynamic options, filters, sorting, paging, saved views and export |
| `reports/sql-resource-report.json` | Backend-owned `catalog/customer-summary` resource |
| `reports/database-selector-report.json` | Runtime selection from backend-authorized databases |
| `reports/filter-catalog-report.json` | Every supported filter type and representative operators |
| `dashboards/minimal-dashboard.json` | Smallest useful stat dashboard |
| `dashboards/date-filtered-dashboard.json` | Required shared date range, field mapping, table/stat/chart widgets |
| `dashboards/database-selector-dashboard.json` | Database inheritance and an explicitly pinned widget |
| `dashboards/widget-catalog-dashboard.json` | Report/reusable/inline widgets; modern table paging; number/currency/decimal; horizontal bar, line and donut; Top-N/Others; all chart exports |
| `dashboards/widget-runtime-filters.json` | Independent table/chart widget filters over orders, customers and shipments |
| `dashboards/combined-dashboard-widget-filters.json` | Shared dashboard date filtering combined with widget-local filters |
| `dashboards/dynamic-widget-runtime-filters.json` | Widget-local dropdowns populated by JSON Query `dynamicOptions` |
| `dashboards/referenced-widget-runtime-filters.json` | Instance-local filters on reusable `widgetId` and referenced `reportId` widgets |
| `widgets/customer-summary.json` | Reusable SQL Resource table definition |
| `menu.json` | Nested dashboards, reports, and a direct route |

The illustrative schema uses `DemoOrders`, `DemoCustomers`, and
`DemoShipments`. Replace these names and logical database IDs with objects from
your deployment. SQL Resource IDs are paths relative to the backend discovery
root; `catalog/customer-summary` corresponds to
`queries/catalog/customer-summary.sql` after the generic backend example is
explicitly copied there.

```bash
cp examples/reports/json-query-report.json src/config/reports/orders.json
cp examples/dashboards/minimal-dashboard.json src/config/dashboards/overview.json
cp examples/menu.json src/config/menu.json
npm test -- --run src/config/__tests__/exampleLibrary.test.ts
```

Examples pass the real frontend validators but are not claimed to execute
against a live database. Test-only historical fixtures live under
`tests/fixtures/`; Vitest uses them to exercise the real Vite glob loaders.
Production and development builds never load that directory.

The catalog is the recommended feature-discovery template. It deliberately
shows optional presentation objects only on compatible widget types:
`pagination` on a table, `runtimeFilterDisplay` on a filtered stat, and
`chartOptions` plus PNG/SVG/CSV/Excel export on charts. Smaller examples may
omit those objects and continue to receive documented defaults.

## Widget-level runtime filters

`dashboard.filters` is one shared form whose applied values reach every widget. A widget's optional `runtimeFilters` uses the same filter-definition syntax but owns its draft, Apply, and Reset state. Applying it reloads only that widget; Reset does not clear dashboard filters, and dashboard Clear does not clear widget filters.

Copy-ready static filter:

```json
{
  "id": "orders",
  "type": "table",
  "title": "Orders",
  "request": {
    "action": "select",
    "source": { "table": "DemoOrders" },
    "fields": ["OrderId", "Status", "Amount"]
  },
  "runtimeFilters": [
    {
      "field": "Status",
      "label": "Order Status",
      "type": "select",
      "operator": "equals",
      "options": [
        { "label": "Open", "value": "OPEN" },
        { "label": "Closed", "value": "CLOSED" }
      ]
    }
  ]
}
```

Dynamic options use an ordinary authorized JSON Query:

```json
{
  "field": "CustomerId",
  "label": "Customer",
  "type": "select",
  "operator": "equals",
  "dynamicOptions": {
    "request": {
      "action": "select",
      "source": { "table": "DemoCustomers" },
      "fields": ["CustomerId", "CustomerName"],
      "sort": [{ "field": "CustomerName", "direction": "ASC" }],
      "limit": 500
    },
    "valueField": "CustomerId",
    "labelField": "CustomerName",
    "searchable": true
  }
}
```

The option request inherits the owning widget's effective database unless it explicitly supplies `database`. That preserves explicit widget databases, dashboard runtime selection, and the browser-local global fallback.

Dashboard, authored, and widget runtime conditions are appended to the same flat filter array and use the request's existing `filterLogic`. The validator rejects a widget runtime field that collides with a mapped dashboard filter or authored request filter; grouped per-scope Boolean logic is not available.

For `widgetId` and `reportId`, declare `runtimeFilters` on the dashboard widget instance. Existing reusable-widget and report `filters` are not automatically exposed. See `referenced-widget-runtime-filters.json` for both forms.

To install the examples:

```bash
cp examples/dashboards/widget-runtime-filters.json src/config/dashboards/
cp examples/dashboards/combined-dashboard-widget-filters.json src/config/dashboards/
cp examples/dashboards/dynamic-widget-runtime-filters.json src/config/dashboards/
cp examples/dashboards/referenced-widget-runtime-filters.json src/config/dashboards/
```

The referenced example also requires `orders-json-example` and `customer-summary-widget` to be copied from the report and widget example directories. Every example is illustrative: the deployment must provide compatible `DemoOrders`, `DemoCustomers`, and `DemoShipments` objects and install any referenced SQL Resource.
