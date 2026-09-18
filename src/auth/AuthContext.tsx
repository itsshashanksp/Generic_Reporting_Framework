import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { clearRequestCache } from "../engine/RequestCache";
import type { AuthSessionSnapshot, AuthState } from "./authTypes";

interface AuthContextValue {
    state: AuthState;
    beginSessionCheck: () => void;
    applySessionSnapshot: (snapshot: AuthSessionSnapshot) => void;
}

const loadingState: AuthState = { status: "loading", user: null };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>(loadingState);
    const stateRef = useRef<AuthState>(loadingState);

    const updateState = useCallback((next: AuthState) => {
        if (identityKey(stateRef.current) !== identityKey(next)) {
            clearRequestCache();
        }
        stateRef.current = next;
        setState(next);
    }, []);

    const beginSessionCheck = useCallback(() => {
        stateRef.current = loadingState;
        setState(loadingState);
    }, []);

    const applySessionSnapshot = useCallback((snapshot: AuthSessionSnapshot) => {
        updateState(snapshot.authenticated
            ? { status: "authenticated", user: snapshot.user }
            : { status: "unauthenticated", user: null });
    }, [updateState]);

    const value = useMemo(() => ({
        state,
        beginSessionCheck,
        applySessionSnapshot,
    }), [state, beginSessionCheck, applySessionSnapshot]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function identityKey(state: AuthState): string {
    return state.status === "authenticated"
        ? `authenticated:${state.user.username}:${String(state.user.isAdmin)}`
        : state.status;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
}
