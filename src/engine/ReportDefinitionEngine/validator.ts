import type { FilterType } from "../../types/filter";
import { allowedOperators } from "../FilterEngine/validator";

const REPORT_KEYS = ["id", "title", "description", "queryDefinition", "request", "columns", "filters", "grid", "toolbar", "export"];
const REQUEST_KEYS = ["action", "source", "fields", "filters", "joins", "groupBy", "having", "sort", "pagination", "distinct", "limit", "filterLogic", "with"];
const REQUEST_FIELD_KEYS = ["field", "fields", "function", "alias", "sort", "case", "expression", "buckets", "offset", "default", "separator", "datatype", "style", "value", "values", "index", "datepart", "number", "start", "end", "year", "month", "day", "hour", "minute", "second", "millisecond", "precision", "power", "part", "length", "search", "replace", "pattern", "format", "condition", "true", "false"];
const COLUMN_KEYS = ["field", "header", "visible", "sortable", "width"];
const FILTER_KEYS = ["field", "label", "type", "operator", "options", "visible", "required", "placeholder"];
const FILTER_TYPES: FilterType[] = ["text", "number", "select", "multiselect", "boolean", "date", "daterange"];
const QUERY_OPERATORS = ["=", "!=", "<>", ">", "<", ">=", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN", "BETWEEN", "NOT BETWEEN", "IS NULL", "IS NOT NULL", "EXISTS", "NOT EXISTS"];
const QUERY_FUNCTIONS = [
    "COUNT", "SUM", "AVG", "MIN", "MAX", "STRING_AGG", "UPPER", "LOWER", "LTRIM", "RTRIM", "TRIM", "LEN",
    "COALESCE", "ISNULL", "NULLIF", "CAST", "CONVERT", "CONCAT", "LEFT", "RIGHT", "SUBSTRING", "REPLACE",
    "CHARINDEX", "PATINDEX", "FORMAT", "YEAR", "MONTH", "DAY", "DATEPART", "DATENAME", "GETDATE", "SYSDATETIME",
    "CURRENT_TIMESTAMP", "DATEADD", "DATEDIFF", "EOMONTH", "ISDATE", "DATEFROMPARTS", "DATETIMEFROMPARTS", "IIF",
    "CHOOSE", "ABS", "CEILING", "FLOOR", "SQRT", "EXP", "LOG", "ROUND", "POWER", "ROW_NUMBER", "RANK",
    "DENSE_RANK", "NTILE", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE",
];
const HAVING_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX", "STRING_AGG"];
const COMPARISON_OPERATORS = ["=", "!=", "<>", ">", "<", ">=", "<="];
const DATE_PARTS = ["YEAR", "QUARTER", "MONTH", "DAYOFYEAR", "DAY", "WEEK", "WEEKDAY", "HOUR", "MINUTE", "SECOND", "MILLISECOND"];

export function validateReport(report: unknown): boolean {
    return getReportValidationErrors(report).length === 0;
}

export interface ReportValidationOptions {
    columnsRequired?: boolean;
}

export function getReportValidationErrors(
    report: unknown,
    { columnsRequired = true }: ReportValidationOptions = {}
): string[] {
    const errors: string[] = [];
    if (!isRecord(report)) return ["Report configuration must be an object."];
    rejectUnknown(report, REPORT_KEYS, "Report", errors);
    requireString(report.id, "Report id", errors);
    requireString(report.title, "Report title", errors);
    optionalString(report.description, "Report description", errors);
    const hasQueryDefinition = report.queryDefinition !== undefined;
    const hasRequest = report.request !== undefined;
    if (hasQueryDefinition === hasRequest) {
        errors.push("Report must contain exactly one of request or queryDefinition.");
    }
    validateQueryDefinitionReference(report.queryDefinition, errors);
    if (hasRequest) validateRequest(report.request, errors);
    validateColumns(report.columns, errors, columnsRequired);
    validateFilters(report.filters, errors, hasQueryDefinition);
    validateGrid(report.grid, errors);
    validateToolbar(report.toolbar, errors);
    validateExport(report.export, "Report export", errors);
    return errors;
}

function validateQueryDefinitionReference(value: unknown, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push("Report queryDefinition must be an object.");
    rejectUnknown(value, ["format", "resource"], "Report queryDefinition", errors);
    if (value.format !== "sql") errors.push("Report queryDefinition format must be sql.");
    requireString(value.resource, "Report queryDefinition resource", errors);
    if (
        typeof value.resource === "string"
        && value.resource.trim().length > 0
        && !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.resource)
    ) {
        errors.push("Report queryDefinition resource must be a safe backend resource identifier.");
    }
}

