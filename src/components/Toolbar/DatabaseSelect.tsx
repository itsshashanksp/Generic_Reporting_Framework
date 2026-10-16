import type { DatabaseOption } from "./useDatabaseSelection";

export interface DatabaseSelectProps {
    /** "" while no database is selected (listing failed, or none available). */
    value: string;
    options: DatabaseOption[];
    disabled?: boolean;
    onChange: (database: string) => void;
}

/** Runtime logical-database switch shared by reports and dashboards. */
export default function DatabaseSelect({ value, options, disabled = false, onChange }: DatabaseSelectProps) {
    // Disabled when no other database can actually be chosen.
    const nothingElse = !options.some(option => !option.disabled && option.id !== value);
    return (
        <label className="report-toolbar__database">
            <span>Database</span>
            <select
                value={value}
                disabled={disabled || nothingElse}
                title={nothingElse ? "No other database is available" : undefined}
                onChange={event => {
                    const next = options.find(option => option.id === event.target.value);
                    if (next && !next.disabled && next.id !== value) onChange(next.id);
                }}
            >
                {!value && <option value="" disabled>Choose a database</option>}
                {options.map(option => (
                    <option key={option.id} value={option.id} disabled={option.disabled}>{option.label}</option>
                ))}
            </select>
        </label>
    );
}
