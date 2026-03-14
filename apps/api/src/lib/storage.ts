/**
 * lib/storage.ts — Upload e gestão de ficheiros em Cloudflare R2 (M5)
 *
 * R: BUILD_PLAN.md §M5.1
 * R: briefing.md §3.5 — avatar: WebP, máx 200KB, máx 512×512px
 * R: briefing.md §3.5 — logo: WebP, máx 200KB, máx 512×512px
 * R: briefing.md §3.9 — quota por empresa; super_user isento
 *
 * Keys namespaceadas:
 *   users/{user_id}/avatars/{filename}
 *   tenants/{tenant_id}/logos/{filename}
 */

import { getAppConfig } from "../db/queries/app-config.js";

// ── Constantes Fallback ───────────────────────────────────────────────────────

export const FALLBACK_MAX_BYTES = 200 * 1024; // 200 KB
export const FALLBACK_MAX_PIXELS = 512;

export const AVATAR_MAX_BYTES = FALLBACK_MAX_BYTES;
export const AVATAR_MAX_WIDTH = FALLBACK_MAX_PIXELS;
export const AVATAR_MAX_HEIGHT = FALLBACK_MAX_PIXELS;


// Removemos export das fixas pois a API agora consumirá variáveis dinâmicas.

// WebP magic bytes: RIFF????WEBP
// bytes 0-3: 52 49 46 46 ("RIFF")
// bytes 8-11: 57 45 42 50 ("WEBP")
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface StorageError extends Error {
  code: string;
  status: number;
}

function storageError(message: string, code: string, status: number): StorageError {
  return Object.assign(new Error(message), { code, status }) as StorageError;
}

// ── Validações ─────────────────────────────────────────────────────────────────

/**
 * Valida magic bytes WebP.
 * Formato: RIFF[4 bytes tamanho]WEBP
 */
export function validateWebP(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 12) {
    throw storageError("Ficheiro inválido: demasiado pequeno.", "invalid_webp", 400);
  }
  const bytes = new Uint8Array(buffer);
  const isRiff = WEBP_RIFF.every((b, i) => bytes[i] === b);
  const isWebp = WEBP_MARKER.every((b, i) => bytes[8 + i] === b);
  if (!isRiff || !isWebp) {
    throw storageError(
      "Formato inválido. Apenas WebP é aceite. Converta a imagem no browser antes de enviar.",
      "invalid_webp",
      400,
    );
  }
}

/**
 * Valida tamanho em bytes.
 */
export function validateFileSize(buffer: ArrayBuffer, maxBytes: number): void {
  if (buffer.byteLength > maxBytes) {
    const maxKb = Math.round(maxBytes / 1024);
    throw storageError(`Ficheiro demasiado grande. Máximo ${maxKb} KB.`, "file_too_large", 400);
  }
}

/**
 * Valida dimensões de imagem WebP.
 *
 * Cloudflare Workers não tem acesso à Canvas API. As dimensões devem ser
 * enviadas pelo cliente (após conversão WebP) e validadas contra os limites.
 * Alternativamente, parsear o header VP8/VP8L do container WebP.
 *
 * Neste projecto: lemos as dimensões do header WebP directamente.
 * VP8 (lossy): bytes 26-27 = largura-1 (14 bits), bytes 28-29 = altura-1 (14 bits)
 * VP8L (lossless): byte 5 = 0x2f (signature), depois bits específicos
 * VP8X (extended): bytes 24-26 = largura-1 (24 bits), bytes 27-29 = altura-1 (24 bits)
 */
export function validateImageDimensions(
  buffer: ArrayBuffer,
  maxWidth: number,
  maxHeight: number,
): void {
  const bytes = new Uint8Array(buffer);
  // Ler tipo de chunk WebP (bytes 12-15)
  if (buffer.byteLength < 16) return; // muito pequeno para ter dimensões

  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  let width = 0;
  let height = 0;

  if (chunkType === "VP8 ") {
    // Lossy: dimensões em bytes 26-27 (width-1) e 28-29 (height-1), little-endian 16-bit
    if (buffer.byteLength < 30) return;
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    width += 1;
    height += 1;
  } else if (chunkType === "VP8L") {
    // Lossless: byte 20 = 0x2f; bits 1-14 = width-1, bits 15-27 = height-1
    if (buffer.byteLength < 25) return;
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const bits = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >> 14) & 0x3fff) + 1;
  } else if (chunkType === "VP8X") {
    // Extended: dimensões em bytes 24-26 (width-1) e 27-29 (height-1), little-endian 24-bit
    if (buffer.byteLength < 30) return;
    width = ((bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) & 0xffffff) + 1;
    height = ((bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) & 0xffffff) + 1;
  }

  if (width > 0 && width > maxWidth) {
    throw storageError(
      `Imagem demasiado larga. Máximo ${maxWidth}px (actual: ${width}px).`,
      "image_too_wide",
      400,
    );
  }
  if (height > 0 && height > maxHeight) {
    throw storageError(
      `Imagem demasiado alta. Máximo ${maxHeight}px (actual: ${height}px).`,
      "image_too_tall",
      400,
    );
  }
}

// ── R2 Operations ──────────────────────────────────────────────────────────────

/**
 * Faz upload de um ficheiro para R2.
 * @param key  - chave R2 namespaceada (ex: users/{id}/avatars/{filename})
 * @param buffer - conteúdo do ficheiro
 * @param contentType - MIME type (ex: "image/webp")
 * @param r2 - binding R2Bucket
 */
export async function uploadFile(
  key: string,
  buffer: ArrayBuffer,
  contentType: string,
  r2: R2Bucket,
): Promise<void> {
  await r2.put(key, buffer, {
    httpMetadata: { contentType },
  });
}

/**
 * Remove um ficheiro do R2. Silencioso se não existir.
 */
export async function deleteFile(key: string, r2: R2Bucket): Promise<void> {
  await r2.delete(key);
}

/**
 * Gera uma key namespaceada para avatar de utilizador.
 */
export function avatarKey(userId: string, ext = "webp"): string {
  return `users/${userId}/avatars/avatar.${ext}`;
}

/**
 * Gera uma key namespaceada para logótipo de tenant.
 */
export function logoKey(tenantId: string, ext = "webp"): string {
  return `tenants/${tenantId}/logos/logo.${ext}`;
}

/**
 * Valida e faz upload de avatar/logo (WebP, tamanho e dimensões).
 * Lemos as variáveis de sistema via `appConfig`.
 * Retorna a key R2.
 */
export async function uploadImage(db: D1Database, key: string, buffer: ArrayBuffer, r2: R2Bucket): Promise<string> {
  validateWebP(buffer);

  let maxBytes = FALLBACK_MAX_BYTES;
  let maxPixels = FALLBACK_MAX_PIXELS;

  try {
    const confKb = await getAppConfig(db, "sys_image_max_kb");
    if (confKb) {
      maxBytes = parseInt(confKb, 10) * 1024;
    }
    const confPx = await getAppConfig(db, "sys_image_max_px");
    if (confPx) {
      maxPixels = parseInt(confPx, 10);
    }
  } catch {
    // Falha silenciosa: usa os fallbacks
  }

  validateFileSize(buffer, maxBytes);
  validateImageDimensions(buffer, maxPixels, maxPixels);

  await uploadFile(key, buffer, "image/webp", r2);
  return key;
}
