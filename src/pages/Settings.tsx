import { ArrowRight, Database, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import { useAuth } from "../auth";
import { useOptionalGlobalDatabase } from "../engine/DatabaseContext";
import Skeleton from "../components/Common/Skeleton";

export default function Settings() {
    const { state } = useAuth();
    const globalDatabase = useOptionalGlobalDatabase();
    const isAdmin = state.status === "authenticated" && state.user.frontendRole === "application-administrator";
    const [draft, setDraft] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const savedDatabase = globalDatabase?.database ?? "";
    const selection = draft ?? savedDatabase;
    const hasChanges = draft !== null && draft !== savedDatabase;

    const saveDatabase = async () => {
        if (!globalDatabase) return;
        setSaveState("saving");
        await Promise.resolve();
        const saved = globalDatabase.save(selection);
        setSaveState(saved ? "saved" : "error");
        if (saved) setDraft(null);
    };

    return (
        <main className="settings-page">
            <header className="settings-header">
                <p className="settings-eyebrow">Application</p>
                <h1>Settings</h1>
                <p>Manage application configuration and administration.</p>
            </header>

            <section className="settings-grid" aria-label="Available settings">
                {globalDatabase && (
                    <article className="settings-option settings-option--database">
                        <div className="settings-option__icon"><Database aria-hidden="true" /></div>
                        <div className="settings-option__content">
                            <h2>Database Selection</h2>
                            <p>Set the frontend default used when a report, dashboard, or widget does not specify a database.</p>
                            {globalDatabase.registry.status === "loading" ? (
                                <div className="settings-database-form" aria-busy="true">
                                    <Skeleton kind="filter" label="Loading database settings…" />
                                    <Skeleton kind="text" label="Loading database setting details…" />
                                </div>
                            ) : globalDatabase.registry.status === "failed" ? (
                                <div role="alert">
                                    <p>{globalDatabase.registry.error}</p>
                                    <button type="button" className="app-button" onClick={globalDatabase.registry.retry}>Try again</button>
                                </div>
                            ) : (
                                <div className="settings-database-form">
                                    <label>
                                        <span>Default Database</span>
                                        <select value={selection} onChange={event => { setDraft(event.target.value); setSaveState("idle"); }}>
                                            <option value="">Use Backend Default</option>
                                            {globalDatabase.registry.options.map(option => (
                                                <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="settings-database-form__help">
                                        This browser-local setting is the frontend default. Explicit JSON databases take precedence, and a page-level selector can override the effective default for that page.
                                    </p>
                                    {globalDatabase.configuredDatabase && !globalDatabase.database && (
                                        <p role="alert">The saved database is no longer authorized or available. Backend default is being used.</p>
                                    )}
                                    <div className="settings-option__action">
                                        <button
                                            type="button"
                                            className="app-button app-button--primary"
                                            onClick={() => void saveDatabase()}
                                            disabled={!hasChanges || saveState === "saving"}
                                        >
                                            {saveState === "saving" ? "Saving…" : "Save Changes"}
                                        </button>
                                        {hasChanges && saveState === "idle" && <p role="status">Unsaved changes</p>}
                                        {saveState === "saved" && <p role="status">Changes saved.</p>}
                                        {saveState === "error" && <p role="alert">The database selection could not be saved.</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </article>
                )}
                {isAdmin && (
                    <article className="settings-option settings-option--users">
                        <div className="settings-option__icon"><Users aria-hidden="true" /></div>
                        <div className="settings-option__content">
                            <h2>User Management</h2>
                            <p>Create and manage application users and administrator access.</p>
                            <div className="settings-option__action">
                                <Link className="settings-option__link" to="/settings/users">
                                    Open User Management <ArrowRight aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    </article>
                )}
            </section>
            {!globalDatabase && !isAdmin && (
                <section className="settings-empty" aria-labelledby="settings-empty-title">
                    <h2 id="settings-empty-title">No settings are available for your account</h2>
                    <p>Additional settings will appear here when they are available to you.</p>
                </section>
            )}
        </main>
    );
}
