import type { ReportDefinition } from "../../types/report";
import type { WidgetDefinitionConfiguration } from "../../types/widget";
import { loadDefinition } from "../ReportDefinitionEngine";
import { getWidgetSqlDefinition } from "../ReportQueryEngine";

const widgetModules = import.meta.glob(
    "../../config/widgets/*.json",
    { eager: true, import: "default" }
) as Record<string, WidgetDefinitionConfiguration>;

const widgets = buildWidgetRegistry(widgetModules);

export function buildWidgetRegistry(
    modules: Record<string, unknown>
): Record<string, ReportDefinition> {
    const registry: Record<string, ReportDefinition> = {};

    Object.entries(modules).forEach(([source, configuration]) => {
        try {
            const widget = loadDefinition(configuration, {
                resolveSql: getWidgetSqlDefinition,
                columnsRequired: false,
            });
            if (Object.prototype.hasOwnProperty.call(registry, widget.id)) {
                console.error(`Duplicate widget definition id "${widget.id}" in ${source}.`);
                return;
            }
            registry[widget.id] = widget;
        } catch (error) {
            console.error(`Unable to load widget definition: ${source}`, error);
        }
    });

    return registry;
}

export function getWidgetDefinition(widgetId: string): ReportDefinition | undefined {
    return widgets[widgetId];
}

export function getWidgetDefinitionIds(): string[] {
    return Object.keys(widgets);
}
