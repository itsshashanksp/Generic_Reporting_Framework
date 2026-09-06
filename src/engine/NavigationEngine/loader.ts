import type { NavigationIcon, NavigationItem } from "../../types/navigation";

const icons: NavigationIcon[] = ["dashboard", "reports", "report", "settings", "user"];
const itemKeys = ["id", "title", "icon", "visible", "route", "reportId", "dashboardId", "children"];

export interface NavigationLoadOptions {
    reportIds?: Iterable<string>;
    dashboardIds?: Iterable<string>;
}

export function getNavigationRoute(item: NavigationItem): string {
    if (item.route) return item.route;
    if (item.reportId) return `/report/${item.reportId}`;
    if (item.dashboardId) return `/dashboard/${item.dashboardId}`;
    return "";
}

export function loadNavigation(value: unknown, options: NavigationLoadOptions = {}): NavigationItem[] {
    if (!Array.isArray(value)) throw new Error("Navigation configuration must be an array.");
    const ids = new Set<string>();
    const reportIds = options.reportIds ? new Set(options.reportIds) : undefined;
    const dashboardIds = options.dashboardIds ? new Set(options.dashboardIds) : undefined;

    const loadItems = (items: unknown[], parentLabel = "Navigation") => items.map((item, index) =>
        loadItem(item, `${parentLabel} item at index ${index}`, ids, reportIds, dashboardIds, loadItems)
    );

    return loadItems(value);
}

function loadItem(
    value: unknown,
    label: string,
    ids: Set<string>,
    reportIds: Set<string> | undefined,
    dashboardIds: Set<string> | undefined,
    loadItems: (items: unknown[], parentLabel?: string) => NavigationItem[]
): NavigationItem {
    if (!isRecord(value)) throw new Error(`${label} must be an object.`);
    const unknown = Object.keys(value).filter(key => !itemKeys.includes(key));
    if (unknown.length) throw new Error(`${label} contains unknown property "${unknown[0]}".`);
    if (!isNonEmptyString(value.id)) throw new Error(`${label} requires id.`);
    if (ids.has(value.id)) throw new Error(`Duplicate navigation id: ${value.id}.`);
    ids.add(value.id);
    if (!isNonEmptyString(value.title)) throw new Error(`${label} requires title.`);
    if (typeof value.icon !== "string" || !icons.includes(value.icon as NavigationIcon)) throw new Error(`${label} has an invalid icon.`);
    if (value.visible !== undefined && typeof value.visible !== "boolean") throw new Error(`${label} visible must be a boolean.`);
    optionalNonEmptyString(value.route, `${label} route`);
    optionalNonEmptyString(value.reportId, `${label} reportId`);
    optionalNonEmptyString(value.dashboardId, `${label} dashboardId`);
    if (typeof value.route === "string" && !value.route.startsWith("/")) throw new Error(`${label} route must start with '/'.`);
    if (typeof value.reportId === "string" && reportIds && !reportIds.has(value.reportId)) throw new Error(`${label} references unknown reportId "${value.reportId}".`);
    if (typeof value.dashboardId === "string" && dashboardIds && !dashboardIds.has(value.dashboardId)) throw new Error(`${label} references unknown dashboardId "${value.dashboardId}".`);

    const children = value.children === undefined
        ? undefined
        : Array.isArray(value.children)
            ? loadItems(value.children, label)
            : (() => { throw new Error(`${label} children must be an array.`); })();
    const destinations = [value.route, value.reportId, value.dashboardId, children].filter(item => item !== undefined);
    if (destinations.length !== 1) throw new Error(`${label} must define exactly one of route, reportId, dashboardId, or children.`);
    if (children?.length === 0) throw new Error(`${label} children must not be empty.`);

    return {
        id: value.id,
        title: value.title,
        icon: value.icon as NavigationIcon,
        visible: value.visible as boolean | undefined,
        route: value.route as string | undefined,
        reportId: value.reportId as string | undefined,
        dashboardId: value.dashboardId as string | undefined,
        children,
    };
}

function optionalNonEmptyString(value: unknown, label: string) {
    if (value !== undefined && !isNonEmptyString(value)) throw new Error(`${label} must be a non-empty string.`);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
