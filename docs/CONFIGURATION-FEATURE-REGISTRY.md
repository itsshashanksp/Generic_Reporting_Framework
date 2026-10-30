# Configuration feature registry

The executable configuration contracts are the report validator, dashboard validator, navigation loader, and their normalization loaders. The typed registry in `src/config/featureRegistry.ts` is the human-readable index of those contracts. `npm run config:audit` verifies that every registry entry links to real, runtime-validated examples and existing documentation.

The framework currently uses one canonical configuration format. It has no version property and Phase 1.5 does not add one: making a version mandatory would reject existing deployments without improving current loader behavior. Compatibility is maintained through documented legacy properties and normalization at loader boundaries.

## Inventory

| Feature | Scope | Required core | Optional/default behavior | Examples |
| --- | --- | --- | --- | --- |
| Navigation menu | navigation | id, title, icon, destination | visible defaults true; children optional | `examples/menu.json` |
| Dashboard/layout | dashboard | id, title, widgets | description and responsive layout optional | minimal dashboard |
| Auto refresh | dashboard | none | disabled when omitted | widget catalog |
| Database context | request/application | none | explicit request database overrides session/global/backend defaults | database-selector examples |
| Report source | report | id, title, exactly one data source, columns, grid, toolbar | filters, sorting and export optional | JSON Query and SQL Resource reports |
| JSON Query | request | action, source, fields | joins, grouping, HAVING, CTE, filters and limit optional | JSON Query report |
| Columns/currency | grid | field, header | visibility, sizing, type and alignment optional | filter and reporting-grid reports |
| Runtime filters | filter | field, label, type | operator, static/dynamic options and presentation optional | filter catalog and widget-filter dashboards |
| Targeted filters | filter | none | `targetGrids` and `filterFields` opt in | combined widget-filter dashboard |
| Pagination/sorting | grid | report pagination core | modern presentation controls optional | filter and widget catalogs |
| Reporting Grid | grid | enabled plus non-empty groups when enabled | expansion, group-header totals, subtotals, grand total and export behavior have documented defaults | reporting-grid report |
| Widgets | widget | id, type, title and data definition/reference | layout and visibility optional | widget catalog and reusable widget |
| Stat formatting | widget | valueField | number format default | widget catalog |
| Charts | chart | chart type, xField, yField | appearance and presentation optional | widget catalog |
| Chart colors | chart | none | built-in palette when maps are omitted | widget catalog |
| Report/table exports | export | enabled and formats when configured | filename and scopes optional | reporting-grid report |
| Chart exports | export | enabled and formats when configured | filename optional | widget catalog |

The TypeScript registry records the complete property lists, defaults, supported values, dependencies, validation rules, deprecations, example references, and documentation references.

## Application behavior that is not JSON configuration

Global notifications, chart action menu organization, session database persistence, authorization enforcement, request caching, and Settings persistence are application/runtime behavior. They deliberately have no per-report or per-widget JSON flags. Branding is currently a typed build-time application constant in `src/config/branding.ts`, not deployment JSON.

## Strictness, compatibility and extension points

Canonical objects reject unknown properties through their scope-specific validators. Dynamic maps remain intentional only where documented, including `filterFields`, chart color maps, and runtime filter values. Backend authorization and live metadata validation remain authoritative.

`databaseSelection: true` is a supported deprecated compatibility property. New configurations should rely on application Settings. Legacy widget `pageSize` and `pageSizeOptions` remain compatible; modern `pagination` takes precedence.

## Coverage audit

Run `npm run config:audit`. The audit checks registry completeness, unique feature IDs, example ownership, documentation links, report validation, dashboard validation, reusable widget loading, navigation references, and documented deprecations. The broader test suite additionally validates ignored local runtime definitions when present, without publishing them.

## Migration

No Phase 1.5 migration is required. Existing valid JSON remains valid. Teams may adopt newer optional properties incrementally. Never bulk-rewrite ignored production JSON; validate it locally with the same loaders and apply only reviewed changes.
