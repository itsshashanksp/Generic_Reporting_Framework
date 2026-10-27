import type { DashboardWidget } from "../types/widget";
import type { FilterDefinition } from "../types/filter";
import { mapWidgetFilters } from "./DashboardEngine/filterFields";
import { dashboardDateFilterBehaviors } from "./DashboardEngine/dateFilterBehavior";
import {
    validateFilters as validateFilterDefinitions,
} from "./FilterEngine/validator";
import {
    getJsonQueryRequestValidationErrors,
    getReportValidationErrors,
    validateDatabaseId,
} from "./ReportDefinitionEngine/validator";

export interface DashboardValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface DashboardValidationOptions {
    reportIds?: Iterable<string>;
    widgetIds?: Iterable<string>;
}

const widgetTypes = [
    "report",
    "stat",
    "table",
    "chart",
] as const;

const chartTypes = [
    "bar",
    "line",
    "pie",
] as const;

const statFormats = [
    "number",
    "currency",
    "decimal",
    "percentage",
] as const;

const filterTypes = [
    "text",
    "number",
    "select",
    "multiselect",
    "boolean",
    "date",
    "daterange",
] as const;

export function validateDashboard(
    dashboard: unknown,
    options: DashboardValidationOptions = {}
): DashboardValidationResult {

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isRecord(dashboard)) {
        return {
            valid: false,
            errors: [
                "Dashboard configuration must be an object.",
            ],
            warnings,
        };
    }

    rejectUnknownProperties(
        dashboard,
        ["id", "title", "description", "layout", "autoRefresh", "filters", "dateFilterBehavior", "databaseSelection", "widgets"],
        "Dashboard",
        errors
    );

    if (!isNonEmptyString(dashboard.id)) {
        errors.push(
            "Dashboard id is required."
        );
    }

    if (!isNonEmptyString(dashboard.title)) {
        errors.push(
            "Dashboard title is required."
        );
    }


    validateOptionalString(
        dashboard.description,
        "Dashboard description",
        errors
    );

    const columns = validateLayout(
        dashboard.layout,
        errors
    );

    validateAutoRefresh(
        dashboard.autoRefresh,
        errors
    );

    validateFilters(
        dashboard.filters,
        errors
    );

    validateDateFilterBehavior(
        dashboard.dateFilterBehavior,
        dashboard.filters,
        errors
    );

    validateDashboardDatabaseSelection(dashboard.databaseSelection, errors);

    if (!Array.isArray(dashboard.widgets)) {
        errors.push(
            "Dashboard widgets must be an array."
        );
    } else {
        if (dashboard.widgets.length === 0) {
            warnings.push(
                "Dashboard contains no widgets."
            );
        }

        const widgetIds =
            new Set<string>();

        dashboard.widgets.forEach(
            (widget, index) => {
                validateWidget(
                    widget,
                    index,
                    columns,
                    errors,
                    warnings,
                    widgetIds,
                    Array.isArray(dashboard.filters) ? dashboard.filters as FilterDefinition[] : [],
                    options.reportIds,
                    options.widgetIds
                );
            }
        );
    }

    return {
        valid:
            errors.length === 0,
        errors,
        warnings,
    };
}

function validateLayout(
    layout: unknown,
    errors: string[]
) {

    if (layout === undefined) {
        return 12;
    }

    if (!isRecord(layout)) {
        errors.push(
            "Dashboard layout must be an object."
        );

        return 12;
    }


    rejectUnknownProperties(
        layout,
        ["columns", "tabletColumns", "mobileColumns"],
        "Dashboard layout",
        errors
    );

    validatePositiveInteger(
        layout.columns,
        "Dashboard layout columns",
        errors
    );

    validatePositiveInteger(
        layout.tabletColumns,
        "Dashboard layout tabletColumns",
        errors
    );

    validatePositiveInteger(
        layout.mobileColumns,
        "Dashboard layout mobileColumns",
        errors
    );

    return isPositiveInteger(
        layout.columns
    )
        ? layout.columns
        : 12;
}

