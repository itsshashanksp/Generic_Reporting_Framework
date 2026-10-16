import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider } from "../../engine/GridContext";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

type GridProps = {
    columns: { field: string; width?: number }[];
    personalization?: {
        hiddenFields: string[];
        onColumnOrderChange: (fields: string[]) => void;
        onColumnWidthsChange: (widths: Record<string, number>) => void;
    };
};

const { executeRequestMock, gridProps, signedIn, reportOverride } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    gridProps: vi.fn<(props: GridProps) => void>(),
    signedIn: { username: "alice" as string | null },
    reportOverride: { toolbarColumns: undefined as boolean | undefined },
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../auth", async importOriginal => ({
    ...await importOriginal<typeof import("../../auth")>(),
    useAuthenticatedUsername: () => signedIn.username,
}));

vi.mock("../../engine/ReportEngine/reportLoader", async importOriginal => {
    const actual = await importOriginal<typeof import("../../engine/ReportEngine/reportLoader")>();
    return {
        ...actual,
        getReport: (id: string) => {
            const report = actual.getReport(id);
            return report && reportOverride.toolbarColumns !== undefined
                ? { ...report, toolbar: { ...report.toolbar, columns: reportOverride.toolbarColumns } }
                : report;
        },
    };
});

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: (props: GridProps) => {
        gridProps(props);
        return <div data-testid="report-grid" />;
    },
}));

const STORAGE_KEY = "generic-report-column-layout:user:alice:report:item";
const lastGrid = () => gridProps.mock.calls.at(-1)![0];
const gridOrder = () => lastGrid().columns.map(column => column.field);

async function renderItemReport() {
    const view = render(
        <MemoryRouter initialEntries={["/reports/item"]}>
            <GridProvider>
                <FilterProvider>
                    <Routes>
                        <Route path="/reports/:reportId" element={<ReportViewer />} />
                    </Routes>
                </FilterProvider>
            </GridProvider>
        </MemoryRouter>
    );
    await screen.findByTestId("report-grid");
    return view;
}

function openChooser() {
    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    return screen.getByRole("dialog", { name: "Columns — Item Report" });
}

describe("ReportViewer column personalization", () => {
    beforeEach(() => {
        localStorage.clear();
        clearRequestCache();
        gridProps.mockClear();
        signedIn.username = "alice";
        reportOverride.toolbarColumns = undefined;
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Item_Code: 1, Item_Desc: "Pen", Item_MRP: 10 }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("starts from the configured columns and offers no reset", async () => {
        await renderItemReport();
        expect(gridOrder()).toEqual(["Item_Code", "Item_Desc", "Item_MRP"]);
        expect(lastGrid().personalization?.hiddenFields).toEqual([]);

        const dialog = openChooser();
        expect(within(dialog).getAllByRole("checkbox").map(box => (box as HTMLInputElement).checked)).toEqual([true, true, true]);
        expect((within(dialog).getByRole("button", { name: "Reset columns" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("hides a column, keeps one visible, and remembers the choice", async () => {
        await renderItemReport();
        const dialog = openChooser();

        fireEvent.click(within(dialog).getByRole("checkbox", { name: "Item Description" }));
        expect(lastGrid().personalization?.hiddenFields).toEqual(["Item_Desc"]);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).hidden).toEqual(["Item_Desc"]);

        fireEvent.click(within(dialog).getByRole("checkbox", { name: "Item Code" }));
        const last = within(dialog).getByRole("checkbox", { name: "Item MRP" }) as HTMLInputElement;
        expect(last.disabled).toBe(true);
        expect(within(dialog).getByText("At least one column must stay visible.")).toBeTruthy();
    });

    it("reorders with the move buttons", async () => {
        await renderItemReport();
        const dialog = openChooser();

        fireEvent.click(within(dialog).getByRole("button", { name: "Move Item MRP up" }));
        expect(gridOrder()).toEqual(["Item_Code", "Item_MRP", "Item_Desc"]);
        expect((within(dialog).getByRole("button", { name: "Move Item Code up" }) as HTMLButtonElement).disabled).toBe(true);
        expect((within(dialog).getByRole("button", { name: "Move Item Description down" }) as HTMLButtonElement).disabled).toBe(true);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).order).toEqual(["Item_Code", "Item_MRP", "Item_Desc"]);
    });

    it("saves grid drags and resizes", async () => {
        await renderItemReport();

        act(() => lastGrid().personalization!.onColumnOrderChange(["Item_MRP", "Item_Code", "Item_Desc"]));
        act(() => lastGrid().personalization!.onColumnWidthsChange({ Item_Code: 260, Item_MRP: 90 }));

        expect(gridOrder()).toEqual(["Item_MRP", "Item_Code", "Item_Desc"]);
        expect(lastGrid().columns.find(column => column.field === "Item_Code")?.width).toBe(260);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
            order: ["Item_MRP", "Item_Code", "Item_Desc"],
            hidden: [],
            widths: { Item_Code: 260, Item_MRP: 90 },
        });
    });

    it("restores the layout on the next visit, for the same user only", async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: ["Item_Desc"], hidden: ["Item_MRP"], widths: { Item_Desc: 300 } }));

        const first = await renderItemReport();
        expect(gridOrder()).toEqual(["Item_Desc", "Item_Code", "Item_MRP"]);
        expect(lastGrid().personalization?.hiddenFields).toEqual(["Item_MRP"]);
        first.unmount();

        signedIn.username = "bob";
        await renderItemReport();
        expect(gridOrder()).toEqual(["Item_Code", "Item_Desc", "Item_MRP"]);
        expect(lastGrid().personalization?.hiddenFields).toEqual([]);
    });

    it("resets to the configured layout and forgets the stored one", async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: ["Item_MRP"], hidden: ["Item_Code"], widths: { Item_Desc: 300 } }));
        await renderItemReport();
        const dialog = openChooser();

        fireEvent.click(within(dialog).getByRole("button", { name: "Reset columns" }));

        expect(gridOrder()).toEqual(["Item_Code", "Item_Desc", "Item_MRP"]);
        expect(lastGrid().personalization?.hiddenFields).toEqual([]);
        expect(lastGrid().columns.find(column => column.field === "Item_Desc")?.width).toBe(150);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("closes with Done", async () => {
        await renderItemReport();
        const dialog = openChooser();
        fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it.each([
        ["no user is signed in", () => { signedIn.username = null; }],
        ["the report sets toolbar.columns to false", () => { reportOverride.toolbarColumns = false; }],
    ])("offers no column chooser when %s", async (_label, arrange) => {
        arrange();
        await renderItemReport();
        expect(screen.queryByRole("button", { name: "Columns" })).toBeNull();
        expect(lastGrid().personalization).toBeUndefined();
    });
});
