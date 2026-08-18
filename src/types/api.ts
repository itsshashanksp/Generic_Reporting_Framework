export interface ApiResponse {
    success: boolean;
    message: string;
    executionTime: number;
    rowsReturned: number;
    totalRows: number;
    data: Record<string, unknown>[];
}