function validateAutoRefresh(
    autoRefresh: unknown,
    errors: string[]
) {

    if (autoRefresh === undefined) {
        return;
    }

    if (!isRecord(autoRefresh)) {
        errors.push(
            "Dashboard autoRefresh must be an object."
        );

        return;
    }


    rejectUnknownProperties(
        autoRefresh,
        ["enabled", "interval"],
        "Dashboard autoRefresh",
        errors
    );

    if (
        autoRefresh.enabled !== undefined &&
        typeof autoRefresh.enabled !== "boolean"
    ) {
        errors.push(
            "Dashboard autoRefresh enabled must be a boolean."
        );
    }

    if (
        autoRefresh.interval !== undefined
    ) {
        validatePositiveInteger(
            autoRefresh.interval,
            "Dashboard autoRefresh interval",
            errors
        );
    } else if (
        autoRefresh.enabled === true
    ) {
        errors.push(
            "Dashboard autoRefresh interval is required when auto refresh is enabled."
        );
    }
}

/**
 * `dateFilterBehavior` applies to the dashboard's shared `daterange` filters,
 * so it needs at least one; `"optional"` cannot be combined with a date range
 * that is itself marked required.
 */
function validateDateFilterBehavior(
    behavior: unknown,
    filters: unknown,
    errors: string[]
) {
    if (behavior === undefined) return;
    if (!dashboardDateFilterBehaviors.includes(behavior as typeof dashboardDateFilterBehaviors[number])) {
        errors.push(`Dashboard dateFilterBehavior must be "required" or "optional"; received ${JSON.stringify(behavior)}.`);
        return;
    }
    const dateRanges = Array.isArray(filters)
        ? filters.filter(filter => isRecord(filter) && filter.type === "daterange")
        : [];
    if (dateRanges.length === 0) {
        errors.push(`Dashboard dateFilterBehavior "${behavior}" requires at least one shared daterange filter.`);
    }
    if (behavior === "optional") {
        dateRanges
            .filter(filter => isRecord(filter) && filter.required === true)
            .forEach(filter => errors.push(
                `Dashboard dateFilterBehavior "optional" conflicts with required daterange filter "${String((filter as Record<string, unknown>).field)}"; remove one.`
            ));
    }
}

function validateFilters(
    filters: unknown,
    errors: string[],
    scope = "Dashboard"
) {

    if (filters === undefined) {
        return;
    }

    if (!Array.isArray(filters)) {
        errors.push(
            `${scope} filters must be an array.`
        );

        return;
    }

    const initialErrorCount = errors.length;

    const filterFields =
        new Set<string>();

    filters.forEach((filter, index) => {
        const label =
            `${scope} filter at index ${index}`;

        if (!isRecord(filter)) {
            errors.push(
                `${label} must be an object.`
            );

            return;
        }


        rejectUnknownProperties(
            filter,
            ["field", "label", "type", "operator", "options", "dynamicOptions", "visible", "required", "placeholder"],
            label,
            errors
        );

        if (!isNonEmptyString(filter.field)) {
            errors.push(
                `${label} requires field.`
            );
        } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(filter.field)) {
            errors.push(`${label} field must be a field name (letters, digits and underscores, not starting with a digit).`);
        } else if (
            filterFields.has(filter.field)
        ) {
            errors.push(
                `Duplicate ${scope.toLowerCase()} filter field: ${filter.field}`
            );
        } else {
            filterFields.add(filter.field);
        }

        if (!isNonEmptyString(filter.label)) {
            errors.push(
                `${label} requires label.`
            );
        }

        if (
            !isNonEmptyString(filter.type) ||
            !filterTypes.includes(
                filter.type as typeof filterTypes[number]
            )
        ) {
            errors.push(
                `${label} has invalid type.`
            );
        }


        for (const field of ["visible", "required"]) {
            if (filter[field] !== undefined && typeof filter[field] !== "boolean") {
                errors.push(`${label} ${field} must be a boolean.`);
            }
        }

        validateOptionalString(filter.placeholder, `${label} placeholder`, errors);
        if (filter.dynamicOptions !== undefined) {
            if (!isRecord(filter.dynamicOptions)) {
                errors.push(`${label} dynamicOptions must be an object.`);
            } else {
                rejectUnknownProperties(
                    filter.dynamicOptions,
                    ["request", "valueField", "labelField", "countField", "searchable", "searchPlaceholder"],
                    `${label} dynamicOptions`,
                    errors
                );
                for (const key of ["valueField", "labelField", "countField"]) {
                    if (filter.dynamicOptions[key] !== undefined && !isNonEmptyString(filter.dynamicOptions[key])) {
                        errors.push(`${label} dynamicOptions ${key} must be a non-empty string.`);
                    }
                }
                getJsonQueryRequestValidationErrors(filter.dynamicOptions.request)
                    .forEach(error => errors.push(`${label} dynamicOptions: ${error}`));
            }
        }
    });

    if (errors.length === initialErrorCount) {
        try {
            validateFilterDefinitions(
                filters as FilterDefinition[]
            );
        } catch (error) {
            errors.push(
                error instanceof Error
                    ? error.message
                    : `${scope} filter configuration is invalid.`
            );
        }
    }
}

