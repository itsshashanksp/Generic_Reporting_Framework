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
| `dashboards/widget-catalog-dashboard.json` | Report/reusable/inline widgets; number/currency/decimal; bar/line/pie |
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
