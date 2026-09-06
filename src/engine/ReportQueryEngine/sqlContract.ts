import type { HavingCondition, QueryField, QueryFilter, QueryJoin } from "../../types/api";

export const supportedAggregateFunctions = [
    "COUNT",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
] as const;

export type SupportedAggregateFunction = typeof supportedAggregateFunctions[number];
export type SupportedWhereOperator =
    | "=" | "!=" | "<>" | ">" | "<" | ">=" | "<="
    | "LIKE" | "NOT LIKE" | "IN" | "NOT IN"
    | "BETWEEN" | "NOT BETWEEN" | "IS NULL" | "IS NOT NULL";
export type SqlLiteral = string | number | boolean;

export type SelectExpression =
    | { kind: "all" }
    | { kind: "column"; field: string; alias?: string }
    | {
          kind: "aggregate";
          function: SupportedAggregateFunction;
          field: string;
          alias?: string;
      };

export interface StaticWhereCondition {
    field: string;
    operator: SupportedWhereOperator;
    value?: SqlLiteral | SqlLiteral[];
}

export type AggregateHavingCondition = HavingCondition;

export type SqlContractErrorCode =
    | "EMPTY_SQL"
    | "MULTIPLE_STATEMENTS"
    | "UNSUPPORTED_STATEMENT"
    | "UNSUPPORTED_FEATURE"
    | "INVALID_SELECT"
    | "INVALID_SELECT_MODIFIER"
    | "INVALID_FROM"
    | "INVALID_JOIN"
    | "UNSUPPORTED_JOIN_TYPE"
    | "INVALID_WHERE"
    | "INVALID_GROUP_BY"
    | "INVALID_HAVING"
    | "INVALID_ORDER_BY";

export type SqlContractValidationResult =
    | { valid: true }
    | { valid: false; code: SqlContractErrorCode; message: string };

const IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";
const FIELD_REFERENCE = `${IDENTIFIER}(?:\\.${IDENTIFIER})?`;
const FIELD_REFERENCE_PATTERN = new RegExp(`^${FIELD_REFERENCE}$`);
const ALIAS_PATTERN = new RegExp(`^${IDENTIFIER}$`);
const SELECT_COLUMN_PATTERN = new RegExp(
    `^(${FIELD_REFERENCE})(?:\\s+AS\\s+(${IDENTIFIER}))?$`,
    "i"
);
const AGGREGATE_PATTERN = new RegExp(
    `^(${supportedAggregateFunctions.join("|")})\\s*\\(\\s*(\\*|${FIELD_REFERENCE})\\s*\\)(?:\\s+AS\\s+(${IDENTIFIER}))?$`,
    "i"
);
const HAVING_CONDITION_PATTERN = new RegExp(
    `^(${supportedAggregateFunctions.join("|")})\\s*\\(\\s*(\\*|${FIELD_REFERENCE})\\s*\\)\\s*(>=|<=|<>|!=|=|>|<)\\s*(.+)$`,
    "i"
);
const SQL_RESOURCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;
const BASE_SOURCE_PATTERN = new RegExp(
    `^(${IDENTIFIER})(?:\\s+AS\\s+(${IDENTIFIER}))?`,
    "i"
);
const JOIN_PATTERN = new RegExp(
    `^(?:(INNER|LEFT|RIGHT)\\s+)?JOIN\\s+(${IDENTIFIER})(?:\\s+AS\\s+(${IDENTIFIER}))?\\s+ON\\s+(${FIELD_REFERENCE})\\s*=\\s*(${FIELD_REFERENCE})(?=\\s+(?:(?:(?:INNER|LEFT|RIGHT)\\s+)?JOIN)\\b|$)`,
    "i"
);

export const sqlFeatureSupport = {
    select: "supported",
    distinct: "supported",
    top: "supported",
    from: "supported",
    where: "supported",
    join: "supported",
    groupBy: "supported",
    having: "supported",
    with: "unsupported",
    union: "unsupported",
    subquery: "unsupported",
    orderBy: "supported",
    scalarFunctions: "partial",
    arithmetic: "supported",
    case: "supported",
    windowFunctions: "supported-without-partition",
} as const;

