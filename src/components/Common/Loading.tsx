import LoadingSpinner from "./LoadingSpinner";

interface LoadingProps {
    label?: string;
    compact?: boolean;
}

export default function Loading({
    label = "Loading report data…",
    compact = false,
}: LoadingProps) {
    return <LoadingSpinner label={label} compact={compact} />;
}
