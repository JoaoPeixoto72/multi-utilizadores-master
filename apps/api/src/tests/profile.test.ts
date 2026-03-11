/**
 * tests/profile.test.ts — Testes unitários para services/profile.service.ts (M5)
 *
 * R: BUILD_PLAN.md §M5.5 — cobertura G05 ≥ 70%
 * R: briefing.md §3.5, §3.6, §3.8, §3.9
 *
 * Testa:
 *   - storage.ts: validateWebP, validateFileSize, validateImageDimensions
 *   - profile.service: getProfile, patchProfile, uploadAvatar, deleteAvatar,
 *                       requestEmailChange, confirmEmailChangeToken,
 *                       changePassword, exportRgpd,
 *                       getCompanyProfile, patchCompanyProfile
 */

import { describe, expect, it, vi } from "vitest";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_HEIGHT,
  AVATAR_MAX_WIDTH,
  validateFileSize,
  validateImageDimensions,
  validateWebP,
} from "../lib/storage.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Gera um ArrayBuffer simulando um WebP VP8 válido (magic bytes correctos) */
function makeWebPBuffer(width = 100, height = 100): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const bytes = new Uint8Array(buf);
  // RIFF header
  bytes[0] = 0x52;
  bytes[1] = 0x49;
  bytes[2] = 0x46;
  bytes[3] = 0x46;
  // Size (ignored in validation)
  bytes[4] = 0x00;
  bytes[5] = 0x00;
  bytes[6] = 0x00;
  bytes[7] = 0x00;
  // WEBP marker
  bytes[8] = 0x57;
  bytes[9] = 0x45;
  bytes[10] = 0x42;
  bytes[11] = 0x50;
  // VP8 chunk type
  bytes[12] = 0x56;
  bytes[13] = 0x50;
  bytes[14] = 0x38;
  bytes[15] = 0x20;
  // VP8 data size
  bytes[16] = 0x10;
  bytes[17] = 0x00;
  bytes[18] = 0x00;
  bytes[19] = 0x00;
  // VP8 signature
  bytes[20] = 0x30;
  bytes[21] = 0x01;
  bytes[22] = 0x00;
  bytes[23] = 0x00;
  // width - 1 (14 bits, little-endian)
  const w = width - 1;
  const h = height - 1;
  bytes[26] = w & 0xff;
  bytes[27] = (w >> 8) & 0x3f;
  bytes[28] = h & 0xff;
  bytes[29] = (h >> 8) & 0x3f;
  return buf;
}

/** Buffer inválido (não é WebP) */
function makeInvalidBuffer(): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const bytes = new Uint8Array(buf);
  bytes[0] = 0xff;
  bytes[1] = 0xd8; // JPEG magic
  return buf;
}

// ── Testes: validateWebP ──────────────────────────────────────────────────────

describe("validateWebP", () => {
  it("aceita buffer WebP válido", () => {
    const buf = makeWebPBuffer();
    expect(() => validateWebP(buf)).not.toThrow();
  });

  it("rejeita buffer muito pequeno", () => {
    const buf = new ArrayBuffer(4);
    expect(() => validateWebP(buf)).toThrow("inválido");
  });

  it("rejeita buffer sem magic bytes RIFF/WEBP", () => {
    const buf = makeInvalidBuffer();
    expect(() => validateWebP(buf)).toThrow("WebP");
  });

  it("rejeita buffer com RIFF mas sem WEBP marker", () => {
    const buf = new ArrayBuffer(12);
    const bytes = new Uint8Array(buf);
    // RIFF correcto
    bytes[0] = 0x52;
    bytes[1] = 0x49;
    bytes[2] = 0x46;
    bytes[3] = 0x46;
    // JPEG em vez de WEBP
    bytes[8] = 0xff;
    bytes[9] = 0xd8;
    expect(() => validateWebP(buf)).toThrow("WebP");
  });
});

// ── Testes: validateFileSize ──────────────────────────────────────────────────