export function isValidSqlResourceReference(resource: string): boolean {
    return SQL_RESOURCE_PATTERN.test(resource);
}

export function mapSelectExpression(expression: SelectExpression): QueryField {
    if (expression.kind === "all") return "*";
    assertFieldReference(expression.field);
    if (expression.alias !== undefined && !ALIAS_PATTERN.test(expression.alias)) {
        throw new Error(`Invalid SELECT alias: ${expression.alias}`);
    }

    if (expression.kind === "column") {
        return expression.alias
            ? { field: expression.field, alias: expression.alias }
            : expression.field;
    }

    if (expression.field === "*" && expression.function !== "COUNT") {
        throw new Error(`${expression.function}(*) is not supported.`);
    }

    return {
        function: expression.function,
        field: expression.field,
        ...(expression.alias ? { alias: expression.alias } : {}),
    };
}

export function mapStaticWhereCondition(
    condition: StaticWhereCondition
): QueryFilter {
    assertFieldReference(condition.field);
    return { ...condition };
}

export function mapAggregateHavingCondition(
    condition: AggregateHavingCondition
): HavingCondition {
    assertFieldReference(condition.field);
    if (condition.field === "*" && condition.function !== "COUNT") {
        throw new Error(`${condition.function}(*) is not supported.`);
    }
    return { ...condition };
}

export function mapJoinDefinition(join: QueryJoin): QueryJoin {
    assertFieldReference(join.on.left);
    assertFieldReference(join.on.right);
    return {
        type: join.type,
        source: { ...join.source },
        on: { ...join.on },
    };
}

/**
 * Conservative grammar preflight for contract tests and author feedback. It
 * recognizes the supported input subset but deliberately does not build a query.
 */
export function validateSqlAuthoringText(sql: string): SqlContractValidationResult {
    const trimmed = sql.trim();
    if (!trimmed) return invalid("EMPTY_SQL", "SQL must not be empty.");

    const maskedResult = maskStringLiterals(trimmed);
    if (!maskedResult.valid) {
        return invalid(
            /\bHAVING\b/i.test(trimmed) ? "INVALID_HAVING" : "INVALID_WHERE",
            maskedResult.message
        );
    }
    const masked = maskedResult.value;
    const semicolons = [...masked.matchAll(/;/g)];
    if (semicolons.length > 1 || (semicolons.length === 1 && semicolons[0].index !== masked.length - 1)) {
        return invalid("MULTIPLE_STATEMENTS", "Only one SQL statement is allowed.");
    }

    const statement = semicolons.length === 1 ? trimmed.slice(0, -1).trim() : trimmed;
    const statementMask = semicolons.length === 1 ? masked.slice(0, -1).trim() : masked;

    if (/^(INSERT|UPDATE|DELETE|EXEC(?:UTE)?|MERGE|CREATE|ALTER|DROP)\b/i.test(statementMask)) {
        return invalid("UNSUPPORTED_STATEMENT", "Only SELECT statements are supported.");
    }
    const blocked = findUnsupportedFeature(statementMask);
    if (blocked) {
        return invalid("UNSUPPORTED_FEATURE", `${blocked} is not supported by the initial SQL contract.`);
    }
    if (!/^SELECT\b/i.test(statementMask)) {
        return invalid("UNSUPPORTED_STATEMENT", "SQL must begin with SELECT.");
    }

    const clauseOrderError = validateClauseOrder(statementMask);
    if (clauseOrderError) return clauseOrderError;

    const structure = /^SELECT\s+([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+))?$/i.exec(statement);
    if (!structure) {
        return invalid(
            "INVALID_SELECT",
            "Expected SELECT fields FROM a source with supported optional clauses."
        );
    }

    const [, selectText, fromText, whereText, groupByText, havingText, orderByText] = structure;
    const fromError = validateFromAndJoins(fromText);
    if (fromError) return fromError;

    const selectClause = validateSelectModifiers(selectText);
    if (!selectClause.valid) return selectClause.error;
    const selections = splitCommaSeparated(selectClause.fields);
    if (selections.length === 0 || selections.some(item => !isSupportedSelectItem(item))) {
        return invalid("INVALID_SELECT", "SELECT contains an unsupported expression.");
    }

    if (whereText !== undefined && !isSupportedWhere(whereText)) {
        return invalid("INVALID_WHERE", "WHERE supports literal comparisons joined only by AND.");
    }

    if (groupByText !== undefined) {
        const groupByError = validateGroupBy(selections, groupByText);
        if (groupByError) return groupByError;
    }

    if (havingText !== undefined && !isSupportedHaving(havingText)) {
        return invalid(
            "INVALID_HAVING",
            "HAVING supports aggregate comparisons joined only by AND."
        );
    }

    if (orderByText !== undefined && !isSupportedOrderBy(orderByText)) {
        return invalid("INVALID_ORDER_BY", "ORDER BY requires logical fields with optional ASC or DESC.");
    }

    return { valid: true };
}

