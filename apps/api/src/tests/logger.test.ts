/**
 * tests/logger.test.ts — Testes unitários para lib/logger.ts
 *
 * R: STACK_LOCK.md §17 — JSON estruturado, trace_id, zero PII
 * R: R01 — zero console.log no código (logger é a única excepção)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, getTraceId } from "../lib/logger";

describe("createLogger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should create a logger with all 4 levels", () => {
    const log = createLogger("test-context");
    expect(log.debug).toBeTypeOf("function");
    expect(log.info).toBeTypeOf("function");
    expect(log.warn).toBeTypeOf("function");
    expect(log.error).toBeTypeOf("function");
  });

  it("should log a JSON entry with correct shape on info", () => {
    const log = createLogger("auth");
    log.info({ user_id: "123" }, "login_success");

    expect(consoleSpy).toHaveBeenCalledOnce();
    const raw = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);

    expect(parsed.level).toBe("info");
    expect(parsed.context).toBe("auth");
    expect(parsed.msg).toBe("login_success");
    expect(parsed.user_id).toBe("123");
    expect(parsed.trace_id).toBeTruthy();
    expect(parsed.ts).toBeTruthy();
  });

  it("should log at debug level", () => {
    const log = createLogger("db");
    log.debug({ query: "SELECT 1" }, "health_check");

    const raw = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("debug");
    expect(parsed.context).toBe("db");
  });

  it("should log at warn level", () => {
    const log = createLogger("rate-limit");
    log.warn({ ip: "127.0.0.1" }, "rate_limit_exceeded");

    const raw = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("warn");
  });

  it("should log at error level", () => {
    const log = createLogger("session");
    log.error({ err: "timeout" }, "db_connection_failed");

    const raw = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("error");
    expect(parsed.err).toBe("timeout");
  });

  it("should use provided traceId", () => {
    const traceId = "fixed-trace-id";
    const log = createLogger("context", traceId);
    log.info({}, "test");

    const raw = consoleSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.trace_id).toBe(traceId);
  });

  it("should generate unique traceId when not provided", () => {
    const log1 = createLogger("ctx1");
    const log2 = createLogger("ctx2");

    log1.info({}, "a");
    log2.info({}, "b");

    const tid1 = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string).trace_id;
    const tid2 = JSON.parse(consoleSpy.mock.calls[1]?.[0] as string).trace_id;
    expect(tid1).not.toBe(tid2);
  });

  it("should keep same traceId across multiple calls from same logger", () => {
    const log = createLogger("ctx");
    log.info({}, "first");
    log.info({}, "second");

    const tid1 = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string).trace_id;
    const tid2 = JSON.parse(consoleSpy.mock.calls[1]?.[0] as string).trace_id;
    expect(tid1).toBe(tid2);
  });
});

describe("getTraceId", () => {
  it("should return X-Trace-Id header value when present", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-trace-id": "my-trace-123" },
    });
    const traceId = getTraceId(req);
    expect(traceId).toBe("my-trace-123");
  });

  it("should generate a UUID when header is absent", () => {
    const req = new Request("http://localhost/");
    const traceId = getTraceId(req);
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("should generate unique IDs on each call without header", () => {
    const req = new Request("http://localhost/");
    const id1 = getTraceId(req);
    const id2 = getTraceId(req);
    expect(id1).not.toBe(id2);
  });
});
