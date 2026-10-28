import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import AccessibleDialog from "../AccessibleDialog";

function Harness() {
    const [open, setOpen] = useState(false);
    return <>
        <button onClick={() => setOpen(true)}>Open colors</button>
        {open && <AccessibleDialog title="Customize Chart Colors" className="chart-color-dialog" onClose={() => setOpen(false)}>
            <button>First control</button>
            <button>Last control</button>
        </AccessibleDialog>}
    </>;
}

describe("AccessibleDialog", () => {
    it("closes on Escape, locks page scrolling, and restores opener focus", () => {
        render(<Harness />);
        const opener = screen.getByRole("button", { name: "Open colors" });
        opener.focus();
        fireEvent.click(opener);
        const dialog = screen.getByRole("dialog", { name: "Customize Chart Colors" });
        expect(document.body.style.overflow).toBe("hidden");
        fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.body.style.overflow).toBe("");
        expect(document.activeElement).toBe(opener);
    });

    it("cycles keyboard focus within the dialog", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "Open colors" }));
        const close = screen.getByRole("button", { name: "Close" });
        const last = screen.getByRole("button", { name: "Last control" });
        last.focus();
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
        expect(document.activeElement).toBe(close);
    });
});
