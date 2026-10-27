import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import ChartWidget from "../ChartWidget";

const mocks = vi.hoisted(() => ({
    executeRequest: vi.fn(), exportPng: vi.fn(), exportSvg: vi.fn(), exportCsv: vi.fn(), exportExcel: vi.fn(),
}));
vi.mock("../../../api/request", () => ({
    executeRequest: mocks.executeRequest,
    getRequestErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
    isRequestAbort: () => false,
}));
vi.mock("../../../engine/ExportEngine", () => ({
    exportChartPNG: mocks.exportPng,
    exportChartSVG: mocks.exportSvg,
    exportRowsCSV: mocks.exportCsv,
    exportExcel: mocks.exportExcel,
}));
vi.mock("recharts", () => {
    const container = ({ children }: { children: ReactNode }) => <div data-testid="responsive-chart">{children}</div>;
    const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
    return {
        ResponsiveContainer: container,
        BarChart: ({ children, layout, data }: { children: ReactNode; layout?: string; data: unknown[] }) => <svg data-testid="bar-chart" data-layout={layout ?? "horizontal"} data-count={data.length}>{children}</svg>,
        LineChart: ({ children, data }: { children: ReactNode; data: unknown[] }) => <svg data-testid="line-chart" data-count={data.length}>{children}</svg>,
        PieChart: ({ children }: { children: ReactNode }) => <svg data-testid="pie-chart">{children}</svg>,
        Pie: ({ children, innerRadius }: { children: ReactNode; innerRadius?: string | number }) => <g data-testid="pie" data-inner-radius={innerRadius}>{children}</g>,
        Bar: passthrough, Line: passthrough, Cell: () => null, Label: ({ value }: { value: string }) => <text>{value}</text>,
        CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
    };
});

const request = { action: "select" as const, source: { table: "Sales" }, fields: ["Category", "Amount"] };
const response = (data: Record<string, unknown>[]) => ({ success: true, message: "ok", data, meta: { page: null, pageSize: null, totalRows: data.length, rowsReturned: data.length, executionTime: 1 } });

describe("modern chart widget", () => {
    beforeEach(() => {
        clearRequestCache();
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.exportPng.mockResolvedValue(undefined);
        mocks.exportExcel.mockResolvedValue(undefined);
    });

    it("renders donut totals, horizontal bars, and line charts from existing chart types", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 7 }, { Category: "B", Amount: 3 }]));
        const { rerender } = render(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="pie" chartOptions={{ appearance: "donut", showCenterTotal: true }} /></DashboardProvider>);
        expect(await screen.findByTestId("pie")).toBeTruthy();
        expect(screen.getByTestId("pie").getAttribute("data-inner-radius")).toBe("46%");
        expect(screen.getByText("10")).toBeTruthy();

        rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="bar" chartOptions={{ orientation: "horizontal" }} /></DashboardProvider>);
        expect(await screen.findByTestId("bar-chart")).toBeTruthy();
        expect(screen.getByTestId("bar-chart").getAttribute("data-layout")).toBe("vertical");

        rerender(<DashboardProvider><ChartWidget title="Sales" request={request} xField="Category" yField="Amount" chartType="line" chartOptions={{ smooth: true, showPoints: true }} /></DashboardProvider>);
        expect(await screen.findByTestId("line-chart")).toBeTruthy();
    });

    it("explains negative and zero-only pie data without misrepresenting it", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "Loss", Amount: -2 }]));
        const view = render(<DashboardProvider><ChartWidget title="Losses" request={request} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByText("Pie chart cannot display negative values")).toBeTruthy();
        expect(screen.queryByTestId("pie-chart")).toBeNull();

        mocks.executeRequest.mockResolvedValue(response([{ Category: "None", Amount: 0 }]));
        view.rerender(<DashboardProvider><ChartWidget title="Zero" request={{ ...request, database: "other" }} xField="Category" yField="Amount" chartType="pie" /></DashboardProvider>);
        expect(await screen.findByText("No positive pie values")).toBeTruthy();
    });

    it("exports displayed graphics but complete filtered source rows for tabular formats", async () => {
        mocks.executeRequest.mockResolvedValue(response([
            { Category: "=Formula", Amount: 10 }, { Category: "B", Amount: 8 }, { Category: "C", Amount: -2 },
        ]));
        render(
            <DashboardProvider>
                <ChartWidget title="Sales Chart" request={request} xField="Category" yField="Amount" chartType="bar"
                    chartOptions={{ topN: 1, showOthers: true }}
                    exportConfig={{ enabled: true, formats: ["png", "svg", "csv", "excel"], filename: "sales-chart" }} />
            </DashboardProvider>
        );
        await screen.findByTestId("bar-chart");
        const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Export" }));
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "Displayed chart — PNG" }));
        await waitFor(() => expect(mocks.exportPng).toHaveBeenCalledWith(expect.any(HTMLElement), "sales-chart.png"));
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: "Complete filtered source — CSV" }));
        expect(mocks.exportCsv).toHaveBeenCalledWith([
            { Category: "=Formula", Amount: 10 }, { Category: "B", Amount: 8 }, { Category: "C", Amount: -2 },
        ], "sales-chart.csv");
    });

    it("hides disabled export and surfaces export failures", async () => {
        mocks.executeRequest.mockResolvedValue(response([{ Category: "A", Amount: 1 }]));
        const view = render(<DashboardProvider><ChartWidget title="No Export" request={request} xField="Category" yField="Amount" exportConfig={{ enabled: false, formats: ["png"] }} /></DashboardProvider>);
        await screen.findByTestId("bar-chart");
        expect(screen.queryByRole("button", { name: "Export" })).toBeNull();

        mocks.exportSvg.mockImplementation(() => { throw new Error("SVG failed"); });
        view.rerender(<DashboardProvider><ChartWidget title="Export" request={request} xField="Category" yField="Amount" exportConfig={{ enabled: true, formats: ["svg"] }} /></DashboardProvider>);
        fireEvent.click(await screen.findByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Displayed chart — SVG" }));
        expect(await screen.findByText("SVG failed")).toBeTruthy();
    });
});
