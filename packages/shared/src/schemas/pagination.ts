/**
 * schemas/pagination.ts — Cursor-based pagination schemas
 *
 * R: STACK_LOCK.md §16 G12 — zero OFFSET; cursor-based obrigatório
 * R: R07 — cursor pagination
 */
import { z } from "zod";

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  total?: number;
}
