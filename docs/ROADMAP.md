# Frontend roadmap

Status reflects executable frontend code, not backend capability or aspirational configuration.

Status summary: Completed — 36 and 36A; In Progress — none; Next — 37; Planned — 39, 40, 41, 42, 44, 45, and 46; Deferred / Last — 38 and 43. Removed and not-supported work is listed below the table.

| # | Workstream | Status | Evidence / remaining scope |
| ---: | --- | --- | --- |
| 36 | Report layout and responsive UX | Completed | Shared report/table frame, mobile labeled cards, filters, sort, pagination, pull-to-refresh, and portaled More/Export sheet |
| 36A | Backend read-capability alignment and cleanup | Completed | JSON/SQL Resource contracts, validation, dead SQL parser removal, API/error documentation and tests |
| 37 | Report actions | Next | Define frontend mutation UX and a safe resource/action schema before exposing backend insert/update/delete/upsert; none are currently supported |
| 39 | Chart engine | Planned | Basic bar/line/pie widgets exist; multi-series configuration, formatting, accessibility, interactions, and export remain |
| 40 | Dashboard builder | Planned | Current dashboards are authored JSON; no interactive builder or saved dashboard model |
| 41 | Drill down | Planned | Needs navigation/filter context contract and tests |
| 42 | Report scheduler | Planned | Requires an external/backend scheduling and delivery contract; no frontend-only implementation is claimed |
| 44 | Audit | Planned | Define auditable frontend events after identity and mutation contracts exist |
| 45 | Favorites | Planned | Define local vs account-backed ownership and migration |
| 46 | Report designer | Planned | Must emit only validated JSON Query structures or registered SQL Resource IDs—never SQL text |
| 38 | Email report | Deferred / Last | Keep after scheduling, identity, and delivery APIs are defined |
| 43 | Authentication and roles | Deferred / Last | Firebase direction retained; backend currently has no API authorization, so UI hiding alone is insufficient |

## Removed / not supported

- Frontend SQL parser/converter: removed because it contradicted backend-owned SQL Resource architecture and had no runtime consumer.
- Disabled Settings placeholder: removed; column personalization remains planned rather than represented as working.
- Global search engine: removed because no UI or request integration used it. Configured filter submission remains supported.
- Report mutation actions: not supported yet. Backend write endpoints do not by themselves constitute a safe frontend feature.

Any roadmap item becomes completed only when runtime behavior, validation, tests, accessibility, documentation, and backend contract alignment land together.
