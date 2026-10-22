# Changelog

All notable frontend changes. The repository has no release tags: `package.json` is `0.0.0` and the displayed application version (`src/config/version.ts`) is `1.0.0-dev`. Everything below is therefore **unreleased**. When a release is cut, move the shipped entries under a version heading.

Commit hashes refer to this repository. Entries are grouped by type; within a group, the newest come first.

## Unreleased

### Breaking / migration notes

- **Authentication is required.** Every application route now needs a backend session with `frontendAccess` (`c2dbb76`, `028e596`). A deployment must use a backend that implements the `setup.status` and `auth.*` actions described in [Authentication](docs/AUTHENTICATION.md).
- **Production API URL.** `npm run build` now fails when `VITE_API_URL` is a loopback, invalid, or non-http(s) URL. `.env.production` sets `/api` (`72dd668`).
- **Saved report views are per user.** Views are stored under `generic-report-saved-reports:user:<username>`, and the old shared key `generic-report-saved-reports` is deleted. Views saved before this change are not migrated (`983ee7d`).
- **The released resource ID `widgets/TOP-10-month-Wise-Category-wise` is no longer used.** The Bill and Sales dashboards use `widgets/sales-top-10-month-wise-category-wise`. Deploy the frontend and backend together (`15200c5`; see roadmap E3).
- **Excel export library.** `xlsx@0.18.5` was replaced by `write-excel-file`, and the AG Grid Enterprise module was removed (`983ee7d`).

### Added

- Runtime database selector for dashboards: `databaseSelection: true` adds a **Database** dropdown beside Refresh. Authorized IDs and labels come only from `metadata.databases`; frontend configuration no longer registers them. Widgets whose request names no database follow the selection, pinned widgets keep theirs, and refresh, filters, paging, sorting, and export follow the correct context.
- Runtime database selector for reports: `databaseSelection: true` uses the same backend-owned discovery. Switching reruns the report with the same filters and sort; refresh, paging, sorting, and All-rows export follow it, with cache entries separated by database.
- Database discovery fails closed: a denied, failed, or malformed listing offers no configured fallback and sends no data request. The authorized default is selected when usable, otherwise the first enabled and available backend result. Authentication identity changes invalidate cached listings and report data.
- Configurable dashboard date-filter behavior: the optional dashboard property `dateFilterBehavior` is `"required"` (no widget requests, refresh, or export until Search applies both dates of every shared date range) or `"optional"` (widgets load without a date runtime filter; Search applies a range only with both dates). Omitting it keeps the existing filter behavior. Dashboards that use it show which date range the results reflect. Bill uses `"required"`; Sales, Purchases, and Receipts use `"optional"` (`a50396b`, `73a0a75`).
- Per-widget `filterFields`, which maps a shared dashboard filter to another field name for one widget. Required shared filters gate the whole dashboard (`6cfe17e`).
- Optional logical database selection: `request.database` and `queryDefinition.database` (`ddf06a2`).
- Authentication and administration: login/logout against the backend session, a setup-status gate, protected routes, an admin-only `/settings/users` route, the Settings page, and Frontend User Management (create, edit profile, enable/disable, delete, change password, grant or revoke the Admin role) (`86435d7`, `8c5cdb0`, `df88f7d`, `c2dbb76`, `2299151`, `505ab3c`, `9fa7005`, `3ee339c`, `028e596`).
- CSRF token handling for protected actions, with a retry after token rotation (`1c982c1`, `3d1bb8a`).
- Smart dynamic filter options (`dynamicOptions`) for `select` and `multiselect` filters (`38cb5fa`).
- Inline widget definitions on dashboards (`96dd2d3`).
- An `npm run typecheck` script that covers the app and Node/tooling projects (`72dd668`).
- A backend capability matrix and a concise frontend-facing API reference.
- Boolean filter controls and configured NOT LIKE filter variants.
- Contract tests for JSON Query mode, SQL Resource mode, filter serialization, grouping, pagination, response validation, and backend error details.

### Changed

- The Bill dashboard's TOP-10 month-wise category widget uses `widgets/sales-top-10-month-wise-category-wise`, the SQL Resource the Sales dashboard already uses, instead of a byte-identical copy. Each dashboard keeps its own database, date-filter behavior, and export filename (`15200c5`).
- Sign-in state is synchronized across tabs through `BroadcastChannel`. A change of user rebuilds the protected pages and discards filter values and cached responses (`983ee7d`).
- Report definitions were normalized: display `columns`, `filters`, and the initial `sort` live at the top level, and the SQL Resource `execution` envelope is derived at load time (`f3c9039`, `a7b8f1f`; follow-up cleanup in `324fd82`).
- SQL Resource references moved from legacy basename IDs to discovered `reports/...` and `widgets/...` IDs (`4c5e061`). The two checked-in reports later moved to JSON Query mode (`a7b8f1f`), so only dashboards use SQL Resources today.
- Definitions that need runtime filtering, sorting, or deterministic pagination gained reviewed SQL `execution` metadata. Later, `a7b8f1f` replaced the authored metadata with metadata derived at load time.
- The repeated Item statistics SQL definition was consolidated into one reusable widget configuration.
- Frontend JSON request validation was aligned with the backend public SELECT contract, including operators, joins, grouping, HAVING, functions, subqueries, CTEs, sorting, and pagination.
- The default page size and the examples were standardized on 10 records per page.