function validateRequest(value: unknown, errors: string[]) {
    if (!isRecord(value)) return errors.push("Report request must be an object.");
    rejectUnknown(value, REQUEST_KEYS, "Report request", errors);
    if (value.action !== "select") errors.push("Report request action must be select.");
    if (!isRecord(value.source)) errors.push("Report request source must be an object.");
    else {
        rejectUnknown(value.source, ["table", "alias"], "Report request source", errors);
        requireIdentifier(value.source.table, "Report request source table", errors);
        optionalIdentifier(value.source.alias, "Report request source alias", errors);
    }
    validateRequestFields(value.fields, "Report request fields", errors);
    if (value.filters !== undefined) validateRequestFilters(value.filters, "Report request filters", errors);
    if (value.sort !== undefined) validateSort(value.sort, "Report request sort", errors);
    if (value.groupBy !== undefined
        && (!Array.isArray(value.groupBy) || value.groupBy.some(field => !isIdentifier(field)))) {
        errors.push("Report request groupBy must contain field names.");
    }
    if (value.joins !== undefined) validateJoins(value.joins, errors);
    if (value.having !== undefined) validateHaving(value.having, errors);
    if (value.with !== undefined) validateWith(value.with, errors);
    if (value.pagination !== undefined) {
        if (!isRecord(value.pagination)) errors.push("Report request pagination must be an object.");
        else {
            rejectUnknown(value.pagination, ["page", "pageSize"], "Report request pagination", errors);
            positiveInteger(value.pagination.page, "Report request pagination page", errors);
            positiveInteger(value.pagination.pageSize, "Report request pagination pageSize", errors);
        }
    }
    optionalBoolean(value.distinct, "Report request distinct", errors);
    positiveInteger(value.limit, "Report request limit", errors);
    if (value.filterLogic !== undefined && value.filterLogic !== "AND" && value.filterLogic !== "OR") {
        errors.push("Report request filterLogic must be AND or OR.");
    }
}

function validateColumns(value: unknown, errors: string[], required: boolean) {
    if (value === undefined && !required) return;
    if (!Array.isArray(value) || value.length === 0) return errors.push("Report columns must be a non-empty array.");
    const fields = new Set<string>();
    value.forEach((entry, index) => {
        const label = `Report column at index ${index}`;
        if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
        rejectUnknown(entry, COLUMN_KEYS, label, errors);
        requireString(entry.field, `${label} field`, errors);
        requireString(entry.header, `${label} header`, errors);
        if (typeof entry.field === "string" && fields.has(entry.field)) errors.push(`Duplicate report column field: ${entry.field}.`);
        if (typeof entry.field === "string") fields.add(entry.field);
        optionalBoolean(entry.visible, `${label} visible`, errors);
        optionalBoolean(entry.sortable, `${label} sortable`, errors);
        positiveInteger(entry.width, `${label} width`, errors);
    });
}

function validateFilters(value: unknown, errors: string[], sqlResource: boolean) {
    if (!Array.isArray(value)) return errors.push("Report filters must be an array.");
    const fields = new Set<string>();
    value.forEach((entry, index) => {
        const label = `Report filter at index ${index}`;
        if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
        rejectUnknown(entry, FILTER_KEYS, label, errors);
        if (sqlResource) requireSqlIdentifier(entry.field, `${label} field`, errors);
        else requireIdentifier(entry.field, `${label} field`, errors);
        requireString(entry.label, `${label} label`, errors);
        if (typeof entry.field === "string" && fields.has(entry.field)) errors.push(`Duplicate report filter field: ${entry.field}.`);
        if (typeof entry.field === "string") fields.add(entry.field);
        if (typeof entry.type !== "string" || !FILTER_TYPES.includes(entry.type as FilterType)) {
            errors.push(`${label} type is invalid.`);
        } else if (entry.operator !== undefined && !allowedOperators[entry.type as FilterType].includes(entry.operator as never)) {
            errors.push(`${label} operator is invalid for type ${entry.type}.`);
        }
        optionalBoolean(entry.visible, `${label} visible`, errors);
        optionalBoolean(entry.required, `${label} required`, errors);
        optionalString(entry.placeholder, `${label} placeholder`, errors);
        if (entry.placeholder !== undefined && entry.type !== "text" && entry.type !== "number") errors.push(`${label} placeholder is not supported for type ${String(entry.type)}.`);
        if (entry.options !== undefined && entry.type !== "select" && entry.type !== "multiselect") errors.push(`${label} options are not supported for type ${String(entry.type)}.`);
        validateOptions(entry.options, entry.type, entry.operator, label, errors);
    });
}

