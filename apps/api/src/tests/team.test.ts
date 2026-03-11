/**
 * tests/team.test.ts — Testes unitários para services/team.service.ts
 *
 * R: STACK_LOCK.md §5 — cobertura G05 ≥ 70%
 * R: BUILD_PLAN.md §M3.4
 */

import { describe, expect, it } from "vitest";

// ── Helpers de mock ────────────────────────────────────────────────────────────

type MockUser = {
  id: string;
  email: string;
  display_name: string | null;
  tenant_id: string;
  role: "tenant_admin" | "member" | "collaborator";
  is_owner: number;
  is_temp_owner: number;
  status: "active" | "inactive" | "deleted";
  module_permissions: string;
  temp_owner_expires_at: number | null;
  created_at: number;
  updated_at: number;
};

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "user@test.com",
    display_name: "Test User",
    tenant_id: "tenant-1",
    role: "collaborator",
    is_owner: 0,
    is_temp_owner: 0,
    status: "active",
    module_permissions: "{}",
    temp_owner_expires_at: null,
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

function makeOwner(overrides: Partial<MockUser> = {}): MockUser {
  return makeUser({
    id: "owner-1",
    email: "owner@test.com",
    role: "member",
    is_owner: 1,
    is_temp_owner: 0,
    ...overrides,
  });
}

function makeMember(overrides: Partial<MockUser> = {}): MockUser {
  return makeUser({
    id: "member-1",
    email: "member@test.com",
    role: "member",
    is_owner: 0,
    is_temp_owner: 0,
    ...overrides,
  });
}

type RunFn = () => Promise<void>;
interface BindResult {
  first: () => Promise<unknown>;
  run: RunFn;
  all: () => Promise<{ results: unknown[] }>;
}

function makeDb(returnUser: MockUser | null, secondUser?: MockUser | null): D1Database {
  let callCount = 0;
  const bindResult = (): BindResult => {
    const currentCall = ++callCount;
    return {
      first: async () => {
        if (currentCall === 1) return returnUser;
        return secondUser !== undefined ? secondUser : returnUser;
      },
      run: async () => { },
      all: async () => ({ results: returnUser ? [returnUser] : [] }),
    };
  };
  return {
    prepare: (_sql: string) => ({
      first: async () => returnUser,
      run: async () => { },
      all: async () => ({ results: returnUser ? [returnUser] : [] }),
      bind: (..._args: unknown[]): BindResult => bindResult(),
    }),
    batch: async () => [],
  } as unknown as D1Database;
}

// DB que retorna utilizadores diferentes em chamadas sequenciais
function makeDbSequential(users: (MockUser | null)[]): D1Database {
  let index = 0;
  const bindResult = (): BindResult => {
    const user = users[index] ?? null;
    index = Math.min(index + 1, users.length - 1);
    return {
      first: async () => user,
      run: async () => { },
      all: async () => ({ results: user ? [user] : [] }),
    };
  };
  return {
    prepare: (_sql: string) => ({
      first: async () => users[0] ?? null,
      run: async () => { },
      all: async () => ({ results: users[0] ? [users[0]] : [] }),
      bind: (..._args: unknown[]): BindResult => bindResult(),
    }),
    batch: async () => [],
  } as unknown as D1Database;
}

// ── validateHierarchy ─────────────────────────────────────────────────────────

