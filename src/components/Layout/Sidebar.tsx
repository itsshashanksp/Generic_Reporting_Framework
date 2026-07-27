import menu from "../../config/menu.json";
import { Link } from "react-router-dom";

export default function Sidebar() {

    return (

        <div
            style={{
                width: 250,
                borderRight: "1px solid #ddd",
                padding: 20
            }}
        >

            {menu.map((item: any) => (

                <div key={item.id}>

                    {item.route && (
                        <div style={{ marginBottom: 15 }}>
                            <Link to={item.route}>
                                {item.title}
                            </Link>
                        </div>
                    )}

                    {item.children && (

                        <>

                            <h3>{item.title}</h3>

                            {item.children.map((child: any) => (

                                <div
                                    key={child.id}
                                    style={{ marginBottom: 10 }}
                                >
                                    <Link
                                        to={`/report/${child.reportId}`}
                                    >
                                        {child.title}
                                    </Link>
                                </div>

                            ))}

                        </>

                    )}

                </div>

            ))}

        </div>

    );

}