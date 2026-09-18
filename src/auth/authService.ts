import type { AuthSessionSnapshot } from "./authTypes";

/** Validate the identity payload returned by a future backend session endpoint. */
export function parseAuthSessionSnapshot(value: unknown): AuthSessionSnapshot {
    if (typeof value !== "object" || value === null || !("authenticated" in value)) {
        throw new Error("The API returned an invalid authentication response.");
    }

    if (value.authenticated === false) {
        if (Object.keys(value).some(key => key !== "authenticated")) {
            throw new Error("The API returned an invalid authentication response.");
        }
        return { authenticated: false };
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
