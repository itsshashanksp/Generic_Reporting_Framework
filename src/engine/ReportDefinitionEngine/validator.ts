import type { FilterType } from "../../types/filter";
import { allowedOperators } from "../FilterEngine/validator";
import { isValidSqlResourceReference } from "../ReportQueryEngine/sqlContract";

const REPORT_KEYS = ["id", "title", "description", "queryDefinition", "request", "columns", "filters", "grid", "toolbar", "export"];
const REQUEST_KEYS = ["action", "source", "fields", "filters", "joins", "groupBy", "having", "sort", "pagination", "distinct", "limit", "filterLogic", "with"];
const REQUEST_FIELD_KEYS = ["field", "fields", "function", "alias", "sort", "case", "expression", "buckets", "offset", "default", "separator", "datatype", "style", "value", "values", "index", "datepart", "number", "start", "end", "year", "month", "day", "hour", "minute", "second", "millisecond", "precision", "power", "part", "length", "search", "replace", "pattern", "format", "condition", "true", "false"];
const COLUMN_KEYS = ["field", "header", "visible", "sortable", "width"];
const FILTER_KEYS = ["field", "label", "type", "operator", "options", "visible", "required", "placeholder"];
const FILTER_TYPES: FilterType[] = ["text", "number", "select", "multiselect", "date", "daterange"];

export function validateReport(report: unknown): boolean {
    return getReportValidationErrors(report).length === 0;
}

export function getReportValidationErrors(report: unknown): string[] {
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
    validateColumns(report.columns, errors);
    validateFilters(report.filters, errors);
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
        && !isValidSqlResourceReference(value.resource)
    ) {
        errors.push("Report queryDefinition resource must be a .sql filename without a path.");
    }
}

function validateRequest(value: unknown, errors: string[]) {
    if (!isRecord(value)) return errors.push("Report request must be an object.");
    rejectUnknown(value, REQUEST_KEYS, "Report request", errors);
    if (value.action !== "select") errors.push("Report request action must be select.");
    if (!isRecord(value.source)) errors.push("Report request source must be an object.");
    else {
        rejectUnknown(value.source, ["table", "alias"], "Report request source", errors);
        requireString(value.source.table, "Report request source table", errors);
        optionalString(value.source.alias, "Report request source alias", errors);
    }
    validateRequestFields(value.fields, "Report request fields", errors);
    if (value.filters !== undefined) validateRequestFilters(value.filters, "Report request filters", errors);
    if (value.sort !== undefined) validateSort(value.sort, "Report request sort", errors);
    if (value.groupBy !== undefined
        && (!Array.isArray(value.groupBy) || value.groupBy.some(field => typeof field !== "string" || !field.trim()))) {
        errors.push("Report request groupBy must contain field names.");
    }
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

function validateColumns(value: unknown, errors: string[]) {
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

function validateFilters(value: unknown, errors: string[]) {
    if (!Array.isArray(value)) return errors.push("Report filters must be an array.");
    const fields = new Set<string>();
    value.forEach((entry, index) => {
        const label = `Report filter at index ${index}`;
        if (!isRecord(entry)) return errors.push(`${label} must be an object.`);
        rejectUnknown(entry, FILTER_KEYS, label, errors);
        requireString(entry.field, `${label} field`, errors);
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
    const keys = ["export", "refresh", "settings", "saveReport"];
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
        if (typeof entry === "string" && entry.trim()) return;
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} is invalid.`);
        rejectUnknown(entry, REQUEST_FIELD_KEYS, `${label} entry at index ${index}`, errors);
        if (entry.function === undefined && entry.field === undefined && entry.case === undefined && entry.expression === undefined) {
            errors.push(`${label} entry at index ${index} requires field, function, case, or expression.`);
        }
        optionalString(entry.function, `${label} entry at index ${index} function`, errors);
        optionalString(entry.field, `${label} entry at index ${index} field`, errors);
        optionalString(entry.alias, `${label} entry at index ${index} alias`, errors);
        if (entry.sort !== undefined) validateSort(entry.sort, `${label} entry at index ${index} sort`, errors);
    });
}

function validateRequestFilters(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value)) return errors.push(`${label} must be an array.`);
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} must be an object.`);
        rejectUnknown(entry, ["field", "operator", "value", "query"], `${label} entry at index ${index}`, errors);
        requireString(entry.operator, `${label} entry at index ${index} operator`, errors);
        const exists = entry.operator === "EXISTS" || entry.operator === "NOT EXISTS";
        const nullCheck = entry.operator === "IS NULL" || entry.operator === "IS NOT NULL";
        if (!exists) requireString(entry.field, `${label} entry at index ${index} field`, errors);
        if (!nullCheck && !Object.prototype.hasOwnProperty.call(entry, "value") && entry.query === undefined) errors.push(`${label} entry at index ${index} requires value or query.`);
    });
}

function validateSort(value: unknown, label: string, errors: string[]) {
    if (!Array.isArray(value)) return errors.push(`${label} must be an array.`);
    value.forEach((entry, index) => {
        if (!isRecord(entry)) return errors.push(`${label} entry at index ${index} must be an object.`);
        rejectUnknown(entry, ["field", "direction"], `${label} entry at index ${index}`, errors);
        requireString(entry.field, `${label} entry at index ${index} field`, errors);
        if (entry.direction !== "ASC" && entry.direction !== "DESC") errors.push(`${label} entry at index ${index} direction must be ASC or DESC.`);
    });
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
function optionalBoolean(value: unknown, label: string, errors: string[]) { if (value !== undefined && typeof value !== "boolean") errors.push(`${label} must be a boolean.`); }
function positiveInteger(value: unknown, label: string, errors: string[]) { if (value !== undefined && (!Number.isInteger(value) || Number(value) <= 0)) errors.push(`${label} must be a positive integer.`); }
function positiveIntegerArray(value: unknown, label: string, errors: string[]) { if (value !== undefined && (!Array.isArray(value) || value.length === 0 || value.some(item => !Number.isInteger(item) || item <= 0))) errors.push(`${label} must be a non-empty array of positive integers.`); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
