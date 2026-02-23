export type ApiResponse = {
  message: string;
  data?: Record<string, any> | Record<string, any>[];
};

export type PaginationMeta = {
  totalDocs: number;
  skip: number;
  page: number;
  totalPages: number;
  limit: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
};

export type PaginationResponse<T> = {
  meta: PaginationMeta;
  docs: T[];
};

/**
 * Helper function to build pagination metadata
 * @param totalDocs - Total number of documents matching the query
 * @param page - Current page number (1-indexed)
 * @param limit - Number of items per page
 * @returns PaginationMeta object with all pagination details
 */
export function buildPaginationMeta(
  totalDocs: number,
  page: number,
  limit: number,
): PaginationMeta {
  const skip = (page - 1) * limit;
  const totalPages = Math.ceil(totalDocs / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    totalDocs,
    skip,
    page,
    totalPages,
    limit,
    hasPrevPage,
    hasNextPage,
    prevPage: hasPrevPage ? page - 1 : null,
    nextPage: hasNextPage ? page + 1 : null,
  };
}
