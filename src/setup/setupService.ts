import { executeRequest } from "../api/request";
import type { InitialAdminRequest } from "./setupTypes";

export async function getSetupStatus(signal?: AbortSignal): Promise<boolean> {
    const response = await executeRequest({ action: "setup.status" }, { signal });
    return parseInitialized(response.data);
}

export async function createInitialAdministrator(
    request: InitialAdminRequest,
    signal?: AbortSignal
): Promise<void> {
    const response = await executeRequest({
        action: "setup.createAdmin",
        username: request.username,
        password: request.password,
        passwordConfirmation: request.passwordConfirmation,
    }, { signal });

    if (!parseInitialized(response.data)) {
        throw new Error("The API did not complete application setup.");
    }
}

function parseInitialized(data: Record<string, unknown>[]): boolean {
    if (data.length !== 1
        || Object.keys(data[0]).some(key => key !== "initialized")
        || typeof data[0].initialized !== "boolean") {
        throw new Error("The API returned an invalid setup response.");
    }
    return data[0].initialized;
}
