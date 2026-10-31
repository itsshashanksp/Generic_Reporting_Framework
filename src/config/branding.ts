export interface ApplicationBranding {
    applicationName: string;
    shortName: string;
    browserTitle: string;
    description: string;
    favicon: string | null;
}

export const APPLICATION_BRANDING: Readonly<ApplicationBranding> = {
  applicationName: "Reporting Dashboard",
  shortName: "Sigma Reporting",
  browserTitle: "Sigma Reporting Framework",
  description:
    "An open-source, configurable reporting and analytics framework for interactive dashboards, data visualization, and business reporting.",
  favicon: "https://avatars.githubusercontent.com/u/350623603?s=96&v=4",
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
