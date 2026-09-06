import type { HavingCondition, QueryField, QueryFilter, QueryJoin, QuerySort } from "../../types/api";
import type { QueryDefinition } from "./queryModel";
import {
    mapSelectExpression,
    mapAggregateHavingCondition,
    mapJoinDefinition,
    mapStaticWhereCondition,
    supportedAggregateFunctions,
    validateSqlAuthoringText,
    type SqlContractErrorCode,
    type SqlLiteral,
    type SupportedAggregateFunction,
    type SupportedWhereOperator,
} from "./sqlContract";

export const initialSqlSubset = ["SELECT", "DISTINCT", "TOP", "FROM", "JOIN", "WHERE", "GROUP BY", "HAVING", "ORDER BY"] as const;

export interface ReportSqlParser {
    parse(sql: string): QueryDefinition;
}

export type ReportSqlParserErrorCode =
    | "INVALID_SQL_SYNTAX"
    | "UNSUPPORTED_SQL_FEATURE"
    | "INVALID_IDENTIFIER"
    | "INVALID_SELECT_EXPRESSION"
    | "INVALID_SELECT_MODIFIER"
    | "INVALID_FROM_CLAUSE"
    | "INVALID_JOIN"
    | "UNSUPPORTED_JOIN_TYPE"
    | "INVALID_WHERE_PREDICATE"
    | "INVALID_LITERAL"
    | "INVALID_GROUP_BY"
    | "INVALID_HAVING"
    | "INVALID_ORDER_BY";

export class ReportSqlParserError extends Error {
    readonly code: ReportSqlParserErrorCode;

    constructor(code: ReportSqlParserErrorCode, message: string) {
        super(message);
        this.name = "ReportSqlParserError";
        this.code = code;
    }
}

const IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";
const FIELD_REFERENCE = `${IDENTIFIER}(?:\\.${IDENTIFIER})?`;
const COLUMN_PATTERN = new RegExp(
    `^(${FIELD_REFERENCE})(?:\\s+AS\\s+(${IDENTIFIER}))?$`,
    "i"
);
const AGGREGATE_PATTERN = new RegExp(
    `^(${supportedAggregateFunctions.join("|")})\\s*\\(\\s*(\\*|${FIELD_REFERENCE})\\s*\\)(?:\\s+AS\\s+(${IDENTIFIER}))?$`,
    "i"
);
const WHERE_PATTERN = new RegExp(
    `^(${FIELD_REFERENCE})\\s*(NOT\\s+LIKE|LIKE|>=|<=|<>|!=|=|>|<)\\s*(.+)$`,
    "i"
);
const HAVING_PATTERN = new RegExp(
    `^(${supportedAggregateFunctions.join("|")})\\s*\\(\\s*(\\*|${FIELD_REFERENCE})\\s*\\)\\s*(>=|<=|<>|!=|=|>|<)\\s*(.+)$`,
    "i"
);
const QUERY_PATTERN = /^SELECT\s+([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+GROUP\s+BY\s+([\s\S]+?))?(?:\s+HAVING\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+([\s\S]+))?$/i;
const FIELD_REFERENCE_PATTERN = new RegExp(`^${FIELD_REFERENCE}$`);
const BASE_SOURCE_PATTERN = new RegExp(
    `^(${IDENTIFIER})(?:\\s+AS\\s+(${IDENTIFIER}))?`,
    "i"
);
const JOIN_PATTERN = new RegExp(
    `^(?:(INNER|LEFT|RIGHT)\\s+)?JOIN\\s+(${IDENTIFIER})(?:\\s+AS\\s+(${IDENTIFIER}))?\\s+ON\\s+(${FIELD_REFERENCE})\\s*=\\s*(${FIELD_REFERENCE})(?=\\s+(?:(?:(?:INNER|LEFT|RIGHT)\\s+)?JOIN)\\b|$)`,
    "i"
);
const SIMPLE_SCALAR_FUNCTIONS = new Set([
    "UPPER", "LOWER", "LTRIM", "RTRIM", "TRIM", "LEN",
    "YEAR", "MONTH", "DAY", "ISDATE",
    "ABS", "CEILING", "FLOOR", "SQRT", "EXP", "LOG",
]);
const ZERO_ARGUMENT_FUNCTIONS = new Set(["GETDATE", "SYSDATETIME"]);
const SQL_LITERAL_PATTERN = "(?:-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)|TRUE|FALSE|'(?:[^']|'')*')";

export function parseReportSql(sql: string): QueryDefinition {
    const contractResult = validateSqlAuthoringText(sql);
    if (!contractResult.valid) {
        throwContractError(sql, contractResult.code, contractResult.message);
    }

    const statement = stripTrailingSemicolon(sql.trim());
    const match = QUERY_PATTERN.exec(statement);
    if (!match) {
        throw new ReportSqlParserError(
            "INVALID_SQL_SYNTAX",
            "SQL does not match the supported SELECT/FROM/JOIN/WHERE/GROUP BY/HAVING/ORDER BY grammar."
        );
    }

    const [, selectText, fromText, whereText, groupByText, havingText, orderByText] = match;
    const { source, joins } = parseFromAndJoins(fromText);
    const select = parseSelectClause(selectText);
    const fields = select.items.map(parseSelectItem);
    const baseFilters = whereText === undefined
        ? []
        : splitWherePredicates(whereText).map(parseWherePredicate);
    const groupBy = groupByText === undefined
        ? []
        : groupByText.split(",").map(parseGroupByField);
    const having = havingText === undefined
        ? []
        : splitWherePredicates(havingText).map(parseHavingPredicate);
    const baseSort = orderByText === undefined
        ? []
        : splitSelectItems(orderByText).map(parseOrderByItem);

    return {
        source,
        fields,
        ...(baseFilters.length > 0 ? { baseFilters } : {}),
        ...(joins.length > 0 ? { joins } : {}),
        ...(groupBy.length > 0 ? { groupBy } : {}),
        ...(having.length > 0 ? { having } : {}),
        ...(baseSort.length > 0 ? { baseSort } : {}),
        ...(select.distinct ? { distinct: true } : {}),
        ...(select.limit !== undefined ? { limit: select.limit } : {}),
    };
}

function parseSelectClause(value: string): {
    items: string[];
    distinct: boolean;
    limit?: number;
} {
    let remaining = value.trim();
    let distinct = false;
    let limit: number | undefined;

    if (/^DISTINCT\b/i.test(remaining)) {
        distinct = true;
        remaining = remaining.replace(/^DISTINCT\b/i, "").trim();
    }
    if (/^TOP\b/i.test(remaining)) {
        const top = /^TOP\s+([^\s]+)(?:\s+|$)([\s\S]*)$/i.exec(remaining);
        if (!top || !/^\d+$/.test(top[1]) || Number(top[1]) < 1 || !top[2].trim()) {
            throw new ReportSqlParserError(
                "INVALID_SELECT_MODIFIER",
                "TOP requires a positive integer followed by selected fields."
            );
        }
        limit = Number(top[1]);
        remaining = top[2].trim();
    }
    if (/^(?:DISTINCT|TOP)\b/i.test(remaining)) {
        throw new ReportSqlParserError(
            "INVALID_SELECT_MODIFIER",
            "Use SELECT DISTINCT TOP <positive integer> before the selected fields."
        );
    }
    return { items: splitSelectItems(remaining), distinct, ...(limit ? { limit } : {}) };
}

function parseOrderByItem(value: string): QuerySort {
    const match = new RegExp(`^(${FIELD_REFERENCE})(?:\\s+(ASC|DESC))?$`, "i")
        .exec(value.trim());
    if (!match || /^\d+$/.test(match?.[1] ?? "")) {
        throw new ReportSqlParserError(
            "INVALID_ORDER_BY",
            `ORDER BY requires logical fields with optional ASC or DESC: ${value.trim()}`
        );
    }
    return { field: match[1], direction: (match[2]?.toUpperCase() ?? "ASC") as QuerySort["direction"] };
}

function parseFromAndJoins(fromText: string): {
    source: QueryDefinition["source"];
    joins: QueryJoin[];
} {
    const text = fromText.trim();
    const sourceMatch = BASE_SOURCE_PATTERN.exec(text);
    if (!sourceMatch) {
        throw new ReportSqlParserError("INVALID_FROM_CLAUSE", "FROM requires a valid table.");
    }

    const source = {
        table: sourceMatch[1],
        ...(sourceMatch[2] ? { alias: sourceMatch[2] } : {}),
    };
    const joins: QueryJoin[] = [];
    let remaining = text.slice(sourceMatch[0].length).trim();
    while (remaining) {
        const match = JOIN_PATTERN.exec(remaining);
        if (!match) {
            throw new ReportSqlParserError(
                /\b(?:FULL|CROSS|OUTER)\b/i.test(remaining)
                    ? "UNSUPPORTED_JOIN_TYPE"
                    : "INVALID_JOIN",
                "JOIN requires INNER, LEFT, RIGHT, or bare JOIN with one column equality after ON."
            );
        }
        joins.push(mapJoinDefinition({
            type: (match[1]?.toUpperCase() ?? "INNER") as QueryJoin["type"],
            source: {
                table: match[2],
                ...(match[3] ? { alias: match[3] } : {}),
            },
            on: { left: match[4], operator: "=", right: match[5] },
        }));
        remaining = remaining.slice(match[0].length).trim();
    }
    return { source, joins };
}

function parseHavingPredicate(value: string): HavingCondition {
    const predicate = value.trim();
    const match = HAVING_PATTERN.exec(predicate);
    if (!match) {
        throw new ReportSqlParserError(
            "INVALID_HAVING",
            `Invalid HAVING predicate: ${predicate || "<empty>"}`
        );
    }

    const functionName = match[1].toUpperCase() as HavingCondition["function"];
    return mapAggregateHavingCondition({
        function: functionName,
        field: match[2],
        operator: match[3] as HavingCondition["operator"],
        value: parseLiteral(match[4].trim()),
    });
}

function parseGroupByField(value: string): string {
    const field = value.trim();
    if (!FIELD_REFERENCE_PATTERN.test(field)) {
        throw new ReportSqlParserError(
            "INVALID_GROUP_BY",
            `Invalid GROUP BY field: ${field || "<empty>"}`
        );
    }
    return field;
}

function parseSelectItem(value: string): QueryField {
    const item = value.trim();
    if (item === "*") return mapSelectExpression({ kind: "all" });

    const aggregate = AGGREGATE_PATTERN.exec(item);
    if (aggregate) {
        const functionName = aggregate[1].toUpperCase() as SupportedAggregateFunction;
        return mapSelectExpression({
            kind: "aggregate",
            function: functionName,
            field: aggregate[2],
            ...(aggregate[3] ? { alias: aggregate[3] } : {}),
        });
    }

    const caseExpression = parseCaseExpression(item);
    if (caseExpression) return caseExpression;

    const { expression, alias } = splitExpressionAlias(item);
    const windowFunction = parseWindowFunction(expression, alias);
    if (windowFunction) return windowFunction;
    const arithmetic = new RegExp(
        `^(${FIELD_REFERENCE}|-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*([+\\-*/%])\\s*(${FIELD_REFERENCE}|-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))$`
    ).exec(expression);
    if (arithmetic) {
        if (!alias) {
            throw new ReportSqlParserError(
                "INVALID_SELECT_EXPRESSION",
                "Arithmetic SELECT expressions require an AS alias."
            );
        }
        return {
            expression: {
                left: parseExpressionOperand(arithmetic[1]),
                operator: arithmetic[2],
                right: parseExpressionOperand(arithmetic[3]),
            },
            alias,
        };
    }

    const currentTimestamp = /^CURRENT_TIMESTAMP$/i.test(expression);
    if (currentTimestamp) {
        return { function: "CURRENT_TIMESTAMP", ...(alias ? { alias } : {}) };
    }

    const functionCall = new RegExp(`^(${IDENTIFIER})\\s*\\(([\\s\\S]*)\\)$`, "i")
        .exec(expression);
    if (functionCall) return parseScalarFunction(functionCall[1], functionCall[2], alias);

    const column = COLUMN_PATTERN.exec(item);
    if (column) {
        return mapSelectExpression({
            kind: "column",
            field: column[1],
            ...(column[2] ? { alias: column[2] } : {}),
        });
    }

    throw new ReportSqlParserError(
        looksLikeSimpleReference(item) ? "INVALID_IDENTIFIER" : "INVALID_SELECT_EXPRESSION",
        `Invalid SELECT expression: ${item}`
    );
}

function splitExpressionAlias(item: string): { expression: string; alias?: string } {
    const match = new RegExp(`^([\\s\\S]+?)\\s+AS\\s+(${IDENTIFIER})$`, "i").exec(item);
    return match ? { expression: match[1].trim(), alias: match[2] } : { expression: item };
}

function parseScalarFunction(name: string, argumentText: string, alias?: string): QueryField {
    const functionName = name.toUpperCase();
    const args = argumentText.trim() ? splitSelectItems(argumentText) : [];

    if (SIMPLE_SCALAR_FUNCTIONS.has(functionName)) {
        requireFunctionArguments(functionName, args, 1);
        assertParserField(args[0], functionName);
        return { function: functionName, field: args[0], ...(alias ? { alias } : {}) };
    }
    if (ZERO_ARGUMENT_FUNCTIONS.has(functionName)) {
        requireFunctionArguments(functionName, args, 0);
        return { function: functionName, ...(alias ? { alias } : {}) };
    }
    if (functionName === "STRING_AGG") {
        requireFunctionArguments(functionName, args, 2);
        assertParserField(args[0], functionName);
        return {
            function: functionName,
            field: args[0],
            separator: parseLiteral(args[1]),
            ...(alias ? { alias } : {}),
        };
    }
    if (["ROUND", "POWER", "LEFT", "RIGHT"].includes(functionName)) {
        requireFunctionArguments(functionName, args, 2);
        assertParserField(args[0], functionName);
        const number = parseNumericLiteral(args[1], functionName);
        const option = functionName === "ROUND"
            ? { precision: number }
            : functionName === "POWER"
                ? { power: number }
                : { length: number };
        return { function: functionName, field: args[0], ...option, ...(alias ? { alias } : {}) };
    }
    if (functionName === "SUBSTRING") {
        requireFunctionArguments(functionName, args, 3);
        assertParserField(args[0], functionName);
        return {
            function: functionName,
            field: args[0],
            start: parseNumericLiteral(args[1], functionName),
            length: parseNumericLiteral(args[2], functionName),
            ...(alias ? { alias } : {}),
        };
    }
    if (functionName === "NULLIF") {
        requireFunctionArguments(functionName, args, 2);
        assertParserField(args[0], functionName);
        return {
            function: functionName,
            field: args[0],
            value: parseLiteral(args[1]),
            ...(alias ? { alias } : {}),
        };
    }
    if (functionName === "CONCAT") {
        if (args.length < 2 || args.some(arg => !FIELD_REFERENCE_PATTERN.test(arg))) {
            throw invalidFunction(functionName, "requires at least two field arguments");
        }
        return { function: functionName, fields: args, ...(alias ? { alias } : {}) };
    }
    if (functionName === "COALESCE") {
        if (args.length < 2 || args.slice(0, -1).some(arg => !FIELD_REFERENCE_PATTERN.test(arg))) {
            throw invalidFunction(functionName, "requires field arguments followed by one literal default");
        }
        return {
            function: functionName,
            fields: args.slice(0, -1),
            default: parseLiteral(args.at(-1)!),
            ...(alias ? { alias } : {}),
        };
    }

    throw new ReportSqlParserError(
        "UNSUPPORTED_SQL_FEATURE",
        `Unsupported SQL function: ${functionName}`
    );
}

function parseWindowFunction(expression: string, alias?: string): QueryField | null {
    if (!/\bOVER\s*\(/i.test(expression)) return null;
    if (/\bPARTITION\s+BY\b/i.test(expression)) {
        throw new ReportSqlParserError(
            "UNSUPPORTED_SQL_FEATURE",
            "Window PARTITION BY is not represented by the public Universal API."
        );
    }
    if (!alias) throw invalidFunction("Window function", "requires an AS alias");

    const match = /^(ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE)\s*\(([^)]*)\)\s+OVER\s*\(\s*ORDER\s+BY\s+([\s\S]+)\)$/i
        .exec(expression);
    if (!match) throw invalidFunction("Window function", "has unsupported syntax");

    const functionName = match[1].toUpperCase();
    const args = match[2].trim() ? splitSelectItems(match[2]) : [];
    const sort = splitSelectItems(match[3]).map(parseOrderByItem);
    if (["ROW_NUMBER", "RANK", "DENSE_RANK"].includes(functionName)) {
        requireFunctionArguments(functionName, args, 0);
        return { function: functionName, alias, sort };
    }
    if (functionName === "NTILE") {
        requireFunctionArguments(functionName, args, 1);
        const buckets = parseNumericLiteral(args[0], functionName);
        if (!Number.isInteger(buckets) || buckets < 1) throw invalidFunction(functionName, "requires positive integer buckets");
        return { function: functionName, buckets, alias, sort };
    }
    if (["FIRST_VALUE", "LAST_VALUE"].includes(functionName)) {
        requireFunctionArguments(functionName, args, 1);
        assertParserField(args[0], functionName);
        return { function: functionName, field: args[0], alias, sort };
    }
    if (args.length < 1 || args.length > 3) {
        throw invalidFunction(functionName, "requires a field and optional offset/default");
    }
    assertParserField(args[0], functionName);
    const offset = args[1] === undefined ? undefined : parseNumericLiteral(args[1], functionName);
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 1)) {
        throw invalidFunction(functionName, "offset must be a positive integer");
    }
    return {
        function: functionName,
        field: args[0],
        ...(offset !== undefined ? { offset } : {}),
        ...(args[2] !== undefined ? { default: parseLiteral(args[2]) } : {}),
        alias,
        sort,
    };
}

