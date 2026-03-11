/**
 * tests/observability.test.ts — Testes para middleware/observability.ts (M13)
 *
 * R: BUILD_PLAN.md §M13 — trace_id, request logging, error handler, graceful shutdown
 */
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  errorHandler,
  requestLogger,
  traceMiddleware,
  withGracefulShutdown,
} from "../middleware/observability";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", traceMiddleware);
  app.use("*", requestLogger);
  app.onError(errorHandler);
  return app;
}

const mockEnv = {
  DB: {},
  CSRF_SECRET: "test",
  SESSION_SECRET: "test",
  ENCRYPTION_KEY: "test",
  APP_ENV: "test",
  SENTRY_DSN: undefined,
} as unknown as Env;

// ── traceMiddleware ────────────────────────────────────────────────────────────

describe("traceMiddleware", () => {
  it("should add x-trace-id header to response", async () => {
    const app = makeApp();
    app.get("/ping", (c) => c.json({ ok: true }));

    const res = await app.fetch(
      new Request("http://localhost/ping"),
      mockEnv,
      {} as ExecutionContext,
    );
    expect(res.headers.get("x-trace-id")).toBeTruthy();
    expect(res.headers.get("x-trace-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("should propagate incoming X-Trace-Id", async () => {
    const app = makeApp();
    app.get("/ping", (c) => c.json({ traceId: c.get("traceId") }));

    const req = new Request("http://localhost/ping", {
      headers: { "x-trace-id": "aaaaaaaa-0000-0000-0000-bbbbbbbbbbbb" },
    });
    const res = await app.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.headers.get("x-trace-id")).toBe("aaaaaaaa-0000-0000-0000-bbbbbbbbbbbb");
  });
});

// ── requestLogger ──────────────────────────────────────────────────────────────

describe("requestLogger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should log request_start and request_end for 200 response", async () => {
    const app = makeApp();
    app.get("/ok", (c) => c.json({ ok: true }));

    await app.fetch(new Request("http://localhost/ok"), mockEnv, {} as ExecutionContext);

    const calls = consoleSpy.mock.calls.map(
      (args: unknown[]) => JSON.parse(args[0] as string) as Record<string, unknown>,
    );
    const start = calls.find((entry: Record<string, unknown>) => entry.msg === "request_start");
    const end = calls.find((entry: Record<string, unknown>) => entry.msg === "request_end");

    expect(start).toBeDefined();
    expect(start?.method).toBe("GET");
    expect(start?.path).toBe("/ok");
    expect(end).toBeDefined();
    expect(end?.status).toBe(200);
    expect(end?.level).toBe("info");
  });

  it("should log at warn level for 4xx responses", async () => {
    const app = makeApp();
    app.get("/not-found", (c) => c.json({}, 404));

    await app.fetch(new Request("http://localhost/not-found"), mockEnv, {} as ExecutionContext);

    const calls2 = consoleSpy.mock.calls.map(
      (args: unknown[]) => JSON.parse(args[0] as string) as Record<string, unknown>,
    );
    const end = calls2.find((entry: Record<string, unknown>) => entry.msg === "request_end");
    expect(end?.level).toBe("warn");
  });

  it("should not log PII (email) in request path", async () => {
    const app = makeApp();
    app.get("/users/:id", (c) => c.json({ id: c.req.param("id") }));

    await app.fetch(
      new Request("http://localhost/users/user-123"),
      mockEnv,
      {} as ExecutionContext,
    );

    const allLogs = consoleSpy.mock.calls.map((args: unknown[]) => args[0] as string).join(" ");
    // path não deve conter email-like patterns
    expect(allLogs).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  });
});

// ── errorHandler ──────────────────────────────────────────────────────────────

describe("errorHandler", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should return 500 Problem JSON on unhandled error", async () => {
    const app = makeApp();
    app.get("/crash", () => {
      throw new Error("something went wrong");
    });

    const res = await app.fetch(
      new Request("http://localhost/crash"),
      mockEnv,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(500);
    expect(body.title).toBe("Internal Server Error");
    expect(body.trace_id).toBeTruthy();
  });

  it("should log error without PII", async () => {
    const app = makeApp();
    app.get("/leak", () => {
      throw new Error("user email admin@example.com failed");
    });

    await app.fetch(new Request("http://localhost/leak"), mockEnv, {} as ExecutionContext);

    const logs = consoleSpy.mock.calls.map((args: unknown[]) => args[0] as string).join(" ");
    expect(logs).not.toContain("admin@example.com");
    expect(logs).toContain("[REDACTED]");
  });
});

// ── withGracefulShutdown ───────────────────────────────────────────────────────

describe("withGracefulShutdown", () => {
  it("should return the same response as the wrapped fetch", async () => {
    const app = new Hono();
    app.get("/ping", (c) => c.json({ pong: true }));

    const wrapped = withGracefulShutdown(app.fetch as unknown as ExportedHandlerFetchHandler<Env>);

    const waitUntilSpy = vi.fn();
    const ctx = {
      waitUntil: waitUntilSpy,
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    const res = await wrapped(
      new Request("http://localhost/ping") as unknown as Request<
        unknown,
        IncomingRequestCfProperties<unknown>
      >,
      mockEnv,
      ctx,
    );
    expect(res.status).toBe(200);
    expect(waitUntilSpy).toHaveBeenCalledTimes(1);
  });
});
