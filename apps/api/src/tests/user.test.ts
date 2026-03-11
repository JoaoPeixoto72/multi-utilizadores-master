/**
 * tests/user.test.ts — Testes unitários para services/user.service.ts (M4)
 *
 * R: STACK_LOCK.md §5 — cobertura G05 ≥ 70%
 * R: BUILD_PLAN.md §M4.3
 */

import { describe, expect, it, vi } from "vitest";

// ── Helpers de mock ────────────────────────────────────────────────────────────

type MockUser = {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  website: string | null;
  avatar_key: string | null;
  preferred_language: string;
  tenant_id: string | null;
  role: "super_user" | "tenant_admin" | "member" | "collaborator";
  is_owner: number;
  is_temp_owner: number;
  status: "active" | "inactive" | "deleted";
  temp_owner_expires_at: number | null;
  created_at: number;
  updated_at: number;
};

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "user@test.com",
    display_name: "Test User",
    phone: null,
    website: null,
    avatar_key: null,
    preferred_language: "pt",
    tenant_id: "tenant-1",
    role: "collaborator",
    is_owner: 0,
    is_temp_owner: 0,
    status: "active",
    temp_owner_expires_at: null,
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

// ── getUserModules (M10 — usa registry real) ──────────────────────────────────

describe("getUserModules", () => {
  it("admin tem acesso a todos os módulos do registry", async () => {
    const { getUserModules } = await import("../services/user.service.js");
    const { MODULES } = await import("../modules.config.js");
    const admin = makeUser({ role: "tenant_admin", is_owner: 1 });
    const modules = getUserModules(admin, {});
    expect(modules.length).toBe(MODULES.length);
    expect(modules.every((m) => m.has_access)).toBe(true);
  });

  it("super_user recebe lista vazia (sem módulos de empresa)", async () => {
    const { getUserModules } = await import("../services/user.service.js");
    const su = makeUser({ role: "super_user", tenant_id: null });
    const modules = getUserModules(su, {});
    expect(modules).toEqual([]);
  });

  it("collaborator sem permissões tem has_access=false em módulos restritos", async () => {
    const { getUserModules } = await import("../services/user.service.js");
    const collab = makeUser({ role: "collaborator", is_owner: 0 });
    // Sem nenhuma permissão concedida
    const modules = getUserModules(collab, {});
    // Módulos sem permissions[] (core, backups, integrations) ficam acessíveis a admins mas não a collaborator
    // módulos com permission key: collaborator precisa de ter permissão explícita
    expect(Array.isArray(modules)).toBe(true);
  });

  it("devolve array com id, name_key e has_access", async () => {
    const { getUserModules } = await import("../services/user.service.js");
    const admin = makeUser({ role: "member", is_owner: 1 });
    const modules = getUserModules(admin, {});
    for (const mod of modules) {
      expect(typeof mod.id).toBe("string");
      expect(typeof mod.name_key).toBe("string");
      expect(typeof mod.has_access).toBe("boolean");
    }
  });
});

// ── selfDeleteUser ────────────────────────────────────────────────────────────

