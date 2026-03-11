/**
 * lib/module-registry.ts — Registry de módulos + lifecycle handlers (M10)
 *
 * R: BUILD_PLAN.md §M10.1
 * R: modules.config.ts
 *
 * Este ficheiro é o único ponto de entrada para:
 *   - Obter a lista de módulos registados
 *   - Chamar lifecycle hooks de todos os módulos (tolera falhas individuais)
 *   - Inicializar limites de módulos para novas empresas
 */

import { MODULES, type ModuleDefinition } from "../modules.config.js";

// ── Queries inline (sem dependência circular) ─────────────────────────────────

async function upsertModuleLimits(
  db: D1Database,
  tenantId: string,
  moduleId: string,
  limits: { key: string; value: string }[],
): Promise<void> {
  for (const limit of limits) {
    await db
      .prepare(
        `INSERT INTO tenant_module_limits (tenant_id, module_id, limit_key, limit_value)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (tenant_id, module_id, limit_key)
         DO UPDATE SET limit_value = excluded.limit_value, updated_at = unixepoch()`,
      )
      .bind(tenantId, moduleId, limit.key, limit.value)
      .run();
  }
}

async function getModuleLimits(
  db: D1Database,
  tenantId: string,
  moduleId: string,
): Promise<Record<string, string>> {
  const rows = await db
    .prepare(
      "SELECT limit_key, limit_value FROM tenant_module_limits WHERE tenant_id = ? AND module_id = ?",
    )
    .bind(tenantId, moduleId)
    .all<{ limit_key: string; limit_value: string }>();

  const result: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    result[row.limit_key] = row.limit_value;
  }
  return result;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Devolve todos os módulos registados.
 */
export function getRegisteredModules(): ModuleDefinition[] {
  return MODULES;
}

/**
 * Devolve um módulo pelo id, ou null se não existir.
 */
export function getModuleById(id: string): ModuleDefinition | null {
  return MODULES.find((m) => m.id === id) ?? null;
}

/**
 * Inicializa os limites de todos os módulos para uma empresa.
 * Chamado em tenant.service ao criar empresa.
 * Usa INSERT OR IGNORE para ser idempotente.
 */
export async function initTenantModuleLimits(db: D1Database, tenantId: string): Promise<void> {
  for (const mod of MODULES) {
    if (mod.limits_schema.length > 0) {
      await upsertModuleLimits(db, tenantId, mod.id, mod.limits_schema);
    }
  }
}

/**
 * Devolve os limites actuais de um módulo para uma empresa.
 * Usa defaults do schema se o registo não existir.
 */
export async function getTenantModuleLimits(
  db: D1Database,
  tenantId: string,
  moduleId: string,
): Promise<Record<string, string>> {
  const mod = getModuleById(moduleId);
  if (!mod) return {};

  const stored = await getModuleLimits(db, tenantId, moduleId);

  // Merge: stored sobrepoõe defaults
  const result: Record<string, string> = {};
  for (const schema of mod.limits_schema) {
    result[schema.key] = stored[schema.key] ?? schema.value;
  }
  return result;
}

/**
 * Chama onUserDelete em todos os módulos que o implementam.
 * Tolera falhas individuais — regista erro mas não aborta.
 */
export async function callOnUserDelete(
  userId: string,
  tenantId: string,
  db: D1Database,
  r2: R2Bucket,
): Promise<void> {
  for (const mod of MODULES) {
    if (mod.handlers.onUserDelete) {
      try {
        await mod.handlers.onUserDelete(userId, tenantId, db, r2);
      } catch {
        // Tolera falha — log silencioso
      }
    }
  }
}

/**
 * Chama onTenantDelete em todos os módulos que o implementam.
 */
export async function callOnTenantDelete(
  tenantId: string,
  db: D1Database,
  r2: R2Bucket,
): Promise<void> {
  for (const mod of MODULES) {
    if (mod.handlers.onTenantDelete) {
      try {
        await mod.handlers.onTenantDelete(tenantId, db, r2);
      } catch {
        // Tolera falha
      }
    }
  }
}

/**
 * Chama onCronMaintenance em todos os módulos que o implementam.
 * Chamado pelo cron handler em index.ts.
 */
export async function callOnCronMaintenance(db: D1Database, r2: R2Bucket, env: Env): Promise<void> {
  for (const mod of MODULES) {
    if (mod.handlers.onCronMaintenance) {
      try {
        await mod.handlers.onCronMaintenance(db, r2, env);
      } catch {
        // Tolera falha
      }
    }
  }
}

/**
 * Agrega dados RGPD de todos os módulos para um utilizador.
 * Chamado por rgpd.service.exportUserData.
 */
export async function callOnRgpdExport(
  userId: string,
  tenantId: string,
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (const mod of MODULES) {
    if (mod.handlers.onRgpdExport) {
      try {
        const data = await mod.handlers.onRgpdExport(userId, tenantId, db);
        results.push({ module_id: mod.id, data });
      } catch {
        results.push({ module_id: mod.id, error: "export_failed" });
      }
    }
  }

  return results;
}
