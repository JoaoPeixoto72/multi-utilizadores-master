/**
 * modules.config.ts — Registo central de módulos (M10)
 *
 * R: BUILD_PLAN.md §M10.1
 * R: briefing.md §4 — sistema de módulos pluggable
 *
 * Cada módulo declara:
 *   id                   — identificador único (snake_case)
 *   name_key             — chave i18n para o nome
 *   icon                 — emoji ou código de ícone
 *   description_key      — chave i18n para descrição curta
 *   integrations_required — categorias de integração necessárias (de INTEGRATION_CATEGORIES)
 *   permissions          — lista de permissões granulares (usadas em module_permissions)
 *   limits_schema        — limites default para tenant_module_limits
 *   handlers             — lifecycle hooks (implementados per-módulo; null = stub)
 */

export interface ModuleLimitDefault {
  key: string;
  value: string;
  description: string;
}

export interface ModulePermission {
  key: string;
  label_key: string;
  description_key: string;
}

export interface ModuleHandlers {
  onUserDelete?: (userId: string, tenantId: string, db: D1Database, r2: R2Bucket) => Promise<void>;
  onTenantDelete?: (tenantId: string, db: D1Database, r2: R2Bucket) => Promise<void>;
  onCronMaintenance?: (db: D1Database, r2: R2Bucket, env: Env) => Promise<void>;
  onRgpdExport?: (
    userId: string,
    tenantId: string,
    db: D1Database,
  ) => Promise<Record<string, unknown>>;
}

export interface ModuleDefinition {
  id: string;
  name_key: string;
  icon: string;
  description_key: string;
  integrations_required: string[]; // categorias: "email","sms","llm","storage","calendar","payments","pdf"
  permissions: ModulePermission[];
  limits_schema: ModuleLimitDefault[];
  handlers: ModuleHandlers;
}

// ── Módulos registados ────────────────────────────────────────────────────────
// Nesta fase (M10) define-se a infra. Módulos de negócio serão adicionados progressivamente.
// Cada módulo futuro é adicionado a este array — o registry faz o resto automaticamente.

export const MODULES: ModuleDefinition[] = [
  {
    id: "core",
    name_key: "module.core.name",
    icon: "🏠",
    description_key: "module.core.description",
    integrations_required: [],
    permissions: [],
    limits_schema: [
      { key: "max_users", value: "10", description: "Máximo de utilizadores" },
      { key: "max_storage_mb", value: "500", description: "Armazenamento máximo (MB)" },
    ],
    handlers: {},
  },
  {
    id: "notifications",
    name_key: "module.notifications.name",
    icon: "🔔",
    description_key: "module.notifications.description",
    integrations_required: [],
    permissions: [
      {
        key: "notifications.read",
        label_key: "module.notifications.perm.read",
        description_key: "module.notifications.perm.read.desc",
      },
    ],
    limits_schema: [
      { key: "max_notifications", value: "1000", description: "Notificações em arquivo" },
    ],
    handlers: {},
  },
  {
    id: "backups",
    name_key: "module.backups.name",
    icon: "💾",
    description_key: "module.backups.description",
    integrations_required: [],
    permissions: [],
    limits_schema: [
      { key: "max_backups", value: "10", description: "Backups retidos por empresa" },
      { key: "retention_days", value: "30", description: "Dias de retenção padrão" },
    ],
    handlers: {},
  },
  {
    id: "activity",
    name_key: "module.activity.name",
    icon: "📋",
    description_key: "module.activity.description",
    integrations_required: [],
    permissions: [
      {
        key: "activity.read",
        label_key: "module.activity.perm.read",
        description_key: "module.activity.perm.read.desc",
      },
    ],
    limits_schema: [],
    handlers: {},
  },
  {
    id: "integrations",
    name_key: "module.integrations.name",
    icon: "⚡",
    description_key: "module.integrations.description",
    integrations_required: [],
    permissions: [],
    limits_schema: [],
    handlers: {},
  },
];
