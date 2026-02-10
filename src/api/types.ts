export type ApiRow = Record<string, unknown>;

export type ApiResponse<T> = {
  data: T[];
  page: number;      // 1-based
  pageSize: number;
  total: number;     // total de registros (sem paginação)
};

export type FilterOp = "contains" | "equals" | "startsWith" | "word" | "regex";