function isSupportedSelectItem(value: string): boolean {
    const item = value.trim();
    if (item === "*") return true;
    const aggregate = AGGREGATE_PATTERN.exec(item);
    if (aggregate) {
        return aggregate[2] !== "*" || aggregate[1].toUpperCase() === "COUNT";
    }
    return SELECT_COLUMN_PATTERN.test(item)
        || /^CASE\b[\s\S]+\bEND\s+AS\s+[A-Za-z_][A-Za-z0-9_]*$/i.test(item)
        || /^[A-Za-z_][A-Za-z0-9_]*\s*\([\s\S]*\)(?:\s+AS\s+[A-Za-z_][A-Za-z0-9_]*)?$/i.test(item)
        || /^(?:ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE)\s*\([^)]*\)\s+OVER\s*\([\s\S]+\)\s+AS\s+[A-Za-z_][A-Za-z0-9_]*$/i.test(item)
        || /^[A-Za-z_][A-Za-z0-9_.]*\s*[+\-*/%]\s*(?:[A-Za-z_][A-Za-z0-9_.]*|-?(?:\d+(?:\.\d+)?|\.\d+))\s+AS\s+[A-Za-z_][A-Za-z0-9_]*$/i.test(item)
        || /^CURRENT_TIMESTAMP(?:\s+AS\s+[A-Za-z_][A-Za-z0-9_]*)?$/i.test(item);
}

function isSupportedWhere(value: string): boolean {
    const maskedResult = maskStringLiterals(value);
    if (!maskedResult.valid || /\bOR\b/i.test(maskedResult.value) || /\b(?:EXISTS|SELECT)\b/i.test(maskedResult.value)) {
        return false;
    }

    const conditions = splitWhereConditions(value);
    return conditions.length > 0 && conditions.every(isSupportedWhereCondition);
}

function isSupportedWhereCondition(value: string): boolean {
    const condition = value.trim();
    if (new RegExp(`^${FIELD_REFERENCE}\\s+IS\\s+(?:NOT\\s+)?NULL$`, "i").test(condition)) {
        return true;
    }
    const between = new RegExp(
        `^${FIELD_REFERENCE}\\s+(?:NOT\\s+)?BETWEEN\\s+(.+?)\\s+AND\\s+(.+)$`,
        "i"
    ).exec(condition);
    if (between) return isSqlLiteral(between[1].trim()) && isSqlLiteral(between[2].trim());

    const inList = new RegExp(
        `^${FIELD_REFERENCE}\\s+(?:NOT\\s+)?IN\\s*\\(([\\s\\S]*)\\)$`,
        "i"
    ).exec(condition);
    if (inList) {
        const values = splitCommaSeparated(inList[1]);
        return values.length > 0 && values.every(value => value && isSqlLiteral(value));
    }

    const match = new RegExp(
        `^${FIELD_REFERENCE}\\s*(?:NOT\\s+LIKE|LIKE|>=|<=|<>|!=|=|>|<)\\s*(.+)$`,
        "i"
    ).exec(condition);
    return match !== null && isSqlLiteral(match[1].trim());
}

