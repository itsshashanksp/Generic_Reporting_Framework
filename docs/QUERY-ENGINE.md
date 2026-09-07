# Query engine status

The active frontend query contract is documented in [Query modes](QUERY-MODES.md).

`src/engine/ReportQueryEngine` retains a SQL tokenizer/parser, SQL resource loader utilities, a converter, and unit tests from an earlier paired-file design. The current report and dashboard loaders do not use that conversion path. Runtime SQL mode sends `{action:"sql", resource:"..."}` to the backend; runtime JSON mode starts from a top-level `request`.

Consequently:

- Do not add paired frontend `.sql` files.
- Do not treat parser acceptance as the production SQL contract.
- Do not put credentials or executable SQL in frontend configuration.
- Backend resource registration, SQL validation and execution are outside this repository's frontend contract.

Any future activation or removal of the legacy engine should be a deliberate runtime change with tests and documentation updated together.
