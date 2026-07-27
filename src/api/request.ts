import { apiClient } from "./client";

export async function executeRequest(request: object) {
    return apiClient(request);
}