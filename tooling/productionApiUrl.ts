/**
 * Production bundles must reach the API on the deployed origin (normally
 * `/api`). A loopback URL taken from a developer `.env` would otherwise be
 * compiled into the bundle and fail in production.
 *
 * The value is checked exactly as `src/api/client.ts` uses it:
 * `VITE_API_URL || "/api"`, without trimming.
 */
export function getProductionApiUrlError(apiUrl: string | undefined): string | null {
    const value = apiUrl || "/api";
    if (value !== value.trim()) {
        return `VITE_API_URL "${value}" has surrounding whitespace.`;
    }
    // A single leading slash is a same-origin path; "//host" is protocol-relative.
    if (value.startsWith("/") && !value.startsWith("//")) return null;

    let url: URL;
    try {
        url = new URL(value.startsWith("//") ? `https:${value}` : value);
    } catch {
        return `VITE_API_URL "${value}" is not a valid URL. Use a same-origin path such as /api.`;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return `VITE_API_URL "${value}" must be an http(s) URL or a same-origin path such as /api.`;
    }
    if (isLoopbackHost(url.hostname)) {
        return `VITE_API_URL "${value}" points to a loopback host and cannot be used in a production build. `
            + "Set VITE_API_URL=/api (see .env.production) or build with a non-production --mode.";
    }
    return null;
}

/** Hostnames as normalized by the WHATWG URL parser (lowercase, canonical IPs). */
function isLoopbackHost(hostname: string): boolean {
    const host = hostname.replace(/\.+$/, "");
    return host === "localhost"
        || host.endsWith(".localhost")
        || /^127\.\d+\.\d+\.\d+$/.test(host)
        || host === "0.0.0.0"
        || host === "[::1]"
        || host === "[::]"
        || /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host);
}
