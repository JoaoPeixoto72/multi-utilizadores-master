/**
 * packages/shared/src/index.ts — Exports partilhados
 *
 * Tipos e schemas Zod partilhados entre apps/api e apps/web.
 * Zero dependências de runtime (apenas Zod).
 */

export * from "./schemas/common";
export * from "./schemas/pagination";
export * from "./types/roles";