function validateOptions(value: unknown, type: unknown, operator: unknown, label: string, errors: string[]) {
    const required = (type === "multiselect" || type === "select") && operator !== "isNull" && operator !== "isNotNull";
    if (value === undefined) {
        if (required) errors.push(`${label} options are required.`);
        return;
    }
    if (!Array.isArray(value) || (required && value.length === 0)) return errors.push(`${label} options must be a non-empty array.`);
    const values = new Set<string>();
    value.forEach((option, index) => {
        if (!isRecord(option)) return errors.push(`${label} option at index ${index} must be an object.`);
        rejectUnknown(option, ["label", "value"], `${label} option at index ${index}`, errors);
        requireString(option.label, `${label} option at index ${index} label`, errors);
        if (typeof option.value !== "string" && typeof option.value !== "number") errors.push(`${label} option at index ${index} value must be a string or number.`);
        const key = `${typeof option.value}:${String(option.value)}`;
        if (values.has(key)) errors.push(`${label} has duplicate option value ${String(option.value)}.`);
        values.add(key);
    });
}

function validateGrid(value: unknown, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push("Report grid must be an object.");
    rejectUnknown(value, ["pagination", "rowSelection", "grouping"], "Report grid", errors);
    if (value.pagination !== undefined) {
        if (!isRecord(value.pagination)) errors.push("Report grid pagination must be an object.");
        else {
            rejectUnknown(value.pagination, ["enabled", "pageSize", "pageSizeOptions"], "Report grid pagination", errors);
            optionalBoolean(value.pagination.enabled, "Report grid pagination enabled", errors);
            positiveInteger(value.pagination.pageSize, "Report grid pagination pageSize", errors);
            positiveIntegerArray(value.pagination.pageSizeOptions, "Report grid pagination pageSizeOptions", errors);
        }
    }
    if (value.rowSelection !== undefined && value.rowSelection !== "single" && value.rowSelection !== "multiple") errors.push("Report grid rowSelection must be single or multiple.");
    if (value.grouping !== undefined) validateGrouping(value.grouping, errors);
}

function validateGrouping(value: unknown, errors: string[]) {
    if (!isRecord(value)) return errors.push("Report grid grouping must be an object.");
    rejectUnknown(value, ["enabled", "groups", "aggregates"], "Report grid grouping", errors);
    if (typeof value.enabled !== "boolean") errors.push("Report grid grouping enabled must be a boolean.");
    if (value.groups !== undefined) validateNamedFields(value.groups, "Report grid grouping groups", errors);
    if (value.aggregates !== undefined) {
        if (!Array.isArray(value.aggregates)) errors.push("Report grid grouping aggregates must be an array.");
        else value.aggregates.forEach((entry, index) => {
            const label = `Report grid grouping aggregate at index ${index}`;
            if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
            rejectUnknown(entry, ["field", "function", "alias", "header"], label, errors);
            requireString(entry.field, `${label} field`, errors);
            if (!["COUNT", "SUM", "AVG", "MIN", "MAX"].includes(String(entry.function))) errors.push(`${label} function is invalid.`);
            optionalString(entry.alias, `${label} alias`, errors);
            optionalString(entry.header, `${label} header`, errors);
        });
    }
}

function validateToolbar(value: unknown, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push("Report toolbar must be an object.");
    const keys = ["export", "refresh", "saveReport"];
    rejectUnknown(value, keys, "Report toolbar", errors);
    keys.forEach(key => optionalBoolean(value[key], `Report toolbar ${key}`, errors));
}

