import type { DashboardWidget } from "../types/widget";
import type { FilterDefinition } from "../types/filter";
import {
    validateFilters as validateFilterDefinitions,
} from "./FilterEngine/validator";

export interface DashboardValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
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
] as const;

const filterTypes = [
    "text",
    "number",
    "select",
    "multiselect",
    "date",
    "daterange",
] as const;

export function validateDashboard(
    dashboard: unknown
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
                    widgetIds
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

function validateFilters(
    filters: unknown,
    errors: string[]
) {

    if (filters === undefined) {
        return;
    }

    if (!Array.isArray(filters)) {
        errors.push(
            "Dashboard filters must be an array."
        );

        return;
    }

    const initialErrorCount = errors.length;

    const filterFields =
        new Set<string>();

    filters.forEach((filter, index) => {
        const label =
            `Dashboard filter at index ${index}`;

        if (!isRecord(filter)) {
            errors.push(
                `${label} must be an object.`
            );

            return;
        }

        if (!isNonEmptyString(filter.field)) {
            errors.push(
                `${label} requires field.`
            );
        } else if (
            filterFields.has(filter.field)
        ) {
            errors.push(
                `Duplicate dashboard filter field: ${filter.field}`
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
                    : "Dashboard filter configuration is invalid."
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
    widgetIds: Set<string>
) {

    if (!isRecord(widget)) {
        errors.push(
            `Widget at index ${index} must be an object.`
        );

        return;
    }

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

    if (
        widget.type === "report"
    ) {
        if (!isNonEmptyString(widget.reportId)) {
            errors.push(
                `Report widget "${String(widget.id ?? "")}" requires reportId.`
            );
        }
    } else {
        validateRequest(
            widget.request,
            `${widget.type} widget "${String(widget.id ?? "")}"`,
            errors
        );
    }

    if (widget.type === "chart") {
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
        validateExportConfig(
            widget.export,
            `Table widget "${String(widget.id ?? "")}" export`,
            errors
        );
    }

    if (widget.type === "stat") {
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

function validateExportConfig(config: unknown, label: string, errors: string[]) {
    if (config === undefined) return;
    if (!isRecord(config)) {
        errors.push(`${label} must be an object.`);
        return;
    }
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

    if (
        widget.height !== undefined &&
        (
            typeof widget.height !== "number" ||
            !Number.isFinite(widget.height) ||
            !Number.isInteger(widget.height) ||
            widget.height < 0
        )
    ) {
        errors.push(
            `${widgetLabel} height must be a non-negative integer.`
        );
    }

    if (widget.position === undefined) {
        return;
    }

    if (!isRecord(widget.position)) {
        errors.push(
            `${widgetLabel} position must be an object.`
        );

        return;
    }

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

    for (const field of [
        "controller",
        "action",
        "table",
    ]) {
        if (!isNonEmptyString(request[field])) {
            errors.push(
                `${widgetLabel} request requires ${field}.`
            );
        }
    }

    if (
        !Array.isArray(request.columns) ||
        request.columns.length === 0
    ) {
        errors.push(
            `${widgetLabel} request columns must be a non-empty array.`
        );
    } else {
        request.columns.forEach(
            (column, index) => {
                if (isNonEmptyString(column)) {
                    return;
                }

                if (
                    !isRecord(column) ||
                    !isNonEmptyString(column.function) ||
                    !isNonEmptyString(column.column)
                ) {
                    errors.push(
                        `${widgetLabel} request column at index ${index} is invalid.`
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
        request.where !== undefined &&
        (
            !Array.isArray(request.where) ||
            request.where.some(
                condition =>
                    !isRecord(condition) ||
                    !isNonEmptyString(condition.column) ||
                    !isNonEmptyString(condition.operator)
            )
        )
    ) {
        errors.push(
            `${widgetLabel} request where conditions are invalid.`
        );
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
