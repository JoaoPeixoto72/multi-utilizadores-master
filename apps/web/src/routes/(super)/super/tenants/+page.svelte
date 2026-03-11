<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { formatDateShort } from "$lib/format";
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
        pending: m.status_pending(),
        active: m.status_active(),
        inactive: m.status_inactive(),
        deleted: m.status_deleted(),
      }[s] ?? s
    );
  }
</script>

<div class="page">
  <!-- ── Header ── -->
  <div class="page-header">
    <h1 class="page-title">{m.super_tenants_title()}</h1>
    <Button href="/super/tenants/new" variant="primary"
      >{m.super_tenants_new()}</Button
    >
  </div>

  <!-- ── Tabs de estado (reais) ── -->
  <div class="tabs-wrapper">
    <div
      class="tabs"
      role="tablist"
      aria-label={m.super_tenants_filter_label()}
    >
      <a
        href="/super/tenants"
        class="tab"
        class:tab-active={!data.currentStatus}
        role="tab"
        aria-selected={!data.currentStatus}
      >
        {m.super_tenants_all()}
        <span class="tab-count"
          >{data.meta.pending + data.meta.active + data.meta.inactive}</span
        >
      </a>
      <a
        href="/super/tenants?status=active"
        class="tab"
        class:tab-active={data.currentStatus === "active"}
        role="tab"
        aria-selected={data.currentStatus === "active"}
      >
        {m.super_tenants_active()}
        {#if data.meta.active > 0}
          <span class="tab-count tab-count-active">{data.meta.active}</span>
        {/if}
      </a>
      <a
        href="/super/tenants?status=inactive"
        class="tab"
        class:tab-active={data.currentStatus === "inactive"}
        role="tab"
        aria-selected={data.currentStatus === "inactive"}
      >
        {m.super_tenants_inactive()}
        {#if data.meta.inactive > 0}
          <span class="tab-count tab-count-inactive">{data.meta.inactive}</span>
        {/if}
      </a>
      <a
        href="/super/tenants?status=pending"
        class="tab"
        class:tab-active={data.currentStatus === "pending"}
        role="tab"
        aria-selected={data.currentStatus === "pending"}
      >
        {m.super_tenants_pending()}
        {#if data.meta.pending > 0}
          <span class="tab-count tab-count-pending">{data.meta.pending}</span>
        {/if}
      </a>
    </div>
  </div>

  <!-- ── Tabela / Empty ── -->
  {#if data.tenants.length === 0}
    <div class="empty">
      <span aria-hidden="true" class="empty-icon text-muted opacity-50"
        >{@html Icons.database}</span
      >
      <p>{m.super_tenants_empty()}</p>
      <Button href="/super/tenants/new" variant="primary"
        >{m.super_tenants_new()}</Button
      >
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{m.common_name()}</th>
            <th>{m.common_email()}</th>
            <th>{m.common_status()}</th>
            <th>{m.super_tenant_admin_seats_col()}</th>
            <th>{m.super_tenant_collab_col()}</th>
            <th>{m.super_tenant_clients_col()}</th>
            <th>{m.super_tenant_created_col()}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.tenants as tenant}
            <tr>
              <td class="td-name">{tenant.name}</td>
              <td class="td-email">{tenant.email}</td>
              <td>
                <Badge variant={tenant.status}>
                  {statusLabel(tenant.status)}
                </Badge>
              </td>
              <td class="td-seats">
                {tenant.user_count} / {tenant.admin_seat_limit}
              </td>
              <td class="td-seats">
                {tenant.collab_count} / {tenant.member_seat_limit}
              </td>
              <td class="td-seats">
                {tenant.client_count} / {tenant.client_seat_limit}
              </td>
              <td class="td-date">{formatDate(tenant.created_at)}</td>
              <td>
                <Button
                  href={`/super/tenants/${tenant.id}`}
                  variant="ghost"
                  size="sm">{m.super_tenants_view()}</Button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Paginação cursor -->
    {#if data.nextCursor}
      <div class="pagination">
        <Button
          href={`/super/tenants?cursor=${data.nextCursor}${data.currentStatus ? "&status=" + data.currentStatus : ""}`}
          variant="outline"
        >
          {m.super_tenants_next_page()}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* ── Layout ── */
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

  /* ── Tabs ── */
  .tabs-wrapper {
    border-bottom: 1px solid var(--border-subtle);
  }

  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: -1px; /* overlap the border */
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    transition:
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text-primary);
    border-bottom-color: var(--border-subtle);
  }

  .tab.tab-active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 var(--space-1);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    background-color: var(--bg-subtle);
    color: var(--text-secondary);
  }

  .tab-count-pending {
    background-color: var(--badge-info-bg);
    color: var(--badge-info-text);
  }

  .tab-count-active {
    background-color: var(--badge-success-bg);
    color: var(--badge-success-text);
  }

  .tab-count-inactive {
    background-color: var(--badge-warning-bg);
    color: var(--badge-warning-text);
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

  .td-email,
  .td-date {
    color: var(--text-secondary);
  }
  .td-seats {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
  }
  /* ── Paginação ── */
  .pagination {
    display: flex;
    justify-content: center;
  }

  /* ── Empty ── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-12);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .empty .empty-icon :global(svg) {
    width: 40px;
    height: 40px;
    stroke: var(--text-muted);
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
