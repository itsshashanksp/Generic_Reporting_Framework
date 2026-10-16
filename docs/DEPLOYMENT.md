# Deployment and hosting

The frontend builds to static files. Any web server that can serve static files can host it, as long as it meets the requirements below. Deploying the Generic SQL API itself is a backend responsibility and is not covered here.

**Verification status.** The build and its production API-URL check are verified: `npm run build` passes locally and in CI. The repository contains **no** server configuration, and no hosting setup was tested as part of this documentation. The IIS and Nginx snippets below are *unverified examples* written from the frontend's requirements. Test them in your environment before relying on them.

## Requirements

| Requirement | Why |
| --- | --- |
| Serve `dist/` from the **site root** (`/`) | `index.html` references `/assets/…` and `/favicon.svg` by absolute path, and the router has no `basename`. Hosting under a sub-path such as `/reports/` is **not supported** without a code change |
| Fallback to `/index.html` for unknown paths | Routes such as `/dashboard/bill-dashboard`, `/report/item`, and `/settings/users` are client-side. Reloading the page or opening a deep link must still return `index.html` |
| Exclude the API path from that fallback | `POST /api` must reach the backend, not `index.html` |
| Route `/api` to the Generic SQL API on the **same origin** | Production builds use `VITE_API_URL=/api` (`.env.production`). The cookie session and CSRF protection depend on the API being same-site (see [API origin](#api-origin)) |
| HTTPS in production | Required for a secure session cookie. Cookie flags are set by the backend |

## Build

```bash
npm ci
npm test && npm run lint && npm run typecheck   # optional locally; CI runs them
npm run build
```

- Output: `dist/index.html`, `dist/favicon.svg`, and `dist/assets/index-<hash>.js|css`. There are no source maps (`build.sourcemap: false`).
- `vite build` reads `.env.production` (`VITE_API_URL=/api`). A local `.env.production.local` or a shell variable overrides it.
- The build **fails** if `VITE_API_URL` is a loopback host (`localhost`, `127.x`, `[::1]`, …), invalid, has surrounding whitespace, or is not an http(s) URL or a same-origin path. The check lives in `tooling/productionApiUrl.ts` and is called from `vite.config.ts`.
- All report, dashboard, and menu JSON is compiled into the bundle. **Any configuration change requires a new build and deployment.**
- Vite prints a warning that the chunk is larger than 500 kB. The warning is expected, and the build still succeeds.

To check a build locally, run `npm run preview` and open the printed URL. Live data needs an API reachable at the built `VITE_API_URL`, which for `/api` means on the preview server's origin. So the preview mainly confirms that the bundle loads and the routes render.

## API origin

| `VITE_API_URL` | Status |
| --- | --- |
| `/api` (same origin) | **Intended production setup.** This is what `.env.production` uses |
| `https://api.example.com/…` (another origin) | The build accepts it, but **unverified**. Every request uses `credentials: "include"`, so the backend must send credentialed CORS headers, and the session cookie must be usable from the page's site. With a `SameSite=Lax` cookie, that means the same *site* (registrable domain) |

## Example: Nginx (unverified)

```nginx
server {
    listen 443 ssl;
    server_name reports.example.com;
    root /var/www/generic-reporting/dist;

    # API: route to the Generic SQL API (see the backend deployment docs).
    location = /api {
        # proxy_pass / fastcgi_pass to the backend entry point
    }

    # Hashed assets never change; cache them long-term.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback; never cache index.html, so new deployments are picked up.
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ /index.html;
    }
}
```

## Example: IIS (unverified)

This requires the IIS URL Rewrite module. Place `web.config` next to `index.html` in the deployed folder. It is not part of `dist/` and not in this repository.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Leave /api to the backend application/route configured on this site. -->
        <rule name="SPA fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_URI}" pattern="^/api(/|$|\?)" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## Deployment steps

1. Build from a clean checkout of the commit you are releasing: `npm ci && npm run build`.
2. Make sure the backend this build talks to supports the actions the frontend uses: `setup.status`, `auth.*`, `auth.frontendUsers.*`, `select`, `sql`, and every SQL Resource ID the dashboards reference. See [API reference](API-REFERENCE.md) and the resource list in [Examples](EXAMPLES.md#dashboard-sql-resources-in-use).
3. Copy the **contents** of `dist/` to the site root. Replace the old `assets/` folder rather than merging into it, so stale hashed files don't build up (or keep them deliberately for clients that are still open).
4. Make sure the host serves `index.html` with `no-cache` (or a short cache lifetime). The hashed assets can be cached long-term.

## Post-deployment checks

1. Open `/`. You should see the sign-in page, or "User setup is required" if backend setup is incomplete.
2. Sign in. The app redirects to the first dashboard (Item Dashboard), and its widgets load.
3. Reload on a deep link such as `/report/item`. It must render the report, not a 404 page.
4. In the browser's network tab, requests go to `POST /api` with the session cookie, and `auth.login`/`auth.logout` carry `X-CSRF-Token`.
5. Run a CSV or Excel export from a report and from a dashboard table.
6. As an admin, open **Settings → User Management**.

## Rollback

- Keep the previous `dist/` and redeploy it. The frontend holds no server-side state.
- Check frontend/backend compatibility before rolling back only one side:
  - Builds since `15200c5` request `widgets/sales-top-10-month-wise-category-wise`. Older builds request `widgets/TOP-10-month-Wise-Category-wise`, which current backends no longer provide (roadmap E3).
  - Builds since the authentication work (September 2026) need the backend's `setup.status` and `auth.*` actions.
- Saved report views live in each user's browser. A rollback to a build from before `983ee7d` would not see views saved under the per-user keys.

## Common deployment failures

| Symptom | Likely cause |
| --- | --- |
| Build error `VITE_API_URL "http://localhost…" points to a loopback host…` | A developer `.env.production.local` or a shell variable overrides `.env.production`. Set `VITE_API_URL=/api` |
| Blank page; `/assets/*.js` returns 404 | The app is deployed under a sub-path, or only part of `dist/` was copied |
| 404 when reloading `/dashboard/...` | The SPA fallback is missing |
| "The API returned an invalid JSON response." or "The API returned HTTP 404/405." at the setup check | `/api` is not routed to the backend, or the fallback returns `index.html` for `/api` |
| Signed in but immediately signed out again, or `CSRF_VALIDATION_FAILED` | The cookie isn't sent: the API is cross-site, or it is served over HTTP while the cookie is `Secure` |

More: [Troubleshooting](TROUBLESHOOTING.md).
