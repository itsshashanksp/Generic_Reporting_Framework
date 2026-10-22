# Frontend roadmap

This is the single authoritative roadmap for the Generic Reporting Framework **frontend**. A status describes the executable frontend code in this repository; backend capability, plans, or configuration alone never make an item complete. Backend work appears here only as an external dependency.

Last reconciled: 2026-10-16, against `main` at `15200c5` (Git history, source, tests, and the previous roadmap versions).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| **Completed** | Implemented, with source and test (or verification) evidence |
| **Partially completed** | Some of the stated scope is implemented; the remainder is listed |
| **Pending** | Not yet implemented |
| **Blocked** | A named external dependency prevents progress |
| **Needs verification** | Implemented, but the evidence needed to call it complete is missing |

An item is completed only when runtime behavior, validation, tests, accessibility, documentation, and backend-contract alignment land together.

## What to do next

1. **Next actionable frontend item: 39 Chart engine, starting with a scope decision (S1).** It is the earliest planned item that is neither completed nor waiting on another system. It cannot be built yet, though: its remaining scope ("multi-series configuration, formatting, accessibility, interactions, and chart export") has no acceptance criteria, so S1 must define them first. Every item before it is completed or blocked (see the tables below).
2. **Waiting on owners (no frontend work possible):** 37 needs the Gate 0 decisions in its [decision register](design/REPORT-ACTIONS.md#7-decision-register-gate-0); 47 needs E1; the R3 and database-selector checks need V1 and V3.
3. **Do not reopen** R3 or 47's implementation. Column personalization was removed and is deferred (see below).

## Current and next work

| ID | Workstream | Status | Deliverable | Done when |
| --- | --- | --- | --- | --- |
| 47 | Configurable dashboard date-filter behavior | **Needs verification** | `dateFilterBehavior` (`required`/`optional`), per-widget `filterFields`, required-filter gating, and an applied-range indicator | E1 is done, and the Bill, Sales, Purchases, and Receipts dashboards return correct totals and inclusive range boundaries against SQL Server |
| 37 | Report actions: single-row insert/update/delete on eligible JSON Query reports | **Blocked**: design drafted 2026-10-16; implementation waits on the Gate 0 decisions (D2, Q1, Q2, Q3, Q6, Q8), all *Awaiting owner decision* and Unassigned. `frontendCapabilities.write` stays `false` | 1) Agreed [design](design/REPORT-ACTIONS.md) (Gate 0: Q1–Q3, Q6, Q8; D2). 2) A validated `actions` report schema. 3) Request builders. 4) Selection, dialogs, and confirmation UI behind `frontendCapabilities.write`. 5) `write` enabled together with backend `FrontendCapabilityPolicy::WRITE` (D1) | Design acceptance criteria 1–11 pass in the suite; criterion 12 is verified on an approved test database (D4); the `data-operator` role is assignable; docs and changelog are updated. Upsert, bulk edits, dashboards, and SQL Resource reports are out of scope unless Q2 decides otherwise |

Evidence for 47: commits `6cfe17e`, `a50396b`, `73a0a75`, and `15200c5`; source `src/engine/DashboardEngine/dateFilterBehavior.ts` and `filterFields.ts`; tests `src/pages/__tests__/DashboardDateFilterBehavior.test.tsx`, `DashboardRequiredRange.test.tsx`, `src/engine/DashboardEngine/__tests__/dateFilterBehavior.test.ts`, `filterFields.test.ts`, and `src/components/Dashboard/__tests__/filterFieldsRequests.test.tsx`.


## External dependencies and confirmations

These items are not frontend implementation tasks. Do not investigate them again from this repository. Wait for the owner named in each row.

