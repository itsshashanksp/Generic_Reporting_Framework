import { beforeEach, describe, expect, it } from "vitest";

import {
    beginPageDatabaseSession,
    clearPageDatabaseSession,
    ensurePageDatabaseSession,
    readPageDatabaseSelection,
    removePageDatabaseSelection,
    savePageDatabaseSelection,
} from "../pageDatabaseSession";

describe("page database authenticated-session storage", () => {
    beforeEach(() => sessionStorage.clear());

    it("keeps independent report and dashboard choices through browser refresh", () => {
        const marker = ensurePageDatabaseSession();
        expect(savePageDatabaseSelection("dashboard:item", "loyal-3")).toBe(true);
        expect(savePageDatabaseSelection("report:item", "loyal-2")).toBe(true);
        expect(ensurePageDatabaseSession()).toBe(marker);
        expect(readPageDatabaseSelection("dashboard:item")).toBe("loyal-3");
        expect(readPageDatabaseSelection("report:item")).toBe("loyal-2");
    });

    it("clears choices for logout and starts a clean new login session", () => {
        savePageDatabaseSelection("dashboard:item", "loyal-3");
        clearPageDatabaseSession();
        expect(readPageDatabaseSelection("dashboard:item")).toBe("");
        savePageDatabaseSelection("dashboard:item", "loyal-4");
        beginPageDatabaseSession();
        expect(readPageDatabaseSelection("dashboard:item")).toBe("");
    });

    it("rejects invalid ids and removes stale selections", () => {
        expect(savePageDatabaseSelection("dashboard:item", "Not Valid")).toBe(false);
        savePageDatabaseSelection("dashboard:item", "loyal-3");
        removePageDatabaseSelection("dashboard:item");
        expect(readPageDatabaseSelection("dashboard:item")).toBe("");
    });
});
