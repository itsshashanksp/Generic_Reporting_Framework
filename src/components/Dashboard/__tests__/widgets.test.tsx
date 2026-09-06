import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import StatWidget from "../StatWidget";
import TableWidget from "../TableWidget";

const { executeRequestMock, genericGridProps } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    genericGridProps: vi.fn(),
}));

vi.mock("../../../api/request", () => ({
    executeRequest: executeRequestMock,
    getRequestErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Request failed",
    isRequestAbort: () => false,
}));

vi.mock("../../Grid/GenericGrid", () => ({
    default: (props: unknown) => {
        genericGridProps(props);
        return <div data-testid="shared-generic-grid" />;
    },
}));

const request = {
    action: "select" as const,
    source: { table: "ItemMasterTable" },
    fields: ["Item_Code", "Item_Desc"],
};

describe("dashboard widgets", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset();
        genericGridProps.mockClear();
    });

    it("renders dashboard tables through GenericGrid with presentation columns", async () => {
        executeRequestMock.mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Item_Code: "A1", Item_Desc: "Alpha" }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        });
        const columns = [
            { field: "Item_Code", header: "Item Code" },
            { field: "Item_Desc", header: "Item Description" },
        ];
        render(
            <DashboardProvider>
                <TableWidget title="Items" request={request} columns={columns} pageSize={10} />
            </DashboardProvider>
        );

        await waitFor(() => expect(screen.getByTestId("shared-generic-grid")).toBeTruthy());
        const props = genericGridProps.mock.calls.at(-1)?.[0];
        expect(props.columns.map((column: { field: string }) => column.field)).toEqual(["Item_Code", "Item_Desc"]);
        expect(props.serverPagination).toMatchObject({ page: 1, pageSize: 10, totalRows: 1 });
        expect(executeRequestMock).toHaveBeenCalledTimes(1);
    });

    it("uses dashboard valueField and formatting for columnless stat widgets", async () => {
        executeRequestMock.mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ TotalItems: 1234, Ignored: 9 }],
        });
        render(
            <DashboardProvider>
                <StatWidget title="Total Items" request={request} valueField="TotalItems" format="number" />
            </DashboardProvider>
        );
        expect(await screen.findByText("1,234")).toBeTruthy();
    });
});