function validateWidget(
    widget: unknown,
    index: number,
    dashboardColumns: number,
    errors: string[],
    warnings: string[],
    widgetIds: Set<string>,
    sharedFilters: FilterDefinition[],
    reportIds?: Iterable<string>,
    widgetDefinitionIds?: Iterable<string>
) {

    if (!isRecord(widget)) {
        errors.push(
            `Widget at index ${index} must be an object.`
        );

        return;
    }


    const commonKeys = [
        "id", "type", "title", "description", "width", "height", "visible", "position", "filterFields", "runtimeFilters", "runtimeFilterDisplay",
    ];
    const definitionKeys = ["queryDefinition", "columns", "filters", "sort", "filterLogic", "grid", "toolbar"];
    const typeKeys: Record<string, string[]> = {
        report: ["request", "reportId", "widgetId", ...definitionKeys],
        stat: ["request", "reportId", "widgetId", "format", "valueField", ...definitionKeys],
        table: ["request", "reportId", "widgetId", "pageSize", "pageSizeOptions", "pagination", "export", ...definitionKeys],
        chart: ["request", "reportId", "widgetId", "xField", "yField", "chartType", "chartOptions", "showLegend", "showTooltip", "showGrid", "showLabels", "export", ...definitionKeys],
    };
    rejectUnknownProperties(
        widget,
        [...commonKeys, ...(typeof widget.type === "string" ? typeKeys[widget.type] ?? [] : [])],
        `Widget at index ${index}`,
        errors
    );

    const widgetLabel =
        isNonEmptyString(widget.id)
            ? `Widget "${widget.id}"`
            : `Widget at index ${index}`;

    if (!isNonEmptyString(widget.id)) {
        errors.push(
            "Widget id is required."
        );
    } else if (
        widgetIds.has(widget.id)
    ) {
        errors.push(
            `Duplicate widget id: ${widget.id}`
        );
    } else {
        widgetIds.add(widget.id);
    }

    if (!isNonEmptyString(widget.title)) {
        errors.push(
            `${widgetLabel} requires title.`
        );
    }


    validateOptionalString(widget.description, `${widgetLabel} description`, errors);

    if (
        !isNonEmptyString(widget.type)
    ) {
        errors.push(
            `${widgetLabel} has no type.`
        );

        return;
    }

    if (
        !widgetTypes.includes(
            widget.type as DashboardWidget["type"]
        )
    ) {
        errors.push(
            `${widgetLabel} has invalid type: ${widget.type}`
        );

        return;
    }

    if (
        widget.visible !== undefined &&
        typeof widget.visible !== "boolean"
    ) {
        errors.push(
            `${widgetLabel} visible must be a boolean.`
        );
    }

    validateWidgetDimensions(
        widget,
        widgetLabel,
        dashboardColumns,
        errors
    );

    // Inline definitions are checked as the widget sees the shared filters.
    const widgetSharedFilters = mapWidgetFilters(
        sharedFilters,
        {},
        validateFilterFields(widget, widgetLabel, sharedFilters, errors)
    ).filters;
    validateFilters(widget.runtimeFilters, errors, `${widgetLabel} runtime`);
    if (widget.runtimeFilterDisplay !== undefined && widget.runtimeFilterDisplay !== "inline" && widget.runtimeFilterDisplay !== "dialog") {
        errors.push(`${widgetLabel} runtimeFilterDisplay must be inline or dialog.`);
    }
    addRuntimeFilterDiagnostics(widget, widgetLabel, widgetSharedFilters, warnings);

    const hasReportId = widget.reportId !== undefined;
    const hasWidgetId = widget.widgetId !== undefined;
    const hasRequest = widget.request !== undefined;
    const hasInlineDefinition = widget.queryDefinition !== undefined;

    if ([hasReportId, hasWidgetId, hasRequest, hasInlineDefinition].filter(Boolean).length !== 1) {
        errors.push(
            `${widget.type} widget "${String(widget.id ?? "")}" requires exactly one of queryDefinition, widgetId, reportId, or request.`
        );
    } else if (hasInlineDefinition) {
        const inlineErrors = getReportValidationErrors(
            {
                id: widget.id,
                title: widget.title,
                description: widget.description,
                queryDefinition: widget.queryDefinition,
                columns: widget.columns,
                filters: mergeFilterDefinitions(widget.filters, widgetSharedFilters),
                sort: widget.sort,
                filterLogic: widget.filterLogic,
                grid: widget.grid,
                toolbar: widget.toolbar,
                // Chart graphic formats are presentation-only and validated
                // below; the shared report definition accepts tabular formats.
                export: widget.type === "chart" ? undefined : widget.export,
            },
            { columnsRequired: false }
        );

        inlineErrors.forEach(error => {
            errors.push(`${widgetLabel} inline definition: ${error}`);
        });
    } else if (hasWidgetId) {
        if (!isNonEmptyString(widget.widgetId)) {
            errors.push(`${widgetLabel} widgetId must be a non-empty string.`);
        } else if (widgetDefinitionIds && !new Set(widgetDefinitionIds).has(widget.widgetId)) {
            errors.push(`${widgetLabel} references unknown widgetId: ${widget.widgetId}`);
        }
    } else if (hasReportId) {
        if (!isNonEmptyString(widget.reportId)) {
            errors.push(`${widgetLabel} reportId must be a non-empty string.`);
        } else if (reportIds && !new Set(reportIds).has(widget.reportId)) {
            errors.push(`${widgetLabel} references unknown reportId: ${widget.reportId}`);
        }
    } else {
        validateRequest(
            widget.request,
            `${widget.type} widget "${String(widget.id ?? "")}"`,
            errors
        );
        getReportValidationErrors(
            {
                id: widget.id,
                title: widget.title,
                request: widget.request,
                columns: widget.columns,
                filters: mergeFilterDefinitions(widget.filters, widgetSharedFilters),
                sort: widget.sort,
                filterLogic: widget.filterLogic,
                grid: widget.grid,
                toolbar: widget.toolbar,
                export: widget.type === "chart" ? undefined : widget.export,
            },
            { columnsRequired: false }
        ).forEach(error => errors.push(`${widgetLabel} inline definition: ${error}`));
    }

    if (widget.type === "chart") {
        validateChartOptions(widget.chartOptions, `Chart widget "${String(widget.id ?? "")}" chartOptions`, errors);
        validateChartExport(widget.export, `Chart widget "${String(widget.id ?? "")}" export`, errors);
        if (!isNonEmptyString(widget.xField)) {
            errors.push(
                `Chart widget "${String(widget.id ?? "")}" requires xField.`
            );
        }

        if (!isNonEmptyString(widget.yField)) {
            errors.push(
                `Chart widget "${String(widget.id ?? "")}" requires yField.`
            );
        }

        if (
            widget.chartType !== undefined &&
            (
                !isNonEmptyString(widget.chartType) ||
                !chartTypes.includes(
                    widget.chartType as typeof chartTypes[number]
                )
            )
        ) {
            errors.push(
                `Chart widget "${String(widget.id ?? "")}" has invalid chartType.`
            );
        }


        for (const field of ["showLegend", "showTooltip", "showGrid", "showLabels"]) {
            if (widget[field] !== undefined && typeof widget[field] !== "boolean") {
                errors.push(`Chart widget "${String(widget.id ?? "")}" ${field} must be a boolean.`);
            }
        }
    }

    if (
        widget.type === "table" &&
        widget.pageSize !== undefined
    ) {
        validatePositiveInteger(
            widget.pageSize,
            `Table widget "${String(widget.id ?? "")}" pageSize`,
            errors
        );
    }

    if (
        widget.type === "table" &&
        widget.pageSizeOptions !== undefined
    ) {
        if (
            !Array.isArray(widget.pageSizeOptions) ||
            widget.pageSizeOptions.length === 0
        ) {
            errors.push(
                `Table widget "${String(widget.id ?? "")}" pageSizeOptions must be a non-empty array.`
            );
        } else {
            widget.pageSizeOptions.forEach((option, optionIndex) => {
                validatePositiveInteger(
                    option,
                    `Table widget "${String(widget.id ?? "")}" pageSizeOptions[${optionIndex}]`,
                    errors
                );
            });
        }
    }

    if (widget.type === "table") {
        validateWidgetPagination(widget.pagination, `Table widget "${String(widget.id ?? "")}" pagination`, errors);
        validateExportConfig(
            widget.export,
            `Table widget "${String(widget.id ?? "")}" export`,
            errors
        );
    }

    if (widget.type === "stat") {
        validateOptionalString(widget.valueField, `Stat widget "${String(widget.id ?? "")}" valueField`, errors);
        if (widget.format === undefined) {
            warnings.push(
                `Stat widget "${String(widget.id ?? "")}" has no format.`
            );
        } else if (
            !isNonEmptyString(widget.format) ||
            !statFormats.includes(
                widget.format as typeof statFormats[number]
            )
        ) {
            errors.push(
                `Stat widget "${String(widget.id ?? "")}" has invalid format.`
            );
        }
    }
}

