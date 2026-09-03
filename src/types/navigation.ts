export type NavigationIcon = "dashboard" | "reports" | "report";

export interface NavigationItem {
    id: string;
    title: string;
    icon: NavigationIcon;
    visible?: boolean;
    route?: string;
    reportId?: string;
    children?: NavigationItem[];
}
