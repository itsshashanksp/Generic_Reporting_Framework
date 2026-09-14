import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GridProvider } from "../../../engine/GridContext";
import { defaultColumn, defaultGridOptions } from "../../../engine/GridEngine";
import { getContentMinWidth } from "../../../engine/GridEngine/contentWidth";
import GenericGrid from "../GenericGrid";

const { agGridProps } = vi.hoisted(() => ({ agGridProps: vi.fn() }));

vi.mock("ag-grid-react", () => ({
    AgGridReact: (props: unknown) => {
        agGridProps(props);
        return <div data-testid="ag-grid" />;
    },
}));

const columns = [
    { field: "Code", header: "Item Code", visible: true, sortable: true, width: 150 },
    { field: "Description", header: "Item Description", visible: true, sortable: true, width: 240 },
];
const gridConfig = {
    pagination: { enabled: true, pageSize: 25, pageSizeOptions: [25, 50] },
    rowSelection: "multiple" as const,
};

describe("GenericGrid shared configuration", () => {
    beforeEach(() => agGridProps.mockClear());

    it("preserves configured column order and labels", () => {
        render(<GridProvider><GenericGrid rows={[{ Code: "A", Description: "Alpha" }]} columns={columns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];
        expect(props.columnDefs.map((column: { field: string }) => column.field)).toEqual(["Code", "Description"]);
        expect(props.columnDefs.map((column: { headerName: string }) => column.headerName)).toEqual(["Item Code", "Item Description"]);
        expect(props.columnDefs.map((column: { initialWidth: number }) => column.initialWidth)).toEqual([150, 240]);
        expect(props.columnDefs.every((column: { minWidth: number }) => column.minWidth >= 150)).toBe(true);
        expect(props.defaultColDef).toMatchObject({ resizable: true, suppressMovable: false });
        expect(props.maintainColumnOrder).toBe(true);
        expect(props.suppressMovableColumns).toBe(false);
        expect(props.rowSelection).toBe("multiple");
    });

    it("formats numeric cells without changing row data", () => {
        const rows = [{ Code: 0.30000000000000004, Description: "Calculated" }];
        render(<GridProvider><GenericGrid rows={rows} columns={columns} gridConfig={gridConfig} /></GridProvider>);
        const props = agGridProps.mock.calls.at(-1)?.[0];

        expect(props.columnDefs[0].valueFormatter({ value: rows[0].Code })).toBe("0.3");
        expect(rows[0].Code).toBe(0.30000000000000004);
        expect(screen.getByLabelText("Item Code: 0.3")).toBeTruthy();
    });

    it("exposes working server pagination controls", () => {
        const onPageChange = vi.fn();
        const onPageSizeChange = vi.fn();
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "A" }]}
                    columns={columns}
                    gridConfig={gridConfig}
                    serverPagination={{ page: 2, pageSize: 25, totalRows: 100, onPageChange, onPageSizeChange }}
                />
            </GridProvider>
        );
        fireEvent.click(screen.getByLabelText("First page"));
        fireEvent.click(screen.getByLabelText("Previous page"));
        fireEvent.click(screen.getByLabelText("Next page"));
        fireEvent.click(screen.getByLabelText("Last page"));
        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
        expect(onPageChange.mock.calls.map(call => call[0])).toEqual([1, 1, 3, 4]);
        expect(onPageSizeChange).toHaveBeenCalledWith(50);
        expect(screen.getByText(/Page/).textContent).toContain("2");
    });

    it("paginates client-side rows in the shared mobile presentation", () => {
        const rows = Array.from({ length: 12 }, (_, index) => ({
            Code: `A${index + 1}`,
            Description: `Item ${index + 1}`,
        }));
        render(
            <GridProvider>
                <GenericGrid
                    rows={rows}
                    columns={columns}
                    gridConfig={{
                        ...gridConfig,
                        pagination: { enabled: true, pageSize: 10, pageSizeOptions: [10, 25] },
                    }}
                />
            </GridProvider>
        );

        const records = screen.getByRole("listbox", { name: "Report records" });
        expect(within(records).getAllByRole("option")).toHaveLength(10);
        fireEvent.click(screen.getByLabelText("Next page"));
        expect(within(records).getAllByRole("option")).toHaveLength(2);
        expect(screen.getByText(/Page/).textContent).toContain("2");
    });

    it("defines resizable and movable defaults", () => {
        expect(defaultColumn).toMatchObject({
            initialFlex: 1,
            minWidth: 150,
            resizable: true,
            suppressMovable: false,
        });
        expect(defaultColumn).not.toHaveProperty("flex");
        expect(defaultGridOptions).toMatchObject({
            maintainColumnOrder: true,
            suppressMovableColumns: false,
            suppressDragLeaveHidesColumns: true,
        });
    });

    it("calculates independent content minimums for arbitrary fields", () => {
        const rows = [{
            Code: "A",
            Description: "A description that is much longer than the other values",
            Category: "Tools",
        }];
        const measureText = (value: string) => value.length * 8;

        expect(getContentMinWidth(rows, "Code", "Code", true, measureText)).toBe(150);
        expect(getContentMinWidth(rows, "Category", "Category", true, measureText)).toBe(150);
        expect(getContentMinWidth(rows, "Description", "Description", true, measureText)).toBeGreaterThan(400);
    });

    it("renders every configured field in the generic mobile record presentation", () => {
        const mobileColumns = [
            ...columns,
            { field: "Active", header: "Active", visible: true, sortable: true, width: 150 },
            { field: "Stock", header: "Stock", visible: true, sortable: true, width: 150 },
        ];
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: "A1", Description: "Alpha", Active: true, Stock: null, Hidden: "not configured" }]}
                    columns={mobileColumns}
                    gridConfig={gridConfig}
                />
            </GridProvider>
        );

        const record = within(screen.getByRole("listbox", { name: "Report records" })).getByRole("option");
        expect(within(record).getByLabelText("Item Code: A1")).toBeTruthy();
        expect(within(record).getByLabelText("Item Description: Alpha")).toBeTruthy();
        expect(record.textContent).toContain("ActiveYes");
        expect(record.textContent).toContain("Stock—");
        expect(record.textContent).not.toContain("not configured");

        fireEvent.click(record);
        expect(record.getAttribute("aria-selected")).toBe("true");
    });

    it("keeps non-descriptive columns in compact labeled detail rows", () => {
        render(
            <GridProvider>
                <GenericGrid
                    rows={[{ Code: 1, Total: 42 }]}
                    columns={[
                        { field: "Code", header: "Code", visible: true, sortable: true },
                        { field: "Total", header: "Total", visible: true, sortable: true },
                    ]}
                    gridConfig={gridConfig}
                />
            </GridProvider>
        );

        const record = within(screen.getByRole("listbox", { name: "Report records" })).getByRole("option");
        expect(record.querySelector(".mobile-report-record__secondary")).toBeNull();
        expect(record.querySelector(".mobile-report-record__details")?.textContent).toContain("Total42");
    });
});