describe("validateHierarchy", () => {
  it("deve lançar erro se actor === target (self-action)", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    const _user = makeUser({ id: "same-id" });
    expect(() =>
      validateHierarchy(
        { id: "same-id", role: "member", is_owner: 1, is_temp_owner: 0 },
        { id: "same-id", role: "collaborator", is_owner: 0 },
        "deactivate",
      ),
    ).toThrow();
  });

  it("deve lançar erro se target é owner fixo", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "actor", role: "member", is_owner: 1, is_temp_owner: 0 },
        { id: "target", role: "member", is_owner: 1 },
        "delete_member",
      ),
    ).toThrow();
  });

  it("owner fixo pode eliminar sócio", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "owner", role: "member", is_owner: 1, is_temp_owner: 0 },
        { id: "member", role: "member", is_owner: 0 },
        "delete_member",
      ),
    ).not.toThrow();
  });

  it("sócio NÃO pode eliminar outro sócio", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "member1", role: "member", is_owner: 0, is_temp_owner: 0 },
        { id: "member2", role: "member", is_owner: 0 },
        "delete_member",
      ),
    ).toThrow();
  });

  it("sócio pode eliminar colaborador", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "member1", role: "member", is_owner: 0, is_temp_owner: 0 },
        { id: "collab1", role: "collaborator", is_owner: 0 },
        "delete_collaborator",
      ),
    ).not.toThrow();
  });

  it("colaborador NÃO pode desactivar ninguém", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "collab1", role: "collaborator", is_owner: 0, is_temp_owner: 0 },
        { id: "collab2", role: "collaborator", is_owner: 0 },
        "deactivate",
      ),
    ).toThrow();
  });

  it("owner temporário pode convidar sócio", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "tempowner", role: "member", is_owner: 0, is_temp_owner: 1 },
        { id: "newmember", role: "member", is_owner: 0 },
        "invite_member",
      ),
    ).not.toThrow();
  });

  it("sócio NÃO pode convidar outro sócio (invite_member requer owner)", async () => {
    const { validateHierarchy } = await import("../services/team.service.js");
    expect(() =>
      validateHierarchy(
        { id: "member1", role: "member", is_owner: 0, is_temp_owner: 0 },
        { id: "newmember", role: "member", is_owner: 0 },
        "invite_member",
      ),
    ).toThrow();
  });
});

// ── deactivateCollaborator ────────────────────────────────────────────────────

describe("deactivateCollaborator", () => {
  it("deve lançar user_not_found se target não existe", async () => {
    const { deactivateCollaborator } = await import("../services/team.service.js");
    const db = makeDbSequential([makeOwner(), null]);

    await expect(
      deactivateCollaborator(db, "owner-1", "nonexistent", "tenant-1"),
    ).rejects.toMatchObject({ code: "user_not_found" });
  });

  it("deve lançar already_inactive se utilizador já inactivo", async () => {
    const { deactivateCollaborator } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1", status: "inactive" });
    const db = makeDbSequential([owner, target]);

    await expect(
      deactivateCollaborator(db, "owner-1", "collab-1", "tenant-1"),
    ).rejects.toMatchObject({ code: "already_inactive" });
  });

  it("deve desactivar colaborador com sucesso (owner fixo)", async () => {
    const { deactivateCollaborator } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1" });
    const db = makeDbSequential([owner, target]);

    await expect(
      deactivateCollaborator(db, "owner-1", "collab-1", "tenant-1"),
    ).resolves.toBeUndefined();
  });
});

// ── reactivateCollaborator ────────────────────────────────────────────────────

describe("reactivateCollaborator", () => {
  it("deve lançar already_active se utilizador já activo", async () => {
    const { reactivateCollaborator } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1", status: "active" });
    const db = makeDbSequential([owner, target]);

    await expect(
      reactivateCollaborator(db, "owner-1", "collab-1", "tenant-1"),
    ).rejects.toMatchObject({ code: "already_active" });
  });

  it("deve reactivar colaborador inactivo", async () => {
    const { reactivateCollaborator } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1", status: "inactive" });
    const db = makeDbSequential([owner, target]);

    await expect(
      reactivateCollaborator(db, "owner-1", "collab-1", "tenant-1"),
    ).resolves.toBeUndefined();
  });
});

// ── deleteTeamUser ────────────────────────────────────────────────────────────

describe("deleteTeamUser", () => {
  it("deve lançar user_deleted se já eliminado", async () => {
    const { deleteTeamUser } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1", status: "deleted" });
    const db = makeDbSequential([owner, target]);

    await expect(
      deleteTeamUser(db, "owner-1", "collab-1", "tenant-1", "collaborator"),
    ).rejects.toMatchObject({ code: "user_deleted" });
  });

  it("deve fazer soft delete com sucesso", async () => {
    const { deleteTeamUser } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1" });
    const db = makeDbSequential([owner, target]);

    await expect(
      deleteTeamUser(db, "owner-1", "collab-1", "tenant-1", "collaborator"),
    ).resolves.toBeUndefined();
  });

  it("sócio não pode eliminar outro sócio sem ser owner", async () => {
    const { deleteTeamUser } = await import("../services/team.service.js");
    const actor = makeMember({ id: "member-actor" });
    const target = makeMember({ id: "member-target" });
    const db = makeDbSequential([actor, target]);

    await expect(
      deleteTeamUser(db, "member-actor", "member-target", "tenant-1", "member"),
    ).rejects.toMatchObject({ code: "requires_owner" });
  });
});

