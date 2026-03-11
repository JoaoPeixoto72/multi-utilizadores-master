<script lang="ts">
  /**
   * (super)/super/backups/+page.svelte — Lista global de backups (super user) (M8)
   *
   * R: BUILD_PLAN.md §M8.4
   */
  import type { PageData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { formatDateTimeMs, formatBytes } from "$lib/format";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  function formatSize(bytes: number | null): string {
    if (!bytes) return "—";
    return formatBytes(bytes);
  }

  function statusLabel(status: string): string {
    return (
      {
        pending: m.backup_status_pending(),
        running: m.backup_status_running(),
        done: m.backup_status_done(),
        failed: m.backup_status_failed(),
      }[status] ?? status
    );
  }

  function statusVariant(
    status: string,
  ): "default" | "success" | "warning" | "destructive" {
    return (
      ({
        pending: "warning",
        running: "default",
        done: "success",
        failed: "destructive",
      }[status] as any) ?? "default"
    );
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">{m.super_backups_title()}</h1>
      <p
        class="page-subtitle"
        style="color: var(--text-secondary); margin-top: var(--space-1); font-size: var(--text-sm);"
      >
        Monitorização global das cópias de segurança realizadas pelas empresas.
      </p>
    </div>
  </div>

  {#if data.backups.length === 0}
    <div class="empty">
      <span aria-hidden="true" class="empty-icon text-muted opacity-50"
        >{@html Icons.database}</span
      >
      <p style="margin-bottom: var(--space-2);">{m.super_backup_empty()}</p>
      <p style="font-size: var(--text-sm);">
        Os backups devem ser criados e geridos localmente pelos Administradores
        de cada empresa nos seus respetivos painéis. As cópias efetuadas irão
        aparecer listadas aqui.
      </p>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{m.common_date()}</th>
            <th>{m.super_backup_tenant_col()}</th>
            <th>{m.common_type()}</th>
            <th>{m.common_status()}</th>
            <th>{m.backup_size_col()}</th>
            <th>{m.super_backup_done_col()}</th>
          </tr>
        </thead>
        <tbody>
          {#each data.backups as b (b.id)}
            <tr>
              <td class="td-date">{formatDateTimeMs(b.created_at)}</td>
              <td><code class="mono">{b.tenant_id.substring(0, 8)}…</code></td>
              <td>
                <Badge variant="secondary">
                  {b.type === "full"
                    ? m.super_backup_type_full()
                    : m.super_backup_type_db()}
                </Badge>
              </td>
              <td>
                <Badge variant={statusVariant(b.status)}
                  >{statusLabel(b.status)}</Badge
                >
              </td>
              <td class="td-size">{formatSize(b.size_bytes)}</td>
              <td class="td-date">{formatDateTimeMs(b.completed_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
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
    white-space: nowrap;
  }

  .table td {
    padding: var(--space-3) var(--space-4);
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }

  .table tr:last-child td {
    border-bottom: none;
  }
  .table tbody tr:hover td {
    background-color: var(--bg-hover);
  }

  .td-date {
    color: var(--text-secondary);
    white-space: nowrap;
  }
  .td-size {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
  }

  .mono {
    font-family: monospace;
    font-size: var(--text-xs);
    background-color: var(--bg-subtle);
    padding: 1px var(--space-1);
    border-radius: var(--radius-sm);
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
    stroke: var(--text-secondary);
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