function parseCaseExpression(item: string): QueryField | null {
    const outer = new RegExp(`^CASE\\s+([\\s\\S]+)\\s+END\\s+AS\\s+(${IDENTIFIER})$`, "i")
        .exec(item);
    if (!outer) return null;

    let body = outer[1].trim();
    const when: Array<{ condition: QueryFilter; then: SqlLiteral }> = [];
    const clause = new RegExp(
        `^WHEN\\s+(${FIELD_REFERENCE})\\s*(>=|<=|<>|!=|=|>|<)\\s*(${SQL_LITERAL_PATTERN})\\s+THEN\\s+(${SQL_LITERAL_PATTERN})(?:\\s+|$)`,
        "i"
    );
    while (/^WHEN\b/i.test(body)) {
        const match = clause.exec(body);
        if (!match) throw invalidCase();
        when.push({
            condition: { field: match[1], operator: match[2], value: parseLiteral(match[3]) },
            then: parseLiteral(match[4]),
        });
        body = body.slice(match[0].length).trim();
    }
    const otherwise = new RegExp(`^ELSE\\s+(${SQL_LITERAL_PATTERN})$`, "i").exec(body);
    if (when.length === 0 || !otherwise) throw invalidCase();
    return {
        case: { when, else: parseLiteral(otherwise[1]) },
        alias: outer[2],
    };
}

