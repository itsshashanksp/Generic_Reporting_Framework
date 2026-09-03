import "./Feedback.css";

interface LoadingSpinnerProps {
    label?: string;
    compact?: boolean;
}

export default function LoadingSpinner({
    label = "Loading…",
    compact = false,
}: LoadingSpinnerProps) {
    return (
        <div
            className={`ui-state${compact ? " ui-state--compact" : ""}`}
            role="status"
            aria-live="polite"
        >
            <span className="ui-spinner" aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
}
