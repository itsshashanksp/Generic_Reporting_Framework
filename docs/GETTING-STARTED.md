# Getting started

## Prerequisites

- **Node.js 22** (the version CI uses) and the npm that ships with it. Newer versions may work; Node 24.19 was used for the local checks on 2026-10-16.
- For live data: a running Generic SQL API backend with **user setup completed** and an account that has frontend access. The test suite does not need a backend.

## Install

```bash
git clone git@github.com:itsshashanksp/Generic_Reporting_Framework.git
cd Generic_Reporting_Framework
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`.

## Configure the API URL

The frontend sends every request to `VITE_API_URL`. For local development, copy the example file:

```bash
cp .env.example .env
```

```dotenv
VITE_API_URL=http://localhost:8000/index.php
```

Change the value to match the host and port of your local backend. Vite reads `.env` at startup, so restart `npm run dev` after editing it. `.env` is git-ignored; never commit it, and never put secrets in a `VITE_*` variable, because the value is embedded in the browser bundle. Every setting is listed in [Configuration](CONFIGURATION.md#environment-variables).

`localhost` and `127.0.0.1` are interchangeable here: the client rewrites the API host to match the hostname you opened the app with, so the session cookie is still sent.

## Start the development server

```bash
npm run dev
```

Open the URL Vite prints (by default `http://localhost:5173`). You should see one of the following:

| Screen | Meaning |
| --- | --- |
| **Sign-in page** | The backend is reachable and setup is complete. Sign in |
| "User setup is required." | The backend reports `initialized: false`. Complete setup in the Backend Admin Console |
| "Unable to check application setup" | The backend is unreachable or returned an invalid response. See [Troubleshooting](TROUBLESHOOTING.md) |

After you sign in, the app redirects to the first dashboard in `src/config/menu.json` (the Item Dashboard), and its widgets load.

## Run the checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The production output goes to `dist/`. Run `npm run preview` to serve it locally. Hosting is covered in [Deployment](DEPLOYMENT.md).

## Next steps

- [Architecture](ARCHITECTURE.md): how the app is put together.
- [Configuration](CONFIGURATION.md) and [`examples/`](../examples/): adding a report or dashboard.
- [Development](DEVELOPMENT.md): day-to-day workflow.

[Documentation index](README.md) · [Project README](../README.md)
