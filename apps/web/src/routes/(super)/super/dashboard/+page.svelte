<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";
  import { formatDateShort } from "$lib/format";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  function formatDate(ts: number): string {
    return formatDateShort(ts);
  }

  function statusLabel(s: string): string {
    return (
      {
        active: m.status_active(),
        inactive: m.status_inactive(),
        deleted: m.status_deleted(),
        pending: m.status_pending(),
      }[s] ?? s
    );
  }

  function statusClass(s: string): string {
    return (
      {
        active: "active",
        inactive: "inactive",
        deleted: "deleted",
        pending: "pending",
      }[s] ?? "default"
    );
  }
</script>

<div class="page">
  <!-- Título -->
  <div class="page-header">
    <h1 class="page-title">{m.super_dashboard_title()}</h1>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-value">{data.stats.active}</span>
      <span class="stat-label">{m.super_stats_active()}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{data.stats.inactive}</span>
      <span class="stat-label">{m.super_stats_inactive()}</span>
    </div>
    <div class="stat-card">
      <span class="stat-value"
        >{(data.stats.active ?? 0) + (data.stats.inactive ?? 0)}</span
      >
      <span class="stat-label">{m.super_stats_total()}</span>
    </div>
  </div>

  <!-- Empresas ATIVAS -->
  <div class="section">
    <div class="section-header">
      <h2 class="section-title">{m.super_dashboard_active_tenants()}</h2>
      <a href="/super/tenants?status=active" class="link-more"
        >{m.super_see_all()}</a
      >
    </div>

    {#if data.activeCompanies.length === 0}
      <div class="empty">{m.super_dashboard_no_active_tenants()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_name()}</th>
              <th>{m.common_email()}</th>
              <th>{m.super_tenant_created_at()}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each data.activeCompanies as tenant}
              <tr>
                <td class="td-name">{tenant.name}</td>
                <td class="td-email">{tenant.email}</td>
                <td class="td-date">{formatDate(tenant.created_at)}</td>
                <td>
                  <Button
                    href={`/super/tenants/${tenant.id}`}
                    size="sm"
                    variant="secondary"
                  >
                    {m.common_view()}
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Todas as empresas recentes -->
  <div class="section">
    <div class="section-header">
      <h2 class="section-title">{m.super_recent_companies()}</h2>
      <a href="/super/tenants" class="link-more">{m.super_see_all()}</a>
    </div>

    {#if data.recent.length === 0}
      <div class="empty">{m.super_no_companies()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_name()}</th>
              <th>{m.common_email()}</th>
              <th>{m.common_status()}</th>
              <th>{m.super_tenant_created_at()}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each data.recent as tenant}
              <tr>
                <td class="td-name">{tenant.name}</td>
                <td class="td-email">{tenant.email}</td>
                <td>
                  <Badge variant={statusClass(tenant.status) || "default"}>
                    {statusLabel(tenant.status)}
                  </Badge>
                </td>
                <td class="td-date">{formatDate(tenant.created_at)}</td>
                <td>
                  <Button
                    href={`/super/tenants/${tenant.id}`}
                    size="sm"
                    variant="secondary"
                  >
                    {m.common_view()}
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
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

  .link-more {
    font-size: var(--text-sm);
    color: var(--brand-600);
    text-decoration: none;
  }

  .link-more:hover {
    text-decoration: underline;
  }

  /* ── Table ── */
  .table-wrap {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .table th {
    padding: var(--space-3) var(--space-4);
    text-align: left;
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    border-bottom: 1px solid var(--border-subtle);
    background-color: var(--bg-table-header);
  }

  .table td {
    padding: var(--space-3) var(--space-4);
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
  }

  .table tr:last-child td {
    border-bottom: none;
  }
  .table tbody tr:hover td {
    background-color: var(--bg-hover);
  }

  .td-email {
    color: var(--text-secondary);
  }

  .td-date {
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  /* Badge styles removed: rely on shared design system */

  /* ── Empty ── */
  .empty {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    padding: var(--space-8);
    text-align: center;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }
</style>