function validateChartOptions(value: unknown, label: string, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push(`${label} must be an object.`);
    const keys = ["appearance", "orientation", "showLegend", "showLabels", "showDataLabels", "showCenterTotal", "showGrid", "smooth", "showPoints", "topN", "showOthers", "othersLabel"];
    rejectUnknownProperties(value, keys, label, errors);
    if (value.appearance !== undefined && value.appearance !== "pie" && value.appearance !== "donut") errors.push(`${label} appearance must be pie or donut.`);
    if (value.orientation !== undefined && value.orientation !== "vertical" && value.orientation !== "horizontal") errors.push(`${label} orientation must be vertical or horizontal.`);
    for (const field of ["showLegend", "showLabels", "showDataLabels", "showCenterTotal", "showGrid", "smooth", "showPoints", "showOthers"]) {
        if (value[field] !== undefined && typeof value[field] !== "boolean") errors.push(`${label} ${field} must be a boolean.`);
    }
    if (value.topN !== undefined) validatePositiveInteger(value.topN, `${label} topN`, errors);
    if (typeof value.topN === "number" && value.topN > 100) errors.push(`${label} topN must be at most 100.`);
    validateOptionalString(value.othersLabel, `${label} othersLabel`, errors);
}

function validateChartExport(value: unknown, label: string, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) return errors.push(`${label} must be an object.`);
    rejectUnknownProperties(value, ["enabled", "formats", "filename"], label, errors);
    if (typeof value.enabled !== "boolean") errors.push(`${label} enabled must be a boolean.`);
    const allowed = ["png", "svg", "csv", "excel"];
    if (!Array.isArray(value.formats) || value.formats.length === 0 || value.formats.some(format => !allowed.includes(String(format)))) {
        errors.push(`${label} formats must contain png, svg, csv, or excel.`);
    } else if (new Set(value.formats).size !== value.formats.length) {
        errors.push(`${label} formats must not contain duplicates.`);
    }
    validateOptionalString(value.filename, `${label} filename`, errors);
}

