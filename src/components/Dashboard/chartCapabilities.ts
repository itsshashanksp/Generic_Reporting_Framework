import type { ChartType } from "../../types/widget";
import type { ChartDatum } from "./chartData";

export interface ChartCapability {
    type: ChartType;
    label: string;
    category: "Comparison" | "Trends" | "Distribution" | "KPI" | "Legacy";
    requiredMappings: readonly ["category", "value"];
    acceptedCategoryTypes: readonly ["string", "number", "date"];
    acceptedValueTypes: readonly ["number"];
    colorMode: "series" | "category";
    supportsMultipleSeries: boolean;
    supportsStacking: boolean;
    supportsColorCustomization: boolean;
    orderingMeaningful: boolean;
    supportsNegativeValues: boolean;
    supportsZeroValues: boolean;
    tooltipMode: "series" | "proportional";
    supported: boolean;
    exportFormats: readonly ["png", "svg", "csv", "excel"];
    incompatibility: (data: ChartDatum[]) => string | null;
}

const numeric = (data: ChartDatum[]) => data.some(item => item.value !== null)
    ? null
    : "Requires at least one numeric value.";

const proportional = (label: string) => (data: ChartDatum[]) => numeric(data)
    ?? (data.some(item => (item.value ?? 0) < 0)
        ? `${label} charts cannot display negative values.`
        : data.some(item => (item.value ?? 0) > 0) ? null : "Requires at least one positive value.");

const capability = (
    type: ChartType,
    label: string,
    category: ChartCapability["category"],
    colorMode: ChartCapability["colorMode"],
    incompatibility: ChartCapability["incompatibility"] = numeric,
): ChartCapability => ({
    type,
    label,
    category,
    requiredMappings: ["category", "value"],
    acceptedCategoryTypes: ["string", "number", "date"],
    acceptedValueTypes: ["number"],
    colorMode,
    supportsMultipleSeries: false,
    supportsStacking: false,
    supportsColorCustomization: true,
    orderingMeaningful: type === "line" || type === "area",
    supportsNegativeValues: colorMode === "series",
    supportsZeroValues: colorMode === "series",
    tooltipMode: colorMode === "category" ? "proportional" : "series",
    supported: true,
    exportFormats: ["png", "svg", "csv", "excel"],
    incompatibility,
});

export const CHART_CAPABILITIES: readonly ChartCapability[] = [
    capability("bar", "Bar / Column", "Comparison", "series"),
    capability("line", "Line", "Trends", "series"),
    capability("area", "Area", "Trends", "series"),
    capability("pie", "Pie", "Distribution", "category", proportional("Pie")),
    capability("doughnut", "Doughnut", "Distribution", "category", proportional("Doughnut")),
    capability("treemap", "Treemap", "Distribution", "category", proportional("Treemap")),
    capability("radial-bar", "Radial Bar", "KPI", "category", proportional("Radial bar")),
] as const;

const LEGACY_FUNNEL_CAPABILITY: ChartCapability = {
    ...capability("funnel", "Legacy Funnel", "Legacy", "category", () => "Funnel charts are no longer supported. Choose another chart type without changing the source query or mappings."),
    supportsColorCustomization: false,
    exportFormats: ["png", "svg", "csv", "excel"],
    supported: false,
};

export function getChartCapability(type: ChartType) {
    return type === "funnel"
        ? LEGACY_FUNNEL_CAPABILITY
        : CHART_CAPABILITIES.find(capability => capability.type === type) ?? CHART_CAPABILITIES[0];
}
