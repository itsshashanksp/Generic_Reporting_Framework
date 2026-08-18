export function parseResponse(response: any) {

    if (!response?.success) {
        return {
            rows: [],
            columns: []
        };
    }

    const rows = response.data ?? [];

    return {
        rows,
    };
}