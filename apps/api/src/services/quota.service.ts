/**
 * services/quota.service.ts — Verificação e débito de quotas
 *
 * R: BUILD_PLAN.md §M2.3
 * R: briefing.md §3 — limites por empresa
 */

import { getDailyEmailCount, incrementDailyEmailCount } from "../db/queries/email-counters.js";
import { decrementStorage, getStorageUsage, incrementStorage } from "../db/queries/storage.js";
import { getTenantById } from "../db/queries/tenants.js";

export interface QuotaError {
  type: "storage_exceeded" | "email_limit_exceeded" | "tenant_not_found";
  message: string;
}

// Devolve a data actual em 'YYYY-MM-DD' (UTC)
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Storage ───────────────────────────────────────────────────────────────────

/**
 * Verifica se a empresa tem espaço suficiente e, em caso afirmativo,
 * debita os bytes. Devolve null em sucesso ou QuotaError em falha.
 */
export async function checkAndDebitStorage(
  db: D1Database,
  tenantId: string,
  bytes: number,
): Promise<QuotaError | null> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) return { type: "tenant_not_found", message: "Empresa não encontrada." };

  const used = await getStorageUsage(db, tenantId);
  if (used + bytes > tenant.storage_limit_bytes) {
    return { type: "storage_exceeded", message: "Quota de armazenamento excedida." };
  }

  await incrementStorage(db, tenantId, bytes);
  return null;
}

/**
 * Liberta espaço após remoção de ficheiro.
 */
export async function releaseStorage(
  db: D1Database,
  tenantId: string,
  bytes: number,
): Promise<void> {
  await decrementStorage(db, tenantId, bytes);
}

// ── Email diário ──────────────────────────────────────────────────────────────

/**
 * Verifica se a empresa ainda pode enviar emails hoje e, em caso afirmativo,
 * incrementa o contador. Devolve null em sucesso ou QuotaError em falha.
 */
export async function checkAndDebitEmail(
  db: D1Database,
  tenantId: string,
): Promise<QuotaError | null> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) return { type: "tenant_not_found", message: "Empresa não encontrada." };

  const today = todayUTC();
  const count = await getDailyEmailCount(db, tenantId, today);

  if (count >= tenant.daily_email_limit) {
    return { type: "email_limit_exceeded", message: "Limite diário de emails atingido." };
  }

  await incrementDailyEmailCount(db, tenantId, today);
  return null;
}

/**
 * Consulta o estado actual das quotas de uma empresa.
 */
export async function getQuotaSummary(
  db: D1Database,
  tenantId: string,
): Promise<{
  storage_used: number;
  storage_limit: number;
  emails_today: number;
  emails_limit: number;
} | null> {
  const tenant = await getTenantById(db, tenantId);
  if (!tenant) return null;

  const [storageUsed, emailsToday] = await Promise.all([
    getStorageUsage(db, tenantId),
    getDailyEmailCount(db, tenantId, todayUTC()),
  ]);

  return {
    storage_used: storageUsed,
    storage_limit: tenant.storage_limit_bytes,
    emails_today: emailsToday,
    emails_limit: tenant.daily_email_limit,
  };
}