function validateExport(value: unknown, label: string, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push(`${label} must be an object.`);
    rejectUnknown(value, ["enabled", "formats", "filename", "exportAll", "exportCurrentView"], label, errors);
    if (typeof value.enabled !== "boolean") errors.push(`${label} enabled must be a boolean.`);
    if (!Array.isArray(value.formats) || value.formats.length === 0 || value.formats.some(item => item !== "csv" && item !== "excel")) errors.push(`${label} formats must be a non-empty array containing csv or excel.`);
    optionalString(value.filename, `${label} filename`, errors);
    optionalBoolean(value.exportAll, `${label} exportAll`, errors);
    optionalBoolean(value.exportCurrentView, `${label} exportCurrentView`, errors);
}

function validateRequestFields(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value) || value.length === 0) return errors.push(`${label} must be a non-empty array.`);
    value.forEach((entry, index) => {
        if (typeof entry === "string" && (entry === "*" || isIdentifier(entry))) return;
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} is invalid.`);
        rejectUnknown(entry, REQUEST_FIELD_KEYS, `${label} entry at index ${index}`, errors);
        if (entry.function === undefined && entry.field === undefined && entry.case === undefined && entry.expression === undefined) {
            errors.push(`${label} entry at index ${index} requires field, function, case, or expression.`);
        }
        if (entry.function !== undefined && (typeof entry.function !== "string" || !QUERY_FUNCTIONS.includes(entry.function.toUpperCase()))) {
            errors.push(`${label} entry at index ${index} function is unsupported.`);
        }
        if (entry.field !== undefined && entry.field !== "*") requireIdentifier(entry.field, `${label} entry at index ${index} field`, errors);
        optionalIdentifier(entry.alias, `${label} entry at index ${index} alias`, errors);
        if (entry.fields !== undefined && (!Array.isArray(entry.fields) || entry.fields.some(field => !isIdentifier(field)))) {
            errors.push(`${label} entry at index ${index} fields must contain identifiers.`);
        }
        if (entry.sort !== undefined) validateSort(entry.sort, `${label} entry at index ${index} sort`, errors);
        if (entry.expression !== undefined) validateExpression(entry.expression, `${label} entry at index ${index} expression`, errors);
        if (entry.case !== undefined) validateCase(entry.case, `${label} entry at index ${index} case`, errors);
        const functionName = typeof entry.function === "string" ? entry.function.toUpperCase() : "";
        if (["ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE"].includes(functionName)
            && entry.sort === undefined) {
            errors.push(`${label} entry at index ${index} window function requires sort.`);
        }
        if (entry.field === "*" && functionName !== "COUNT") errors.push(`${label} entry at index ${index} only COUNT accepts *.`);
        if (entry.datatype !== undefined && (typeof entry.datatype !== "string" || !/^[A-Za-z]+(?:\([0-9]+(?:,[0-9]+)?\))?$/.test(entry.datatype))) {
            errors.push(`${label} entry at index ${index} datatype is invalid.`);
        }
        if (functionName) validateFunctionOptions(entry, functionName, `${label} entry at index ${index}`, errors);
    });
}

function validateFunctionOptions(entry: Record<string, unknown>, name: string, label: string, errors: string[]) {
    const fieldFunctions = [
        "COUNT", "SUM", "AVG", "MIN", "MAX", "STRING_AGG", "UPPER", "LOWER", "LTRIM", "RTRIM", "TRIM", "LEN",
        "ISNULL", "NULLIF", "CAST", "CONVERT", "LEFT", "RIGHT", "SUBSTRING", "REPLACE", "CHARINDEX", "PATINDEX",
        "FORMAT", "YEAR", "MONTH", "DAY", "DATEPART", "DATENAME", "DATEADD", "ISDATE", "ABS", "CEILING", "FLOOR",
        "SQRT", "EXP", "LOG", "ROUND", "POWER", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE",
    ];
    if (fieldFunctions.includes(name) && entry.field === undefined) errors.push(`${label} ${name} requires field.`);
    if (name === "STRING_AGG" && typeof entry.separator !== "string") errors.push(`${label} STRING_AGG requires separator.`);
    if (name === "COALESCE" && (!Array.isArray(entry.fields) || entry.fields.length === 0)) errors.push(`${label} COALESCE requires fields.`);
    if (name === "CONCAT" && (!Array.isArray(entry.fields) || entry.fields.length < 2)) errors.push(`${label} CONCAT requires at least two fields.`);
    if (["CAST", "CONVERT"].includes(name) && entry.datatype === undefined) errors.push(`${label} ${name} requires datatype.`);
    if (name === "ISNULL" && !("default" in entry)) errors.push(`${label} ISNULL requires default.`);
    if (name === "ISNULL" && "default" in entry && !isSafeFunctionExpression(entry.default)) errors.push(`${label} ISNULL default must be a safe expression.`);
    if (name === "NULLIF" && !("value" in entry)) errors.push(`${label} NULLIF requires value.`);
    if (name === "NULLIF" && "value" in entry && !isSafeFunctionExpression(entry.value)) errors.push(`${label} NULLIF value must be a safe expression.`);
    if (name === "COALESCE" && entry.default !== undefined && !isSafeFunctionExpression(entry.default)) errors.push(`${label} COALESCE default must be a safe expression.`);
    if (["LEFT", "RIGHT"].includes(name) && !isPositiveInteger(entry.length)) errors.push(`${label} ${name} requires a positive length.`);
    if (name === "SUBSTRING" && (!isPositiveInteger(entry.start) || !isNonNegativeInteger(entry.length))) errors.push(`${label} SUBSTRING requires positive start and non-negative length.`);
    if (name === "REPLACE" && (typeof entry.search !== "string" || typeof entry.replace !== "string")) errors.push(`${label} REPLACE requires search and replace strings.`);
    if (name === "CHARINDEX" && typeof entry.search !== "string") errors.push(`${label} CHARINDEX requires search.`);
    if (name === "PATINDEX" && typeof entry.pattern !== "string") errors.push(`${label} PATINDEX requires pattern.`);
    if (name === "FORMAT" && typeof entry.format !== "string") errors.push(`${label} FORMAT requires format.`);
    if (["DATEPART", "DATENAME"].includes(name) && !isSupportedDatePart(entry.part)) errors.push(`${label} ${name} requires a supported part.`);
    if (name === "DATEADD" && (!isDateAddPart(entry.datepart) || !Number.isInteger(entry.number))) errors.push(`${label} DATEADD requires a supported datepart and integer number.`);
    if (name === "DATEDIFF" && (!isSupportedDatePart(entry.datepart) || !isDateEndpoint(entry.start) || !isDateEndpoint(entry.end))) errors.push(`${label} DATEDIFF requires a supported datepart and valid start/end endpoints.`);
    if (name === "EOMONTH" && !isDateEndpoint(entry.start)) errors.push(`${label} EOMONTH requires a valid start endpoint.`);
    if (name === "EOMONTH" && entry.month !== undefined && !Number.isInteger(entry.month)) errors.push(`${label} EOMONTH month must be an integer.`);
    const parts = name === "DATEFROMPARTS" ? ["year", "month", "day"] : name === "DATETIMEFROMPARTS" ? ["year", "month", "day", "hour", "minute", "second", "millisecond"] : [];
    if (parts.some(part => !(part in entry) || !isSafeNumericFunctionExpression(entry[part]))) errors.push(`${label} ${name} requires safe numeric date parts.`);
    if (name === "IIF" && !isIif(entry)) errors.push(`${label} IIF requires a valid condition and safe true/false expressions.`);
    if (name === "CHOOSE" && (!isPositiveInteger(entry.index) || !Array.isArray(entry.values) || entry.values.length < 2 || entry.values.some(value => !isSafeFunctionExpression(value)))) errors.push(`${label} CHOOSE requires positive index and at least two safe values.`);
    if (name === "NTILE" && !isPositiveInteger(entry.buckets)) errors.push(`${label} NTILE requires positive buckets.`);
    if (["LAG", "LEAD"].includes(name) && entry.offset !== undefined && !isPositiveInteger(entry.offset)) errors.push(`${label} ${name} offset must be positive.`);
    if (["LAG", "LEAD"].includes(name) && entry.default !== undefined && !isSafeFunctionExpression(entry.default)) errors.push(`${label} ${name} default must be a safe expression.`);
    if (name === "ROUND" && entry.precision !== undefined && !Number.isInteger(entry.precision)) errors.push(`${label} ROUND precision must be an integer.`);
    if (name === "POWER" && typeof entry.power !== "number") errors.push(`${label} POWER requires numeric power.`);
    if (entry.style !== undefined && !Number.isInteger(entry.style)) errors.push(`${label} style must be an integer.`);
}

function validateRequestFilters(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value)) return errors.push(`${label} must be an array.`);
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} must be an object.`);
        rejectUnknown(entry, ["field", "operator", "value", "query"], `${label} entry at index ${index}`, errors);
        const operator = typeof entry.operator === "string" ? entry.operator.toUpperCase() : "";
        if (!QUERY_OPERATORS.includes(operator)) errors.push(`${label} entry at index ${index} operator is unsupported.`);
        const exists = operator === "EXISTS" || operator === "NOT EXISTS";
        const nullCheck = operator === "IS NULL" || operator === "IS NOT NULL";
        const list = operator === "IN" || operator === "NOT IN";
        const range = operator === "BETWEEN" || operator === "NOT BETWEEN";
        if (!exists) requireIdentifier(entry.field, `${label} entry at index ${index} field`, errors);
        if (exists) {
            if (entry.query === undefined) errors.push(`${label} entry at index ${index} requires query.`);
            if (entry.field !== undefined || entry.value !== undefined) errors.push(`${label} entry at index ${index} EXISTS must omit field and value.`);
        } else if (nullCheck) {
            if (entry.value !== undefined || entry.query !== undefined) errors.push(`${label} entry at index ${index} null check must omit value and query.`);
        } else if (list && entry.query !== undefined) {
            if (entry.value !== undefined) errors.push(`${label} entry at index ${index} cannot contain both value and query.`);
        } else if (list && (!Array.isArray(entry.value) || entry.value.length === 0)) {
            errors.push(`${label} entry at index ${index} IN requires a non-empty value array or query.`);
        } else if (range && (!Array.isArray(entry.value) || entry.value.length !== 2)) {
            errors.push(`${label} entry at index ${index} BETWEEN requires exactly two values.`);
        } else if (!Object.prototype.hasOwnProperty.call(entry, "value")) {
            errors.push(`${label} entry at index ${index} requires value.`);
        }
        if (entry.query !== undefined) validateNestedSelect(entry.query, `${label} entry at index ${index} query`, errors, list);
    });
}

