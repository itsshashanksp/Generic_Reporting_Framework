# Live validation: runtime database selector (roadmap V3)

**Status: outstanding.** None of the cases below has been run against a live backend. Automated coverage uses a mocked API (`src/pages/__tests__/ReportViewerDatabaseSelector.test.tsx`; 54 files / 535 tests passed on 2026-10-16). Record real results in the *Result* column, then update roadmap item V3.

Feature behavior under test: [Feature behavior — Database selector](../FEATURES.md#database-selector). Configuration: [Runtime database selection](../CONFIGURATION.md#runtime-database-selection).

## 1. Environment requirements

| Need | Current state (observed 2026-10-16) | Owner / action |
| --- | --- | --- |
| API URL | Local `.env` points at `http://localhost:8000/index.php`. An unauthenticated `setup.status` probe returned `initialized: true` | Developer. Run the frontend with `npm run dev` |
| Frontend account | **Not available to this task.** It needs `frontendAccess: true`. A Read Only frontend user is enough for every case except §3.F | Backend/admin owner provides a test account. Never commit or paste credentials |
| Two registered, enabled databases holding the **same report tables** | The registry lists `tts32server`, `loyal-ibms` (registry default), `test`, and `loyal-ibms2` (re-read 2026-10-16). **Unverified** which of them contain `ItemMasterTable` with the columns `Item_Code`, `Item_Desc`, `Item_MRP`, `UserName` | Database/backend owner confirms two IDs, called **DB-A** and **DB-B** below |
| Distinguishable data | Unknown | DB-A and DB-B must differ in row count, or in at least one `Item_Desc` value that a filter can find, so a switch is visible. More than 1,000 matching rows in one of them exercises multi-page All-rows export |
| Access scopes | No `config/access-scopes.json`, so scopes are not enforced (legacy behavior: frontend users may call `metadata.databases` and query any registered database) | §3.F needs a **test** backend with a scopes file, set up by the backend configuration owner. Do not change a shared or production backend |
| Registry state changes (disable / Disconnect) | — | §3.G needs a backend operator to use the Admin Console on a test backend |
| Browser | Any current browser with DevTools | Use the Network tab to read the `POST` body of each request (`database`, `filters`, `sort`, `pagination`) |

## 2. Test report

**Ready-made option:** in the working tree, the Item (`/report/item`) and Customer (`/report/customer`) reports both set `databaseSelection` to `["loyal-ibms", "loyal-ibms2"]`, with `loyal-ibms` configured. Use DB-A = `loyal-ibms` and DB-B = `loyal-ibms2`, but only if the backend owner confirms that `loyal-ibms2` contains `ItemMasterTable` and `CustomerTable` with the same columns. The Customer report is grouped (one row per customer), so for B3 filter on a customer name that exists in only one database. No checked-in report is left without `databaseSelection`, so §3.A6 needs a local report copy without it.

**Otherwise, a local test file (do not commit):**

Create `src/config/reports/zz-database-selector-test.json` from [`examples/reports/database-selector-report.json`](../../examples/reports/database-selector-report.json):

- set `id` to `zz-database-selector-test`;
- set `request.database` to **DB-A**;
- set `databaseSelection.databases` to `["DB-A", "DB-B"]`, using the real IDs;
- for §3.E, also add the `UserName` filter with `dynamicOptions` from `src/config/reports/item.json`.

Open it at `/report/zz-database-selector-test`. No menu entry is needed. Run `npm test` once: it must still pass, because the configuration tests load every report file. Delete the file afterwards.

Before each case, reload the page. That empties the in-memory request cache, including the cached `metadata.databases` listing, which otherwise lasts 5 minutes.

## 3. Test cases

### A. Selection and switching

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| A1 | Open the test report (DB-A is the registry default) | `metadata.databases` is sent once, before any data request. Then **Database** shows DB-A, and the first `select` request has `"database": "DB-A"` | |
| A1b | Make DB-B the registry default (Admin Console, test backend), then reload | DB-B is selected first, even though the report's `request.database` is DB-A | |
| A1c | Make a database that is **not** in `databaseSelection.databases` the registry default, then reload | The first listed, available ID (DB-A) is selected | |
| A2 | Open the dropdown | Exactly the report's IDs that the registry lists as enabled, labelled with registry names. No other registry database appears | |
| A3 | Choose DB-B | A new `select` with `"database": "DB-B"` and `pagination.page: 1`. The rows change to DB-B's data | |
| A4 | Choose DB-A again within 5 minutes | **No** new request (served from DB-A's cache entry). DB-A's rows are shown | |
| A5 | Open another report, then come back | The test report starts on DB-A again | |
| A6 | Open a report without `databaseSelection` (a local copy of `item.json` with the property removed) | No **Database** dropdown, no `metadata.databases` request, and requests keep the report's configured database | |

### B. The selected database reaches every request (do these on DB-B)

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| B1 | **Refresh** | A new request (not from cache) with `"database": "DB-B"` | |
| B2 | Sort by a column header | The request has the new `sort` and `"database": "DB-B"`; page 1 | |
| B3 | Type part of a DB-B-only `Item_Desc`, then **Search** | `filters` contains `LIKE %…%` and `"database": "DB-B"`; the row appears | |
| B4 | With that filter applied, switch to DB-A | The same `filters` and `sort` with `"database": "DB-A"`; the DB-B-only row is gone (empty result or other rows) | |
| B5 | Go to page 2, then change the page size | Each request has the page values and the selected database | |
| B6 | **All rows — CSV**, then **All rows — Excel** | Every export request has `"database"` set to the selection and `pagination.pageSize: 1000`. Both files contain the selected database's rows only. With more than 1,000 rows, pages 1, 2, … run in order and the status shows progress | |
| B7 | **Current view — CSV / Excel** | The files contain the rows on screen (no request) | |
| B8 | Start an All-rows export | The **Database** dropdown is disabled until the export finishes | |
| B9 | Save a view on DB-B, switch to DB-A, load the saved view | The view's filters, sort, and page load on **DB-A**, because a saved view does not store the database | |

### C. In-flight switching

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| C1 | In DevTools, set throttling to *Slow 3G*. Switch to DB-B, then immediately back to DB-A | The DB-B request shows as cancelled, or its response is ignored. DB-A's rows are shown and the dropdown shows DB-A | |
| C2 | Same, but switch DB-A → DB-B while the first load is still running | DB-B's rows end up shown; no flash of DB-A's rows afterwards | |

### D. Errors

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| D1 | Make DB-B fail: Admin Console **Disconnect** for its server profile (test backend only), then switch to DB-B *without* reloading | The grid shows the backend error (`DATABASE_UNAVAILABLE`, HTTP 503). The dropdown stays usable; switching to DB-A shows DB-A again | |

### E. Filter dropdowns with database-loaded options

| # | Steps | Expected (current behavior) | Result |
| --- | --- | --- | --- |
| E1 | Open the **User Name** filter on DB-A | One options request (`groupBy: ["UserName"]`). Its `database` is whatever the filter configures; the Item report's filter names none, so the backend default (`loyal-ibms`) is used | |
| E2 | Switch to DB-B and reopen the filter | **No** new options request: the options still come from the configured database, not DB-B. Note whether DB-B has user names missing from the list, or extra ones | |

See §4 for why this matters.

### F. Access scopes (test backend with a scopes file; backend owner)

| # | Scope setup (enforce mode) | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| F1 | The `frontend` scope grants `select` and the test table in DB-A and DB-B, **with** `listDatabases: true` | Reload, open the dropdown | The narrowed list with registry names (as A2) | |
| F2 | As F1, but **without** `listDatabases` | Reload, open the dropdown | `metadata.databases` returns `403 AUTHORIZATION_DENIED`. "Database list unavailable" is shown, and **no data request** is sent. The dropdown shows "Choose a database" with DB-A and DB-B as raw IDs; choosing one loads the report | |
| F3 | Grant DB-A only | Switch to DB-B | `403 AUTHORIZATION_DENIED` is shown in the grid; switching back to DB-A works | |

### G. Registry states (test backend; reload after each change)

| # | Setup | Expected | Result |
| --- | --- | --- | --- |
| G1 | Disable DB-B in the registry | DB-B is **not** offered. The dropdown is disabled with the tooltip "No other database is available" | |
| G2 | DB-B enabled but **Disconnected** | DB-B is shown as "… (unavailable)" and cannot be chosen, so the dropdown is disabled | |
| G3 | Add an unregistered ID (for example `zz-missing`) to `databaseSelection.databases` and rebuild | The unregistered ID is not offered | |
| G4 | Disable or Disconnect **DB-A** while it is the registry default | DB-B is selected (fallback). With DB-A disabled it is not offered; with DB-A disconnected it shows as "(unavailable)" | |
| G5 | Make both DB-A and DB-B unusable (disabled or disconnected) | "No database available" is shown; **no data request** is sent; Refresh is disabled on dashboards | |

### H. Layout

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| H1 | Desktop width | **Database** label and dropdown at the start of the toolbar, before **Refresh** | |
| H2 | Width ≤ 720px | The dropdown sits beside **More**; its label is visually hidden but announced by a screen reader; the toolbar does not overflow | |

### I. Dashboards (use the working tree's Item Dashboard: `loyal-ibms` → `loyal-ibms2`)

| # | Steps | Expected | Result |
| --- | --- | --- | --- |
| I1 | Open the dashboard | No widget request before `metadata.databases` returns. Then **Database** shows the registry default; inheriting widgets' `sql` requests carry it, and a widget with its own `database` keeps that | |
| I2 | Switch to DB-B | Every inheriting widget reloads with `"database": "DB-B"` and shows DB-B data; the pinned widget sends no new request | |
| I3 | Refresh; apply a shared filter; page and sort a table; table **All rows** export | Each inheriting request uses DB-B; the pinned widget keeps its own database | |
| I4 | Start a table All-rows export on a large result, then switch database | The export stops and no file is saved | |
| I5 | Switch back to DB-A within 5 minutes | Cached results; no request; DB-A values | |
| I6 | Open a dashboard without `databaseSelection` (e.g. Sales) | No **Database** dropdown and no `metadata.databases` request | |
| I7 | On the Item Dashboard, open the **Std_Vat** filter after switching to `loyal-ibms2` | Its options request names no database, so it still reads the backend default (`loyal-ibms`). This is the open filter-options decision in §4 | |

## 4. Filter options and the selected database (investigation)

**Current behavior.** `useDynamicFilterOptions` (`src/components/Filters/useDynamicFilterOptions.ts`) sends `dynamicOptions.request` exactly as configured. Its cache key is built from that request, and the report's selected database is not applied. So:

- the Item report's `UserName` options request names no `database`, so it always reads the backend default (`loyal-ibms`), whatever the report data uses;
- the Item dashboard's `Std_Vat` options request names `loyal-ibms` explicitly.

**API.** There is no API limitation. A `select` request accepts a top-level `database`, and the dashboard already uses one in an options request. Following the selection would only mean adding `database` to the options request, and the cache key would then separate the databases automatically. Two constraints apply:

- with enforced scopes, each selectable database must also grant the options request's table and columns;
- the frontend's options validator checks only `action`, `source`, and `fields`, so a malformed `database` in an options request is caught only by the backend.

**Trade-off.**

| Option | Benefit | Risk |
| --- | --- | --- |
| Follow the selected database | The choices match the data being filtered | Wrong when the options come from a shared lookup database; needs the scope grant per database |
| Stay on the configured database (current) | Predictable, and right for shared lookup tables | Users can choose values that don't exist in the selected database, which gives silently empty results |

A possible rule, to decide later: follow the selection only when the options request names no database, or names the report's configured database, and keep an explicitly different database fixed.

**Decision:** product owner, Unassigned. Behavior is unchanged until then. Case E2 records what users see today.

## 5. Recording results

For each case, record pass or fail, the backend commit, and the DB-A and DB-B IDs used. Attach the request bodies for A3, B4, and B6. Do not attach cookies, tokens, or credentials. When A–E and H pass (F and G need a test backend with scopes and registry control), roadmap V3 can be marked done for those cases, with F and G noted separately if they could not be run.
