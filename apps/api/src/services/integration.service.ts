/**
 * services/integration.service.ts — Serviço de integrações externas (M7)
 *
 * R: BUILD_PLAN.md §M7.2, §M7.4
 * R: STACK_LOCK.md §18 — circuit breaker obrigatório; zero process.env
 *
 * Camada central: módulos NUNCA chamam fornecedores directamente.
 * Todos os acessos externos passam por getActiveEmailAdapter() etc.
 */

import { incrementDailyEmailCount } from "../db/queries/email-counters.js";
import {
  activateIntegration,
  deactivateIntegration,
  deleteIntegration,
  getActiveIntegrationByCategory,
  getIntegrationById,
  type IntegrationRow,
  insertIntegration,
  listIntegrations,
  setIntegrationTested,
  updateIntegrationCredentials,
} from "../db/queries/integrations.js";
import { decrypt, encrypt } from "../lib/encryption.js";
import type {
  EmailAdapter,
  EmailMessage,
  EmailSendResult,
} from "../lib/integrations/adapter.interface.js";
import { ResendEmailAdapter } from "../lib/integrations/email/resend.js";

// Re-exportar
export type { IntegrationRow };

// ── Erros ─────────────────────────────────────────────────────────────────────

export interface IntegrationServiceError {
  code: string;
  status: number;
  message: string;
}

function err(code: string, status: number, message: string): IntegrationServiceError {
  return { code, status, message };
}

// ── Listar ────────────────────────────────────────────────────────────────────

export async function getAllIntegrations(db: D1Database): Promise<IntegrationRow[]> {
  const rows = await listIntegrations(db);
  // Nunca devolver credentials_encrypted ao chamador (mascarar)
  return rows.map((r) => ({ ...r, credentials_encrypted: "***" }));
}

// ── Criar ─────────────────────────────────────────────────────────────────────

export async function createIntegration(
  db: D1Database,
  encryptionKey: string,
  input: {
    category: string;
    provider: string;
    credentials: Record<string, string>;
  },
): Promise<string> {
  const credentials_encrypted = await encrypt(JSON.stringify(input.credentials), encryptionKey);
  return insertIntegration(db, {
    category: input.category,
    provider: input.provider,
    credentials_encrypted,
  });
}

// ── Actualizar credenciais ─────────────────────────────────────────────────────

export async function updateCredentials(
  db: D1Database,
  encryptionKey: string,
  id: string,
  credentials: Record<string, string>,
): Promise<void> {
  const row = await getIntegrationById(db, id);
  if (!row) throw err("not_found", 404, "Integração não encontrada.");

  const credentials_encrypted = await encrypt(JSON.stringify(credentials), encryptionKey);
  await updateIntegrationCredentials(db, id, credentials_encrypted);
}

// ── Testar integração ─────────────────────────────────────────────────────────

export async function testIntegration(
  db: D1Database,
  encryptionKey: string,
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const row = await getIntegrationById(db, id);
  if (!row) throw err("not_found", 404, "Integração não encontrada.");

  let ok = false;
  let message = "Teste falhou.";

  try {
    const rawCreds = await decrypt(row.credentials_encrypted, encryptionKey);

    if (row.category === "email") {
      const adapter = buildEmailAdapter(row.provider, rawCreds);
      ok = await adapter.ping();
      message = ok
        ? `Ligação ao ${row.provider} validada com sucesso.`
        : `Falha na ligação ao ${row.provider}. Verifique a API key e o email de envio.`;
    } else {
      // Outras categorias: testar credenciais JSON (deserialização)
      JSON.parse(rawCreds);
      ok = true;
      message = "Credenciais válidas (teste básico).";
    }

    if (ok) await setIntegrationTested(db, id);
  } catch (e) {
    message = `Erro: ${e instanceof Error ? e.message : String(e)}`;
  }

  return { ok, message };
}

// ── Activar ───────────────────────────────────────────────────────────────────

export async function activateIntegrationById(db: D1Database, id: string): Promise<void> {
  const row = await getIntegrationById(db, id);
  if (!row) throw err("not_found", 404, "Integração não encontrada.");
  if (!row.tested_at)
    throw err("not_tested", 422, "A integração precisa ser testada antes de ser activada.");
  await activateIntegration(db, id, row.category);
}

// ── Desactivar ────────────────────────────────────────────────────────────────

export async function deactivateIntegrationById(db: D1Database, id: string): Promise<void> {
  const row = await getIntegrationById(db, id);
  if (!row) throw err("not_found", 404, "Integração não encontrada.");
  await deactivateIntegration(db, id);
}

// ── Eliminar ──────────────────────────────────────────────────────────────────

export async function removeIntegration(db: D1Database, id: string): Promise<void> {
  const row = await getIntegrationById(db, id);
  if (!row) throw err("not_found", 404, "Integração não encontrada.");
  await deleteIntegration(db, id);
}

// ── Factory de adaptadores ────────────────────────────────────────────────────

function buildEmailAdapter(provider: string, rawCreds: string): EmailAdapter {
  if (provider === "resend") return ResendEmailAdapter.fromCredentials(rawCreds);
  throw new Error(`email_provider_unsupported:${provider}`);
}

// ── Obter adaptador activo de email ───────────────────────────────────────────

export async function getActiveEmailAdapter(
  db: D1Database,
  encryptionKey: string,
): Promise<EmailAdapter | null> {
  const row = await getActiveIntegrationByCategory(db, "email");
  if (!row) return null;

  try {
    const rawCreds = await decrypt(row.credentials_encrypted, encryptionKey);
    return buildEmailAdapter(row.provider, rawCreds);
  } catch {
    return null;
  }
}

// ── Obter adaptador de email por ID (independente do estado activo) ────────────

export async function getEmailAdapterById(
  db: D1Database,
  encryptionKey: string,
  id: string,
): Promise<EmailAdapter | null> {
  const row = await getIntegrationById(db, id);
  if (!row || row.category !== "email") return null;

  try {
    const rawCreds = await decrypt(row.credentials_encrypted, encryptionKey);
    return buildEmailAdapter(row.provider, rawCreds);
  } catch {
    return null;
  }
}

// ── Enviar email (com limite diário) ─────────────────────────────────────────

export async function sendEmail(
  db: D1Database,
  encryptionKey: string,
  msg: EmailMessage,
  tenantId?: string,
): Promise<EmailSendResult | null> {
  const adapter = await getActiveEmailAdapter(db, encryptionKey);
  if (!adapter) return null; // Sem integração activa — silent

  // Verificar limite diário se tenantId fornecido
  if (tenantId) {
    const row = await db
      .prepare("SELECT daily_email_limit FROM tenants WHERE id = ?")
      .bind(tenantId)
      .first<{ daily_email_limit: number }>();

    if (row) {
      const today = new Date().toISOString().slice(0, 10);
      const counter = await db
        .prepare("SELECT count FROM tenant_daily_email_count WHERE tenant_id = ? AND date = ?")
        .bind(tenantId, today)
        .first<{ count: number }>();

      if (counter && counter.count >= row.daily_email_limit) {
        throw err("email_limit_exceeded", 429, "Limite diário de emails atingido.");
      }
    }
  }

  const result = await adapter.send(msg);

  // Incrementar contador diário (melhor-esforço)
  if (tenantId) {
    const today = new Date().toISOString().slice(0, 10);
    await incrementDailyEmailCount(db, tenantId, today).catch(() => {});
  }

  return result;
}
