import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BrandIdentity from "../../components/Layout/BrandIdentity";
import useDocumentTitle from "../../components/Layout/useDocumentTitle";
import {
    APPLICATION_BRANDING,
    applyApplicationBranding,
    getApplicationPageTitle,
    type ApplicationBranding,
} from "../branding";

const customBranding: ApplicationBranding = {
    applicationName: "A Configurable Reporting Application With A Long Name",
    shortName: "Configurable App",
    browserTitle: "Configured Browser Brand",
    description: "Configured application description",
    favicon: "/branding/favicon.ico",
};

function TitleHarness({ title }: { title?: string }) {
    useDocumentTitle(title);
    return <span>{title ?? "Application"}</span>;
}

describe("application branding", () => {
    it("provides the default public application branding", () => {
        expect(APPLICATION_BRANDING.applicationName.trim()).not.toBe("");
        expect(APPLICATION_BRANDING.browserTitle.trim()).not.toBe("");
    });

    it("builds default, custom, and fallback browser titles", () => {
        expect(getApplicationPageTitle()).toBe(APPLICATION_BRANDING.browserTitle);
        expect(getApplicationPageTitle("Item Dashboard")).toBe(`Item Dashboard | ${APPLICATION_BRANDING.browserTitle}`);
        expect(getApplicationPageTitle("Dashboard", customBranding)).toBe("Dashboard | Configured Browser Brand");
        expect(getApplicationPageTitle("  ", customBranding)).toBe("Configured Browser Brand");
    });

    it("renders the configured application name without requiring a logo asset", () => {
        render(<BrandIdentity branding={customBranding} />);
        expect(screen.getByText(customBranding.applicationName)).toBeTruthy();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("applies one configurable favicon and description metadata entry", () => {
        const target = document.implementation.createHTMLDocument();
        target.head.append(target.createElement("link"), target.createElement("link"));
        target.head.querySelectorAll("link").forEach(link => { link.rel = "icon"; });

        applyApplicationBranding(target, customBranding);

        expect(target.title).toBe(customBranding.browserTitle);
        expect(target.head.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
        expect(target.head.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute("href")).toBe(customBranding.favicon);
        expect(target.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(customBranding.description);
    });

    it("updates page titles without leaving a stale title after navigation or unmount", () => {
        const { rerender, unmount } = render(<TitleHarness title="Login" />);
        expect(document.title).toBe(`Login | ${APPLICATION_BRANDING.browserTitle}`);

        rerender(<TitleHarness title="Settings" />);
        expect(document.title).toBe(`Settings | ${APPLICATION_BRANDING.browserTitle}`);

        rerender(<TitleHarness />);
        expect(document.title).toBe(APPLICATION_BRANDING.browserTitle);

        act(() => unmount());
        expect(document.title).toBe(APPLICATION_BRANDING.browserTitle);
    });
});
