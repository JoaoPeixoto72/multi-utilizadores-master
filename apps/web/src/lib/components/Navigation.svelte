<script lang="ts">
  /**
   * Navigation.svelte — Navegação dinâmica baseada em módulos (M10)
   *
   * R: BUILD_PLAN.md §M10.3
   * Recebe lista de módulos do servidor (via +layout.server.ts)
   * Mostra indicação visual para módulos que requerem integração não configurada.
   */
  import { page } from '$app/state';
  import * as m from '$lib/paraglide/messages.js';

  interface NavModule {
    id: string;
    name_key: string;
    icon: string;
    integrations_required: string[];
  }

  interface Props {
    modules: NavModule[];
    /** IDs de integrações activas (vazio se nenhuma) */
    activeIntegrations?: string[];
  }

  let { modules, activeIntegrations = [] }: Props = $props();

  // Mapa de módulo → rota
  const MODULE_ROUTES: Record<string, string> = {
    core: '/dashboard',
    notifications: '/notifications',
    backups: '/backups',
    activity: '/activity',
  };

  // Mapa de chave i18n → label PT (fallback enquanto M12 não está pronto)
  const MODULE_LABELS: Record<string, string> = {
    'module.core.name': 'Dashboard',
    'module.notifications.name': 'Notificações',
    'module.backups.name': 'Backups',
    'module.activity.name': 'Actividade',
    'module.integrations.name': 'Integrações',
  };

  function getLabel(name_key: string): string {
    return MODULE_LABELS[name_key] ?? name_key.split('.').pop() ?? name_key;
  }

  function getHref(mod: NavModule): string {
    return MODULE_ROUTES[mod.id] ?? `/modules/${mod.id}`;
  }

  function needsIntegration(mod: NavModule): boolean {
    if (mod.integrations_required.length === 0) return false;
    return !mod.integrations_required.every((cat) => activeIntegrations.includes(cat));
  }

  function isActive(mod: NavModule): boolean {
    const href = getHref(mod);
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<nav class="module-nav" aria-label={m.nav_aria_modules()}>
  {#each modules as mod (mod.id)}
    {@const href = getHref(mod)}
    {@const active = isActive(mod)}
    {@const missingIntegration = needsIntegration(mod)}
    <a
      {href}
      class="module-nav-item"
      class:active
      class:needs-integration={missingIntegration}
      aria-current={active ? 'page' : undefined}
      title={missingIntegration ? m.module_integration_required() : getLabel(mod.name_key)}
    >
      <span class="module-icon">{mod.icon}</span>
      <span class="module-label">{getLabel(mod.name_key)}</span>
      {#if missingIntegration}
        <span class="integration-badge" title={m.module_integration_missing()}>
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
      {/if}
    </a>
  {/each}
</nav>

<style>
  .module-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .module-nav-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    text-decoration: none;
    color: var(--color-text, #374151);
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.15s;
    position: relative;
  }

  .module-nav-item:hover {
    background: var(--brand-hover);
  }

  .module-nav-item.active {
    background: var(--brand-primary-light);
    color: var(--brand-primary);
  }

  .module-nav-item.needs-integration {
    opacity: 0.75;
  }

  .module-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .module-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .integration-badge {
    font-size: 0.75rem;
    flex-shrink: 0;
  }
</style>
