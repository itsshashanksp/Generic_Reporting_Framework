interface Props {

    label: string;

    onClick?: () => void;

}

export default function ToolbarButton({

    label,

    onClick,

}: Props) {

    return (

        <button
            onClick={onClick}
            style={{
                padding: "8px 14px",
                cursor: "pointer",
            }}
        >

            {label}

        </button>

    );

}