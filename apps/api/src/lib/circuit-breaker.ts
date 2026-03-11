/**
 * lib/circuit-breaker.ts — Circuit breaker para chamadas externas (M7)
 *
 * R: BUILD_PLAN.md §M7.2
 * R: STACK_LOCK.md §18 — Timeout ≤500ms, backoff exponencial, max 3 retries
 *
 * Padrão: CLOSED → OPEN (após falhas) → HALF_OPEN (após cooldown) → CLOSED
 *
 * Uso:
 *   const result = await withCircuitBreaker(() => fetch(...), { name: 'resend' });
 */

export interface CircuitBreakerOptions {
  name: string; // nome para logging
  timeoutMs?: number; // timeout por tentativa (default: 5000ms)
  maxRetries?: number; // tentativas máximas (default: 3)
  retryDelayMs?: number; // delay base exponencial (default: 200ms)
}

export class CircuitBreakerError extends Error {
  constructor(
    public readonly code: "timeout" | "max_retries" | "circuit_open",
    message: string,
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

// Estado em memória (por Worker instance — Cloudflare Workers são stateless entre requests)
// Suficiente para evitar cascata no mesmo request; persistência via D1 se necessário no futuro.
const circuitState = new Map<string, { failures: number; openUntil: number }>();

const MAX_FAILURES = 5;
const OPEN_DURATION_MS = 30_000; // 30s cooldown

function getState(name: string) {
  if (!circuitState.has(name)) {
    circuitState.set(name, { failures: 0, openUntil: 0 });
  }
  // biome-ignore lint/style/noNonNullAssertion: garantido pelo has() acima
  return circuitState.get(name)!;
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new CircuitBreakerError("timeout", `Timeout após ${timeoutMs}ms`)),
      timeoutMs,
    );
    fn()
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  opts: CircuitBreakerOptions,
): Promise<T> {
  const { name, timeoutMs = 5000, maxRetries = 3, retryDelayMs = 200 } = opts;
  const state = getState(name);

  // Verificar se o circuito está aberto
  if (state.openUntil > Date.now()) {
    throw new CircuitBreakerError(
      "circuit_open",
      `Circuit breaker "${name}" aberto até ${new Date(state.openUntil).toISOString()}`,
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fn, timeoutMs);
      // Sucesso — resetar falhas
      state.failures = 0;
      state.openUntil = 0;
      return result;
    } catch (err) {
      lastError = err;

      // Incrementar falhas
      state.failures += 1;

      // Abrir circuito se atingir limite
      if (state.failures >= MAX_FAILURES) {
        state.openUntil = Date.now() + OPEN_DURATION_MS;
      }

      // Não fazer retry em timeout do circuito aberto
      if (err instanceof CircuitBreakerError && err.code === "circuit_open") {
        throw err;
      }

      // Backoff exponencial entre retries
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** (attempt - 1)));
      }
    }
  }

  throw lastError;
}
