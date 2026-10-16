# Design: Report actions (roadmap 37)

Status: **Draft for decision**, 2026-10-16. Nothing in this document is implemented. Items marked **Proposed** are design choices awaiting agreement, and items marked **Q** are open product or security decisions. Do not begin implementation until the decisions in [Gate 0](#8-implementation-sequence) are recorded here.

## 1. Scope, from the project record

| Source | What it says about 37 |
| --- | --- |
| Roadmap v1 (`ed46ccd`, 2026-09-07) | "37 Report Actions — Planned". No scope given |
| Roadmap v3 (`04573fb`, 2026-09-12) | "Define frontend mutation UX and a safe resource/action schema before exposing backend insert/update/delete/upsert; none are currently supported" |
| Roadmap, current | Deliverable: a design for the mutation UX plus a safe resource/action schema, then an implementation behind `frontendCapabilities.write`; the `data-operator` role becomes assignable |
| `docs/SUPPORTED.md` | "Report actions — Partially supported: Refresh, export, and local save; no write/CRUD actions" |
| `src/config/frontendCapabilities.ts` | `write: false` hides the `data-operator` role in User Management |
| `src/api/client.ts` | `insert`, `update`, `delete`, `upsert` are already in the CSRF-protected action list; nothing sends them |
| Roadmap 43, 44 | Role-differentiated data UI (43) and Audit (44) both wait on 37 |

**Item 37 therefore means: letting authorized users change the data a report shows (insert, update, delete, and possibly upsert) from the report page.** It does not cover new read-only toolbar actions. Refresh, export, and saved views already exist and stay as they are.

Out of scope: dashboards and widgets; SQL Resource writes; bulk or multi-row edits; stored procedures; changes to the backend API.

## 2. Current behavior

### What the report page offers today

| Action | Where | Gated by | Feedback |
| --- | --- | --- | --- |
| Refresh | Toolbar button; pull-to-refresh on mobile | `toolbar.refresh` | Grid loading state |
| Export (current view / all rows, CSV / Excel) | `ExportMenu` (desktop); "More" sheet (mobile) | `toolbar.export` + `export.enabled`/`formats`/`exportAll`/`exportCurrentView` | Status line `role="status"`, progress for all rows |
| Save Report (local view) | Toolbar button / "More" | `toolbar.saveReport` + signed-in user | Saved-views list |
| Columns (show/hide, order, reset) | Toolbar button / "More" | `toolbar.columns` + signed-in user, no configured grouping (added after this design was drafted) | Changes apply immediately; layout kept per user |
| Row selection | Grid checkbox / mobile card tap | `grid.rowSelection` (`single` default, `multiple`) | Highlight only. **No consumer**: the selection stays inside `GenericGrid` |

### Gaps that 37 must close

1. There is no schema saying which table a report row belongs to, or which column identifies it.
2. There is no UI for entering or changing values, and no confirmation pattern. User Management's **Delete** currently runs without asking.
3. The selected rows never leave `GenericGrid`, so no action can use them.
4. The session exposes `backendRole` and `frontendRole`, not permissions. The frontend cannot tell directly whether the user holds `data.write`.
5. No `data-operator` user can exist, because both the frontend (`frontendCapabilities.write`) and the backend (`FrontendCapabilityPolicy::WRITE`) are `false`.

## 3. External contract and constraints

These come from the backend Write API (`Backend/docs/Write-API.md`, `Errors-and-Validation.md`, `Access-Scopes.md`, and the authorization configuration, read 2026-10-16). They limit any frontend design:

| # | Backend fact | Consequence for the frontend |
| --- | --- | --- |
| C1 | `insert`/`update`/`delete`/`upsert` take `table` (`Name` or `Schema.Name`), optional `database`, `data`, and `filters`. Upsert also takes `keys` | The request is built from configuration plus row values. The frontend never sends SQL |
| C2 | One object per request; no bulk input; no multi-action transactions | Only single-row actions are safe. A multi-row delete would be N independent requests that can fail part-way |
| C3 | UPDATE and DELETE filters "may match zero or more rows; there is no single-row guarantee" | The key must be a real unique key. The frontend cannot enforce that, and can only detect `affectedRows ≠ 1` **after** the write |
| C4 | No optimistic concurrency tokens | Two users editing the same row: the last write wins without warning |
| C5 | `data.write` permits writing **any table the database login can write to**. There is no per-table registration, and access scopes can permit writes only with an `unrestricted` scope | Whatever table a report's configuration names, any user who holds `data.write` can write to every other table the login can reach. **Report configuration is not a security boundary** |
| C6 | Holders of `data.write`: backend roles `data-operator`, `system-administrator`, and `api-administrator` keys. The frontend role `application-administrator` must **not** have it | A frontend "Data Operator" user gets the backend `data-operator` role, which also carries `sql.execute`, `metadata.read`, and `routine.execute` |
| C7 | Success: `data: [{ operation, affectedRows, generatedId? }]` with `meta` (page/pageSize null, `totalRows` 0) | `apiClient` already accepts this envelope; no change is needed in the client |
| C8 | Errors: `AUTHORIZATION_DENIED` 403, `CSRF_VALIDATION_FAILED` 403, `INVALID_WRITE_TABLE`, `INVALID_WRITE_COLUMN`, `INVALID_WRITE_VALUE`, `MISSING_REQUIRED_FIELD`, `UNSAFE_WRITE`, `INVALID_UPSERT_KEY` (400), `DUPLICATE_KEY`, `CONSTRAINT_VIOLATION` (409, "do not blind-retry") | Show the backend message plus details, keep the form open, and never retry automatically. The existing single CSRF retry happens before execution |
| C9 | Writes target a user table, never a view | Reports backed by views, or by SQL Resources, cannot have row actions |

## 4. Proposed design

### 4.1 Which reports may have actions (Proposed)

A report is eligible only when its rows correspond one-to-one with rows of a single table:

- JSON Query mode (`request`), not SQL Resource mode. A SQL Resource hides its tables from the frontend by design.
- `request` has no `joins`, `groupBy`, `having`, `distinct`, `with`, or `limit`.
- The key fields and editable fields appear in `request.fields` as plain column names (strings, or `{ "field": … }` without `alias` or `function`). That way a row value maps to a column without guessing.
- The write targets `request.source.table` in `request.database`. These come from the same request, never from a second configuration value, so an action cannot write to a different table than the one displayed.

The checked-in **Item report** meets these structural rules (`ItemMasterTable`, plain fields). Whether `Item_Code` is a unique key is unknown (**Q4**). The **Customer report** is grouped, so it is ineligible.

### 4.2 Configuration (Proposed shape; names to be agreed)

A new optional top-level report property, `actions`:

```json
{
  "actions": {
    "key": ["Item_Code"],
    "update": {
      "fields": [
        { "field": "Item_Desc", "label": "Item Description", "type": "text", "required": true },
        { "field": "Item_MRP", "label": "Item MRP", "type": "number" }
      ]
    },
    "delete": { "enabled": true }
  }
}
```

| Key | Rule |
| --- | --- |
| `key` | Non-empty array of fields that identify one row. Each one must be a plain field of `request.fields`. Every key value must be non-null in the selected row, or the action is disabled for that row |
| `insert` / `update` | `fields`: a non-empty array of `{ field, label, type, required?, options? }`. `type` is `text`, `number`, `date`, `boolean`, or `select` (with `options` as in filters). `update` may not include key fields (**Q6**) |
| `delete` | `{ "enabled": true }` |
| `upsert` | Not proposed for the UI (**Q2**) |

Validation follows the existing pattern in `ReportDefinitionEngine/validator.ts`: add `actions` to `REPORT_KEYS`, reject unknown keys, and reject `actions` on ineligible reports, each with a message that names the property. The validator protects authors from mistakes. It is **not** an authorization control (C5).

### 4.3 Visibility rules (Proposed)

An action control appears only when **all** of these hold:

1. `frontendCapabilities.write === true` (a build-time switch, off today).
2. The report defines the action (`actions.insert`, `actions.update`, or `actions.delete`).
3. The signed-in user's `backendRole` is one that holds `data.write` (`data-operator` or `system-administrator`, per C6). The role-to-permission mapping is backend configuration, so the authoritative answer is a `403 AUTHORIZATION_DENIED` from the backend. **Q3** asks whether the session should expose a permission flag instead.

Enabled state:

| Action | Enabled when |
| --- | --- |
| Add row | Always (when visible) and no other action is running |
| Edit row / Delete row | Exactly one row selected, all its key values non-null, grid not loading, no other action running |

Several selected rows disable Edit and Delete, with the hint "Select one row". Bulk actions are excluded by C2.

### 4.4 User workflow (Proposed)

**Edit**

1. Select a row (an existing grid or mobile card interaction).
2. Choose **Edit row**: a desktop toolbar button, or an item in the mobile "More" sheet next to the existing export items.
3. An `AccessibleDialog` opens with the configured fields, prefilled from the row, and with the key values shown read-only.
4. **Save** sends `{ action: "update", database, table, data: <changed fields only>, filters: [<key> = <original value>, …] }`. Save stays disabled while nothing has changed.
5. On success, the dialog closes and the status line says "Row updated.". The current page reloads with the cache bypassed.

**Delete**

1. Select one row and choose **Delete row**.
2. A confirmation dialog names the row by its key values and states that the deletion cannot be undone. Focus starts on **Cancel**, and the confirming button reads **Delete row**.
3. Confirming sends `{ action: "delete", database, table, filters: [<key> = <value>, …] }`. On success the status says "Row deleted." and the page reloads. If the page is now empty and is not page 1, the previous page loads.

**Add**

**Add row** opens an empty form with the `insert` fields. Saving sends `{ action: "insert", database, table, data }`. On success the status says "Row added." and the page reloads. The new row can land on any page, depending on the sort.

**After any write**, the report's selection is cleared. The whole request cache is cleared (`clearRequestCache()`), because other reports and dashboards may show the same table; the cache holds at most 100 entries and lasts 5 minutes, so this is cheap. `affectedRows` is then checked:

| `affectedRows` | Result |
| --- | --- |
| 1 | Success message |
| 0 | "No row was changed. It may have been changed or deleted by someone else. The report has been refreshed." |
| > 1 | An error-styled message: "N rows were changed. The report's key does not identify a single row; contact the report owner." Also logged with `console.error`. This cannot be undone (C3) |

### 4.5 Components and state (Proposed, reusing existing parts)

| Need | Reuse | New |
| --- | --- | --- |
| Toolbar placement | `ReportToolbar` buttons; `ExportMenu` options for the mobile "More" sheet | Action buttons and menu items |
| Dialogs | `AccessibleDialog` (modal, Escape → `onCancel`, focus restore) | `ReportActionDialog` (form) and a delete confirmation |
| Form inputs | Filter field components where their value shape fits; to be confirmed during implementation | Value inputs where it doesn't |
| Selection | `GenericGrid` / `MobileReportView` selection | An optional `onSelectionChange(rows)` prop on `GenericGrid` |
| Request and transport | `executeRequest` → `apiClient` (CSRF, error normalization) | Pure builder functions for insert/update/delete requests |
| Error text | `getRequestErrorMessage` (appends `path: message` details) | — |
| Mutation flow | User Management's `runMutation` pattern (busy flag → request → reload → message) | — |
| Reload | `loadReport(…, bypassCache = true)`, `clearRequestCache()` | — |

State per report page:

```text
idle ──select/Add──► dialog-open ──Save/Confirm──► submitting
  ▲                     │  ▲                          │
  └──── Cancel/Esc ─────┘  └──── error (values kept) ─┤
  └──────────── success → close, clear cache, reload ◄┘
```

- **Submitting**: inputs, Save, Cancel, the close button, and Escape are all disabled. An in-flight write is **not** aborted: aborting `fetch` does not undo server-side work, and a "cancelled" write that actually succeeded would mislead the user.
- If the page unmounts while a write is in flight, the result is ignored, as reads already are.
- Only one action runs at a time. Refresh, export, and the other actions are disabled while one is submitting.

### 4.6 Errors and accessibility

- Validation errors stay inside the dialog in `role="alert"`, with focus moved to the first invalid field. Required fields use the existing `*` marker convention from the filters.
- Backend errors are shown with `getRequestErrorMessage`. A `403 AUTHORIZATION_DENIED` gets "You do not have permission to change this data." A `401` already signs the user out globally. `DUPLICATE_KEY` and `CONSTRAINT_VIOLATION` show the backend message and keep the values.
- Success messages use the existing report status line (`role="status"`), so screen readers announce them.
- Every control has a visible text label. The destructive button text names the action ("Delete row"), and the dialog title names the report.
- Mobile: actions live in the existing "More" bottom sheet, and the dialogs use the existing dialog styles.

## 5. Tests and acceptance criteria

The implementation is complete only when all of the following pass in the Vitest suite. The last item is a manual check against a test database.

**Configuration**

1. `actions` is rejected on SQL Resource reports, on JSON reports with `joins`, `groupBy`, `having`, `distinct`, `with`, or `limit`, and when a key or editable field is missing, aliased, or computed. Each case has a specific message.
2. Unknown keys inside `actions` are rejected.

**Requests**

3. Exact request bodies for insert, update (changed fields only, key filters with the *original* key values), and delete, including `database`.
4. Every write carries `X-CSRF-Token` (covered by the existing client test pattern).

**Visibility**

5. No action controls appear when `write` is `false`, when the report has no `actions`, or for a user without a write role.
6. Edit and Delete are disabled for no selection, for several selected rows, and for a null key value.

**Workflow**

7. Edit success, delete success (including stepping back from an emptied last page), and add success, each followed by a cache-bypassing reload and the right message.
8. `affectedRows` 0 and > 1 messages.
9. Backend errors keep the dialog and its values; there is no automatic retry; controls are disabled while submitting; a double submit sends one request.
10. The delete confirmation has initial focus on Cancel and closes with Escape, and Escape does nothing while submitting.

**Regression**

11. Refresh, export, saved views, and read-only reports behave exactly as before.

**Live verification** (cannot run in CI)

12. On an approved test database, with a login limited to the target table: each action works, constraint and duplicate errors surface correctly, and a user without `data.write` gets 403.

## 6. Dependencies and risks

| # | Item | Type | Owner |
| --- | --- | --- | --- |
| D1 | Backend `FrontendCapabilityPolicy::WRITE` is `false`, so `data-operator` cannot be assigned to frontend users | Blocking for non-admin use | Backend owner |
| D2 | Per-table write authority does not exist (C5). Enabling writes for frontend users lets them write to every table the login can reach, through any client, not just this UI | **Blocking security decision** | Backend/security owner |
| D3 | A database login and server profile with write rights limited to the intended tables (`Access-Scopes.md`: "Writes, if ever needed, use a separate profile and login") | Deployment prerequisite | Database/backend owner |
| D4 | Approved test database for live verification (shared with roadmap E1) | Verification prerequisite | Backend owner |
| R1 | A non-unique `key` makes Update or Delete change several rows (C3), and this is only detected afterwards | Risk; mitigated by Q4 and the `affectedRows` check | Report authors |
| R2 | Lost updates without concurrency tokens (C4) | Accepted risk, or backend work (Q5) | Product owner |
| R3 | A frontend Data Operator also gets `sql.execute`/`routine.execute` (C6) | Risk to review with D2 | Backend/security owner |

## 7. Decision register (Gate 0)

No decision below has been made. No owner has been named in the project record, so every row reads *Unassigned*. Record each answer in this table, with the date and the decision-maker, before the step it blocks begins. Rows marked **Implementation** belong to Gate 0 and block step 1. Rows marked **Production enablement** block only step 5, the step that turns `frontendCapabilities.write` on.

| ID | Question | Why it matters | Recommended option | Decision-maker | Consequence for implementation | Blocks | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D2 | **Write-permission boundary.** Is it acceptable that `data.write` lets a user write to every table the database login can reach, through any API client? Or must per-table write authority exist first? | Report configuration cannot restrict writes (C5). A frontend Data Operator could change any writable table, not only the report's | None in the design. This is a security judgement. Limiting the database login (D3) narrows the exposure but does not create per-table authority | Backend/security owner (Unassigned) | If it is not acceptable, 37 stops until the backend adds per-table write authorization, and steps 1–4 would be wasted work | **Implementation** (go/no-go) | Awaiting owner decision |
| Q1 | **Initial eligible reports.** Which report(s) need actions, and who requested them? | The eligibility rules (§4.1) and validator scope depend on the real target. A SQL Resource or grouped report cannot qualify | None. Nothing in the project record names a report. The Item report is structurally eligible (§4.1), but nobody has requested it | Product owner (Unassigned) | Decides whether the §4.1 rules suffice; step 5 configures only these reports | **Implementation** | Awaiting owner decision |
| Q2 | **Operations in scope**: insert, update, delete, upsert? | Each operation adds schema, UI, and tests. Upsert needs a PK or unique index (C1) | **Update and delete** first; upsert not in the UI | Product owner (Unassigned) | Fixes the `actions` schema (step 1) and which dialogs exist (step 4) | **Implementation** | Awaiting owner decision |
| Q3 | **Authorization representation.** Should the UI gate on `backendRole` names, or on a permission/capability flag in `auth.session`? | The role-to-permission mapping is backend configuration. Hard-coding role names can drift from it, though a `403` stays authoritative either way | A session permission flag. This needs a backend change; until it exists, gate on the roles that hold `data.write` (C6) | Backend owner, with the product owner (Unassigned) | Shapes the visibility check (§4.3, step 4). A flag adds a backend dependency | **Implementation** | Awaiting owner decision |
| Q6 | **Key-column editing.** May an update change the key columns? | Changing a key makes the row filter ambiguous, and can collide with another row (C3, `DUPLICATE_KEY`) | **No**: key columns are read-only; delete and re-add instead | Product owner (Unassigned) | The validator rejects key fields in `update.fields` (step 1) | **Implementation** | Awaiting owner decision |
| Q8 | **Initial rollout scope.** Should Super Admins (`system-administrator`, who already hold `data.write`) get actions first, before D1 lets frontend Data Operators exist? | This decides whether release depends on the backend capability change (D1) | None. An admin-only first release avoids D1, but still requires D2 and D3 | Product owner, with the security owner (Unassigned) | Sets the visibility roles for step 4, and whether step 5 waits for D1 | **Implementation** | Awaiting owner decision |
| Q4 | **Key uniqueness and affected-row guarantee.** Is each configured `key` guaranteed unique by the report author, or verified (for example from backend metadata)? | A non-unique key makes Update or Delete change several rows, which is detected only afterwards (C3, R1) | Author responsibility, documented in the configuration reference, plus the `affectedRows` check (§4.4). Whether backend metadata can verify keys is unverified | Product owner and report authors (Unassigned) | Possibly a metadata check before enabling a report; otherwise documentation only | **Production enablement** | Awaiting owner decision |
| Q5 | **Concurrent edits.** Is last-write-wins acceptable? | There are no concurrency tokens (C4), so one user's update can silently overwrite another's | None. If it is not acceptable, the backend must add concurrency support first | Product owner (Unassigned) | Either documented as a limitation, or 37 waits on new backend work | **Production enablement** | Awaiting owner decision |
| Q7 | **Audit requirement.** Must Audit (44) ship before writes are enabled in production? | Writes change business data; whether changes must be attributable is a policy question. 44 itself depends on 37 | None in the design | Product/compliance owner (Unassigned) | If yes, step 5 waits for 44 | **Production enablement** | Awaiting owner decision |

Dependencies that are not decisions (D1, D3, D4) are listed in §6.

## 8. Implementation sequence

| Step | Deliverable | Depends on |
| --- | --- | --- |
| **Gate 0** | The §7 rows marked **Implementation** (D2, Q1, Q2, Q3, Q6, Q8) decided and recorded. D3 planned | Decision-makers in §7 (Unassigned) |
| 1 | `actions` type, validator, and eligibility rules, with configuration tests (acceptance 1–2). No UI; `write` stays `false` | Gate 0 |
| 2 | Pure request builders plus tests (acceptance 3–4) | 1 |
| 3 | `GenericGrid` `onSelectionChange`, plus tests (selection resets on page, sort, filter, refresh) | — (it can start in parallel; no behavior change) |
| 4 | Toolbar controls, dialogs, the state machine in `ReportViewer`, and visibility gating, plus tests (acceptance 5–11), all behind `write: false` | 1–3 |
| 5 | Turn on `frontendCapabilities.write` together with the backend change (D1, unless Q8 chooses admin-only), add `actions` to the chosen report, and update docs and changelog | D1, D3, and the §7 rows marked **Production enablement** (Q4, Q5, Q7) |
| 6 | Live verification (acceptance 12), then mark 37 completed | D4 |

Steps 1–4 ship nothing user-visible while `write` is `false`, so they can merge safely before the backend decisions land.
