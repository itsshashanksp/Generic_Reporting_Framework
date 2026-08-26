import { apiClient } from "./client";

import type { ApiResponse } from "../types/api";

export async function executeRequest(
    request: object
): Promise<ApiResponse> {
    return apiClient(request);
}
