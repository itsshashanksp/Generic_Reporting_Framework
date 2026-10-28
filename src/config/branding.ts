export interface ApplicationBranding {
    applicationName: string;
    shortName: string;
    browserTitle: string;
    description: string;
    logoUrl: string | null;
    favicon: string | null;
}

export const APPLICATION_BRANDING: Readonly<ApplicationBranding> = {
    applicationName: "Generic Reporting Framework",
    shortName: "Generic Framework",
    browserTitle: "Generic Reporting Framework",
    description: "Generic SQL Reporting and Dashboard Framework",
    logoUrl: null,
    favicon: "/favicon.svg",
} as const;

export function getApplicationPageTitle(
    pageTitle?: string | null,
    branding: Readonly<ApplicationBranding> = APPLICATION_BRANDING,
) {
    const normalizedTitle = pageTitle?.trim();
    return normalizedTitle
        ? `${normalizedTitle} | ${branding.browserTitle}`
        : branding.browserTitle;
}

export function applyApplicationBranding(
    target: Document,
    branding: Readonly<ApplicationBranding> = APPLICATION_BRANDING,
) {
    target.title = getApplicationPageTitle(undefined, branding);

    let description = target.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
        description = target.createElement("meta");
        description.name = "description";
        target.head.append(description);
    }
    description.content = branding.description;

    const faviconLinks = [...target.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const favicon = faviconLinks.shift() ?? target.createElement("link");
    favicon.rel = "icon";
    favicon.href = branding.favicon || "/favicon.svg";
    if (!favicon.isConnected) target.head.append(favicon);
    faviconLinks.forEach(link => link.remove());
}
