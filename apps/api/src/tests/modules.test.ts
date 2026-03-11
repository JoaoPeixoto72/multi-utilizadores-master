/**
 * tests/modules.test.ts — Testes unitários para M10 (M10)
 *
 * R: BUILD_PLAN.md §M10
 *
 * Testa:
 *   - modules.config: MODULES array, campos obrigatórios
 *   - lib/module-registry: getRegisteredModules, getModuleById, initTenantModuleLimits
 *   - lib/module-registry: callOnUserDelete, callOnTenantDelete, callOnCronMaintenance (toleram falhas)
 *   - lib/module-registry: callOnRgpdExport (agrega resultados)
 *   - services/rgpd: exportUserData (agrega dados núcleo + actividade + módulos)
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

function makeR2() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [] }),
  };
}

// ── modules.config ────────────────────────────────────────────────────────────

describe("modules.config", () => {
  it("MODULES é um array não vazio", async () => {
    const { MODULES } = await import("../modules.config.js");
    expect(Array.isArray(MODULES)).toBe(true);
    expect(MODULES.length).toBeGreaterThan(0);
  });

  it("todos os módulos têm campos obrigatórios", async () => {
    const { MODULES } = await import("../modules.config.js");
    for (const mod of MODULES) {
      expect(typeof mod.id).toBe("string");
      expect(mod.id.length).toBeGreaterThan(0);
      expect(typeof mod.name_key).toBe("string");
      expect(typeof mod.icon).toBe("string");
      expect(typeof mod.description_key).toBe("string");
      expect(Array.isArray(mod.integrations_required)).toBe(true);
      expect(Array.isArray(mod.permissions)).toBe(true);
      expect(Array.isArray(mod.limits_schema)).toBe(true);
      expect(typeof mod.handlers).toBe("object");
    }
  });

  it("ids são únicos", async () => {
    const { MODULES } = await import("../modules.config.js");
    const ids = MODULES.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("módulo 'core' existe", async () => {
    const { MODULES } = await import("../modules.config.js");
    const core = MODULES.find((m) => m.id === "core");
    expect(core).toBeDefined();
    expect(core?.limits_schema.length).toBeGreaterThan(0);
  });

  it("limits_schema tem key + value + description", async () => {
    const { MODULES } = await import("../modules.config.js");
    for (const mod of MODULES) {
      for (const limit of mod.limits_schema) {
        expect(typeof limit.key).toBe("string");
        expect(typeof limit.value).toBe("string");
        expect(typeof limit.description).toBe("string");
      }
    }
  });
});

// ── lib/module-registry ───────────────────────────────────────────────────────

describe("lib/module-registry", () => {
  describe("getRegisteredModules", () => {
    it("devolve array dos módulos", async () => {
      const { getRegisteredModules } = await import("../lib/module-registry.js");
      const mods = getRegisteredModules();
      expect(Array.isArray(mods)).toBe(true);
      expect(mods.length).toBeGreaterThan(0);
    });
  });

  describe("getModuleById", () => {
    it("devolve módulo existente", async () => {
      const { getModuleById } = await import("../lib/module-registry.js");
      const mod = getModuleById("core");
      expect(mod).not.toBeNull();
      expect(mod?.id).toBe("core");
    });

    it("devolve null para id inexistente", async () => {
      const { getModuleById } = await import("../lib/module-registry.js");
      const mod = getModuleById("non_existent_module_xyz");
      expect(mod).toBeNull();
    });
  });

  describe("initTenantModuleLimits", () => {
    it("corre sem lançar excepção", async () => {
      const db = makeD1() as unknown as D1Database;
      const { initTenantModuleLimits } = await import("../lib/module-registry.js");
      await expect(initTenantModuleLimits(db, "tenant-123")).resolves.toBeUndefined();
    });

    it("chama prepare para cada módulo com limits_schema", async () => {
      const mock = makeD1();
      const db = mock as unknown as D1Database;
      const { initTenantModuleLimits, getRegisteredModules } = await import(
        "../lib/module-registry.js"
      );

      await initTenantModuleLimits(db, "tenant-123");

      const modulesWithLimits = getRegisteredModules().filter((m) => m.limits_schema.length > 0);
      const totalLimits = modulesWithLimits.reduce((acc, m) => acc + m.limits_schema.length, 0);

      expect(mock.prepare).toHaveBeenCalledTimes(totalLimits);
    });

    it("é idempotente — segunda chamada não lança", async () => {
      const db = makeD1() as unknown as D1Database;
      const { initTenantModuleLimits } = await import("../lib/module-registry.js");

      await expect(initTenantModuleLimits(db, "tenant-abc")).resolves.toBeUndefined();
      await expect(initTenantModuleLimits(db, "tenant-abc")).resolves.toBeUndefined();
    });
  });

  describe("getTenantModuleLimits", () => {
    it("devolve defaults quando não há registos", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { getTenantModuleLimits } = await import("../lib/module-registry.js");
      const limits = await getTenantModuleLimits(db, "t1", "core");
      expect(typeof limits).toBe("object");
      // core tem limits_schema com max_users e max_storage_mb
      expect(limits.max_users).toBe("10");
      expect(limits.max_storage_mb).toBe("500");
    });

    it("devolve objecto vazio para módulo inexistente", async () => {
      const db = makeD1([]) as unknown as D1Database;
      const { getTenantModuleLimits } = await import("../lib/module-registry.js");
      const limits = await getTenantModuleLimits(db, "t1", "non_existent_xyz");
      expect(limits).toEqual({});
    });

    it("stored values sobrepõem defaults", async () => {
      const db = makeD1([
        { limit_key: "max_users", limit_value: "50" },
        { limit_key: "max_storage_mb", limit_value: "2000" },
      ]) as unknown as D1Database;
      const { getTenantModuleLimits } = await import("../lib/module-registry.js");
      const limits = await getTenantModuleLimits(db, "t1", "core");
      expect(limits.max_users).toBe("50");
      expect(limits.max_storage_mb).toBe("2000");
    });
  });

  describe("callOnUserDelete", () => {
    it("corre sem lançar mesmo sem handlers", async () => {
      const db = makeD1() as unknown as D1Database;
      const r2 = makeR2() as unknown as R2Bucket;
      const { callOnUserDelete } = await import("../lib/module-registry.js");
      await expect(callOnUserDelete("user-1", "tenant-1", db, r2)).resolves.toBeUndefined();
    });

    it("tolera erro num handler individual", async () => {
      const db = makeD1() as unknown as D1Database;
      const r2 = makeR2() as unknown as R2Bucket;

      // Mock MODULES temporariamente com handler que falha
      const { getRegisteredModules } = await import("../lib/module-registry.js");
      const mods = getRegisteredModules();

      // Adicionar handler que lança ao primeiro módulo temporariamente
      const original = mods[0].handlers.onUserDelete;
      mods[0].handlers.onUserDelete = async () => {
        throw new Error("handler_error");
      };

      const { callOnUserDelete } = await import("../lib/module-registry.js");
      await expect(callOnUserDelete("user-1", "tenant-1", db, r2)).resolves.toBeUndefined(); // não lança

      // Restaurar
      mods[0].handlers.onUserDelete = original;
    });
  });

  describe("callOnTenantDelete", () => {
    it("corre sem lançar mesmo sem handlers", async () => {
      const db = makeD1() as unknown as D1Database;
      const r2 = makeR2() as unknown as R2Bucket;
      const { callOnTenantDelete } = await import("../lib/module-registry.js");
      await expect(callOnTenantDelete("tenant-1", db, r2)).resolves.toBeUndefined();
    });
  });

  describe("callOnCronMaintenance", () => {
    it("corre sem lançar mesmo sem handlers", async () => {
      const db = makeD1() as unknown as D1Database;
      const r2 = makeR2() as unknown as R2Bucket;
      const env = { DB: db, R2_BUCKET: r2, APP_ENV: "production" } as unknown as Env;
      const { callOnCronMaintenance } = await import("../lib/module-registry.js");
      await expect(callOnCronMaintenance(db, r2, env)).resolves.toBeUndefined();
    });
  });

  describe("callOnRgpdExport", () => {
    it("devolve array vazio quando nenhum módulo tem handler", async () => {
      const db = makeD1() as unknown as D1Database;
      const { callOnRgpdExport } = await import("../lib/module-registry.js");
      const results = await callOnRgpdExport("user-1", "tenant-1", db);
      expect(Array.isArray(results)).toBe(true);
    });

    it("inclui error key quando handler lança", async () => {
      const db = makeD1() as unknown as D1Database;

      const { getRegisteredModules, callOnRgpdExport } = await import("../lib/module-registry.js");
      const mods = getRegisteredModules();

      // Injectar handler que falha no primeiro módulo
      const original = mods[0].handlers.onRgpdExport;
      mods[0].handlers.onRgpdExport = async () => {
        throw new Error("rgpd_error");
      };

      const results = await callOnRgpdExport("user-1", "tenant-1", db);

      // O módulo que falhou deve ter entry com error
      const failEntry = results.find((r) => r.module_id === mods[0].id);
      expect(failEntry?.error).toBe("export_failed");

      // Restaurar
      mods[0].handlers.onRgpdExport = original;
    });

    it("agrega resultados de múltiplos handlers com sucesso", async () => {
      const db = makeD1() as unknown as D1Database;

      const { getRegisteredModules, callOnRgpdExport } = await import("../lib/module-registry.js");
      const mods = getRegisteredModules();

      // Injectar handlers em 2 módulos
      const orig0 = mods[0].handlers.onRgpdExport;
      const orig1 = mods[1].handlers.onRgpdExport;

      mods[0].handlers.onRgpdExport = async () => ({ count: 5 });
      mods[1].handlers.onRgpdExport = async () => ({ items: [] });

      const results = await callOnRgpdExport("user-1", "tenant-1", db);
      expect(results.length).toBeGreaterThanOrEqual(2);

      const entry0 = results.find((r) => r.module_id === mods[0].id);
      expect(entry0?.data).toEqual({ count: 5 });

      // Restaurar
      mods[0].handlers.onRgpdExport = orig0;
      mods[1].handlers.onRgpdExport = orig1;
    });
  });
});

// ── services/rgpd (M9+M10) ───────────────────────────────────────────────────

describe("services/rgpd", () => {
  describe("exportUserData", () => {
    it("devolve estrutura correcta sem tenantId", async () => {
      // Mock profile.service.exportRgpd
      vi.doMock("../services/profile.service.js", () => ({
        exportRgpd: vi.fn().mockResolvedValue({
          exported_at: new Date().toISOString(),
          core: { id: "u1", email: "test@test.com" },
          module_data: [],
        }),
      }));

      const db = makeD1([]) as unknown as D1Database;
      const { exportUserData } = await import("../services/rgpd.service.js");

      const result = await exportUserData(db, "user-1", null);
      expect(result.exported_at).toBeDefined();
      expect(result.core).toBeDefined();
      expect(Array.isArray(result.activity)).toBe(true);
      expect(Array.isArray(result.module_data)).toBe(true);
    });

    it("filtra actividade apenas do actor quando tenantId fornecido", async () => {
      vi.doMock("../db/queries/activity-log.js", () => ({
        exportActivityLogByTenant: vi.fn().mockResolvedValue([
          {
            id: 1,
            actor_id: "user-1",
            action: "login",
            target_type: null,
            target_id: null,
            was_temp_owner: 0,
            created_at: 1000,
          },
          {
            id: 2,
            actor_id: "user-2",
            action: "invite",
            target_type: "user",
            target_id: "u3",
            was_temp_owner: 0,
            created_at: 2000,
          },
        ]),
      }));

      vi.doMock("../services/profile.service.js", () => ({
        exportRgpd: vi.fn().mockResolvedValue({
          exported_at: new Date().toISOString(),
          core: { id: "user-1" },
          module_data: [],
        }),
      }));

      const db = makeD1([]) as unknown as D1Database;
      const { exportUserData } = await import("../services/rgpd.service.js");

      const result = await exportUserData(db, "user-1", "tenant-1");
      // Apenas actividade de user-1
      expect(
        result.activity.every(
          (a) => (a as { actor_id?: string }).actor_id === "user-1" || !("actor_id" in a),
        ),
      ).toBe(true);
    });
  });
});