function validateWidgetPagination(value: unknown, label: string, errors: string[]) {
    if (value === undefined) return;
    if (!isRecord(value)) {
        errors.push(`${label} must be an object.`);
        return;
    }
    rejectUnknownProperties(value, ["style", "pageSize", "pageSizeOptions", "showTotalRecords", "showPageNumbers", "showFirstLast"], label, errors);
    if (value.style !== undefined && value.style !== "modern") errors.push(`${label} style must be modern.`);
    if (value.pageSize !== undefined) validatePositiveInteger(value.pageSize, `${label} pageSize`, errors);
    for (const field of ["showTotalRecords", "showPageNumbers", "showFirstLast"]) {
        if (value[field] !== undefined && typeof value[field] !== "boolean") errors.push(`${label} ${field} must be a boolean.`);
    }
    if (value.pageSizeOptions !== undefined) {
        if (!Array.isArray(value.pageSizeOptions) || value.pageSizeOptions.length === 0) {
            errors.push(`${label} pageSizeOptions must be a non-empty array.`);
        } else {
            value.pageSizeOptions.forEach((option, index) => validatePositiveInteger(option, `${label} pageSizeOptions[${index}]`, errors));
            if (value.pageSizeOptions.length > 20) errors.push(`${label} pageSizeOptions must contain at most 20 values.`);
            if (new Set(value.pageSizeOptions).size !== value.pageSizeOptions.length) errors.push(`${label} pageSizeOptions must not contain duplicates.`);
        }
    }
}

/**
 * `filterFields` renames shared dashboard filter fields for one widget. Each
 * source must be a shared filter field; each target a SQL runtime identifier
 * (a field name, never an expression) that no other shared or widget filter
 * uses, and no two sources share a target. Returns the mapping when valid.
 */