function isSupportedOrderBy(value: string): boolean {
    const items = splitCommaSeparated(value);
    return items.length > 0 && items.every(item =>
        new RegExp(`^${FIELD_REFERENCE}(?:\\s+(?:ASC|DESC))?$`, "i").test(item)
        && !/^\d+(?:\s|$)/.test(item)
    );
}

function validateSelectModifiers(value: string):
    | { valid: true; fields: string }
    | { valid: false; error: SqlContractValidationResult & { valid: false } } {
    let fields = value.trim();
    if (/^DISTINCT\b/i.test(fields)) fields = fields.replace(/^DISTINCT\b/i, "").trim();
    if (/^TOP\b/i.test(fields)) {
        const top = /^TOP\s+([^\s]+)(?:\s+|$)([\s\S]*)$/i.exec(fields);
        if (!top || !/^\d+$/.test(top[1]) || Number(top[1]) < 1 || !top[2].trim()) {
            return { valid: false, error: invalid("INVALID_SELECT_MODIFIER", "TOP requires a positive integer.") };
        }
        fields = top[2].trim();
    }
    if (!fields || /^(?:DISTINCT|TOP)\b/i.test(fields)) {
        return { valid: false, error: invalid("INVALID_SELECT_MODIFIER", "DISTINCT/TOP syntax is malformed.") };
    }
    return { valid: true, fields };
}

function isSupportedHaving(value: string): boolean {
    const maskedResult = maskStringLiterals(value);
    if (!maskedResult.valid || /\bOR\b/i.test(maskedResult.value)) return false;

    const conditions = splitOnAnd(value);
    return conditions.length > 0 && conditions.every(condition => {
        const match = HAVING_CONDITION_PATTERN.exec(condition.trim());
        if (!match || !isSqlLiteral(match[4].trim())) return false;
        return match[2] !== "*" || match[1].toUpperCase() === "COUNT";
    });
}

function isSqlLiteral(value: string): boolean {
    return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)
        || /^(TRUE|FALSE)$/i.test(value)
        || /^'(?:[^']|'')*'$/.test(value);
}