### Improved

- Backend error status, code, and details are preserved in `ApiClientError`.
- Numeric runtime filter values are normalized, while typed select and boolean values are kept.
- Reports, dashboard tables, and report widgets share one table frame, mobile cards, sort controls, and pagination.

### Security

- Spreadsheet formulas are neutralized in both CSV export paths, while numeric values stay intact (`72dd668`).
- "Export all" is capped at 100,000 rows, and reports refuse an incomplete export result (`983ee7d`).
- Only real fetch failures are reported as network errors. Programming errors show a generic message (`983ee7d`).
- The production frontend was hardened: credentials are included, and CSRF is limited to protected actions (`1c982c1`).

### Removed

- Unused dependencies, dead code, unreferenced assets, and obsolete `auth.users.*` CSRF entries (`983ee7d`).
- The unused frontend SQL tokenizer/parser/converter and its historical tests (`04573fb`).
- The unused global search context, grouping request builder, toolbar constants, response parser, and UI-state constants.
- The disabled report Settings action and the empty Settings placeholder. The current `/settings` page, added later in `505ab3c`, is the administration entry point.
- The unused saved-report grouping snapshot, which was recorded but never restored.
- The in-app first-time setup page (`028e596`). Initial user setup is done in the Backend Admin Console.

### Fixed

- Report "All rows" export now fetches the report in 1,000-row pages through the same helper as dashboard tables, instead of one unpaginated request. Exports above the backend's single-response limit (`GENERIC_MAX_RESULT_ROWS`, 10,000 by default) now succeed, up to the 100,000-row client cap. Each page sends the report's fields, applied filters, filter logic, database, and current sort unchanged, and the toolbar shows "Preparing export… N of M rows" (roadmap R3).
- Both report and dashboard "All rows" exports refuse inconsistent paging instead of saving duplicates or gaps: a page that repeats the previous page, holds more rows than requested or than remain, or reports a different total ("The matching rows changed while the export was running. Try again."). Report exports add "Nothing was exported." to these messages. Earlier, rows beyond the reported total were silently trimmed.
- Dashboard table "All rows" export no longer fails with "Invalid request.". It used to request 5,000-row pages, above the backend's runtime `maxPageSize` (1,000 by default). It now requests 1,000-row pages and, when a deployment's maximum is lower, retries the first page with smaller sizes (`73a0a75`).
- Request error messages include the backend's validation details (for example `pagination.pageSize: Page size exceeds the configured maximum.`) instead of only "Invalid request." (`73a0a75`).
- Modal body scrolling in User Management, plus scrolling and authentication UX in the admin screens (`859aeed`, `6544d94`).
- Numeric string values sort numerically (`ebdf082`), decimal strings format correctly (`9d2d2e4`, `6af090c`), and null values render as an em dash (`7e20f70`).
- NULL runtime filters omit `value`, matching the backend contract.
- Mobile More/Export sheets render outside clipping/transform contexts through the existing menu portal.

### Documentation

- 2026-10-16: the documentation was consolidated. It adds [Authentication](docs/AUTHENTICATION.md), [Deployment and hosting](docs/DEPLOYMENT.md), [Troubleshooting](docs/TROUBLESHOOTING.md), validated example files in [`examples/`](examples/), and the environment-variable reference. The roadmap was reconciled with Git history. SQL/JSON separation, Reports, and Widgets were merged into Architecture, Configuration, and Dashboards. Stale statements were corrected: the saved-view storage key, the derived `execution` filter shape (no `expression`), and authentication being "not implemented".
- Stale and hypothetical examples were replaced with backend-verified JSON requests and discovered `widgets/...` SQL Resource IDs.
- Explicit supported, unsupported, limitation, roadmap, and ownership boundaries were added.

## History before this changelog

The changelog was started during the backend-alignment work (`04573fb`, 2026-09-12). Earlier work is recorded only in Git:

- 2026-07-27 → 2026-08-18: project setup (`c0ab182`), and the core report pipeline from AG Grid rendering through saved reports (`8fd607e` … `6b743c3`).
- 2026-08-18 → 2026-09-07: configurable dashboards and widgets (`fc90ba4`, `06ec694`), advanced filtering, caching, and export UX (`119d2b0`, `7b2fccf`, `e62de59`), the frontend SQL authoring engine (`eb8adb0`, `94e1d87`; later removed), and the first documentation and CI (`ed46ccd`).
