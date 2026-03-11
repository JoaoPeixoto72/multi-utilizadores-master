/**
 * tests/queries.test.ts — Testes unitários para db/queries/* (M2)
 *
 * R: STACK_LOCK.md §7 — prepared statements; G10 — SQL em queries/ only
 * R: BUILD_PLAN.md §M2.7
 */

import { describe, expect, it } from "vitest";

// ── Helpers ────────────────────────────────────────────────────────────────────

type FirstFn = () => Promise<unknown>;
type RunFn = () => Promise<void>;

interface BindResult {
  first: FirstFn;
  run: RunFn;
  all: () => Promise<{ results: unknown[] }>;
}

function makeSimpleDb(returnValue: unknown = null): D1Database {
  const bindResult = (): BindResult => ({
    first: async () => returnValue,
    run: async () => {},
    all: async () => ({ results: Array.isArray(returnValue) ? returnValue : [] }),
  });
  return {
    prepare: (_sql: string) => ({
      // Support both .prepare().run() and .prepare().bind(...).run()
      first: async () => returnValue,
      run: async () => {},
      all: async () => ({ results: Array.isArray(returnValue) ? returnValue : [] }),
      bind: (..._args: unknown[]): BindResult => bindResult(),
    }),
    batch: async () => [],
  } as unknown as D1Database;
}

// ── db/queries/users.ts ────────────────────────────────────────────────────────

describe("db/queries/users", () => {
  describe("getUserByEmail", () => {
    it("should return null when not found", async () => {
      const db = makeSimpleDb(null);
      const { getUserByEmail } = await import("../db/queries/users.js");
      const result = await getUserByEmail(db, "notfound@test.com");
      expect(result).toBeNull();
    });

    it("should return user when found", async () => {
      const user = {
        id: "u1",
        email: "found@test.com",
        pass_hash: "h",
        role: "member",
        tenant_id: "t1",
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        display_name: null,
        phone: null,
        website: null,
        avatar_key: null,
        preferred_language: "pt",
        temp_owner_expires_at: null,
        created_at: 0,
        updated_at: 0,
      };
      const db = makeSimpleDb(user);
      const { getUserByEmail } = await import("../db/queries/users.js");
      const result = await getUserByEmail(db, "found@test.com");
      expect(result?.email).toBe("found@test.com");
    });
  });

  describe("getUserById", () => {
    it("should return null when user not found", async () => {
      const db = makeSimpleDb(null);
      const { getUserById } = await import("../db/queries/users.js");
      expect(await getUserById(db, "nonexistent")).toBeNull();
    });

    it("should return user public fields", async () => {
      const user = {
        id: "u1",
        email: "u@test.com",
        tenant_id: null,
        role: "super_user",
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        display_name: null,
        phone: null,
        website: null,
        avatar_key: null,
        preferred_language: "pt",
        temp_owner_expires_at: null,
        created_at: 0,
        updated_at: 0,
      };
      const db = makeSimpleDb(user);
      const { getUserById } = await import("../db/queries/users.js");
      const result = await getUserById(db, "u1");
      expect(result?.id).toBe("u1");
      // pass_hash não deve estar exposto
      expect((result as Record<string, unknown>)?.pass_hash).toBeUndefined();
    });
  });

  describe("countUsers", () => {
    it("should return 0 when no users", async () => {
      const db = makeSimpleDb({ count: 0 });
      const { countUsers } = await import("../db/queries/users.js");
      expect(await countUsers(db)).toBe(0);
    });

    it("should return correct count", async () => {
      const db = makeSimpleDb({ count: 5 });
      const { countUsers } = await import("../db/queries/users.js");
      expect(await countUsers(db)).toBe(5);
    });
  });

  describe("countUsersByTenant", () => {
    it("should return zeros when no results", async () => {
      const db = makeSimpleDb(null);
      const { countUsersByTenant } = await import("../db/queries/users.js");
      const result = await countUsersByTenant(db, "tenant-1");
      expect(result.admins).toBe(0);
      expect(result.members).toBe(0);
      expect(result.total).toBe(0);
    });

    it("should return correct counts", async () => {
      const db = makeSimpleDb({ admins: 2, members: 5, total: 7 });
      const { countUsersByTenant } = await import("../db/queries/users.js");
      const result = await countUsersByTenant(db, "tenant-1");
      expect(result.admins).toBe(2);
      expect(result.members).toBe(5);
      expect(result.total).toBe(7);
    });
  });

  describe("createUser", () => {
    it("should throw when DB returns null", async () => {
      const db = makeSimpleDb(null);
      const { createUser } = await import("../db/queries/users.js");
      await expect(createUser(db, { email: "a@b.com", pass_hash: "h" })).rejects.toThrow(
        "Failed to create user",
      );
    });

    it("should return created user", async () => {
      const created = {
        id: "new-u",
        email: "new@test.com",
        tenant_id: null,
        role: "collaborator",
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        display_name: null,
        phone: null,
        website: null,
        avatar_key: null,
        preferred_language: "pt",
        temp_owner_expires_at: null,
        created_at: 0,
        updated_at: 0,
      };
      const db = makeSimpleDb(created);
      const { createUser } = await import("../db/queries/users.js");
      const result = await createUser(db, { email: "new@test.com", pass_hash: "hashed" });
      expect(result.id).toBe("new-u");
    });
  });

  describe("setTempOwner / revokeTempOwner", () => {
    it("setTempOwner should execute without error", async () => {
      const db = makeSimpleDb(null);
      const { setTempOwner } = await import("../db/queries/users.js");
      await expect(setTempOwner(db, "u1", "t1", Date.now() + 3600)).resolves.toBeUndefined();
    });

    it("revokeTempOwner should execute without error", async () => {
      const db = makeSimpleDb(null);
      const { revokeTempOwner } = await import("../db/queries/users.js");
      await expect(revokeTempOwner(db, "u1", "t1")).resolves.toBeUndefined();
    });

    it("expireStaleElevations should execute without error", async () => {
      const db = makeSimpleDb(null);
      const { expireStaleElevations } = await import("../db/queries/users.js");
      await expect(expireStaleElevations(db)).resolves.toBeUndefined();
    });
  });

  describe("updateUserStatus / softDeleteUser", () => {
    it("updateUserStatus should execute without error", async () => {
      const db = makeSimpleDb(null);
      const { updateUserStatus } = await import("../db/queries/users.js");
      await expect(updateUserStatus(db, "u1", "t1", "inactive")).resolves.toBeUndefined();
    });

    it("softDeleteUser should execute without error", async () => {
      const db = makeSimpleDb(null);
      const { softDeleteUser } = await import("../db/queries/users.js");
      await expect(softDeleteUser(db, "u1", "t1")).resolves.toBeUndefined();
    });
  });
});

