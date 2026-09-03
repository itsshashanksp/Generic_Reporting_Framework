interface Props {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
}

export default function ToolbarButton({

    label,
    onClick,
    disabled = false,
    title,
}: Props) {
    return (
        <button
            type="button"
            className="app-button"
            onClick={onClick}
            disabled={disabled || !onClick}
            title={title}
        >
            {label}
        </button>
    );
}