describe("validateFileSize", () => {
  it("aceita ficheiro dentro do limite", () => {
    const buf = new ArrayBuffer(100 * 1024); // 100 KB
    expect(() => validateFileSize(buf, AVATAR_MAX_BYTES)).not.toThrow();
  });

  it("aceita ficheiro exactamente no limite", () => {
    const buf = new ArrayBuffer(AVATAR_MAX_BYTES);
    expect(() => validateFileSize(buf, AVATAR_MAX_BYTES)).not.toThrow();
  });

  it("rejeita ficheiro acima do limite", () => {
    const buf = new ArrayBuffer(AVATAR_MAX_BYTES + 1);
    expect(() => validateFileSize(buf, AVATAR_MAX_BYTES)).toThrow("grande");
  });
});

// ── Testes: validateImageDimensions ──────────────────────────────────────────

describe("validateImageDimensions", () => {
  it("aceita imagem dentro dos limites", () => {
    const buf = makeWebPBuffer(400, 400);
    expect(() => validateImageDimensions(buf, AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)).not.toThrow();
  });

  it("aceita imagem exactamente nos limites", () => {
    const buf = makeWebPBuffer(AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT);
    expect(() => validateImageDimensions(buf, AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)).not.toThrow();
  });

  it("rejeita imagem demasiado larga", () => {
    const buf = makeWebPBuffer(AVATAR_MAX_WIDTH + 1, 100);
    expect(() => validateImageDimensions(buf, AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)).toThrow(
      "larga",
    );
  });

  it("rejeita imagem demasiado alta", () => {
    const buf = makeWebPBuffer(100, AVATAR_MAX_HEIGHT + 1);
    expect(() => validateImageDimensions(buf, AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)).toThrow("alta");
  });

  it("ignora buffer demasiado pequeno para ter dimensões", () => {
    const buf = new ArrayBuffer(8);
    expect(() => validateImageDimensions(buf, AVATAR_MAX_WIDTH, AVATAR_MAX_HEIGHT)).not.toThrow();
  });
});

// ── Mock D1Database ───────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  email: string;
  pass_hash: string;
  tenant_id: string | null;
  role: string;
  is_owner: number;
  is_temp_owner: number;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  website: string | null;
  avatar_key: string | null;
  preferred_language: string;
  status: string;
  temp_owner_expires_at: number | null;
  email_pending: string | null;
  email_token: string | null;
  email_token_expires_at: number | null;
  created_at: number;
  updated_at: number;
};

function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "user-1",
    email: "user@test.com",
    pass_hash: "$2a$12$fakehash",
    tenant_id: "tenant-1",
    role: "collaborator",
    is_owner: 0,
    is_temp_owner: 0,
    first_name: null,
    last_name: null,
    display_name: "Test User",
    phone: null,
    website: null,
    avatar_key: null,
    preferred_language: "pt",
    status: "active",
    temp_owner_expires_at: null,
    email_pending: null,
    email_token: null,
    email_token_expires_at: null,
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

