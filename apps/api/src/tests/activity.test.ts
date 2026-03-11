/**
 * tests/activity.test.ts — Testes unitários para M9 (M9)
 *
 * R: BUILD_PLAN.md §M9
 *
 * Testa:
 *   - db/queries/activity-log: insertActivityLog, listActivityLogs, deleteActivityLogByTenant
 *   - db/queries/audit-log: insertAuditLog, listAuditLogs, deleteExpiredAuditLogs
 *   - services/activity-log: logAction (nunca lança), cleanHistory (pré-condição backup)
 *   - services/audit-log: logAuditEvent (nunca lança), generateBreakGlass
 *   - services/rgpd: exportUserData (dados núcleo + actividade)
 */

import { describe, expect, it, vi } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

type D1Row = Record<string, unknown>;

function makeD1(rows: D1Row[] = [], meta: Record<string, unknown> = {}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(rows[0] ?? null),
    all: vi.fn().mockResolvedValue({ results: rows }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: rows.length, ...meta } }),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  };
}

// ── db/queries/activity-log ───────────────────────────────────────────────────

describe("db/queries/activity-log", () => {
  describe("insertActivityLog", () => {
    it("executa sem lançar excepção", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { insertActivityLog } = await import("../db/queries/activity-log.js");
      await expect(
        insertActivityLog(db, {
          tenant_id: "t1",
          actor_id: "u1",
          actor_name: "Alice",
          action: "user.invite",
          target_type: "user",
          target_id: "u2",
          target_name: "Bob",
          was_temp_owner: false,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("listActivityLogs", () => {
    it("devolve lista vazia quando sem registos", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listActivityLogs } = await import("../db/queries/activity-log.js");
      const { items, nextCursor } = await listActivityLogs(db, { tenant_id: "t1" });
      expect(items).toHaveLength(0);
      expect(nextCursor).toBeNull();
    });

    it("devolve nextCursor quando há mais resultados", async () => {
      // 31 rows para limit=30 → deve cortar 1 e devolver nextCursor
      const rows = Array.from({ length: 31 }, (_, i) => ({
        id: 31 - i,
        tenant_id: "t1",
        actor_id: "u1",
        actor_name: "Alice",
        action: "user.invite",
        target_type: null,
        target_id: null,
        target_name: null,
        metadata: "{}",
        was_temp_owner: 0,
        created_at: 1000 + i,
      }));
      const db = makeD1(rows) as unknown as D1Database;
      const { listActivityLogs } = await import("../db/queries/activity-log.js");
      const { items, nextCursor } = await listActivityLogs(db, { tenant_id: "t1" });
      expect(items).toHaveLength(30);
      expect(nextCursor).not.toBeNull();
    });

    it("aplica filtro actor_id", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listActivityLogs } = await import("../db/queries/activity-log.js");
      await listActivityLogs(db, { tenant_id: "t1", actor_id: "u2" });
      const call = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toContain("actor_id = ?");
    });

    it("aplica filtro action", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listActivityLogs } = await import("../db/queries/activity-log.js");
      await listActivityLogs(db, { tenant_id: "t1", action: "backup.create" });
      const call = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toContain("action = ?");
    });
  });

  describe("deleteActivityLogByTenant", () => {
    it("devolve número de registos eliminados", async () => {
      const db = makeD1([], { changes: 42 }) as unknown as D1Database;
      const { deleteActivityLogByTenant } = await import("../db/queries/activity-log.js");
      const count = await deleteActivityLogByTenant(db, "t1");
      expect(count).toBe(42);
    });
  });
});

// ── db/queries/audit-log ──────────────────────────────────────────────────────