function validateFilterFields(
    widget: Record<string, unknown>,
    widgetLabel: string,
    sharedFilters: FilterDefinition[],
    errors: string[]
): Record<string, string> | undefined {
    if (widget.filterFields === undefined) return undefined;
    const label = `${widgetLabel} filterFields`;
    if (!isRecord(widget.filterFields) || Object.keys(widget.filterFields).length === 0) {
        errors.push(`${label} must be an object mapping shared filter fields to field names, e.g. { "Bill_Date": "GIN_Date" }.`);
        return undefined;
    }
    const initialErrorCount = errors.length;
    const sharedFields = new Set(sharedFilters.map(filter => filter.field));
    const widgetFields = Array.isArray(widget.filters)
        ? widget.filters.filter(isRecord).map(filter => filter.field).filter(isNonEmptyString)
        : [];
    const targets = new Map<string, string>();

    Object.entries(widget.filterFields).forEach(([source, target]) => {
        if (!sharedFields.has(source)) {
            errors.push(`${label} source "${source}" is not a shared dashboard filter field.`);
        }
        if (typeof target !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(target)) {
            errors.push(`${label} target for "${source}" must be a field name (letters, digits and underscores, not starting with a digit).`);
            return;
        }
        const key = target.toLowerCase();
        if (key === source.toLowerCase()) {
            errors.push(`${label} maps "${source}" to itself; remove the mapping.`);
        } else if (targets.has(key)) {
            errors.push(`${label} maps both "${targets.get(key)}" and "${source}" to "${target}".`);
        } else if (sharedFilters.some(filter => filter.field.toLowerCase() === key)) {
            errors.push(`${label} target "${target}" collides with shared dashboard filter "${target}".`);
        } else if (widgetFields.some(field => field.toLowerCase() === key)) {
            errors.push(`${label} target "${target}" collides with this widget's filter "${target}".`);
        }
        targets.set(key, source);
    });

    return errors.length === initialErrorCount
        ? widget.filterFields as Record<string, string>
        : undefined;
}

function addRuntimeFilterDiagnostics(
    widget: Record<string, unknown>,
    widgetLabel: string,
    sharedFilters: FilterDefinition[],
    warnings: string[]
) {
    if (!Array.isArray(widget.runtimeFilters)) return;
    const sharedFields = new Set(sharedFilters.map(filter => filter.field.toLowerCase()));
    const staticFields = new Set<string>();
    if (isRecord(widget.request) && Array.isArray(widget.request.filters)) {
        widget.request.filters.forEach(condition => {
            if (isRecord(condition) && typeof condition.field === "string") {
                staticFields.add(condition.field.toLowerCase());
            }
        });
    }
    widget.runtimeFilters.forEach(filter => {
        if (!isRecord(filter) || typeof filter.field !== "string") return;
        const field = filter.field.toLowerCase();
        if (sharedFields.has(field)) {
            warnings.push(`${widgetLabel} runtime filter "${filter.field}" repeats a dashboard filter targeting the same effective field; both conditions are sent.`);
        }
        if (staticFields.has(field)) {
            warnings.push(`${widgetLabel} runtime filter "${filter.field}" repeats an authored request filter targeting the same field; both conditions are sent.`);
        }
    });

    if (widget.filterLogic === "OR") {
        const sourceCount = [staticFields.size, sharedFilters.length, widget.runtimeFilters.length]
            .filter(count => count > 0).length;
        if (sourceCount > 1) {
            warnings.push(`${widgetLabel} uses flat OR across authored, dashboard, or widget filters; every condition is an alternative, not a mandatory constraint.`);
        }
    }
}

function mergeFilterDefinitions(widgetFilters: unknown, sharedFilters: FilterDefinition[]) {
    const merged = new Map<string, FilterDefinition>();
    if (Array.isArray(widgetFilters)) {
        widgetFilters.forEach(filter => {
            if (isRecord(filter) && typeof filter.field === "string") {
                merged.set(filter.field, filter as unknown as FilterDefinition);
            }
        });
    }
    sharedFilters.forEach(filter => merged.set(filter.field, filter));
    return [...merged.values()];
}