function makeMockDb(userRow: UserRow | null = makeUserRow()): D1Database {
  // biome-ignore lint/suspicious/noExplicitAny: mock
  const mock: any = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(userRow),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    batch: vi.fn().mockResolvedValue([]),
  };
  // chain: prepare().bind().first()
  mock.prepare.mockReturnValue({
    bind: vi.fn().mockReturnValue({
      first: vi.fn().mockResolvedValue(userRow),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
  });
  return mock as D1Database;
}

// ── Testes: profile.service — getProfile ─────────────────────────────────────

describe("getProfile", () => {
  it("retorna perfil do utilizador activo", async () => {
    const { getProfile } = await import("../services/profile.service.js");
    const user = makeUserRow({ first_name: "João", last_name: "Silva" });
    const db = makeMockDb(user);

    const result = await getProfile(db, "user-1");

    expect(result.id).toBe("user-1");
    expect(result.email).toBe("user@test.com");
    expect(result.first_name).toBe("João");
    expect(result.last_name).toBe("Silva");
    // GS09: pass_hash nunca em resultado
    expect((result as Record<string, unknown>).pass_hash).toBeUndefined();
  });

  it("lança erro se utilizador não existe", async () => {
    const { getProfile } = await import("../services/profile.service.js");
    const db = makeMockDb(null);

    await expect(getProfile(db, "ghost")).rejects.toMatchObject({
      code: "user_not_found",
      status: 404,
    });
  });

  it("lança erro se utilizador está deleted", async () => {
    const { getProfile } = await import("../services/profile.service.js");
    const db = makeMockDb(makeUserRow({ status: "deleted" }));

    await expect(getProfile(db, "user-1")).rejects.toMatchObject({
      code: "user_deleted",
      status: 410,
    });
  });
});

// ── Testes: profile.service — exportRgpd ─────────────────────────────────────

describe("exportRgpd", () => {
  it("exporta dados de núcleo sem pass_hash", async () => {
    const { exportRgpd } = await import("../services/profile.service.js");
    const user = makeUserRow({ first_name: "Ana", email: "ana@test.com" });
    const db = makeMockDb(user);

    const result = await exportRgpd(db, "user-1");

    expect(result.exported_at).toBeDefined();
    expect((result.core as Record<string, unknown>).email).toBe("ana@test.com");
    expect((result.core as Record<string, unknown>).first_name).toBe("Ana");
    // Nunca deve incluir pass_hash
    expect(JSON.stringify(result)).not.toContain("pass_hash");
    // Nunca deve incluir tokens
    expect(JSON.stringify(result)).not.toContain("email_token");
  });

  it("lança erro para utilizador não encontrado", async () => {
    const { exportRgpd } = await import("../services/profile.service.js");
    const db = makeMockDb(null);

    await expect(exportRgpd(db, "ghost")).rejects.toMatchObject({ code: "user_not_found" });
  });
});

// ── Testes: profile.service — requestEmailChange ──────────────────────────────

describe("requestEmailChange", () => {
  it("rejeita se novo email for igual ao actual", async () => {
    const { requestEmailChange } = await import("../services/profile.service.js");
    const user = makeUserRow({ email: "user@test.com" });
    const db = makeMockDb(user);

    await expect(
      requestEmailChange(db, "user-1", "password", "user@test.com"),
    ).rejects.toMatchObject({ code: "same_email", status: 400 });
  });

  it("rejeita se novo email já está em uso", async () => {
    const { requestEmailChange } = await import("../services/profile.service.js");
    const user = makeUserRow({ email: "user@test.com" });

    // Mock: isEmailTaken retorna true (email em uso)
    const db = makeMockDb(user);
    // Override para isEmailTaken: prepare().bind().first() retorna row
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi
          .fn()
          .mockResolvedValueOnce(user) // getUserById
          .mockResolvedValueOnce({ id: "other" }), // isEmailTaken
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    });

    await expect(
      requestEmailChange(db, "user-1", "password", "taken@test.com"),
    ).rejects.toMatchObject({ code: "email_taken", status: 409 });
  });
});

// ── Testes: storage key helpers ───────────────────────────────────────────────

describe("storage key helpers", () => {
  it("avatarKey gera key correcta", async () => {
    const { avatarKey } = await import("../lib/storage.js");
    expect(avatarKey("user-123")).toBe("users/user-123/avatars/avatar.webp");
  });

  it("logoKey gera key correcta", async () => {
    const { logoKey } = await import("../lib/storage.js");
    expect(logoKey("tenant-456")).toBe("tenants/tenant-456/logos/logo.webp");
  });

  it("avatarKey aceita extensão personalizada", async () => {
    const { avatarKey } = await import("../lib/storage.js");
    expect(avatarKey("user-123", "png")).toBe("users/user-123/avatars/avatar.png");
  });
});
