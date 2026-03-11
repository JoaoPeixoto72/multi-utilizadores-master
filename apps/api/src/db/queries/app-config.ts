/**
 * db/queries/app-config.ts — Configuração global da aplicação
 *
 * R: STACK_LOCK.md §7 — prepared statements
 * R: BUILD_PLAN.md §M2.2
 */

// ── Leitura ────────────────────────────────────────────────────────────────────

export async function getAppConfig(db: D1Database, key: string): Promise<string | null> {
  const result = await db
    .prepare("SELECT value FROM app_config WHERE key = ?1")
    .bind(key)
    .first<{ value: string }>();
  return result?.value ?? null;
}

export async function getAllAppConfig(db: D1Database): Promise<Record<string, string>> {
  const rows = (
    await db
      .prepare("SELECT key, value FROM app_config ORDER BY key ASC")
      .all<{ key: string; value: string }>()
  ).results;

  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ── Escrita ────────────────────────────────────────────────────────────────────

export async function setAppConfig(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO app_config (key, value, updated_at)
       VALUES (?1, ?2, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
    )
    .bind(key, value)
    .run();
}

export async function setManyAppConfig(
  db: D1Database,
  entries: Record<string, string>,
): Promise<void> {
  const stmts = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO app_config (key, value, updated_at)
         VALUES (?1, ?2, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`,
      )
      .bind(key, value),
  );
  if (stmts.length > 0) await db.batch(stmts);
}
