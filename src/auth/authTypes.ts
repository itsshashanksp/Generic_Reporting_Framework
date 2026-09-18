export interface AuthUser {
    username: string;
    isAdmin: boolean;
}

export type AuthState =
    | { status: "loading"; user: null }
    | { status: "unauthenticated"; user: null }
    | { status: "authenticated"; user: AuthUser };

export type AuthSessionSnapshot =
    | { authenticated: false; user: null }
    | { authenticated: true; user: AuthUser };