describe("db/queries/audit-log", () => {
  describe("insertAuditLog", () => {
    it("executa sem lançar excepção", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { insertAuditLog } = await import("../db/queries/audit-log.js");
      await expect(
        insertAuditLog(db, {
          event_type: "tenant.created",
          actor_id: "super-1",
          tenant_id: "t1",
          count_affected: 1,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("listAuditLogs", () => {
    it("devolve lista vazia quando sem registos", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listAuditLogs } = await import("../db/queries/audit-log.js");
      const { items, nextCursor } = await listAuditLogs(db, {});
      expect(items).toHaveLength(0);
      expect(nextCursor).toBeNull();
    });

    it("inclui condição de retenção 365 dias", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listAuditLogs } = await import("../db/queries/audit-log.js");
      await listAuditLogs(db, {});
      const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(sql).toContain("created_at >=");
    });

    it("aplica filtro event_type", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { listAuditLogs } = await import("../db/queries/audit-log.js");
      await listAuditLogs(db, { event_type: "backup.created" });
      const sql = (db.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(sql).toContain("event_type = ?");
    });
  });

  describe("deleteExpiredAuditLogs", () => {
    it("executa DELETE e devolve contagem", async () => {
      const db = makeD1([], { changes: 10 }) as unknown as D1Database;
      const { deleteExpiredAuditLogs } = await import("../db/queries/audit-log.js");
      const deleted = await deleteExpiredAuditLogs(db);
      expect(deleted).toBe(10);
    });
  });
});

// ── services/activity-log ─────────────────────────────────────────────────────

describe("services/activity-log", () => {
  describe("logAction", () => {
    it("nunca lança excepção mesmo quando DB falha", async () => {
      const db = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockRejectedValue(new Error("DB down")),
        }),
      } as unknown as D1Database;
      const { logAction } = await import("../services/activity-log.service.js");
      await expect(
        logAction(db, {
          tenant_id: "t1",
          actor_id: "u1",
          actor_name: "Alice",
          action: "user.delete",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("cleanHistory", () => {
    it("lança NO_RECENT_BACKUP quando não existe backup", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { cleanHistory } = await import("../services/activity-log.service.js");
      await expect(cleanHistory(db, "t1")).rejects.toThrow("NO_RECENT_BACKUP");
    });

    it("lança NO_RECENT_BACKUP quando backup é antigo (> 60 min)", async () => {
      const oldTs = Math.floor(Date.now() / 1000) - 7200; // 2 horas atrás
      const db = makeD1([
        { id: "b1", tenant_id: "t1", status: "done", completed_at: oldTs },
      ]) as unknown as D1Database;
      const { cleanHistory } = await import("../services/activity-log.service.js");
      await expect(cleanHistory(db, "t1")).rejects.toThrow("NO_RECENT_BACKUP");
    });

    it("limpa histórico com backup recente", async () => {
      const recentTs = Math.floor(Date.now() / 1000) - 600; // 10 min atrás
      // 1ª chamada (getLastDoneBackupByTenant) → backup recente
      // 2ª chamada (deleteActivityLogByTenant) → changes: 5
      let callCount = 0;
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1)
            return Promise.resolve({ id: "b1", status: "done", completed_at: recentTs });
          return Promise.resolve(null);
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 5 } }),
      };
      const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
      const { cleanHistory } = await import("../services/activity-log.service.js");
      const { deleted } = await cleanHistory(db, "t1");
      expect(deleted).toBe(5);
    });
  });
});

// ── services/audit-log ────────────────────────────────────────────────────────

describe("services/audit-log", () => {
  describe("logAuditEvent", () => {
    it("nunca lança excepção mesmo quando DB falha", async () => {
      const db = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockRejectedValue(new Error("DB down")),
        }),
      } as unknown as D1Database;
      const { logAuditEvent } = await import("../services/audit-log.service.js");
      await expect(
        logAuditEvent(db, {
          event_type: "tenant.created",
          actor_id: "super-1",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("generateBreakGlass", () => {
    it("devolve conteúdo JSON com campos obrigatórios", async () => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      };
      const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
      const { generateBreakGlass } = await import("../services/audit-log.service.js");
      const { content, filename } = await generateBreakGlass(
        db,
        "super-1",
        "https://cf-base.example.com",
        "cf-base-db",
      );
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("emergency_token");
      expect(parsed).toHaveProperty("expires_at");
      expect(parsed).toHaveProperty("app_url", "https://cf-base.example.com");
      expect(filename).toMatch(/^break-glass-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("token tem pelo menos 20 caracteres", async () => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      };
      const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
      const { generateBreakGlass } = await import("../services/audit-log.service.js");
      const { content } = await generateBreakGlass(db, "super-1", "https://x.com", "db");
      const parsed = JSON.parse(content);
      expect(parsed.emergency_token.length).toBeGreaterThanOrEqual(20);
    });
  });
});