function validateExportConfig(config: unknown, label: string, errors: string[]) {
    if (config === undefined) return;
    if (!isRecord(config)) {
        errors.push(`${label} must be an object.`);
        return;
    }
    rejectUnknownProperties(
        config,
        ["enabled", "formats", "filename", "exportAll", "exportCurrentView"],
        label,
        errors
    );
    if (typeof config.enabled !== "boolean") {
        errors.push(`${label} enabled must be a boolean.`);
    }
    if (
        !Array.isArray(config.formats)
        || !config.formats.length
        || config.formats.some(format => format !== "csv" && format !== "excel")
    ) {
        errors.push(`${label} formats must contain csv or excel.`);
    }
    for (const field of ["exportAll", "exportCurrentView"]) {
        if (config[field] !== undefined && typeof config[field] !== "boolean") {
            errors.push(`${label} ${field} must be a boolean.`);
        }
    }
    if (config.filename !== undefined && !isNonEmptyString(config.filename)) {
        errors.push(`${label} filename must be a non-empty string.`);
    }
}

function validateWidgetDimensions(
    widget: Record<string, unknown>,
    widgetLabel: string,
    dashboardColumns: number,
    errors: string[]
) {

    if (widget.width !== undefined) {
        validatePositiveInteger(
            widget.width,
            `${widgetLabel} width`,
            errors
        );

        if (
            isPositiveInteger(widget.width) &&
            widget.width > dashboardColumns
        ) {
            errors.push(
                `${widgetLabel} width cannot exceed dashboard columns (${dashboardColumns}).`
            );
        }
    }

    validatePositiveInteger(
        widget.height,
        `${widgetLabel} height`,
        errors
    );

    if (widget.position === undefined) {
        return;
    }

    if (!isRecord(widget.position)) {
        errors.push(
            `${widgetLabel} position must be an object.`
        );

        return;
    }


    rejectUnknownProperties(
        widget.position,
        ["x", "y"],
        `${widgetLabel} position`,
        errors
    );

    const { x, y } = widget.position;

    if (
        typeof x !== "number" ||
        !Number.isFinite(x) ||
        !Number.isInteger(x) ||
        x < 0
    ) {
        errors.push(
            `${widgetLabel} position.x must be a non-negative integer.`
        );
    }

    if (
        typeof y !== "number" ||
        !Number.isFinite(y) ||
        !Number.isInteger(y) ||
        y < 1
    ) {
        errors.push(
            `${widgetLabel} position.y must be a positive integer.`
        );
    }

    const width =
        isPositiveInteger(widget.width)
            ? widget.width
            : dashboardColumns;

    if (
        typeof x === "number" &&
        Number.isInteger(x) &&
        x >= 0 &&
        x + width > dashboardColumns
    ) {
        errors.push(
            `${widgetLabel} position and width exceed dashboard columns (${dashboardColumns}).`
        );
    }
}