// ── updatePermissions ─────────────────────────────────────────────────────────

describe("updatePermissions", () => {
  it("deve lançar not_collaborator_or_client se target não é collaborator nem client", async () => {
    const { updatePermissions } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeMember();
    const db = makeDbSequential([owner, target]);

    await expect(
      updatePermissions(db, "owner-1", "member-1", "tenant-1", { module1: true }),
    ).rejects.toMatchObject({ code: "not_collaborator_or_client" });
  });

  it("deve actualizar permissões de colaborador com sucesso", async () => {
    const { updatePermissions } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1" });
    const db = makeDbSequential([owner, target]);

    await expect(
      updatePermissions(db, "owner-1", "collab-1", "tenant-1", { module1: true }),
    ).resolves.toBeUndefined();
  });
});

// ── changeUserRole ─────────────────────────────────────────────────────────────

describe("changeUserRole", () => {
  it("deve lançar requires_owner se actor não é owner", async () => {
    const { changeUserRole } = await import("../services/team.service.js");
    const actor = makeMember({ is_owner: 0, is_temp_owner: 0 });
    const target = makeUser({ id: "collab-1" });
    const db = makeDbSequential([actor, target]);

    await expect(
      changeUserRole(db, "member-1", "collab-1", "tenant-1", "member"),
    ).rejects.toMatchObject({ code: "requires_owner" });
  });

  it("deve lançar target_is_owner se target é owner", async () => {
    const { changeUserRole } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeOwner({ id: "owner-2" });
    const db = makeDbSequential([owner, target]);

    await expect(
      changeUserRole(db, "owner-1", "owner-2", "tenant-1", "collaborator"),
    ).rejects.toMatchObject({ code: "target_is_owner" });
  });

  it("deve mudar role com sucesso", async () => {
    const { changeUserRole } = await import("../services/team.service.js");
    const owner = makeOwner();
    const target = makeUser({ id: "collab-1" });
    const updatedTarget = makeUser({ id: "collab-1", role: "member" });
    const db = makeDbSequential([owner, target, updatedTarget]);

    await expect(
      changeUserRole(db, "owner-1", "collab-1", "tenant-1", "member"),
    ).resolves.toBeTruthy();
  });
});

// ── Queries de equipa ─────────────────────────────────────────────────────────

describe("listCollaboratorsByTenant", () => {
  it("deve retornar lista vazia quando não há colaboradores", async () => {
    const db = makeDb(null);
    const { listCollaboratorsByTenant } = await import("../db/queries/users.js");
    const result = await listCollaboratorsByTenant(db, "tenant-1", { limit: 10 });
    expect(result.rows).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("deve retornar colaboradores existentes", async () => {
    const collab = makeUser() as unknown;
    const db = makeDb(collab as MockUser);
    const { listCollaboratorsByTenant } = await import("../db/queries/users.js");
    const result = await listCollaboratorsByTenant(db, "tenant-1", { limit: 10 });
    expect(result.rows).toHaveLength(1);
  });
});

describe("listMembersByTenant", () => {
  it("deve retornar lista vazia quando não há sócios", async () => {
    const db = makeDb(null);
    const { listMembersByTenant } = await import("../db/queries/users.js");
    const result = await listMembersByTenant(db, "tenant-1", { limit: 10 });
    expect(result.rows).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe("updateUserRole", () => {
  it("deve chamar UPDATE sem lançar erro", async () => {
    const db = makeDb(null);
    const { updateUserRole } = await import("../db/queries/users.js");
    await expect(updateUserRole(db, "user-1", "tenant-1", "member")).resolves.toBeUndefined();
  });
});

describe("updateUserModulePermissions", () => {
  it("deve chamar UPDATE sem lançar erro", async () => {
    const db = makeDb(null);
    const { updateUserModulePermissions } = await import("../db/queries/users.js");
    await expect(
      updateUserModulePermissions(db, "user-1", "tenant-1", { module1: true }),
    ).resolves.toBeUndefined();
  });
});
