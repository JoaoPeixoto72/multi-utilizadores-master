/**
 * services/rgpd.service.ts — Exportação RGPD agregada (M9)
 *
 * R: BUILD_PLAN.md §M9.2
 * R: briefing.md §3.9 (portabilidade de dados)
 *
 * Agrega:
 *   - Dados núcleo do utilizador (via profile.service)
 *   - Histórico de actividade do utilizador
 *   - Dados de módulos (via onRgpdExport handlers — a implementar em M10)
 */

import { exportActivityLogByTenant } from "../db/queries/activity-log.js";
import { callOnRgpdExport } from "../lib/module-registry.js";
import { exportRgpd as exportCoreRgpd } from "./profile.service.js";

export interface RgpdExport {
  exported_at: string;
  core: Record<string, unknown>;
  activity: ActivityEntry[];
  module_data: Record<string, unknown>[];
}

export interface ActivityEntry {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  was_temp_owner: number;
  created_at: number;
}

/**
 * exportUserData — exporta todos os dados pessoais de um utilizador.
 * Inclui: dados núcleo + histórico de actividade filtrado pelo actor_id.
 * M10 adicionará: module_data via callOnRgpdExport.
 */
export async function exportUserData(
  db: D1Database,
  userId: string,
  tenantId: string | null,
): Promise<RgpdExport> {
  // 1. Dados núcleo (profile + sessões)
  const core = await exportCoreRgpd(db, userId);

  // 2. Histórico de actividade (apenas acções do próprio utilizador)
  let activity: ActivityEntry[] = [];
  if (tenantId) {
    const rows = await exportActivityLogByTenant(db, tenantId);
    activity = rows
      .filter((r) => r.actor_id === userId)
      .map((r) => ({
        id: r.id,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id,
        was_temp_owner: r.was_temp_owner,
        created_at: r.created_at,
      }));
  }

  // 3. Dados de módulos via module-registry (M10)
  const module_data = tenantId ? await callOnRgpdExport(userId, tenantId, db) : [];

  return {
    exported_at: new Date().toISOString(),
    core: core.core as Record<string, unknown>,
    activity,
    module_data,
  };
}
