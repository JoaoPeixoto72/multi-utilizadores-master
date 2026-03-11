/**
 * tests/invitation.test.ts — Testes unitários para services/invitation.service.ts
 *
 * R: STACK_LOCK.md §5 — cobertura G05 ≥ 70%
 * R: BUILD_PLAN.md §M2.7
 */

import { describe, expect, it } from "vitest";

// ── Helpers de mock ────────────────────────────────────────────────────────────

type MockInvitation = {
  id: string;
  tenant_id: string;
  email: string;
  role: "tenant_admin" | "member" | "collaborator";
  is_owner: number;
  invited_by: string;
  token_hash: string;
  module_permissions: string;
  language: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: number;
  expires_at: number;
  accepted_at: number | null;
  cancelled_at: number | null;
};

function makeInvitation(overrides: Partial<MockInvitation> = {}): MockInvitation {
  return {
    id: "inv-1",
    tenant_id: "tenant-1",
    email: "owner@test.com",
    role: "tenant_admin",
    is_owner: 1,
    invited_by: "super-user-1",
    token_hash: "abc123",
    module_permissions: "{}",
    language: "pt",
    status: "pending",
    created_at: 1000000,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1h futuro
    accepted_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

// Mock DB para convites
function makeInviteDb(
  opts: {
    existingUser?: { id: string; email: string } | null;
    existingInvite?: MockInvitation | null;
    insertedInvite?: MockInvitation | null;
    tokenHashRow?: MockInvitation | null;
  } = {},
) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          const s = sql.toLowerCase();
          // getUserByEmail
          if (s.includes("from users") && s.includes("email = ")) {
            return opts.existingUser ?? null;
          }
          // getPendingInvitationByEmail
          if (
            s.includes("from invitations") &&
            s.includes("email = ") &&
            s.includes("status = 'pending'")
          ) {
            return opts.existingInvite ?? null;
          }
          // getInvitationByTokenHash
          if (s.includes("from invitations") && s.includes("token_hash = ")) {
            return opts.tokenHashRow ?? null;
          }
          // createInvitation INSERT
          if (s.includes("insert into invitations")) {
            return opts.insertedInvite ?? makeInvitation();
          }
          // resend: SELECT on cancelled invite
          if (s.includes("from invitations") && s.includes("tenant_id = ")) {
            return opts.insertedInvite ?? makeInvitation();
          }
          return null;
        },
        run: async () => {},
        all: async () => ({ results: [] }),
      }),
    }),
  } as unknown as D1Database;
}

// ── Tests: createOwnerInvitation ───────────────────────────────────────────────

describe("createOwnerInvitation", () => {
  it("should throw when email is already in use", async () => {
    const db = makeInviteDb({ existingUser: { id: "u1", email: "owner@test.com" } });
    const { createOwnerInvitation } = await import("../services/invitation.service.js");

    await expect(
      createOwnerInvitation(db, {
        tenantId: "tenant-1",
        email: "owner@test.com",
        invitedBy: "super-1",
      }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  it("should throw when pending invite already exists", async () => {
    const db = makeInviteDb({ existingInvite: makeInvitation() });
    const { createOwnerInvitation } = await import("../services/invitation.service.js");

    await expect(
      createOwnerInvitation(db, {
        tenantId: "tenant-1",
        email: "new@test.com",
        invitedBy: "super-1",
      }),
    ).rejects.toMatchObject({ code: "invite_pending" });
  });

  it("should create invite successfully when email is free and no pending invite", async () => {
    const db = makeInviteDb({
      existingUser: null,
      existingInvite: null,
      insertedInvite: makeInvitation(),
    });
    const { createOwnerInvitation } = await import("../services/invitation.service.js");

    const result = await createOwnerInvitation(db, {
      tenantId: "tenant-1",
      email: "new@test.com",
      invitedBy: "super-1",
    });

    expect(result).toHaveProperty("rawToken");
    expect(result.rawToken).toBeTruthy();
    expect(result.invitation).toHaveProperty("id", "inv-1");
  });
});

// ── Tests: createMemberInvitation ─────────────────────────────────────────────

describe("createMemberInvitation", () => {
  it("should throw when email is already in use", async () => {
    const db = makeInviteDb({ existingUser: { id: "u1", email: "member@test.com" } });
    const { createMemberInvitation } = await import("../services/invitation.service.js");

    await expect(
      createMemberInvitation(db, {
        tenantId: "tenant-1",
        email: "member@test.com",
        role: "member",
        invitedBy: "owner-1",
      }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  it("should create member invite successfully", async () => {
    const memberInvite = makeInvitation({ role: "member", is_owner: 0 });
    const db = makeInviteDb({
      existingUser: null,
      existingInvite: null,
      insertedInvite: memberInvite,
    });
    const { createMemberInvitation } = await import("../services/invitation.service.js");

    const result = await createMemberInvitation(db, {
      tenantId: "tenant-1",
      email: "member@test.com",
      role: "member",
      invitedBy: "owner-1",
      language: "en",
    });

    expect(result.rawToken).toBeTruthy();
    expect(result.invitation.role).toBe("member");
  });
});

// ── Tests: validateInvitationToken ────────────────────────────────────────────

describe("validateInvitationToken", () => {
  it("should throw not_found when token hash not found in DB", async () => {
    const db = makeInviteDb({ tokenHashRow: null });
    const { validateInvitationToken } = await import("../services/invitation.service.js");

    await expect(validateInvitationToken(db, "fake-raw-token")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("should throw invite_invalid when status is accepted", async () => {
    const db = makeInviteDb({
      tokenHashRow: makeInvitation({ status: "accepted" }),
    });
    const { validateInvitationToken } = await import("../services/invitation.service.js");

    await expect(validateInvitationToken(db, "any-token")).rejects.toMatchObject({
      code: "invite_invalid",
    });
  });

  it("should throw invite_invalid when status is cancelled", async () => {
    const db = makeInviteDb({
      tokenHashRow: makeInvitation({ status: "cancelled" }),
    });
    const { validateInvitationToken } = await import("../services/invitation.service.js");

    await expect(validateInvitationToken(db, "any-token")).rejects.toMatchObject({
      code: "invite_invalid",
    });
  });

  it("should throw invite_expired when expires_at is in the past", async () => {
    const db = makeInviteDb({
      tokenHashRow: makeInvitation({
        status: "pending",
        expires_at: Math.floor(Date.now() / 1000) - 3600, // 1h passado
      }),
    });
    const { validateInvitationToken } = await import("../services/invitation.service.js");

    await expect(validateInvitationToken(db, "any-token")).rejects.toMatchObject({
      code: "invite_expired",
    });
  });

  it("should return invitation when valid and pending", async () => {
    const validInvite = makeInvitation({ status: "pending" });
    const db = makeInviteDb({ tokenHashRow: validInvite });
    const { validateInvitationToken } = await import("../services/invitation.service.js");

    const result = await validateInvitationToken(db, "any-raw-token");
    expect(result.id).toBe("inv-1");
    expect(result.status).toBe("pending");
  });
});

// ── Tests: resendInvitation ────────────────────────────────────────────────────

describe("resendInvitation", () => {
  it("should throw not_found when old invite not found after cancel", async () => {
    const db = {
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          first: async () => null,
          run: async () => {},
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;

    const { resendInvitation } = await import("../services/invitation.service.js");
    await expect(resendInvitation(db, "inv-1", "tenant-1")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
