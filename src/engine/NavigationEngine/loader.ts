import type { NavigationIcon, NavigationItem } from "../../types/navigation";

const icons: NavigationIcon[] = ["dashboard", "reports", "report", "settings", "user"];

export function loadNavigation(value: unknown): NavigationItem[] {
    if (!Array.isArray(value)) throw new Error("Navigation configuration must be an array.");
    return value.map((item, index) => loadItem(item, `Navigation item at index ${index}`));
}

function loadItem(value: unknown, label: string): NavigationItem {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object.`);
    }

    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim()) throw new Error(`${label} requires id.`);
    if (typeof item.title !== "string" || !item.title.trim()) throw new Error(`${label} requires title.`);
    if (typeof item.icon !== "string" || !icons.includes(item.icon as NavigationIcon)) {
        throw new Error(`${label} has an invalid icon.`);
    }
    if (item.visible !== undefined && typeof item.visible !== "boolean") {
        throw new Error(`${label} visible must be a boolean.`);
    }
    if (item.route !== undefined && typeof item.route !== "string") throw new Error(`${label} route must be a string.`);
    if (item.reportId !== undefined && typeof item.reportId !== "string") throw new Error(`${label} reportId must be a string.`);
    if (item.dashboardId !== undefined && typeof item.dashboardId !== "string") throw new Error(`${label} dashboardId must be a string.`);

    return {
        id: item.id,
        title: item.title,
        icon: item.icon as NavigationIcon,
        visible: item.visible as boolean | undefined,
        route: item.route as string | undefined,
        reportId: item.reportId as string | undefined,
        dashboardId: item.dashboardId as string | undefined,
        children: item.children === undefined ? undefined : loadNavigation(item.children),
    };
}