function parseExpressionOperand(value: string): string | number {
    return FIELD_REFERENCE_PATTERN.test(value) ? value : Number(value);
}

function parseNumericLiteral(value: string, functionName: string): number {
    const parsed = parseExpressionOperand(value.trim());
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
        throw invalidFunction(functionName, "requires numeric option arguments");
    }
    return parsed;
}

function assertParserField(value: string, functionName: string): void {
    if (!FIELD_REFERENCE_PATTERN.test(value.trim())) {
        throw invalidFunction(functionName, "requires a logical field argument");
    }
}

function requireFunctionArguments(name: string, args: string[], count: number): void {
    if (args.length !== count) throw invalidFunction(name, `requires exactly ${count} argument(s)`);
}

function invalidFunction(name: string, detail: string): ReportSqlParserError {
    return new ReportSqlParserError("INVALID_SELECT_EXPRESSION", `${name} ${detail}.`);
}

function invalidCase(): ReportSqlParserError {
    return new ReportSqlParserError(
        "INVALID_SELECT_EXPRESSION",
        "CASE requires one or more simple WHEN comparisons, ELSE, END, and an AS alias."
    );
}

function parseWherePredicate(value: string): QueryFilter {
    const predicate = value.trim();
    const nullMatch = new RegExp(`^(${FIELD_REFERENCE})\\s+(IS\\s+(?:NOT\\s+)?NULL)$`, "i")
        .exec(predicate);
    if (nullMatch) {
        return { field: nullMatch[1], operator: normalizeSpaces(nullMatch[2]) };
    }

    const betweenMatch = new RegExp(
        `^(${FIELD_REFERENCE})\\s+(NOT\\s+BETWEEN|BETWEEN)\\s+(.+?)\\s+AND\\s+(.+)$`,
        "i"
    ).exec(predicate);
    if (betweenMatch) {
        return {
            field: betweenMatch[1],
            operator: normalizeSpaces(betweenMatch[2]),
            value: [parseLiteral(betweenMatch[3].trim()), parseLiteral(betweenMatch[4].trim())],
        };
    }

    const inMatch = new RegExp(
        `^(${FIELD_REFERENCE})\\s+(NOT\\s+IN|IN)\\s*\\(([\\s\\S]*)\\)$`,
        "i"
    ).exec(predicate);
    if (inMatch) {
        const values = splitSelectItems(inMatch[3]);
        if (values.length === 0 || values.some(item => !item)) {
            throw new ReportSqlParserError("INVALID_WHERE_PREDICATE", "IN requires a non-empty literal list.");
        }
        return {
            field: inMatch[1],
            operator: normalizeSpaces(inMatch[2]),
            value: values.map(parseLiteral),
        };
    }

    const match = WHERE_PATTERN.exec(predicate);
    if (!match) {
        throw new ReportSqlParserError(
            "INVALID_WHERE_PREDICATE",
            `Invalid WHERE predicate: ${predicate}`
        );
    }

    const [, field, operator, literalText] = match;
    return mapStaticWhereCondition({
        field,
        operator: normalizeSpaces(operator) as SupportedWhereOperator,
        value: parseLiteral(literalText.trim()),
    });
}

