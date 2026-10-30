function editDistance(left: string, right: string) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        let diagonal = previous[0];
        previous[0] = leftIndex;
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const above = previous[rightIndex];
            previous[rightIndex] = Math.min(
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + 1,
                diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
            );
            diagonal = above;
        }
    }
    return previous[right.length];
}

export function unknownPropertyMessage(label: string, property: string, allowed: readonly string[]) {
    const normalized = property.toLowerCase();
    const candidate = allowed
        .map(value => ({ value, distance: editDistance(normalized, value.toLowerCase()) }))
        .sort((left, right) => left.distance - right.distance || left.value.localeCompare(right.value))[0];
    const threshold = Math.max(1, Math.floor(property.length / 3));
    const suggestion = candidate && candidate.distance <= threshold ? ` Did you mean "${candidate.value}"?` : "";
    return `${label} contains unknown property "${property}".${suggestion}`;
}