function findUnsupportedFeature(masked: string): string | null {
    const features: Array<[RegExp, string]> = [
        [/^WITH\b/i, "WITH/CTE"],
        [/\bUNION(?:\s+ALL)?\b/i, "UNION"],
        [/[()]\s*SELECT\b/i, "subqueries"],
        [/--|\/\*|\*\//, "SQL comments"],
    ];
    return features.find(([pattern]) => pattern.test(masked))?.[1] ?? null;
}

function splitCommaSeparated(value: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let quoted = false;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (character === "'") {
            if (quoted && value[index + 1] === "'") index += 1;
            else quoted = !quoted;
        } else if (!quoted && character === "(") depth += 1;
        else if (!quoted && character === ")") depth -= 1;
        else if (!quoted && depth === 0 && character === ",") {
            result.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    result.push(value.slice(start).trim());
    return result;
}

function splitOnAnd(value: string): string[] {
    const masked = maskStringLiterals(value);
    if (!masked.valid) return [];
    const result: string[] = [];
    let start = 0;
    for (const match of masked.value.matchAll(/\bAND\b/gi)) {
        result.push(value.slice(start, match.index).trim());
        start = match.index + match[0].length;
    }
    result.push(value.slice(start).trim());
    return result;
}

function splitWhereConditions(value: string): string[] {
    const masked = maskStringLiterals(value);
    if (!masked.valid) return [];
    const result: string[] = [];
    let start = 0;
    let betweenNeedsAnd = false;
    for (const match of masked.value.matchAll(/\bAND\b/gi)) {
        const before = masked.value.slice(start, match.index);
        if (/\b(?:NOT\s+)?BETWEEN\b/i.test(before) && !betweenNeedsAnd) {
            betweenNeedsAnd = true;
            continue;
        }
        betweenNeedsAnd = false;
        result.push(value.slice(start, match.index).trim());
        start = match.index + match[0].length;
    }
    result.push(value.slice(start).trim());
    return result;
}

function validateClauseOrder(masked: string): SqlContractValidationResult | null {
    const fromIndex = searchIndex(masked, /\bFROM\b/i);
    const whereIndex = searchIndex(masked, /\bWHERE\b/i);
    const groupByIndex = searchIndex(masked, /\bGROUP\s+BY\b/i);
    const bareGroupIndex = searchIndex(masked, /\bGROUP\b/i);
    const havingIndex = searchIndex(masked, /\bHAVING\b/i);
    const joinIndex = searchIndex(masked, /\bJOIN\b/i);
    const orderByRelativeIndex = fromIndex < 0
        ? -1
        : searchIndex(masked.slice(fromIndex), /\bORDER\s+BY\b/i);
    const orderByIndex = orderByRelativeIndex < 0 ? -1 : fromIndex + orderByRelativeIndex;

    const firstPostJoinClause = [whereIndex, groupByIndex, havingIndex, orderByIndex]
        .filter(index => index >= 0)
        .sort((left, right) => left - right)[0];
    if (
        joinIndex >= 0
        && (fromIndex < 0
            || joinIndex < fromIndex
            || (firstPostJoinClause !== undefined && joinIndex > firstPostJoinClause))
    ) {
        return invalid("INVALID_JOIN", "JOIN clauses must appear after FROM and before WHERE, GROUP BY, and HAVING.");
    }

    if (bareGroupIndex >= 0 && groupByIndex < 0) {
        return invalid("INVALID_GROUP_BY", "GROUP must be followed by BY and one or more fields.");
    }
    if (havingIndex >= 0 && whereIndex > havingIndex) {
        return invalid("INVALID_HAVING", "HAVING must appear after WHERE and GROUP BY.");
    }
    if (
        groupByIndex >= 0
        && (fromIndex < 0 || groupByIndex < fromIndex || (whereIndex >= 0 && whereIndex > groupByIndex))
    ) {
        return invalid("INVALID_GROUP_BY", "GROUP BY must appear after FROM and optional WHERE clauses.");
    }
    if (groupByIndex >= 0 && /^\s*$/.test(masked.slice(groupByIndex).replace(/^GROUP\s+BY/i, ""))) {
        return invalid("INVALID_GROUP_BY", "GROUP BY requires at least one field.");
    }
    if (havingIndex >= 0 && groupByIndex < 0) {
        return invalid("INVALID_HAVING", "HAVING requires a preceding GROUP BY clause.");
    }
    if (havingIndex >= 0 && havingIndex < groupByIndex) {
        return invalid("INVALID_HAVING", "HAVING must appear after GROUP BY.");
    }
    if (havingIndex >= 0 && /^\s*$/.test(masked.slice(havingIndex).replace(/^HAVING/i, ""))) {
        return invalid("INVALID_HAVING", "HAVING requires at least one aggregate predicate.");
    }
    const precedingClauses = [whereIndex, groupByIndex, havingIndex].filter(index => index >= 0);
    if (orderByIndex >= 0 && precedingClauses.some(index => index > orderByIndex)) {
        return invalid("INVALID_ORDER_BY", "ORDER BY must be the final SQL clause.");
    }
    if (orderByIndex >= 0 && /^\s*$/.test(masked.slice(orderByIndex).replace(/^ORDER\s+BY/i, ""))) {
        return invalid("INVALID_ORDER_BY", "ORDER BY requires at least one logical field.");
    }
    return null;
}

function validateFromAndJoins(fromText: string): SqlContractValidationResult | null {
    const source = BASE_SOURCE_PATTERN.exec(fromText.trim());
    if (!source) {
        return invalid("INVALID_FROM", "FROM requires a valid unqualified table name.");
    }

    let remaining = fromText.trim().slice(source[0].length).trim();
    if (remaining && !/^(?:(?:INNER|LEFT|RIGHT)\s+)?JOIN\b/i.test(remaining)) {
        const unsupportedType = /^(?:FULL(?:\s+OUTER)?|CROSS|NATURAL|LEFT\s+OUTER|RIGHT\s+OUTER)\s+JOIN\b/i
            .test(remaining);
        return invalid(
            unsupportedType ? "UNSUPPORTED_JOIN_TYPE" : "INVALID_FROM",
            unsupportedType
                ? "JOIN type is unsupported; use INNER, LEFT, RIGHT, or bare JOIN."
                : "Table aliases must use the explicit AS keyword."
        );
    }

    while (remaining) {
        const join = JOIN_PATTERN.exec(remaining);
        if (!join) {
            return invalid(
                "INVALID_JOIN",
                "JOIN requires a valid table and one column-to-column equality after ON."
            );
        }
        remaining = remaining.slice(join[0].length).trim();
    }
    return null;
}

function validateGroupBy(
    selections: string[],
    groupByText: string
): SqlContractValidationResult | null {
    const groupFields = splitCommaSeparated(groupByText).map(field => field.trim());
    if (groupFields.length === 0 || groupFields.some(field => !field)) {
        return invalid("INVALID_GROUP_BY", "GROUP BY contains a malformed field list.");
    }
    if (groupFields.some(field => /^\d+$/.test(field))) {
        return invalid("INVALID_GROUP_BY", "Positional GROUP BY values are not supported.");
    }
    if (groupFields.some(field => !FIELD_REFERENCE_PATTERN.test(field))) {
        return invalid("INVALID_GROUP_BY", "GROUP BY supports only logical column references.");
    }

    const normalizedGroups = new Set(groupFields.map(field => field.toLowerCase()));
    const aliases = new Set<string>();
    const selectedFields: string[] = [];
    for (const selection of selections) {
        const column = SELECT_COLUMN_PATTERN.exec(selection.trim());
        if (column) {
            selectedFields.push(column[1]);
            if (column[2]) aliases.add(column[2].toLowerCase());
        } else if (selection.trim() === "*") {
            return invalid("INVALID_GROUP_BY", "SELECT * cannot be combined with GROUP BY.");
        } else if (!AGGREGATE_PATTERN.test(selection.trim()) && !/^STRING_AGG\s*\(/i.test(selection.trim())) {
            return invalid(
                "INVALID_GROUP_BY",
                "Scalar functions, CASE, and arithmetic expressions are not supported with GROUP BY."
            );
        }
    }

    const normalizedSelectedFields = new Set(selectedFields.map(field => field.toLowerCase()));
    if (groupFields.some(field => {
        const normalized = field.toLowerCase();
        return aliases.has(normalized) && !normalizedSelectedFields.has(normalized);
    })) {
        return invalid("INVALID_GROUP_BY", "GROUP BY must use source fields, not SELECT aliases.");
    }
    const ungrouped = selectedFields.find(field => !normalizedGroups.has(field.toLowerCase()));
    if (ungrouped) {
        return invalid(
            "INVALID_GROUP_BY",
            `Selected field ${ungrouped} must appear in GROUP BY or be aggregated.`
        );
    }
    return null;
}

function searchIndex(value: string, pattern: RegExp): number {
    return pattern.exec(value)?.index ?? -1;
}

function maskStringLiterals(value: string):
    | { valid: true; value: string }
    | { valid: false; message: string } {
    let quoted = false;
    let masked = "";
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (character === "'") {
            masked += " ";
            if (quoted && value[index + 1] === "'") {
                masked += " ";
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else {
            masked += quoted ? " " : character;
        }
    }
    return quoted
        ? { valid: false, message: "SQL contains an unterminated string literal." }
        : { valid: true, value: masked };
}

function assertFieldReference(field: string): void {
    if (field !== "*" && !FIELD_REFERENCE_PATTERN.test(field)) {
        throw new Error(`Invalid field reference: ${field}`);
    }
}

function invalid(
    code: SqlContractErrorCode,
    message: string
): { valid: false; code: SqlContractErrorCode; message: string } {
    return { valid: false, code, message };
}