function normalizeSpaces(value: string): string {
    return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function parseLiteral(value: string): SqlLiteral {
    if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
        const number = Number(value);
        if (Number.isFinite(number)) return number;
    }
    if (/^TRUE$/i.test(value)) return true;
    if (/^FALSE$/i.test(value)) return false;
    if (/^'(?:[^']|'')*'$/.test(value)) {
        return value.slice(1, -1).replace(/''/g, "'");
    }

    throw new ReportSqlParserError(
        "INVALID_LITERAL",
        `Invalid SQL literal: ${value}`
    );
}

function splitSelectItems(value: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let quoted = false;
    let start = 0;
    for (let index = 0; index < value.length; index += 1) {
        if (value[index] === "'") {
            if (quoted && value[index + 1] === "'") index += 1;
            else quoted = !quoted;
        } else if (!quoted && value[index] === "(") depth += 1;
        else if (!quoted && value[index] === ")") depth -= 1;
        else if (!quoted && value[index] === "," && depth === 0) {
            result.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    result.push(value.slice(start).trim());
    return result;
}

function splitWherePredicates(value: string): string[] {
    const masked = maskStringLiterals(value);
    const result: string[] = [];
    let start = 0;
    let betweenNeedsAnd = false;
    for (const match of masked.matchAll(/\bAND\b/gi)) {
        const before = masked.slice(start, match.index);
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

function maskStringLiterals(value: string): string {
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
    return masked;
}

function stripTrailingSemicolon(sql: string): string {
    return sql.endsWith(";") ? sql.slice(0, -1).trim() : sql;
}

function throwContractError(
    sql: string,
    code: SqlContractErrorCode,
    message: string
): never {
    if (code === "UNSUPPORTED_FEATURE" || code === "MULTIPLE_STATEMENTS") {
        throw new ReportSqlParserError("UNSUPPORTED_SQL_FEATURE", message);
    }
    if (code === "UNSUPPORTED_STATEMENT") {
        const unsupportedStatement = /^\s*(?:INSERT|UPDATE|DELETE|EXEC(?:UTE)?|MERGE|CREATE|ALTER|DROP)\b/i.test(sql);
        throw new ReportSqlParserError(
            unsupportedStatement ? "UNSUPPORTED_SQL_FEATURE" : "INVALID_SQL_SYNTAX",
            message
        );
    }
    if (code === "EMPTY_SQL") {
        throw new ReportSqlParserError("INVALID_SQL_SYNTAX", message);
    }
    if (code === "INVALID_FROM" || isMissingFromClause(sql)) {
        throw new ReportSqlParserError("INVALID_FROM_CLAUSE", message);
    }
    if (code === "INVALID_JOIN" || code === "UNSUPPORTED_JOIN_TYPE") {
        throw new ReportSqlParserError(code, message);
    }
    if (code === "INVALID_SELECT_MODIFIER" || code === "INVALID_ORDER_BY") {
        throw new ReportSqlParserError(code, message);
    }
    if (code === "INVALID_WHERE") {
        if (hasUnsupportedWhereOperator(sql)) {
            throw new ReportSqlParserError(
                "UNSUPPORTED_SQL_FEATURE",
                "WHERE predicates may be joined only with AND and supported comparison operators."
            );
        }
        if (hasInvalidLiteral(sql)) {
            throw new ReportSqlParserError("INVALID_LITERAL", message);
        }
        if (hasInvalidWhereIdentifier(sql)) {
            throw new ReportSqlParserError("INVALID_IDENTIFIER", message);
        }
        throw new ReportSqlParserError("INVALID_WHERE_PREDICATE", message);
    }
    if (code === "INVALID_GROUP_BY") {
        throw new ReportSqlParserError("INVALID_GROUP_BY", message);
    }
    if (code === "INVALID_HAVING") {
        throw new ReportSqlParserError("INVALID_HAVING", message);
    }
    if (code === "INVALID_SELECT") {
        throw new ReportSqlParserError(
            looksLikeInvalidSelectIdentifier(sql) || looksLikeMalformedSelectAlias(sql)
                ? "INVALID_IDENTIFIER"
                : "INVALID_SELECT_EXPRESSION",
            message
        );
    }
    throw new ReportSqlParserError("INVALID_SQL_SYNTAX", message);
}

function isMissingFromClause(sql: string): boolean {
    const masked = maskStringLiterals(sql);
    return /^\s*SELECT\b/i.test(masked) && !/\bFROM\b/i.test(masked)
        || /\bFROM\s*(?:;)?\s*$/i.test(masked);
}

function hasUnsupportedWhereOperator(sql: string): boolean {
    const masked = maskStringLiterals(sql);
    return /\bWHERE\b[\s\S]*\bOR\b/i.test(masked);
}

function hasInvalidLiteral(sql: string): boolean {
    const where = /\bWHERE\b([\s\S]*)$/i.exec(sql)?.[1];
    if (!where) return false;
    return splitWherePredicates(where).some(predicate => {
        const match = WHERE_PATTERN.exec(predicate.trim());
        if (!match) return false;
        try {
            parseLiteral(match[3].trim());
            return false;
        } catch {
            return true;
        }
    });
}

function hasInvalidWhereIdentifier(sql: string): boolean {
    const where = /\bWHERE\b([\s\S]*)$/i.exec(sql)?.[1];
    if (!where) return false;
    return splitWherePredicates(where).some(predicate => {
        const match = /^(.+?)\s*(>=|<=|<>|!=|=|>|<)\s*(.+)$/.exec(predicate.trim());
        return match !== null && !new RegExp(`^${FIELD_REFERENCE}$`).test(match[1].trim());
    });
}

function looksLikeInvalidSelectIdentifier(sql: string): boolean {
    const select = /^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i.exec(sql)?.[1];
    return select !== undefined
        && splitSelectItems(select).some(looksLikeSimpleReference);
}

function looksLikeMalformedSelectAlias(sql: string): boolean {
    const select = /^\s*SELECT\s+([\s\S]+?)\s+FROM\b/i.exec(sql)?.[1];
    return select !== undefined
        && splitSelectItems(select).some(item => /\s+AS\s+/i.test(item)
            && !new RegExp(`\\s+AS\\s+${IDENTIFIER}$`, "i").test(item.trim()));
}

function looksLikeSimpleReference(value: string): boolean {
    return !/[()+*/]/.test(value) && !/\s+(?!AS\b)/i.test(value);
}
