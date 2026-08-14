const API_URL = import.meta.env.VITE_API_URL;

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