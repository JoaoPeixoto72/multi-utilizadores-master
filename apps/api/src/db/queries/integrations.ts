/**
 * db/queries/integrations.ts — Queries D1 para integrações (M7)
 *
 * R: BUILD_PLAN.md §M7.1, §M7.2
 * R: migrations/0008_integrations.sql
 */

export interface IntegrationRow {
  id: string;
  category: string;
  provider: string;
  credentials_encrypted: string;
  is_active: number;
  tested_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── SELECT ────────────────────────────────────────────────────────────────────

export async function listIntegrations(db: D1Database): Promise<IntegrationRow[]> {
  const res = await db
    .prepare("SELECT * FROM integrations ORDER BY category, created_at DESC")
    .all<IntegrationRow>();
  return res.results ?? [];
}

export async function getActiveIntegrationByCategory(
  db: D1Database,
  category: string,
): Promise<IntegrationRow | null> {
  return db
    .prepare("SELECT * FROM integrations WHERE category = ? AND is_active = 1 LIMIT 1")
    .bind(category)
    .first<IntegrationRow>();
}

export async function getIntegrationById(
  db: D1Database,
  id: string,
): Promise<IntegrationRow | null> {
  return db.prepare("SELECT * FROM integrations WHERE id = ?").bind(id).first<IntegrationRow>();
}

// ── INSERT ────────────────────────────────────────────────────────────────────

export async function insertIntegration(
  db: D1Database,
  input: {
    category: string;
    provider: string;
    credentials_encrypted: string;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO integrations (id, category, provider, credentials_encrypted)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(id, input.category, input.provider, input.credentials_encrypted)
    .run();
  return id;
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateIntegrationCredentials(
  db: D1Database,
  id: string,
  credentials_encrypted: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE integrations
       SET credentials_encrypted = ?, is_active = 0, tested_at = NULL
       WHERE id = ?`,
    )
    .bind(credentials_encrypted, id)
    .run();
}

export async function setIntegrationTested(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE integrations SET tested_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    )
    .bind(id)
    .run();
}

export async function activateIntegration(
  db: D1Database,
  id: string,
  category: string,
): Promise<void> {
  // Desactivar outras integrações da mesma categoria (excepto payments)
  if (category !== "payments") {
    await db
      .prepare("UPDATE integrations SET is_active = 0 WHERE category = ? AND id != ?")
      .bind(category, id)
      .run();
  }
  await db.prepare("UPDATE integrations SET is_active = 1 WHERE id = ?").bind(id).run();
}

export async function deactivateIntegration(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE integrations SET is_active = 0 WHERE id = ?").bind(id).run();
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteIntegration(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM integrations WHERE id = ?").bind(id).run();
}
