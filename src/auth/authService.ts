import type { AuthSessionSnapshot } from "./authTypes";
import { executeRequest } from "../api/request";

export async function getCurrentSession(signal?: AbortSignal): Promise<AuthSessionSnapshot> {
    const response = await executeRequest({ action: "auth.session" }, { signal });
    return parseSessionData(response.data);
}

export async function login(
    username: string,
    password: string,
    signal?: AbortSignal
): Promise<AuthSessionSnapshot> {
    const response = await executeRequest({ action: "auth.login", username, password }, { signal });
    return parseSessionData(response.data);
}

export async function logout(signal?: AbortSignal): Promise<AuthSessionSnapshot> {
    const response = await executeRequest({ action: "auth.logout" }, { signal });
    return parseSessionData(response.data);
}

function parseSessionData(data: Record<string, unknown>[]): AuthSessionSnapshot {
    if (data.length !== 1) {
        throw new Error("The API returned an invalid authentication response.");
    }
    return parseAuthSessionSnapshot(data[0]);
}

/** Validate the identity payload returned by a future backend session endpoint. */
export function parseAuthSessionSnapshot(value: unknown): AuthSessionSnapshot {
    if (typeof value !== "object" || value === null || !("authenticated" in value)) {
        throw new Error("The API returned an invalid authentication response.");
    }

    if (value.authenticated === false) {
        if (!("user" in value) || value.user !== null
            || Object.keys(value).some(key => key !== "authenticated" && key !== "user")) {
            throw new Error("The API returned an invalid authentication response.");
        }
        return { authenticated: false, user: null };
    }
    if (value.authenticated !== true || !("user" in value)
        || Object.keys(value).some(key => key !== "authenticated" && key !== "user")
        || typeof value.user !== "object" || value.user === null
        || Object.keys(value.user).some(key => key !== "username" && key !== "isAdmin")
        || !("username" in value.user) || typeof value.user.username !== "string"
        || value.user.username.trim() === ""
        || !("isAdmin" in value.user) || typeof value.user.isAdmin !== "boolean") {
        throw new Error("The API returned an invalid authentication response.");
    }

    return {
        authenticated: true,
        user: {
            username: value.user.username,
            isAdmin: value.user.isAdmin,
        },
    };
}
