const DISPLAY_SIGNIFICANT_DIGITS = 15;

/**
 * Formats finite numeric values for display without changing the source value.
 * Fifteen significant digits retain useful JavaScript-number precision while
 * removing the least-significant binary noise exposed by arithmetic.
 */
export function formatNumberForDisplay(value: number): string {
    if (!Number.isFinite(value)) return String(value);

    if (Number.isInteger(value)) {
        return value.toLocaleString("en-IN");
    }

    const normalized = Number(value.toPrecision(DISPLAY_SIGNIFICANT_DIGITS));
    return normalized.toLocaleString("en-IN", {
        maximumSignificantDigits: DISPLAY_SIGNIFICANT_DIGITS,
    });
}
