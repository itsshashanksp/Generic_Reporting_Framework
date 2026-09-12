import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExportMenu from "../ExportMenu";

describe("ExportMenu", () => {
    it("runs an export option and provides a working cancel action", () => {
        const exportRows = vi.fn();
        render(
            <ExportMenu
                options={[{ id: "csv", label: "Current view — CSV", onSelect: exportRows }]}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Current view — CSV" }));
        expect(exportRows).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("menu")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Cancel" }));
        expect(exportRows).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("menu")).toBeNull();
    });

    it("closes from the responsive backdrop without exporting", () => {
        const exportRows = vi.fn();
        render(
            <ExportMenu
                options={[{ id: "csv", label: "CSV", onSelect: exportRows }]}
                menuLabel="Report actions"
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("button", { name: "Close report actions" }));
        expect(exportRows).not.toHaveBeenCalled();
        expect(screen.queryByRole("menu")).toBeNull();
    });

    it.each([320, 375, 390, 412])("portals the mobile action sheet outside clipping ancestors at %ipx", width => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
        vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
            matches: query === "(max-width: 720px)" && width <= 720,
        })));
        const { container } = render(
            <div data-testid="clipping-parent" style={{ overflow: "hidden", transform: "translateZ(0)" }}>
                <ExportMenu
                    options={[{ id: "csv", label: "CSV", onSelect: vi.fn() }]}
                    mobileTriggerLabel="More"
                />
            </div>
        );

        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        const menu = screen.getByRole("menu");
        expect(container.contains(menu)).toBe(false);
        expect(menu.parentElement).toBe(document.body);
        fireEvent.click(screen.getByRole("menuitem", { name: "Cancel" }));
        expect(screen.queryByRole("menu")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(screen.getByRole("menu").parentElement).toBe(document.body);
    });
});
