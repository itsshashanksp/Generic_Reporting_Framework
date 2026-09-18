import { useState, type FormEvent } from "react";

import { getRequestErrorMessage } from "../api/request";
import { useAuth } from "../auth";

export default function Login() {
    const { login, error: sessionError } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedUsername = username.trim();
        if (!normalizedUsername || !password) {
            setError("Username and password are required.");
            return;
        }

        setError("");
        setSubmitting(true);
        try {
            await login(normalizedUsername, password);
        } catch (requestError: unknown) {
            setError(getRequestErrorMessage(requestError, "Unable to sign in."));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="setup-page">
            <section className="setup-card" aria-labelledby="login-title">
                <div className="setup-card__heading">
                    <p className="setup-card__eyebrow">Generic Reporting Framework</p>
                    <h1 id="login-title">Sign in</h1>
                    <p>Use your application account to continue.</p>
                </div>

                <form className="setup-form" onSubmit={event => void handleSubmit(event)} noValidate>
                    <label htmlFor="login-username">
                        Username
                        <input
                            id="login-username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            maxLength={64}
                            value={username}
                            onChange={event => setUsername(event.target.value)}
                            disabled={submitting}
                            autoFocus
                            required
                        />
                    </label>

                    <label htmlFor="login-password">
                        Password
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            disabled={submitting}
                            required
                        />
                    </label>

                    {(error || sessionError) && (
                        <p className="form-error" role="alert">{error || sessionError}</p>
                    )}

                    <button
                        type="submit"
                        className="app-button app-button--primary setup-form__submit"
                        disabled={submitting}
                    >
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </section>
        </main>
    );
}
