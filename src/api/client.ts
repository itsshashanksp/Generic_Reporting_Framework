const API_URL = "http://localhost/Backend/api/index.php";

export async function apiClient(body: object) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
    }

    return response.json();
}