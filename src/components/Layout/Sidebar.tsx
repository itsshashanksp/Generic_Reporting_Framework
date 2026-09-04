import { useState } from "react";
import { ChevronDown, ChevronRight, FileBarChart, FolderKanban, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings, UserRound } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import menu from "../../config/menu.json";
import { loadNavigation } from "../../engine/NavigationEngine";
import type { NavigationIcon, NavigationItem } from "../../types/navigation";

const SIDEBAR_STORAGE_KEY = "generic-report-sidebar-collapsed";
const REPORTS_STORAGE_KEY = "generic-report-sidebar-reports-expanded";
const configuredItems = loadNavigation(menu);
const icons: Record<NavigationIcon, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    reports: FolderKanban,
    report: FileBarChart,
    settings: Settings,
    user: UserRound,
};

export default function Sidebar({ items = configuredItems }: { items?: NavigationItem[] }) {
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
        } catch {
            return false;
        }
    });
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
            return stored ? JSON.parse(stored) as Record<string, boolean> : {};
        } catch {
            return {};
        }
    });

    const toggleCollapsed = () => {
        setCollapsed(previous => {
            const next = !previous;
            try {
                localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
            } catch {
                // Persistence is optional when storage is unavailable.
            }
            return next;
        });
    };

    const toggleGroup = (id: string, activeChild: boolean) => {
        setExpandedGroups(previous => {
            const next = {
                ...previous,
                [id]: !(previous[id] ?? activeChild),
            };
            try {
                localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Persistence is optional when storage is unavailable.
            }
            return next;
        });
    };

    const activateGroup = (id: string, activeChild: boolean) => {
        if (!collapsed) {
            toggleGroup(id, activeChild);
            return;
        }

        setCollapsed(false);
        setExpandedGroups(previous => {
            const next = { ...previous, [id]: true };
            try {
                localStorage.setItem(SIDEBAR_STORAGE_KEY, "false");
                localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Persistence is optional when storage is unavailable.
            }
            return next;
        });
    };

    const visibleItems = items
        .filter(item => item.visible !== false)
        .filter(item => !item.children || item.children.some(child => child.visible !== false));

    return (

        <nav className="app-sidebar" data-collapsed={collapsed} aria-label="Primary navigation">

            <div className="app-sidebar__header">
                {!collapsed && (
                    <div className="app-sidebar__brand">
                        <span className="app-sidebar__brand-name">Generic Reporting <strong>Framework</strong></span>
                    </div>
                )}

                <button
                    type="button"
                    className="app-sidebar__toggle"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                    aria-expanded={!collapsed}
                    aria-controls="primary-navigation-links"
                >
                    {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                </button>
            </div>

            <div className="app-sidebar__links" id="primary-navigation-links">

            {visibleItems.map(item => {
                const Icon = icons[item.icon];
                const visibleChildren = item.children?.filter(child => child.visible !== false) ?? [];
                const childRoutes = visibleChildren.map(child => child.route
                    ?? (child.reportId ? `/report/${child.reportId}` : child.dashboardId ? `/dashboard/${child.dashboardId}` : ""));
                const activeChild = childRoutes.includes(location.pathname);
                const groupExpanded = expandedGroups[item.id] ?? activeChild;
                const route = item.route
                    ?? (item.dashboardId ? `/dashboard/${item.dashboardId}` : item.reportId ? `/report/${item.reportId}` : "");

                return <div key={item.id} className="app-sidebar__section">

                    {route && (
                        <NavLink
                            to={route}
                            end={route === "/"}
                            title={collapsed ? item.title : undefined}
                            className={({ isActive }) => isActive ? "is-active" : undefined}
                        >
                            <Icon aria-hidden="true" />
                            <span aria-hidden={collapsed || undefined}>{item.title}</span>
                        </NavLink>
                    )}

                    {item.children && (

                        <>

                            <button
                                type="button"
                                className="app-sidebar__group"
                                title={collapsed ? item.title : undefined}
                                aria-expanded={!collapsed && groupExpanded}
                                aria-controls={`navigation-group-${item.id}`}
                                onClick={() => activateGroup(item.id, activeChild)}
                            >
                                <Icon aria-hidden="true" />
                                <span aria-hidden={collapsed || undefined}>{item.title}</span>
                                {groupExpanded
                                    ? <ChevronDown className="app-sidebar__chevron" aria-hidden="true" />
                                    : <ChevronRight className="app-sidebar__chevron" aria-hidden="true" />}
                            </button>

                            {!collapsed && groupExpanded && <div className="app-sidebar__children" id={`navigation-group-${item.id}`}>
                            {visibleChildren.map(child => {
                                const ChildIcon = icons[child.icon];
                                const childRoute = child.route
                                    ?? (child.reportId ? `/report/${child.reportId}` : child.dashboardId ? `/dashboard/${child.dashboardId}` : "");

                                return childRoute ? <NavLink
                                        key={child.id}
                                        to={childRoute}
                                        title={collapsed ? child.title : undefined}
                                        className={({ isActive }) => isActive ? "is-active app-sidebar__child" : "app-sidebar__child"}
                                    >
                                        <ChildIcon aria-hidden="true" />
                                        <span>{child.title}</span>
                                    </NavLink> : null;

                            })}
                            </div>}

                        </>

                    )}

                </div>;

            })}
            </div>

        </nav>

    );

}
