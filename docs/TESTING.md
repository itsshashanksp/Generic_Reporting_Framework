# Testing

The frontend uses Vitest, React Testing Library, and jsdom. Tests are deterministic and frontend-only: they do not start PHP, connect to SQL Server, or require the Generic SQL API.

## Test Organization

Tests are colocated in `__tests__` directories near the production behavior they cover. Vitest discovers `*.test.*` and `*.spec.*` files through its standard discovery rules. Shared setup is in `src/test/setup.ts`.

The setup file installs DOM matchers and a failing `fetch` guard. Any test that would make an unmocked network request fails immediately; component and integration tests must provide deliberate request mocks.

## Coverage Areas

- SQL contract parsing, mapping, and typed failures
- `QueryDefinition` conversion to the universal API request
- filters, including single-ended date-range regressions
- production report, widget, and dashboard configuration separation
- widget/dashboard loading and field resolution
- report and dashboard component data flow with mocked responses
- grid columns, sorting, grouping, and pagination behavior
- request-cache expiry and in-flight deduplication
- navigation structure and sidebar collapse behavior

Unit tests cover deterministic engines and converters. Component/integration tests render real React components against small mocked API responses. Final visual appearance and native AG Grid drag interactions still require browser verification.

## Local Validation

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Use `npm test -- --watch` for an interactive local Vitest session. Do not weaken assertions or alter tests merely to hide a production regression.

## Continuous Integration

`.github/workflows/frontend-ci.yml` runs on pushes and pull requests with Node.js 22. It installs locked dependencies with `npm ci`, then runs tests, lint, the standalone TypeScript check, and the production build.

[Documentation index](README.md) · [Development](DEVELOPMENT.md) · [Contributing](../CONTRIBUTING.md)
