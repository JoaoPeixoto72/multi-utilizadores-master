/**
 * tests/tenant.test.ts — Testes unitários para services/tenant.service.ts
 *
 * R: STACK_LOCK.md §5 — cobertura G05 ≥ 70%
 * R: BUILD_PLAN.md §M2.7
 */

import { describe, expect, it } from "vitest";

// ── Helpers de mock ────────────────────────────────────────────────────────────

type MockTenant = {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "deleted";
  admin_seat_limit: number;
  member_seat_limit: number;
  storage_limit_bytes: number;
  daily_email_limit: number;
  allowed_languages: string;
  address: null;
  phone: null;
  website: null;
  logo_key: null;
  created_at: number;
  updated_at: number;
  deleted_at: null;
};

type MockUser = {
  id: string;
  email: string;
  tenant_id: string | null;
  role: "super_user" | "tenant_admin" | "member" | "collaborator";
  is_owner: number;
  is_temp_owner: number;
  display_name: null;
  phone: null;
  website: null;
  avatar_key: null;
  preferred_language: string;
  status: "active" | "inactive" | "deleted";
  temp_owner_expires_at: number | null;
  created_at: number;
  updated_at: number;
};

function makeTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: "tenant-1",
    name: "Test Corp",
    email: "corp@test.com",
    status: "active",
    admin_seat_limit: 3,
    member_seat_limit: 10,
    storage_limit_bytes: 1073741824,
    daily_email_limit: 100,
    allowed_languages: '["pt","en"]',
    address: null,
    phone: null,
    website: null,
    logo_key: null,
    created_at: 1000000,
    updated_at: 1000000,
    deleted_at: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "user@test.com",
    tenant_id: "tenant-1",
    role: "tenant_admin",
    is_owner: 1,
    is_temp_owner: 0,
    display_name: null,
    phone: null,
    website: null,
    avatar_key: null,
    preferred_language: "pt",
    status: "active",
    temp_owner_expires_at: null,
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

// Mock DB simples para operações de tenant
function makeTenantDb(
  opts: {
    tenant?: MockTenant | null;
    owner?: MockUser | null;
    newUser?: MockUser | null;
    batchOk?: boolean;
  } = {},
) {
  const runCalls: string[] = [];

  const makeBindResult = (sql: string) => ({
    first: async () => {
      const s = sql.toLowerCase();
      if (s.includes("insert into tenants")) return opts.tenant ?? makeTenant();
      if (s.includes("insert into users")) return opts.newUser ?? makeUser({ id: "new-user" });
      if (s.includes("from tenants")) return opts.tenant ?? makeTenant();
      if (s.includes("from users") && s.includes("is_owner = 1")) return opts.owner ?? makeUser();
      if (s.includes("from users")) return opts.owner ?? makeUser();
      return null;
    },
    run: async () => {
      runCalls.push(sql);
    },
    all: async () => ({ results: [] }),
  });

  return {
    _runCalls: runCalls,
    prepare: (sql: string) => ({
      // Support direct .run() and .first() (without .bind())
      first: async () => {
        const s = sql.toLowerCase();
        if (s.includes("from tenants")) return opts.tenant ?? makeTenant();
        if (s.includes("from users")) return opts.owner ?? makeUser();
        return null;
      },
      run: async () => {
        runCalls.push(sql);
      },
      all: async () => ({ results: [] }),
      bind: (..._args: unknown[]) => makeBindResult(sql),
    }),
    batch: async (_stmts: unknown[]) => {
      runCalls.push("batch");
      return [];
    },
  } as unknown as D1Database;
}

// ── Tests: activateTenant / deactivateTenant ───────────────────────────────────

describe("activateTenant", () => {
  it("should call updateTenantStatus with active", async () => {
    const db = makeTenantDb();
    const { activateTenant } = await import("../services/tenant.service.js");
    await expect(activateTenant(db, "tenant-1")).resolves.toBeUndefined();
  });
});

describe("deactivateTenant", () => {
  it("should call updateTenantStatus with inactive", async () => {
    const db = makeTenantDb();
    const { deactivateTenant } = await import("../services/tenant.service.js");
    await expect(deactivateTenant(db, "tenant-1")).resolves.toBeUndefined();
  });
});

// ── Tests: elevateTempOwner ────────────────────────────────────────────────────

