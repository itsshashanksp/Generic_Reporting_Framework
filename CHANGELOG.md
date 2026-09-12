# Changelog

## Unreleased

### Added

- Backend capability matrix and concise frontend-facing API reference.
- Boolean filter controls and configured NOT LIKE filter variants.
- Contract tests for JSON Query mode, SQL Resource mode, filter serialization, grouping, pagination, response validation, and backend error details.

### Changed

- Migrated production SQL Resource references from legacy basename IDs to discovered `reports/...` and `widgets/...` IDs.
- Added reviewed SQL `execution` metadata to definitions that need runtime filtering, sorting, or deterministic pagination.
- Consolidated the repeated Item statistics SQL definition into one reusable widget configuration.
- Aligned frontend JSON request validation with the backend public SELECT contract, including operators, joins, grouping, HAVING, functions, subqueries, CTEs, sorting, and pagination.
- Standardized the default and examples on 10 records per page.
- Clarified JSON Query and opaque SQL Resource ownership throughout frontend documentation.

### Improved

- Preserved backend error status, code, and details in `ApiClientError`.
- Normalized numeric runtime filter values while retaining typed select and boolean values.
- Kept report, dashboard table, and report-widget presentation on the shared table frame, mobile cards, sort controls, and pagination.

### Removed

- Unused frontend SQL tokenizer/parser/converter and its historical tests.
- Unused global search context, grouping request builder, toolbar constants, response parser, and UI-state constants.
- Disabled report Settings action and the empty Settings route/menu placeholder.
- Unused saved-report grouping snapshot, which was recorded but never restored.

### Fixed

- NULL runtime filters now omit `value`, matching the backend contract.
- Mobile More/Export sheets render outside clipping/transform contexts through the existing menu portal.

### Documentation

- Replaced stale and hypothetical examples with backend-verified JSON requests and actual discovered `reports/item`, `reports/customer`, and `widgets/...` SQL Resource IDs.
- Added explicit supported, unsupported, limitation, roadmap, and ownership boundaries.
