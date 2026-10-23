# Test fixtures

`runtime-config/` preserves historical application definitions required by
loader, dashboard, filtering, export, routing, and compatibility regressions.
Vitest maps `@runtime-config` here so clean checkouts exercise the real Vite glob
loaders. Production and development map that alias to local `src/config` and
never load these fixtures.

These files are test data, not supported examples or an installable application.