// ── db/queries/tenants.ts ─────────────────────────────────────────────────────

describe("db/queries/tenants", () => {
  const mockTenant = {
    id: "t1",
    name: "Corp",
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
  };

  describe("getTenantById", () => {
    it("should return null when not found", async () => {
      const db = makeSimpleDb(null);
      const { getTenantById } = await import("../db/queries/tenants.js");
      expect(await getTenantById(db, "nonexistent")).toBeNull();
    });

    it("should return tenant when found", async () => {
      const db = makeSimpleDb(mockTenant);
      const { getTenantById } = await import("../db/queries/tenants.js");
      const result = await getTenantById(db, "t1");
      expect(result?.id).toBe("t1");
    });
  });

  describe("getTenantByEmail", () => {
    it("should return null when not found", async () => {
      const db = makeSimpleDb(null);
      const { getTenantByEmail } = await import("../db/queries/tenants.js");
      expect(await getTenantByEmail(db, "nope@test.com")).toBeNull();
    });
  });

  describe("countTenantsByStatus", () => {
    it("should return zeros when no tenants", async () => {
      const db = makeSimpleDb(null);
      const { countTenantsByStatus } = await import("../db/queries/tenants.js");
      const result = await countTenantsByStatus(db);
      expect(result.active).toBe(0);
      expect(result.inactive).toBe(0);
    });

    it("should return correct counts", async () => {
      const db = makeSimpleDb({ active: 3, inactive: 1 });
      const { countTenantsByStatus } = await import("../db/queries/tenants.js");
      const result = await countTenantsByStatus(db);
      expect(result.active).toBe(3);
      expect(result.inactive).toBe(1);
    });
  });

  describe("listTenants", () => {
    it("should return empty list when no tenants", async () => {
      const db = {
        prepare: (_sql: string) => ({
          bind: (..._args: unknown[]) => ({
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => {},
          }),
        }),
      } as unknown as D1Database;
      const { listTenants } = await import("../db/queries/tenants.js");
      const result = await listTenants(db, { limit: 20 });
      expect(result.rows).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("should return nextCursor when more results exist", async () => {
      // 3 results for limit=2 → hasMore=true, nextCursor = created_at of last
      const rows = [
        {
          id: "t1",
          name: "A",
          email: "a@t.com",
          status: "active",
          admin_seat_limit: 3,
          member_seat_limit: 10,
          created_at: 300,
        },
        {
          id: "t2",
          name: "B",
          email: "b@t.com",
          status: "active",
          admin_seat_limit: 3,
          member_seat_limit: 10,
          created_at: 200,
        },
        {
          id: "t3",
          name: "C",
          email: "c@t.com",
          status: "active",
          admin_seat_limit: 3,
          member_seat_limit: 10,
          created_at: 100,
        },
      ];
      const db = {
        prepare: (_sql: string) => ({
          bind: (..._args: unknown[]) => ({
            all: async () => ({ results: rows }),
            first: async () => null,
            run: async () => {},
          }),
        }),
      } as unknown as D1Database;
      const { listTenants } = await import("../db/queries/tenants.js");
      const result = await listTenants(db, { limit: 2 });
      expect(result.rows).toHaveLength(2);
      expect(result.nextCursor).toBe("200");
    });

    it("should work with cursor and status filter", async () => {
      const db = {
        prepare: (_sql: string) => ({
          bind: (..._args: unknown[]) => ({
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => {},
          }),
        }),
      } as unknown as D1Database;
      const { listTenants } = await import("../db/queries/tenants.js");
      const result = await listTenants(db, { limit: 10, cursor: "500", status: "active" });
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("createTenant", () => {
    it("should throw when DB returns null", async () => {
      const db = makeSimpleDb(null);
      const { createTenant } = await import("../db/queries/tenants.js");
      await expect(createTenant(db, { name: "X", email: "x@x.com" })).rejects.toThrow(
        "Failed to create tenant",
      );
    });

    it("should return created tenant", async () => {
      const db = makeSimpleDb(mockTenant);
      const { createTenant } = await import("../db/queries/tenants.js");
      const result = await createTenant(db, { name: "Corp", email: "corp@test.com" });
      expect(result.id).toBe("t1");
    });
  });

  describe("updateTenantLimits", () => {
    it("should no-op when no fields provided", async () => {
      const db = makeSimpleDb(null);
      const { updateTenantLimits } = await import("../db/queries/tenants.js");
      await expect(updateTenantLimits(db, "t1", {})).resolves.toBeUndefined();
    });

    it("should update limits when fields are provided", async () => {
      const db = makeSimpleDb(null);
      const { updateTenantLimits } = await import("../db/queries/tenants.js");
      await expect(updateTenantLimits(db, "t1", { admin_seat_limit: 5 })).resolves.toBeUndefined();
    });
  });

  describe("updateTenantStatus / softDeleteTenant", () => {
    it("updateTenantStatus active should not throw", async () => {
      const db = makeSimpleDb(null);
      const { updateTenantStatus } = await import("../db/queries/tenants.js");
      await expect(updateTenantStatus(db, "t1", "active")).resolves.toBeUndefined();
    });

    it("softDeleteTenant should not throw", async () => {
      const db = makeSimpleDb(null);
      const { softDeleteTenant } = await import("../db/queries/tenants.js");
      await expect(softDeleteTenant(db, "t1")).resolves.toBeUndefined();
    });
  });

  describe("updateTenantOwner", () => {
    it("should execute batch without error", async () => {
      const db = {
        prepare: (_sql: string) => ({
          bind: (..._args: unknown[]) => ({
            first: async () => null,
            run: async () => {},
            all: async () => ({ results: [] }),
          }),
        }),
        batch: async (_stmts: unknown[]) => [],
      } as unknown as D1Database;

      const { updateTenantOwner } = await import("../db/queries/tenants.js");
      await expect(updateTenantOwner(db, "t1", "new-owner", "old-owner")).resolves.toBeUndefined();
    });
  });
});
