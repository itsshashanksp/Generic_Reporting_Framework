import { useState } from "react";
import { FileBarChart, FolderKanban, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";

import menu from "../../config/menu.json";
import { loadNavigation } from "../../engine/NavigationEngine";
import type { NavigationIcon, NavigationItem } from "../../types/navigation";

const SIDEBAR_STORAGE_KEY = "generic-report-sidebar-collapsed";
const configuredItems = loadNavigation(menu);
const icons: Record<NavigationIcon, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    reports: FolderKanban,
    report: FileBarChart,
};

export default function Sidebar({ items = configuredItems }: { items?: NavigationItem[] }) {
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
        } catch {
            return false;
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

    return (

        <nav className="app-sidebar" data-collapsed={collapsed} aria-label="Primary navigation">

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

            <div className="app-sidebar__links" id="primary-navigation-links">

            {items.filter(item => item.visible !== false).map(item => {
                const Icon = icons[item.icon];
                const visibleChildren = item.children?.filter(child => child.visible !== false) ?? [];

                return <div key={item.id} className="app-sidebar__section">

                    {item.route && (
                        <NavLink
                            to={item.route}
                            end={item.route === "/"}
                            title={collapsed ? item.title : undefined}
                            className={({ isActive }) => isActive ? "is-active" : undefined}
                        >
                            <Icon aria-hidden="true" />
                            <span>{item.title}</span>
                        </NavLink>
                    )}

                    {item.children && (

                        <>

                            <h3 title={collapsed ? item.title : undefined}>
                                <Icon aria-hidden="true" />
                                <span>{item.title}</span>
                            </h3>

                            {visibleChildren.map(child => {
                                const ChildIcon = icons[child.icon];
                                const route = child.route ?? (child.reportId ? `/report/${child.reportId}` : "");

                                return route ? <NavLink
                                        key={child.id}
                                        to={route}
                                        title={collapsed ? child.title : undefined}
                                        className={({ isActive }) => isActive ? "is-active app-sidebar__child" : "app-sidebar__child"}
                                    >
                                        <ChildIcon aria-hidden="true" />
                                        <span>{child.title}</span>
                                    </NavLink> : null;

                            })}

                        </>

                    )}

                </div>;

            })}
            </div>

        </nav>

    );

}