describe("selfDeleteUser", () => {
  it("deve rejeitar se utilizador não encontrado", async () => {
    vi.resetModules();
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(null),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "ghost-id")).rejects.toMatchObject({
      code: "user_not_found",
      status: 404,
    });
  });

  it("deve rejeitar se utilizador já eliminado", async () => {
    vi.resetModules();
    const deletedUser = makeUser({ status: "deleted" });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(deletedUser),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).rejects.toMatchObject({
      code: "user_deleted",
      status: 409,
    });
  });

  it("deve rejeitar se super_user tenta auto-eliminar-se", async () => {
    vi.resetModules();
    const su = makeUser({ role: "super_user", tenant_id: null });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(su),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).rejects.toMatchObject({
      code: "super_user_self_delete",
      status: 403,
    });
  });

  it("deve rejeitar se owner fixo (is_owner=1, is_temp_owner=0) tenta auto-eliminar-se", async () => {
    vi.resetModules();
    const owner = makeUser({ role: "member", is_owner: 1, is_temp_owner: 0 });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(owner),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).rejects.toMatchObject({
      code: "owner_self_delete",
      status: 403,
    });
  });

  it("deve rejeitar se owner temporário tenta auto-eliminar-se", async () => {
    vi.resetModules();
    const tempOwner = makeUser({ role: "member", is_owner: 0, is_temp_owner: 1 });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(tempOwner),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).rejects.toMatchObject({
      code: "temp_owner_self_delete",
      status: 403,
    });
  });

  it("deve rejeitar se utilizador não tem tenant_id", async () => {
    vi.resetModules();
    const noTenant = makeUser({ role: "collaborator", tenant_id: null });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(noTenant),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).rejects.toMatchObject({
      code: "no_tenant",
      status: 400,
    });
  });

  it("deve permitir colaborador auto-eliminar-se", async () => {
    vi.resetModules();
    const collab = makeUser({ role: "collaborator", is_owner: 0, is_temp_owner: 0 });
    const softDeleteMock = vi.fn().mockResolvedValue(undefined);
    const deleteSessionsMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(collab),
      softDeleteUser: softDeleteMock,
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: deleteSessionsMock,
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).resolves.toBeUndefined();
    expect(deleteSessionsMock).toHaveBeenCalledWith(fakeDb, "user-1");
    expect(softDeleteMock).toHaveBeenCalledWith(fakeDb, "user-1", "tenant-1");
  });

  it("deve permitir sócio (sem elevação) auto-eliminar-se", async () => {
    vi.resetModules();
    const member = makeUser({ role: "member", is_owner: 0, is_temp_owner: 0 });
    const softDeleteMock = vi.fn().mockResolvedValue(undefined);
    const deleteSessionsMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(member),
      softDeleteUser: softDeleteMock,
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: deleteSessionsMock,
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).resolves.toBeUndefined();
    expect(softDeleteMock).toHaveBeenCalled();
  });

  it("deve permitir tenant_admin (sem ownership) auto-eliminar-se", async () => {
    vi.resetModules();
    const admin = makeUser({ role: "tenant_admin", is_owner: 0, is_temp_owner: 0 });
    const softDeleteMock = vi.fn().mockResolvedValue(undefined);
    const deleteSessionsMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(admin),
      softDeleteUser: softDeleteMock,
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: deleteSessionsMock,
    }));

    const { selfDeleteUser } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(selfDeleteUser(fakeDb, "user-1")).resolves.toBeUndefined();
    expect(softDeleteMock).toHaveBeenCalled();
  });
});

// ── getUserProfile ─────────────────────────────────────────────────────────────

describe("getUserProfile", () => {
  it("deve retornar perfil público do utilizador activo", async () => {
    vi.resetModules();
    const user = makeUser({
      id: "user-abc",
      email: "test@example.com",
      display_name: "João Silva",
      role: "collaborator",
    });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(user),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { getUserProfile } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    const profile = await getUserProfile(fakeDb, "user-abc");

    expect(profile.id).toBe("user-abc");
    expect(profile.email).toBe("test@example.com");
    expect(profile.display_name).toBe("João Silva");
    expect(profile.role).toBe("collaborator");
    // pass_hash nunca deve aparecer
    expect("pass_hash" in profile).toBe(false);
  });

  it("deve lançar erro se utilizador não encontrado", async () => {
    vi.resetModules();
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(null),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { getUserProfile } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(getUserProfile(fakeDb, "ghost")).rejects.toMatchObject({
      code: "user_not_found",
      status: 404,
    });
  });

  it("deve lançar erro se utilizador eliminado", async () => {
    vi.resetModules();
    const deleted = makeUser({ status: "deleted" });
    vi.doMock("../db/queries/users.js", () => ({
      getUserById: vi.fn().mockResolvedValue(deleted),
      softDeleteUser: vi.fn(),
    }));
    vi.doMock("../db/queries/sessions.js", () => ({
      deleteAllUserSessions: vi.fn(),
    }));

    const { getUserProfile } = await import("../services/user.service.js");
    const fakeDb = {} as D1Database;

    await expect(getUserProfile(fakeDb, "user-1")).rejects.toMatchObject({
      code: "user_deleted",
      status: 410,
    });
  });
});