function validateSort(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value)) return errors.push(`${label} must be an array.`);
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} must be an object.`);
        rejectUnknown(entry, ["field", "direction"], `${label} entry at index ${index}`, errors);
        requireIdentifier(entry.field, `${label} entry at index ${index} field`, errors);
        if (entry.direction !== "ASC" && entry.direction !== "DESC") errors.push(`${label} entry at index ${index} direction must be ASC or DESC.`);
    });
}

function validateJoins(value: unknown, errors: string[]) {
    if (!Array.isArray(value)) return errors.push("Report request joins must be an array.");
    value.forEach((entry, index) => {
        const label = `Report request join at index ${index}`;
        if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
        rejectUnknown(entry, ["type", "source", "on"], label, errors);
        if (typeof entry.type !== "string" || !["INNER", "LEFT", "RIGHT"].includes(entry.type.toUpperCase())) errors.push(`${label} type must be INNER, LEFT, or RIGHT.`);
        if (!isRecord(entry.source)) errors.push(`${label} source must be an object.`);
        else {
            rejectUnknown(entry.source, ["table", "alias"], `${label} source`, errors);
            requireIdentifier(entry.source.table, `${label} source table`, errors);
            optionalIdentifier(entry.source.alias, `${label} source alias`, errors);
        }
        if (!isRecord(entry.on)) errors.push(`${label} on must be an object.`);
        else {
            rejectUnknown(entry.on, ["left", "operator", "right"], `${label} on`, errors);
            requireIdentifier(entry.on.left, `${label} on left`, errors);
            requireIdentifier(entry.on.right, `${label} on right`, errors);
            if (entry.on.operator !== undefined && entry.on.operator !== "=") errors.push(`${label} on operator must be =.`);
        }
    });
}

function validateHaving(value: unknown, errors: string[]) {
    if (!Array.isArray(value)) return errors.push("Report request having must be an array.");
    value.forEach((entry, index) => {
        const label = `Report request having at index ${index}`;
        if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
        rejectUnknown(entry, ["function", "field", "operator", "value"], label, errors);
        if (typeof entry.function !== "string" || !HAVING_FUNCTIONS.includes(entry.function.toUpperCase())) errors.push(`${label} function is unsupported.`);
        if (entry.field !== "*") requireIdentifier(entry.field, `${label} field`, errors);
        if (typeof entry.operator !== "string" || !COMPARISON_OPERATORS.includes(entry.operator.toUpperCase())) errors.push(`${label} operator is unsupported.`);
        if (!Object.prototype.hasOwnProperty.call(entry, "value")) errors.push(`${label} requires value.`);
    });
}

function validateWith(value: unknown, errors: string[]) {
    if (!isRecord(value)) return errors.push("Report request with must be an object.");
    requireIdentifier(value.name, "Report request with name", errors);
    const recursive = value.anchor !== undefined || value.recursive !== undefined;
    rejectUnknown(value, recursive ? ["name", "anchor", "recursive"] : ["name", "query"], "Report request with", errors);
    const branches = recursive ? [value.anchor, value.recursive] : [value.query];
    branches.forEach((branch, index) => validateNestedSelect(branch, `Report request with branch ${index}`, errors, false));
    if (recursive && isRecord(value.anchor) && isRecord(value.recursive)
        && Array.isArray(value.anchor.fields) && Array.isArray(value.recursive.fields)
        && !value.anchor.fields.includes("*") && !value.recursive.fields.includes("*")
        && value.anchor.fields.length !== value.recursive.fields.length) {
        errors.push("Report request recursive CTE branches must return the same number of fields.");
    }
}

function validateNestedSelect(value: unknown, label: string, errors: string[], requireSingleField: boolean) {
    if (!isRecord(value)) return errors.push(`${label} must be a SELECT body.`);
    for (const key of ["action", "sort", "pagination", "with"]) {
        if (key in value) errors.push(`${label} does not support ${key}.`);
    }
    const nestedErrors: string[] = [];
    validateRequest({ ...value, action: "select" }, nestedErrors);
    errors.push(...nestedErrors.map(error => `${label}: ${error}`));
    if (requireSingleField && (!Array.isArray(value.fields) || value.fields.length !== 1 || value.fields.includes("*"))) {
        errors.push(`${label} must return exactly one explicit field.`);
    }
}

function validateExpression(value: unknown, label: string, errors: string[]) {
    if (!isRecord(value)) return errors.push(`${label} must be an object.`);
    rejectUnknown(value, ["left", "operator", "right"], label, errors);
    if (!["+", "-", "*", "/", "%"].includes(String(value.operator))) errors.push(`${label} operator is unsupported.`);
    for (const key of ["left", "right"] as const) {
        if (typeof value[key] !== "number" && !isIdentifier(value[key])) errors.push(`${label} ${key} must be a number or field.`);
    }
}

function validateCase(value: unknown, label: string, errors: string[]) {
    if (!isRecord(value)) return errors.push(`${label} must be an object.`);
    rejectUnknown(value, ["when", "else"], label, errors);
    if (!Array.isArray(value.when) || value.when.length === 0) return errors.push(`${label} requires at least one when entry.`);
    value.when.forEach((entry, index) => {
        if (!isRecord(entry) || !isRecord(entry.condition)) return errors.push(`${label} when ${index} is invalid.`);
        rejectUnknown(entry, ["condition", "then"], `${label} when ${index}`, errors);
        rejectUnknown(entry.condition, ["field", "operator", "value"], `${label} when ${index} condition`, errors);
        requireIdentifier(entry.condition.field, `${label} when ${index} field`, errors);
        if (typeof entry.condition.operator !== "string" || !COMPARISON_OPERATORS.includes(entry.condition.operator.toUpperCase())) errors.push(`${label} when ${index} operator is unsupported.`);
        if (!("value" in entry.condition) || !("then" in entry)) errors.push(`${label} when ${index} requires value and then.`);
        else if (!isLiteral(entry.condition.value) || !isLiteral(entry.then)) errors.push(`${label} when ${index} value and then must be literals.`);
    });
    if ("else" in value && !isLiteral(value.else)) errors.push(`${label} else must be a literal.`);
}

function validateNamedFields(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value)) return errors.push(`${label} must be an array.`);
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} must be an object.`);
        rejectUnknown(entry, ["field", "header"], `${label} entry at index ${index}`, errors);
        requireString(entry.field, `${label} entry at index ${index} field`, errors);
        optionalString(entry.header, `${label} entry at index ${index} header`, errors);
    });
}

