export type NavigationIcon = "dashboard" | "reports" | "report" | "settings" | "user";

export interface NavigationItem {
    id: string;
    title: string;
    icon: NavigationIcon;
    visible?: boolean;
    route?: string;
    reportId?: string;
    dashboardId?: string;
    children?: NavigationItem[];
}
