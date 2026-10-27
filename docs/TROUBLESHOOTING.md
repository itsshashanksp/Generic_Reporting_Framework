# Troubleshooting

Each message below is the exact text the frontend shows or logs. Backend-specific failures (SQL errors, resource resolution, permissions) arrive as the backend's own `message` and `details`, so diagnose those with the backend documentation.

## Startup and sign-in

| Message / symptom | Cause | Fix |
| --- | --- | --- |
| "Unable to check application setup" + "The data service could not be reached…" | `fetch` failed: wrong `VITE_API_URL`, backend down, or a CORS error | Check `VITE_API_URL` in `.env` (dev) or the `/api` routing (prod), then restart `npm run dev`. Look in the browser console for CORS errors |
| "The API returned an invalid JSON response." / "The API returned HTTP 404." (or another status) | The URL responds, but not as the API. A common cause in production is the SPA fallback serving `index.html` for `/api` | Point `VITE_API_URL` at the backend entry point. Exclude `/api` from the SPA fallback ([Deployment](DEPLOYMENT.md)) |
| "The API returned an invalid setup response." | `setup.status` did not return exactly one row `{ "initialized": boolean }` | The backend version doesn't match the frontend |
| "User setup is required." | The backend reports `initialized: false` | Complete user setup in the Backend Admin Console |
| "Frontend access is not assigned" | The account has a session but `frontendAccess: false` | Have an administrator grant frontend access |
| Sign-in succeeds, then the app returns to the login page; or "The security token is invalid or expired." | The session cookie isn't being sent back: the API is cross-site, or HTTP is used with a `Secure` cookie | In dev, open the app on the same host as the API (`localhost` vs `127.0.0.1` is handled automatically). In prod, serve the API same-origin at `/api` over HTTPS |
| "Unable to establish a secure request. Refresh the page and try again." | The `auth.csrf` request failed | Check the backend and the session cookie, then reload |
| "The API returned an invalid security token." | The `auth.csrf` row is missing a 64-hex `csrfToken` | The backend version doesn't match the frontend |
| "The API returned an invalid authentication response." | The session row has unexpected keys or values (for example `frontendRole` set while `frontendAccess` is `false`) | Check the backend's `auth.session` output against [Authentication](AUTHENTICATION.md#session-payload) |
| "Too many unsuccessful login attempts. Please try again in N minutes." / "Invalid username or password. Attempts remaining: N." | The backend returned `LOGIN_RATE_LIMITED` / `INVALID_CREDENTIALS` | Wait the indicated time, or check the credentials |
| Blank page, and the console shows `Navigation configuration …` or `… references unknown reportId "…"` | `src/config/menu.json` is invalid, or references a report/dashboard that failed to load (an invalid definition is excluded from the registry) | Fix the menu entry, or fix the referenced definition (its own error is logged above) |

## Reports and dashboards

| Message / symptom | Cause | Fix |
| --- | --- | --- |
| "Report configuration error" + validation text | The report JSON failed validation | Fix the file. The message names the property ([Common mistakes](CONFIGURATION.md#common-mistakes)) |
| "Report not found" | No loaded report has that `id`. The filename doesn't matter | Check `id`, and the console for a load error |
| "Dashboard Configuration Error" + a list | The dashboard JSON failed validation | Fix each listed error |
| Dashboard shows only the filter form, and no widgets | The dashboard has a required filter or `dateFilterBehavior: "required"`. This is by design | Enter both dates and press **Search** |
| A widget shows "… Invalid request." followed by `path: message` details | The backend rejected the request | Read the appended detail. Typical causes: a column/filter field the resource doesn't have, or a page size above the backend `maxPageSize` |
| "The current filters returned no data." | An empty result set | Widen the filters. Some SQL Resources also restrict dates internally (for example to the current financial year) |
| Numbers sort as text (1, 10, 2…) or aren't formatted | The column has no `"dataType": "number"` | Add `dataType` to the column |
| Filter dropdown shows "Unable to load filter values." | The `dynamicOptions.request` failed | Choose **Retry** after checking connectivity. If it repeats, test that request on its own; it must be a valid JSON Query `select` |
| A change to a JSON file has no effect on a deployed site | The configuration is bundled at build time | Rebuild and redeploy |

## Export

| Message | Cause | Fix |
| --- | --- | --- |
| "This export has N rows, which exceeds the 100,000-row export limit. Narrow the filters and try again." | The client-side export limit | Narrow the filters |
| "The data service returned an incomplete export result. Nothing was exported." | A page came back short before `totalRows` was reached | Retry. If it persists, the backend is returning fewer rows than it counts |
| "The matching rows changed while the export was running. Try again. Nothing was exported." | `totalRows` differed between pages, because data was written during the export | Retry when the data is stable |
| "The data service returned the same rows for consecutive pages." / "…more rows than the reported total." | The backend did not honor `pagination` | Report it to the backend owner; nothing was saved |
| "The CSV file could not be created." / "The Excel file could not be created." | The browser couldn't write the file | Retry. Check the browser's download permissions |

## Development

| Symptom | Fix |
| --- | --- |
| `npm run build` fails with `VITE_API_URL "…" points to a loopback host…` | A production build picked up a local URL. Remove `.env.production.local` (or the shell variable), or build with `--mode development` for a local bundle |
| A test fails with "Unexpected network request in frontend test." | The test reached `fetch` without a mock. Mock the response |
| `tsc --noEmit` reports nothing although there are type errors | Use `npm run typecheck`; the root tsconfig only holds project references |

[Getting started](GETTING-STARTED.md) · [Deployment](DEPLOYMENT.md) · [Documentation index](README.md)
