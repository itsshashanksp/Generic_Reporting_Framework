# Contributing

Thank you for contributing to the Generic Reporting Framework frontend.

## Configuration feature contract

Any change that adds, changes, aliases, or deprecates a JSON configuration property must update all applicable parts of the configuration contract in the same change:

1. TypeScript configuration types.
2. Runtime validator and conditional dependencies.
3. Loader/parser/resolver behavior and defaults.
4. Public focused JSON example.
5. Applicable complete reference example.
6. `src/config/featureRegistry.ts`.
7. Configuration documentation.
8. Validator and loader regression tests.
9. Configuration coverage audit.
10. Relevant ignored runtime JSON only when locally necessary; never force-add it.

Run `npm run config:audit`, the full tests, type checking, lint, production build, and `git diff --check`. Missing registry example/document references or invalid public configurations fail the audit.

## Before You Start

- Keep changes scoped to the frontend repository.
- For substantial features, discuss the intended behavior before investing in a large implementation.
- Read the [architecture](docs/ARCHITECTURE.md), including its [ownership boundary](docs/ARCHITECTURE.md#ownership-boundary), and the [roadmap](docs/ROADMAP.md) so you don't restart completed work.
- Never commit credentials, local `.env` files, generated builds, or coverage artifacts.

## Development Workflow

1. Create a focused branch from the current default branch.
2. Install locked dependencies with `npm ci`.
3. Make the smallest cohesive change and add or update meaningful tests.
4. Update documentation when behavior, configuration, or public authoring rules change, and add a `CHANGELOG.md` entry. If you change a schema, re-validate the files in `examples/`.
5. Run the complete validation suite.

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Project Expectations

- Preserve TypeScript type safety and existing component accessibility.
- Keep SQL as the source of query/data logic and JSON as the source of UI/UX presentation.
- Do not add backend-specific implementation details or change backend code from this repository.
- Keep JSON Query configuration within the documented backend public contract.
- Do not introduce frontend SQL parsing or use JSON `request` definitions to carry SQL-backed resource logic.
- Avoid unrelated formatting or refactors in a focused change.
- Do not change tests only to make a failure disappear; fix the production behavior or update an assertion when the intended contract genuinely changed.

## Pull Requests

Describe the problem, the chosen solution, affected configuration or user flows, and validation results. Include screenshots for visible UI changes and call out any limitation or follow-up. Keep commits and the pull request narrowly focused enough to review.

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
