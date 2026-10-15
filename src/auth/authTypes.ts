export interface AuthUser {
    username: string;
    backendRole: "read-only" | "data-operator" | "system-administrator" | null;
    frontendAccess: boolean;
    frontendRole: "application-administrator" | null;
}

export interface ManagedAuthUser {
    name: string | null;
    username: string;
    mobile: string | null;
    email: string | null;
    enabled: boolean;
    backendRole: "read-only" | "data-operator" | "system-administrator" | null;
    frontendAccess: boolean;
    frontendRole: "application-administrator" | null;
    backendProtected: boolean;
    createdAt: string;
}

export interface CreateUserRequest {
    name: string;
    username: string;
    mobile: string;
    email: string | null;
    password: string;
    passwordConfirmation: string;
    role: "read-only" | "data-operator" | "application-administrator";
}

export type AuthState =
    | { status: "loading"; user: null }
    | { status: "unauthenticated"; user: null }
    | { status: "authenticated"; user: AuthUser };

export type AuthSessionSnapshot =
    | { authenticated: false; user: null }
    | { authenticated: true; user: AuthUser };
