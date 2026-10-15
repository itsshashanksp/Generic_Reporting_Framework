import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GridProvider } from "../../../engine/GridContext";
import type { ColumnDefinition } from "../../../types/column";
import type { GridConfig } from "../../../types/report";
import GenericGrid from "../GenericGrid";

const columns: ColumnDefinition[] = [
    { field: "Code", header: "Item Code", visible: true, sortable: true },
    { field: "Amount", header: "Amount", visible: true, sortable: true, dataType: "number" },
];
const gridConfig: GridConfig = { pagination: { enabled: false, pageSize: 10 }, rowSelection: "multiple" };

describe("GenericGrid on AG Grid Community", () => {
    it("renders headers and formatted rows without Enterprise modules or console errors", async () => {
        const consoleError = vi.spyOn(console, "error");

        render(
            <GridProvider>
                <GenericGrid rows={[{ Code: "A1", Amount: 1234567 }]} columns={columns} gridConfig={gridConfig} />
            </GridProvider>
        );

        expect((await screen.findAllByText("Item Code")).length).toBeGreaterThan(0);
        expect((await screen.findAllByText("A1")).length).toBeGreaterThan(0);
        expect((await screen.findAllByText("12,34,567")).length).toBeGreaterThan(0);
        expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/enterprise|license/i);
    });
});