| ID | Dependency | Blocks | Owner / next step |
| --- | --- | --- | --- |
| E1 | An approved SQL Server test database, so the date-filtered SQL Resources can be validated (inventory R6) | Completing 47 | Backend/API owner provides the database; then run the checks in [inventory §15](security/Frontend-Query-Source-Inventory.md#15-known-issues) |
| E2 | Backend access-scope entries for the dashboards' filter fields (`Bill_Date`, `GIN_Date`) when scopes run in `enforce` mode | Production use of 47 under enforced scopes | Backend configuration owner |
| D2 (37) | A decision on write authority. Backend `data.write` covers every table the database login can write to, and there is no per-table write scope. See [design §6](design/REPORT-ACTIONS.md#6-dependencies-and-risks) | Enabling 37 for any frontend user | Backend/security owner |
| D1/D3 (37) | Backend `FrontendCapabilityPolicy::WRITE` (currently `false`), and a database login/profile with write rights limited to the intended tables | Step 5 of 37 | Backend and database owners |
| V1 (R3) | Live-backend check of report "Export all": a report with more than 10,000 matching rows exports completely, in 1,000-row pages, against a running backend | Calling R3 verified beyond mocked tests | Unassigned; needs a test backend environment (can share E1's) |
| V3 (database selector) | Live check (reports and dashboards; procedure in [validation/DATABASE-SELECTOR-LIVE-TEST.md](validation/DATABASE-SELECTOR-LIVE-TEST.md)) with two registered databases that hold the same report tables: switching shows each database's rows, the `metadata.databases` listing narrows the options, and an access scope that does not grant a database returns `403` | Calling the database selector verified beyond mocked tests | Unassigned; needs a test backend with two registered databases. Production use also needs access scopes that grant each listed database, plus `listDatabases` for the narrowed list (backend configuration owner) |
| S1 (39) | Scope for the chart engine: which charts need multi-series, which formatting and interactions, whether chart export is wanted, and acceptance criteria for each | Starting 39 | Product owner (Unassigned) |
| E3 | Confirmation that no API-key integration still calls the retired resource ID `widgets/TOP-10-month-Wise-Category-wise` (inventory R5) | Releasing `15200c5` on its own | API owner. Until it is confirmed, deploy the frontend and backend together |

## Planned work

| ID | Workstream | Status | Deliverable / remaining scope |
| --- | --- | --- | --- |
| 43 | Authentication and roles | **Partially completed** | Done: backend-session sign-in/sign-out, setup gate, protected and admin-only routes, cross-tab session sync, per-user state isolation, and frontend user management. Remaining: role-differentiated data UI, **blocked** with 37 (`data-operator` is not assignable while `write` is `false`) |
| 39 | Chart engine | **Pending**, Next. Starts with scope decision S1 | Basic bar/line/pie exists. Remaining: multi-series configuration, formatting, accessibility, interactions, and chart export. None of these has acceptance criteria yet |
| 40 | Dashboard builder | **Pending** | Interactive builder and a saved dashboard model. Dashboards are authored JSON today |
| 42 | Report scheduler | **Blocked** | Needs a backend scheduling and delivery contract first (owner: backend, Unassigned). No frontend-only implementation is claimed |
| 44 | Audit | **Blocked** | Waits on 37's mutation contract (and 37's Q7 asks whether audit must precede writes). Identity now exists (43) |
| 45 | Favorites | **Pending**, awaiting decision | Decide between local and account-backed ownership, and how data migrates (product owner, Unassigned). Account-backed favorites would also need a backend API |
| 46 | Report designer | **Pending** | Must emit only validated JSON Query structures, or minimal discovered SQL Resource references plus normalized presentation. It must never emit SQL text |

## Deferred

| ID | Workstream | Status | Reason |
| --- | --- | --- | --- |
| 41 | Drill down | **Pending (paused)** | The workspace project context records drill-down as paused while SQL Resource execution is stabilized. There is no drill-down code in `src/` |
| 38 | Email report | **Pending (deferred, last)** | Kept until the scheduling (42) and delivery APIs are defined |
| — | Column personalization | **Pending (deferred)** | Column chooser, show/hide/reset, and persisted width/order/visibility. It was implemented in `de6df7d` and removed before any release on 2026-10-16, at the owner's request. It may be implemented again later; that commit holds the previous implementation and tests |

## Completed

| ID | Workstream | Status | Evidence |
| --- | --- | --- | --- |
| — | Core report pipeline: AG Grid rendering, toolbar, export, definition/column/filter engines, server filtering, sorting and pagination, grouping display, saved reports | Completed | `8fd607e` through `6b743c3`; tests in `src/engine/**/__tests__`, `src/components/Grid/__tests__` |
| — | Configurable dashboards and widgets (report, stat, table, chart) | Completed | `fc90ba4`, `06ec694`, `96dd2d3` (inline widgets); `src/components/Dashboard/__tests__` |
| — | Automated test suite and GitHub Actions CI | Completed | `ed46ccd`; `.github/workflows/frontend-ci.yml`; latest local run 2026-10-16 (working tree): 53 files / 513 tests, lint, typecheck, and build passed |
| 36 | Report layout and responsive UX (includes the earlier "UI/UX cleanup") | Completed | `e7f4ab2`, `1f6371b`, `4a4b34c`, `4c5e061`: shared report/table frame, mobile cards, pull-to-refresh, portaled More/Export sheet |
| 36A | Backend read-capability alignment and cleanup | Completed | `04573fb`, `4c5e061`: JSON Query and SQL Resource contracts, validation, removal of the dead SQL parser, error details |
| — | Query configuration normalization (top-level `columns`/`filters`/`sort`; derived `execution`) | Completed | `f3c9039`, `a7b8f1f`, `324fd82`; `src/config/__tests__/configurationSeparation.test.ts` |
| — | Smart dynamic filter options (`dynamicOptions`) | Completed | `38cb5fa`; `src/components/Filters/useDynamicFilterOptions.ts` |
| — | Value formatting fixes (null as em dash, numeric/decimal strings, numeric string sorting) | Completed | `7e20f70`, `6af090c`, `9d2d2e4`, `ebdf082` |
| — | Logical database selection (`request.database`, `queryDefinition.database`) | Completed | `ddf06a2`; `src/engine/ReportDefinitionEngine/__tests__/databaseSelection.test.ts` |
| 43 (part) | Authentication, setup gate, and frontend user management | Completed (the 43 remainder is listed above) | `86435d7`, `8c5cdb0`, `df88f7d`, `c2dbb76`, `2299151`, `505ab3c`, `9fa7005`, `1c982c1`, `3d1bb8a`, `3ee339c`, `b6b208e`, `028e596`, `6544d94`, `859aeed`; `src/auth/__tests__`, `src/setup/__tests__`, `src/pages/__tests__/UserManagement.test.tsx` |
| — | Production hardening: CSV formula neutralization, production API-URL build check, real `typecheck` script, AG Grid Community only, `xlsx` replaced by `write-excel-file`, per-user saved views, cross-tab session sync, 100,000-row export cap | Completed | `72dd668`, `983ee7d`; `tooling/*.test.ts`, `src/engine/ExportEngine/__tests__`, `src/auth/__tests__/crossTabSession.test.tsx` |
| — | Dashboard export-all within the backend `maxPageSize` | Completed | `73a0a75`; `src/engine/ExportEngine/__tests__/fetchAllRows.test.ts` |
| R3 | Paginated report "Export all" | Completed for implementation and automated tests (`de6df7d`, 2026-10-16); live-backend check V1 outstanding | `ReportViewer` "Export all" pages through the shared `fetchAllRowsForExport` (1,000-row pages, page-size fallback, 100,000-row cap, progress). It refuses repeated pages, pages that overrun the total, and totals that change mid-export, instead of exporting duplicates or gaps. Tests: `src/pages/__tests__/ReportViewerExportAllPagination.test.tsx` and the "export batch integrity" cases in `fetchAllRows.test.ts`. Not yet run against a live backend |
| — | Runtime database selector (reports) | Completed; live check V3 outstanding | Opt-in `databaseSelection: true`; the authorized `metadata.databases` result is the sole source of IDs, labels, and the initial selection. Nothing is requested while unresolved or denied. Selection reaches every report request and All-rows export; caches are per database and cleared on identity changes. |
| — | Runtime database selector (dashboards) | Completed; live check V3 outstanding | Opt-in `databaseSelection: true`; backend-owned discovery is shared with reports. Widgets without their own database inherit the selection, pinned widgets keep theirs, and a running table export is cancelled on switch. |

## Removed, superseded, or not supported

- **Frontend SQL authoring engine and parser** (old phases 1–10.2: Query Engine Foundation, SQL Contract, Deterministic SQL Parser, Aggregate/GROUP BY/HAVING/Join support, Expanded SQL Subset, Parser Hardening). It was built in `eb8adb0`, `94e1d87`, and `78eca24`, and **superseded and removed** in `04573fb`, because SQL ownership moved to backend-discovered SQL Resources. Do not reintroduce frontend SQL parsing.
- **Configuration directory separation and strict SQL/JSON separation** (old phases 10.1 and 10.2). They are completed, and the rule still holds: see [Architecture](ARCHITECTURE.md#ownership-boundary).
- **Firebase authentication direction** (the previous note on 43). Superseded: the frontend uses the backend's session API (`auth.*` actions).
- **Global search engine.** Removed because no UI used it. "Search" means applying the configured filters.
- **Report mutation actions.** Not supported until 37 lands. The existence of backend write endpoints does not make this a frontend feature.

## Roadmap history

| Version | Commit | Change |
| --- | --- | --- |
| 1 | `ed46ccd` (2026-09-07) | First roadmap: phases 1–10.2 complete; 36 Report layout *Next*; 37–45 planned (numbered 37 Report actions … 42 Role-based UI … 45 Report designer) |
| 2 | `775b1be` (2026-09-08) | Table replaced by an unordered list of possible future work |
| 3 | `04573fb` (2026-09-12) | Status table restored and **renumbered**: 38 Email (new), 39 Chart, 40 Builder, 41 Drill down, 42 Scheduler, 43 Authentication and roles (was 42 Role-based UI), 44 Audit, 45 Favorites, 46 Designer; 36 and 36A completed |
| 4 | `a50396b` (2026-10-15) | Added 47 as *In Progress* |
| 5 | 2026-10-16 documentation consolidation | Reconciled with the auth, security, and export work (`86435d7`…`15200c5`) that the roadmap had never recorded; 43 moved from *Deferred* to *Partially completed*; 47 moved to *Needs verification*, with its external steps split out into E1–E3; R3 added |
| 6 | 2026-10-16 | R3 completed; the next actionable task is the 37 design |
| 7 | 2026-10-16 | 37 design drafted; 37's scope, deliverables, dependencies (D1–D3), and acceptance criteria clarified |
| 8 | 2026-10-16 | Column personalization completed; statuses made consistent (37, 42, 44 → Blocked; 45 awaiting decision); verification items V1 and V2 and scope decision S1 added; 39 is next |
| 9 | 2026-10-16 | Runtime database selector added (completed; V3 outstanding); R3 and column personalization reference `de6df7d` |
| 10 | 2026-10-16 | Database selector extended to dashboards (completed; V3 now covers both) |
| 11 | 2026-10-16 | Report and dashboard selection unified: no `default`, backend registry decides the initial database; V3 procedure updated |
| 12 | this revision | Column personalization removed before release (now deferred); V2 dropped |

Use the current numbers when you refer to items. If an older document cites "42 Role-based UI", it means today's 43.

[Documentation index](README.md) · [Changelog](../CHANGELOG.md)