function validateRequest(
    request: unknown,
    widgetLabel: string,
    errors: string[]
) {

    if (!isRecord(request)) {
        errors.push(
            `${widgetLabel} requires a request.`
        );

        return;
    }


    rejectUnknownProperties(
        request,
        [
            "action", "database", "source", "fields", "filters", "joins", "groupBy", "having",
            "sort", "pagination", "distinct", "limit", "filterLogic", "with",
        ],
        `${widgetLabel} request`,
        errors
    );
    validateDatabaseId(request.database, `${widgetLabel} request database`, errors);

    if (request.action !== "select") {
        errors.push(`${widgetLabel} request action must be select.`);
    }
    if (!isRecord(request.source) || !isNonEmptyString(request.source.table)) {
        errors.push(`${widgetLabel} request requires source.table.`);
    } else {
        rejectUnknownProperties(request.source, ["table", "alias"], `${widgetLabel} request source`, errors);
        validateOptionalString(request.source.alias, `${widgetLabel} request source alias`, errors);
    }

    if (
        !Array.isArray(request.fields) ||
        request.fields.length === 0
    ) {
        errors.push(
            `${widgetLabel} request fields must be a non-empty array.`
        );
    } else {
        request.fields.forEach(
            (column, index) => {
                if (isNonEmptyString(column)) {
                    return;
                }

                if (
                    !isRecord(column) ||
                    (!isNonEmptyString(column.function) && !isNonEmptyString(column.field)
                        && column.case === undefined && column.expression === undefined)
                ) {
                    errors.push(
                        `${widgetLabel} request field at index ${index} is invalid.`
                    );
                } else {
                    rejectUnknownProperties(
                        column,
                        ["field", "fields", "function", "alias", "sort", "case", "expression", "buckets", "offset", "default", "separator", "datatype", "style", "value", "values", "index", "datepart", "number", "start", "end", "year", "month", "day", "hour", "minute", "second", "millisecond", "precision", "power", "part", "length", "search", "replace", "pattern", "format", "condition", "true", "false"],
                        `${widgetLabel} request field at index ${index}`,
                        errors
                    );
                    validateOptionalString(
                        column.alias,
                        `${widgetLabel} request field at index ${index} alias`,
                        errors
                    );
                }
            }
        );
    }

    if (
        request.groupBy !== undefined &&
        (
            !Array.isArray(request.groupBy) ||
            request.groupBy.some(
                group => !isNonEmptyString(group)
            )
        )
    ) {
        errors.push(
            `${widgetLabel} request groupBy must contain only column names.`
        );
    }

    if (
        request.filters !== undefined &&
        (
            !Array.isArray(request.filters) ||
            request.filters.some(
                condition =>
                    !isRecord(condition) ||
                    ((condition.operator !== "EXISTS" && condition.operator !== "NOT EXISTS") && !isNonEmptyString(condition.field)) ||
                    !isNonEmptyString(condition.operator)
            )
        )
    ) {
        errors.push(
            `${widgetLabel} request filters conditions are invalid.`
        );
    }


    if (Array.isArray(request.filters)) {
        request.filters.forEach((condition, index) => {
            if (isRecord(condition)) {
                rejectUnknownProperties(
                    condition,
                    ["field", "operator", "value", "query"],
                    `${widgetLabel} request filters condition at index ${index}`,
                    errors
                );
                const nullCheck = condition.operator === "IS NULL" || condition.operator === "IS NOT NULL";
                if (!nullCheck && !Object.prototype.hasOwnProperty.call(condition, "value") && condition.query === undefined) {
                    errors.push(`${widgetLabel} request filters condition at index ${index} requires value or query.`);
                }
            }
        });
    }

    if (request.sort !== undefined) {
        if (!Array.isArray(request.sort)) {
            errors.push(`${widgetLabel} request sort must be an array.`);
        } else {
            request.sort.forEach((sort, index) => {
                if (!isRecord(sort)) {
                    errors.push(`${widgetLabel} request sort at index ${index} must be an object.`);
                    return;
                }
                rejectUnknownProperties(sort, ["field", "direction"], `${widgetLabel} request sort at index ${index}`, errors);
                if (!isNonEmptyString(sort.field)) errors.push(`${widgetLabel} request sort at index ${index} requires field.`);
                if (sort.direction !== "ASC" && sort.direction !== "DESC") errors.push(`${widgetLabel} request sort at index ${index} direction must be ASC or DESC.`);
            });
        }
    }

    if (request.pagination !== undefined) {
        if (!isRecord(request.pagination)) {
            errors.push(`${widgetLabel} request pagination must be an object.`);
        } else {
            rejectUnknownProperties(request.pagination, ["page", "pageSize"], `${widgetLabel} request pagination`, errors);
            validatePositiveInteger(request.pagination.page, `${widgetLabel} request pagination page`, errors);
            validatePositiveInteger(request.pagination.pageSize, `${widgetLabel} request pagination pageSize`, errors);
        }
    }
    if (request.distinct !== undefined && typeof request.distinct !== "boolean") {
        errors.push(`${widgetLabel} request distinct must be a boolean.`);
    }
    validatePositiveInteger(request.limit, `${widgetLabel} request limit`, errors);
    if (request.filterLogic !== undefined && request.filterLogic !== "AND" && request.filterLogic !== "OR") {
        errors.push(`${widgetLabel} request filterLogic must be AND or OR.`);
    }
}

function rejectUnknownProperties(
    value: Record<string, unknown>,
    allowed: string[],
    label: string,
    errors: string[]
) {
    Object.keys(value)
        .filter(key => !allowed.includes(key))
        .forEach(key => errors.push(`${label} contains unknown property "${key}".`));
}

function validateOptionalString(value: unknown, label: string, errors: string[]) {
    if (value !== undefined && !isNonEmptyString(value)) {
        errors.push(`${label} must be a non-empty string.`);
    }
}

function validatePositiveInteger(
    value: unknown,
    label: string,
    errors: string[]
) {

    if (
        value !== undefined &&
        !isPositiveInteger(value)
    ) {
        errors.push(
            `${label} must be a positive integer.`
        );
    }
}

function isPositiveInteger(
    value: unknown
): value is number {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value > 0
    );
}

function isNonEmptyString(
    value: unknown
): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0
    );
}

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

/** Opt-in runtime database switching; the backend owns the complete option list. */
function validateDashboardDatabaseSelection(value: unknown, errors: string[]) {
    if (value === undefined) return;
    if (value !== true) errors.push("Dashboard databaseSelection must be true.");
}