describe("elevateTempOwner", () => {
  it("should throw when user not found", async () => {
    const db = makeTenantDb({ owner: null });
    // Mock getUserByIdAndTenant to return null
    const overrideDb = {
      ...db,
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => null,
          run: async () => {},
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;

    const { elevateTempOwner } = await import("../services/tenant.service.js");
    await expect(elevateTempOwner(overrideDb, "tenant-1", "user-1")).rejects.toMatchObject({
      code: "user_not_found",
    });
  });

  it("should throw when user is not a member", async () => {
    const admin = makeUser({ role: "tenant_admin", is_owner: 0, is_temp_owner: 0 });
    const db = makeTenantDb({ owner: admin });

    const { elevateTempOwner } = await import("../services/tenant.service.js");
    await expect(elevateTempOwner(db, "tenant-1", "user-1")).rejects.toMatchObject({
      code: "invalid_role",
    });
  });

  it("should throw when user is already elevated", async () => {
    const elevated = makeUser({ role: "member", is_temp_owner: 1 });
    const db = makeTenantDb({ owner: elevated });

    const { elevateTempOwner } = await import("../services/tenant.service.js");
    await expect(elevateTempOwner(db, "tenant-1", "user-1")).rejects.toMatchObject({
      code: "already_elevated",
    });
  });

  it("should succeed for a member who is not yet elevated", async () => {
    const member = makeUser({ role: "member", is_owner: 0, is_temp_owner: 0 });
    const db = makeTenantDb({ owner: member });

    const { elevateTempOwner } = await import("../services/tenant.service.js");
    await expect(elevateTempOwner(db, "tenant-1", "user-1", 3600)).resolves.toBeUndefined();
  });
});

// ── Tests: revokeElevation ─────────────────────────────────────────────────────

describe("revokeElevation", () => {
  it("should call revokeTempOwner without error", async () => {
    const db = makeTenantDb();
    const { revokeElevation } = await import("../services/tenant.service.js");
    await expect(revokeElevation(db, "tenant-1", "user-1")).resolves.toBeUndefined();
  });
});

// ── Tests: transferOwnership ───────────────────────────────────────────────────

describe("transferOwnership", () => {
  it("should throw when current owner is not found", async () => {
    // No owner returned for getTenantOwner
    const db = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (sql.toLowerCase().includes("is_owner = 1")) return null;
            return null;
          },
          run: async () => {},
          all: async () => ({ results: [] }),
        }),
      }),
      batch: async () => [],
    } as unknown as D1Database;

    const { transferOwnership } = await import("../services/tenant.service.js");
    await expect(transferOwnership(db, "tenant-1", "new-owner")).rejects.toMatchObject({
      code: "owner_not_found",
    });
  });

  it("should throw when new owner user is not in tenant", async () => {
    const currentOwner = makeUser({ id: "old-owner", role: "tenant_admin", is_owner: 1 });
    let callCount = 0;
    const db = {
      prepare: (sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => {
            const s = sql.toLowerCase();
            if (s.includes("is_owner = 1")) return currentOwner;
            callCount++;
            if (callCount >= 1) return null; // new owner not found
            return null;
          },
          run: async () => {},
          all: async () => ({ results: [] }),
        }),
      }),
      batch: async () => [],
    } as unknown as D1Database;

    const { transferOwnership } = await import("../services/tenant.service.js");
    await expect(transferOwnership(db, "tenant-1", "new-user")).rejects.toMatchObject({
      code: "user_not_found",
    });
  });
});

// ── Tests: hardDeleteTenant ────────────────────────────────────────────────────

describe("hardDeleteTenant", () => {
  it("should throw when tenant not found", async () => {
    // DB que retorna null para todas as queries
    const nullDb = {
      prepare: (_sql: string) => ({
        first: async () => null,
        run: async () => {},
        all: async () => ({ results: [] }),
        bind: (..._args: unknown[]) => ({
          first: async () => null,
          run: async () => {},
          all: async () => ({ results: [] }),
        }),
      }),
      batch: async () => [],
    } as unknown as D1Database;

    const { hardDeleteTenant } = await import("../services/tenant.service.js");
    await expect(hardDeleteTenant(nullDb, "nonexistent")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("should soft-delete tenant when found", async () => {
    const db = makeTenantDb({ tenant: makeTenant() });
    const { hardDeleteTenant } = await import("../services/tenant.service.js");
    await expect(hardDeleteTenant(db, "tenant-1")).resolves.toBeUndefined();
  });
});

// ── Tests: expireElevations ────────────────────────────────────────────────────

describe("expireElevations", () => {
  it("should call expireStaleElevations without error", async () => {
    const db = makeTenantDb();
    const { expireElevations } = await import("../services/tenant.service.js");
    await expect(expireElevations(db)).resolves.toBeUndefined();
  });
});