function rejectUnknown(value: Record<string, unknown>, allowed: string[], label: string, errors: string[]) {
    Object.keys(value).filter(key => !allowed.includes(key)).forEach(key => errors.push(`${label} contains unknown property "${key}".`));
}
function requireString(value: unknown, label: string, errors: string[]) { if (typeof value !== "string" || !value.trim()) errors.push(`${label} must be a non-empty string.`); }
function optionalString(value: unknown, label: string, errors: string[]) { if (value !== undefined && (typeof value !== "string" || !value.trim())) errors.push(`${label} must be a non-empty string.`); }
function requireIdentifier(value: unknown, label: string, errors: string[]) { if (!isIdentifier(value)) errors.push(`${label} must be a valid identifier.`); }
function requireSqlIdentifier(value: unknown, label: string, errors: string[]) { if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) errors.push(`${label} must be a valid SQL Resource logical field.`); }
function optionalIdentifier(value: unknown, label: string, errors: string[]) { if (value !== undefined && !isIdentifier(value)) errors.push(`${label} must be a valid identifier.`); }
function isIdentifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(value); }
function isLiteral(value: unknown) { return value === null || ["string", "number", "boolean"].includes(typeof value); }
function isSafeFunctionExpression(value: unknown): boolean {
    if (isLiteral(value)) return true;
    if (!isRecord(value)) return false;
    if (Object.keys(value).length === 1 && isIdentifier(value.field)) return true;
    if (Object.keys(value).length !== 1 || !isRecord(value.expression)) return false;
    const expression = value.expression;
    return ["+", "-", "*", "/", "%"].includes(String(expression.operator))
        && isSafeFunctionExpression(expression.left)
        && isSafeFunctionExpression(expression.right);
}
function isSafeNumericFunctionExpression(value: unknown) { return typeof value === "number" && Number.isFinite(value) || isRecord(value) && isSafeFunctionExpression(value); }
function isSupportedDatePart(value: unknown) { return typeof value === "string" && DATE_PARTS.includes(value.toUpperCase()); }
function isDateAddPart(value: unknown) { return typeof value === "string" && ["YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND"].includes(value.toUpperCase()); }
function isDateEndpoint(value: unknown) {
    if (!isRecord(value)) return false;
    if ("field" in value) return Object.keys(value).every(key => key === "field" || key === "style") && isIdentifier(value.field) && (value.style === undefined || Number.isInteger(value.style));
    return Object.keys(value).length === 1 && typeof value.function === "string" && value.function.toUpperCase() === "GETDATE";
}
function isIif(entry: Record<string, unknown>) {
    if (!isRecord(entry.condition) || !("true" in entry) || !("false" in entry)) return false;
    const condition = entry.condition;
    if (!Object.keys(condition).every(key => ["left", "operator", "right"].includes(key))) return false;
    const operator = typeof condition.operator === "string" ? condition.operator.toUpperCase() : "";
    const right = ["IN", "NOT IN"].includes(operator)
        ? Array.isArray(condition.right) && condition.right.length > 0 && condition.right.every(isSafeFunctionExpression)
        : isSafeFunctionExpression(condition.right);
    return ["=", "!=", "<>", ">", "<", ">=", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN"].includes(operator)
        && isSafeFunctionExpression(condition.left)
        && right
        && isSafeFunctionExpression(entry.true)
        && isSafeFunctionExpression(entry.false);
}
function optionalBoolean(value: unknown, label: string, errors: string[]) { if (value !== undefined && typeof value !== "boolean") errors.push(`${label} must be a boolean.`); }
function positiveInteger(value: unknown, label: string, errors: string[]) { if (value !== undefined && (!Number.isInteger(value) || Number(value) <= 0)) errors.push(`${label} must be a positive integer.`); }
function isPositiveInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) > 0; }
function isNonNegativeInteger(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function positiveIntegerArray(value: unknown, label: string, errors: string[]) { if (value !== undefined && (!Array.isArray(value) || value.length === 0 || value.some(item => !Number.isInteger(item) || item <= 0))) errors.push(`${label} must be a non-empty array of positive integers.`); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
