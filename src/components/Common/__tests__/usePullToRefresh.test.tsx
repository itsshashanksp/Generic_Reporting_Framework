import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import usePullToRefresh from "../usePullToRefresh";

function PullTarget({ onRefresh }: { onRefresh: () => void }) {
    const { containerRef, pullDistance, armed } = usePullToRefresh({ onRefresh });
    return (
        <main ref={containerRef} data-distance={pullDistance} data-armed={armed}>
            Report
        </main>
    );
}

describe("usePullToRefresh", () => {
    it("refreshes only after a deliberate downward mobile pull at the page top", () => {
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
        document.documentElement.scrollTop = 0;
        const onRefresh = vi.fn();
        render(<PullTarget onRefresh={onRefresh} />);
        const target = screen.getByRole("main");

        fireEvent.touchStart(target, { touches: [{ clientX: 20, clientY: 10 }] });
        fireEvent.touchMove(target, { touches: [{ clientX: 20, clientY: 55 }] });
        fireEvent.touchEnd(target);
        expect(onRefresh).not.toHaveBeenCalled();

        fireEvent.touchStart(target, { touches: [{ clientX: 20, clientY: 10 }] });
        fireEvent.touchMove(target, { touches: [{ clientX: 22, clientY: 170 }] });
        expect(target.getAttribute("data-armed")).toBe("true");
        fireEvent.touchEnd(target);

        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("ignores horizontal gestures", () => {
        vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
        document.documentElement.scrollTop = 0;
        const onRefresh = vi.fn();
        render(<PullTarget onRefresh={onRefresh} />);
        const target = screen.getByRole("main");

        fireEvent.touchStart(target, { touches: [{ clientX: 10, clientY: 10 }] });
        fireEvent.touchMove(target, { touches: [{ clientX: 180, clientY: 90 }] });
        fireEvent.touchEnd(target);

        expect(onRefresh).not.toHaveBeenCalled();
    });
});
