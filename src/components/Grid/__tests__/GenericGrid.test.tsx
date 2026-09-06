import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GridProvider } from "../../../engine/GridContext";
import { defaultColumn, defaultGridOptions } from "../../../engine/GridEngine";
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
        expect(props.defaultColDef).toMatchObject({ resizable: true, suppressMovable: false });
        expect(props.maintainColumnOrder).toBe(true);
        expect(props.suppressMovableColumns).toBe(false);
        expect(props.rowSelection).toBe("multiple");
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

    it("defines resizable and movable defaults", () => {
        expect(defaultColumn).toMatchObject({ resizable: true, suppressMovable: false });
        expect(defaultGridOptions).toMatchObject({
            maintainColumnOrder: true,
            suppressMovableColumns: false,
            suppressDragLeaveHidesColumns: true,
        });
    });
});
