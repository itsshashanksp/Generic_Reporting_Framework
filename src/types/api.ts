export interface ApiResponse {
    success: boolean;
    message: string;
    executionTime: number;
    rowsReturned: number;
    data: Record<string, unknown>[];
}