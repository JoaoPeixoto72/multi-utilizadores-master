<script lang="ts">
  /**
   * (admin)/dashboard/+page.svelte — Dashboard de empresa
   *
   * R: BUILD_PLAN.md §M3.3, §M4.2
   * R: design-guidelines.md §5 — tokens only
   *
   * Admin/Owner/Member: estatísticas de equipa + acções rápidas
   * Colaborador: módulos disponíveis (stub M4, módulos reais em M10)
   */
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  const isOwner = $derived(
    data.adminUser.is_owner === 1 || data.adminUser.is_temp_owner === 1,
  );
  // Sócios (members) também podem convidar colaboradores
  const canInviteMember = $derived(isOwner || data.adminUser.role === "member");
  const canManageTeam = $derived(data.isAdmin);
</script>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">{m.admin_dashboard_title()}</h1>
  </div>

  {#if data.isAdmin}
    <!-- ── Vista admin/owner/member ── -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">
          {data.stats.members.count}{#if data.stats.members.limit > 0}<span
              class="stat-limit">/{data.stats.members.limit}</span
            >{/if}
        </span>
        <span class="stat-label">{m.dashboard_seat_members()}</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">
          {data.stats.collaborators
            .count}{#if data.stats.collaborators.limit > 0}<span
              class="stat-limit">/{data.stats.collaborators.limit}</span
            >{/if}
        </span>
        <span class="stat-label">{m.dashboard_seat_collaborators()}</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">
          {data.stats.clients.count}{#if data.stats.clients.limit > 0}<span
              class="stat-limit">/{data.stats.clients.limit}</span
            >{/if}
        </span>
        <span class="stat-label">{m.dashboard_seat_clients()}</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">
          {data.stats.total.count}{#if data.stats.total.limit > 0}<span
              class="stat-limit">/{data.stats.total.limit}</span
            >{/if}
        </span>
        <span class="stat-label">{m.dashboard_seat_total()}</span>
      </div>
    </div>

    {#if canManageTeam}
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">{m.admin_dashboard_quick_actions()}</h2>
        </div>
        <div class="actions-grid">
          <a href="/team" class="action-card">
            <span class="action-icon" aria-hidden="true"
              >{@html Icons.users}</span
            >
            <span class="action-label">{m.admin_dashboard_manage_team()}</span>
          </a>
          <a href="/team?tab=invitations" class="action-card">
            <span class="action-icon" aria-hidden="true"
              >{@html Icons.mail}</span
            >
            <span class="action-label">{m.team_invite_btn()}</span>
          </a>
        </div>
      </div>
    {/if}
  {:else}
    <!-- ── Vista colaborador ── -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">{m.dashboard_my_modules()}</h2>
      </div>

      {#if data.modules.length === 0}
        <div class="empty-state">
          <span class="empty-icon" aria-hidden="true">{@html Icons.zap}</span>
          <p class="empty-text">{m.dashboard_no_modules()}</p>
        </div>
      {:else}
        <div class="modules-grid">
          {#each data.modules as mod}
            {#if mod.has_access}
              <a href="/modules/{mod.id}" class="module-card">
                <span class="module-icon" aria-hidden="true"
                  >{@html Icons.zap}</span
                >
                <span class="module-label">{mod.name_key || mod.id}</span>
              </a>
            {:else}
              <div class="module-card module-card--locked" aria-disabled="true">
                <span class="module-icon" aria-hidden="true"
                  >{@html Icons.shieldCheck}</span
                >
                <span class="module-label">{mod.name_key || mod.id}</span>
                <Badge variant="default">{m.dashboard_module_no_access()}</Badge
                >
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: var(--page-content-max-w);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }

  /* ── Stats ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
  }

  .stat-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stat-value {
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    line-height: 1;
  }

  .stat-limit {
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
    color: var(--text-muted);
  }

  .stat-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  /* ── Section ── */
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  /* ── Actions ── */
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-6);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    text-decoration: none;
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
    cursor: pointer;
  }

  .action-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-input-hover);
  }

  .action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--text-secondary);
  }

  .action-icon :global(svg) {
    width: 28px;
    height: 28px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  .action-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-primary);
    text-align: center;
  }

  /* ── Modules ── */
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-4);
  }

  .module-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    text-decoration: none;
    transition: background-color var(--duration-fast) var(--ease-out);
    position: relative;
  }

  .module-card:not(.module-card--locked):hover {
    background-color: var(--bg-hover);
  }

  .module-card--locked {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .module-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-secondary);
  }

  .module-icon :global(svg) {
    width: 22px;
    height: 22px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  .module-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-primary);
    text-align: center;
  }

  /* ── Empty state ── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-12) var(--space-8);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }

  .empty-icon {
    font-size: var(--text-3xl);
    opacity: 0.4;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .empty-icon :global(svg) {
    width: 40px;
    height: 40px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  .empty-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-align: center;
    margin: 0;
  }
</style>
