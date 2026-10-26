/** Configured defaults are resolved without mutating the authored request. */
export function resolveConfiguredDatabase(
    explicitDatabase: string | undefined,
    globalDatabase: string | undefined
) {
    return explicitDatabase || globalDatabase || "";
}
