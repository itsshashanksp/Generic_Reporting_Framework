export const UIState = {
    LOADING: "loading",
    SUCCESS: "success",
    EMPTY: "empty",
    ERROR: "error",
} as const;

export type UIState =
    (typeof UIState)[keyof typeof UIState];