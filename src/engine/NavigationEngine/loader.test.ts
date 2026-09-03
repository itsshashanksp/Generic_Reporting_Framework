import { describe, expect, it } from "vitest";

import { loadNavigation } from "./loader";

describe("loadNavigation", () => {
    it("accepts optional visibility and nested report rows", () => {
        expect(loadNavigation([{
            id: "reports",
            title: "Reports",
            icon: "reports",
            children: [{ id: "customer", title: "Customer", icon: "report", reportId: "customer" }],
        }])[0].visible).toBeUndefined();
    });

    it("rejects invalid visibility configuration", () => {
        expect(() => loadNavigation([{ id: "dashboard", title: "Dashboard", icon: "dashboard", visible: "yes" }]))
            .toThrow("visible must be a boolean");
    });
});
