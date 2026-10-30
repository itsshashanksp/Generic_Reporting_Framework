# Runtime feature coverage

The local runtime library is deployment configuration and remains Git-ignored. `npm run config:audit` nevertheless loads these files directly from `src/config` and validates them alongside the public examples.

| Capability | Runtime configuration |
| --- | --- |
| INR currency stats | Item Dashboard; Bill Dashboard |
| Percentage column | Item Dashboard (`GST %`); Sales Dashboard (`GST %`) |
| Currency tables and Excel formats | Item, Bill, Receipts, and Sales dashboards; Customer and Item reports |
| Dynamic select page filter | Item Dashboard (`GST %`) |
| Text and numeric filters | Item Dashboard; Customer and Item reports |
| Date-range page filter | Bill, Purchase, Receipts, and Sales dashboards |
| Selective page-filter exclusion | Item Dashboard (`Total Items`) |
| Inline and dialog widget filters | Item Dashboard |
| Standard Grid | Every dashboard table; Item and Customer reports |
| Reporting Grid with totals | Bill Dashboard month/category table |
| JSON Query report | Item Report |
| SQL Resource report | Customer Report |
| SQL Resource widgets | All runtime dashboards |
| Explicit database selection | Bill Dashboard resources; application Settings |
| Doughnut and vertical bar charts | Item Dashboard |
| Line chart | Purchase Dashboard |
| Area and treemap charts | Sales Dashboard |
| Pie and radial-bar charts | Receipts Dashboard |
| CSV, Excel, PNG, and SVG export | Table/report and chart configurations as applicable |
| Responsive layout and authored dimensions | All dashboards |
| Optional auto-refresh | All dashboards (disabled demo default) |

The chart schema has one `bar` type with `orientation`; it does not expose a separate `column` identifier. A vertical bar in Item Dashboard demonstrates the column presentation without inventing an unsupported chart type. No synthetic row-number capability exists in the current framework, so no demo configuration is assigned to it.
