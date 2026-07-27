export function parseResponse(response: any) {

    if (!response?.success) {
        return {
            rows: [],
            columns: []
        };
    }

    const rows = response.data ?? [];

    const columns =
        rows.length > 0
            ? Object.keys(rows[0]).map((key) => ({
                  field: key,
                  sortable: true,
                  filter: true,
                  resizable: true,
              }))
            : [];

    return {
        rows,
        columns,
    };
}