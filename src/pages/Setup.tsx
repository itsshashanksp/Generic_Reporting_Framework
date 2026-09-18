import { useState, type FormEvent } from "react";

import { ApiClientError } from "../api/client";
import { getRequestErrorMessage } from "../api/request";
import { useSetup } from "../setup";

const MINIMUM_PASSWORD_LENGTH = 12;

export default function Setup() {
    const { createAdministrator, submitting } = useSetup();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedUsername = username.trim();
        if (!normalizedUsername) {
            setError("Username is required.");
            return;
        }
        if (password.length < MINIMUM_PASSWORD_LENGTH) {
            setError(`Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (password !== passwordConfirmation) {
            setError("Password confirmation does not match.");
            return;
        }

        setError("");
        try {
            await createAdministrator({
                username: normalizedUsername,
                password,
                passwordConfirmation,
            });
        } catch (submissionError: unknown) {
            const detail = submissionError instanceof ApiClientError
                ? submissionError.details.find(item =>
                    typeof item === "object" && typeof item.message === "string"
                )
                : undefined;
            setError(
                typeof detail === "object" && typeof detail.message === "string"
                    ? detail.message
                    : getRequestErrorMessage(submissionError, "Unable to complete initial setup.")
            );
        }
    };

    return (
        <main className="setup-page">
            <section className="setup-card" aria-labelledby="setup-title">
                <div className="setup-card__heading">
                    <p className="setup-card__eyebrow">Generic Reporting Framework</p>
                    <h1 id="setup-title">Application setup</h1>
                    <p>Create the initial administrator account for this installation.</p>
                </div>

                <form className="setup-form" onSubmit={event => void handleSubmit(event)} noValidate>
                    <label htmlFor="setup-username">
                        Username
                        <input
                            id="setup-username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            maxLength={64}
                            value={username}
                            onChange={event => setUsername(event.target.value)}
                            disabled={submitting}
                            required
                        />
                    </label>

                    <label htmlFor="setup-password">
                        Password
                        <input
                            id="setup-password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={MINIMUM_PASSWORD_LENGTH}
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            disabled={submitting}
                            required
                        />
                    </label>

                    <label htmlFor="setup-password-confirmation">
                        Confirm Password
                        <input
                            id="setup-password-confirmation"
                            name="passwordConfirmation"
                            type="password"
                            autoComplete="new-password"
                            minLength={MINIMUM_PASSWORD_LENGTH}
                            value={passwordConfirmation}
                            onChange={event => setPasswordConfirmation(event.target.value)}
                            disabled={submitting}
                            required
                        />
                    </label>

                    {error && <p className="form-error" role="alert">{error}</p>}

                    <button
                        type="submit"
                        className="app-button app-button--primary setup-form__submit"
                        disabled={submitting}
                    >
                        {submitting ? "Creating administrator…" : "Create Administrator"}
                    </button>
                </form>
            </section>
        </main>
    );
}
