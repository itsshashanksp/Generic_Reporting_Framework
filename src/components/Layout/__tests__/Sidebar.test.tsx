import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import Sidebar from "../Sidebar";
import type { NavigationItem } from "../../../types/navigation";

const items: NavigationItem[] = [
    { id: "dashboard", title: "Dashboard", icon: "dashboard", route: "/" },
    {
        id: "reports", title: "Reports", icon: "reports", children: [
            { id: "customer", title: "Customer Report", icon: "report", reportId: "customer" },
            { id: "item", title: "Item Report", icon: "report", reportId: "item" },
        ],
    },
];

describe("Sidebar", () => {
    beforeEach(() => localStorage.clear());

    it("renders branding and nested report navigation", () => {
        render(<MemoryRouter><Sidebar items={items} /></MemoryRouter>);
        expect(screen.getByText("Generic Reporting Framework")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Reports" }));
        expect(screen.getByRole("link", { name: "Customer Report" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Item Report" })).toBeTruthy();
    });

    it("keeps labels mounted while collapsing the navigation", () => {
        const { container } = render(<MemoryRouter><Sidebar items={items} /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
        expect(container.querySelector("nav")?.getAttribute("data-collapsed")).toBe("true");
        expect(screen.getByText("Dashboard")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
    });
});
