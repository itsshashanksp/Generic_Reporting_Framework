interface Props {

    value: string;

    onChange: (value: string) => void;

}

export default function SearchBox({

    value,

    onChange,

}: Props) {

    return (

        <input

            type="text"

            placeholder="Search..."

            value={value}

            onChange={(e) => onChange(e.target.value)}

            style={{
                padding: "8px",
                width: "250px",
            }}

        />

    );

}