export function validateReport(
    report: unknown
): boolean {
    if (typeof report !== "object" || report === null || Array.isArray(report)) return false;
    const value = report as Record<string, unknown>;
    if (
        typeof value.id !== "string" || !value.id.trim()
        || typeof value.title !== "string" || !value.title.trim()
        || typeof value.request !== "object" || value.request === null || Array.isArray(value.request)
    ) return false;

    if (value.toolbar !== undefined) {
        if (typeof value.toolbar !== "object" || value.toolbar === null || Array.isArray(value.toolbar)) return false;
        const toolbar = value.toolbar as Record<string, unknown>;
        for (const field of ["search", "export", "refresh", "settings", "saveReport"]) {
            if (toolbar[field] !== undefined && typeof toolbar[field] !== "boolean") return false;
        }
    }
    return true;
}
