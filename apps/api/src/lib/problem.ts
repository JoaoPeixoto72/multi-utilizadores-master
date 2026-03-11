/**
 * lib/problem.ts — RFC 7807 Problem Details helper
 *
 * R: STACK_LOCK.md §5, G11 — zero statusCode directo; usar problemResponse()
 * R: R05 — formato de erro RFC 7807
 *
 * Uso:
 *   return problemResponse(c, 422, 'Validation Error', 'Campo email inválido', { field: 'email' })
 */
import type { Context } from "hono";

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

const STATUS_TYPES: Record<number, string> = {
  400: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400",
  401: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401",
  403: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403",
  404: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404",
  409: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409",
  422: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422",
  429: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429",
  500: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500",
  503: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503",
};

export function problemResponse(
  c: Context,
  status: keyof typeof STATUS_TYPES,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
): Response {
  const body: ProblemDetail = {
    type: STATUS_TYPES[status] ?? "about:blank",
    title,
    status,
    ...(detail ? { detail } : {}),
    ...(extra ?? {}),
  };

  return c.json(body, status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503, {
    "Content-Type": "application/problem+json",
  });
}

/**
 * Erros de autenticação genéricos (STACK_LOCK.md §6 — erros_auth)
 * Nunca revelar se email existe, se password está errada, se conta está desactivada
 */
export function authErrorResponse(c: Context): Response {
  return problemResponse(c, 401, "Authentication Failed", "Invalid credentials");
}

/**
 * Erro de autorização (IDOR / permissão insuficiente)
 */
export function forbiddenResponse(c: Context, detail?: string): Response {
  return problemResponse(c, 403, "Forbidden", detail ?? "Insufficient permissions");
}

/**
 * Erro de validação com campos específicos
 */
export function validationErrorResponse(
  c: Context,
  errors: Array<{ field: string; message: string }>,
): Response {
  return problemResponse(c, 422, "Validation Error", "One or more fields are invalid", { errors });
}
