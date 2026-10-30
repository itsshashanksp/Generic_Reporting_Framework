import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReportTableFrame from "../../Grid/ReportTableFrame";
import DashboardWidgetFrame from "../DashboardWidgetFrame";

describe("shared dashboard widget header", () => {
    it("keeps chart-style headings and actions in the shared two-column header", () => {
        const { container } = render(
            <DashboardWidgetFrame
                title="Total Sales Month Wise"
                description="Sales by calendar month with a deliberately long description."
                actions={<><button type="button">Filter</button><button type="button">Export</button></>}
            >
                <div>Chart</div>
            </DashboardWidgetFrame>,
        );

        const header = container.querySelector(".dashboard-widget-header");
        const heading = header?.querySelector(".dashboard-widget-header__heading");
        const actions = header?.querySelector(".dashboard-widget-header__actions");

        expect(header).not.toBeNull();
        expect(heading?.querySelector("h2")?.textContent).toBe("Total Sales Month Wise");
        expect(heading?.querySelector("h2")?.getAttribute("title")).toBe("Total Sales Month Wise");
        expect(heading?.querySelector("p")?.textContent).toContain("Sales by calendar month");
        expect(actions?.querySelectorAll("button")).toHaveLength(2);
        expect(header?.children[0]).toBe(heading);
        expect(header?.children[1]).toBe(actions);
    });

    it("uses the same header contract for standard and reporting table widgets", () => {
        const { container } = render(
            <ReportTableFrame
                title="Purchases Month Wise"
                description="Purchases grouped by month."
                actions={<button type="button">Export</button>}
            >
                <div>Grid</div>
            </ReportTableFrame>,
        );

        const header = container.querySelector(".dashboard-widget-header.report-table-frame__header");
        expect(header?.querySelector(".dashboard-widget-header__heading.report-table-frame__heading")).not.toBeNull();
        expect(header?.querySelector(".dashboard-widget-header__actions.report-table-frame__actions")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    });

    it("reserves refresh status inside the action group without changing header structure", () => {
        const { container, rerender } = render(
            <DashboardWidgetFrame title="Sales" refreshing={false} actions={<button type="button">Export</button>}>
                <div>Chart</div>
            </DashboardWidgetFrame>,
        );
        const initialHeader = container.querySelector(".dashboard-widget-header");
        const initialActions = initialHeader?.querySelector(".dashboard-widget-header__actions");
        expect(initialActions?.children).toHaveLength(2);

        rerender(
            <DashboardWidgetFrame title="Sales" refreshing actions={<button type="button">Export</button>}>
                <div>Chart</div>
            </DashboardWidgetFrame>,
        );

        const refreshedHeader = container.querySelector(".dashboard-widget-header");
        expect(refreshedHeader).toBe(initialHeader);
        expect(refreshedHeader?.querySelector(".dashboard-widget-header__actions")?.children).toHaveLength(2);
        expect(screen.getByRole("status").textContent).toBe("Refreshing…");
    });
});
