export type SetupState =
    | { status: "loading"; error: null }
    | { status: "required"; error: null }
    | { status: "complete"; error: null }
    | { status: "error"; error: string };

export interface InitialAdminRequest {
    username: string;
    password: string;
    passwordConfirmation: string;
}
