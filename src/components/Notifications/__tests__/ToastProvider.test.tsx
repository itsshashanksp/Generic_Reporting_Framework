import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast, type ToastType } from "../ToastProvider";

function Controls() {
    const toast = useToast();
    const show = (type: ToastType) => toast.notify(type, `${type} message`);
    return <>
        {(["success", "error", "warning", "info"] as const).map(type => (
            <button key={type} onClick={() => show(type)}>{type}</button>
        ))}
    </>;
}

describe("ToastProvider", () => {
    afterEach(() => vi.useRealTimers());

    it("shows all notification types, supports multiples, dismissal, and deduplication", () => {
        render(<ToastProvider><Controls /></ToastProvider>);
        fireEvent.click(screen.getByRole("button", { name: "success" }));
        fireEvent.click(screen.getByRole("button", { name: "error" }));
        fireEvent.click(screen.getByRole("button", { name: "warning" }));
        fireEvent.click(screen.getByRole("button", { name: "info" }));
        fireEvent.click(screen.getByRole("button", { name: "success" }));

        expect(screen.getByLabelText("Notifications").children).toHaveLength(4);
        expect(screen.getByText("error message").closest("[role=alert]")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Dismiss warning message" }));
        expect(screen.queryByText("warning message")).toBeNull();
    });

    it("automatically dismisses transient notifications", () => {
        vi.useFakeTimers();
        render(<ToastProvider><Controls /></ToastProvider>);
        fireEvent.click(screen.getByRole("button", { name: "success" }));
        expect(screen.getByText("success message")).not.toBeNull();
        act(() => vi.advanceTimersByTime(4000));
        expect(screen.queryByText("success message")).toBeNull();
    });
});
