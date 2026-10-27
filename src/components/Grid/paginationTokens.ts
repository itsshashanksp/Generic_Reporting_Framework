export type PageToken = number | "ellipsis-left" | "ellipsis-right";

export function getPageTokens(page: number, totalPages: number): PageToken[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
    if (page >= totalPages - 3) return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "ellipsis-left", page - 1, page, page + 1, "ellipsis-right", totalPages];
}
