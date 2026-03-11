<script lang="ts">
  /**
   * (super)/super/audit/+page.svelte — Audit log global (M9/M12)
   *
   * R: BUILD_PLAN.md §M9.5, §M12
   */
  import type { PageData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import { formatDateTime, formatBytes } from "$lib/format";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  let breakGlassExpanded = $state(false);

  /** Mapa evento → ícone SVG inline (Lucide) */
  const EVENT_ICONS: Record<string, string> = {
    "tenant.created": Icons.building2,
    "tenant.activated": Icons.check,
    "tenant.deactivated": Icons.lock,
    "tenant.deleted": Icons.trash2,
    "tenant.soft_deleted": Icons.trash2,
    "tenant.hard_deleted": Icons.trash2,
    "user.created": Icons.user,
    "user.deleted": Icons.trash2,
    "backup.created": Icons.hardDrive,
    "backup.imported": Icons.download,
    "backup.deleted": Icons.trash2,
    "integration.created": Icons.zap,
    "integration.deleted": Icons.alertTriangle,
    "break_glass.downloaded": Icons.key,
  };

  function getIcon(event_type: string): string {
    return EVENT_ICONS[event_type] ?? Icons.clipboardList;
  }

  function getEventName(event_type: string): string {
    const names: Record<string, string> = {
      "tenant.created": "Empresa Criada",
      "tenant.activated": "Empresa Ativada",
      "tenant.deactivated": "Empresa Desativada",
      "tenant.deleted": "Empresa Eliminada",
      "tenant.soft_deleted": "Empresa Eliminada (Soft)",
      "tenant.hard_deleted": "Empresa Erradicada",
      "user.created": "Utilizador Criado",
      "user.deleted": "Utilizador Apagado",
      "backup.created": "Cópia Criada",
      "backup.imported": "Cópia Restaurada",
      "backup.deleted": "Cópia Apagada",
      "integration.created": "Integração Ligada",
      "integration.deleted": "Integração Desligada",
      "break_glass.downloaded": "Emergência Acionada",
    };
    return names[event_type] ?? event_type;
  }

  function getMetadataName(
    metadataString: string | null | undefined,
  ): string | null {
    try {
      if (!metadataString) return null;
      const parsed = JSON.parse(metadataString);
      return parsed.name || null;
    } catch {
      return null;
    }
  }
</script>

<div class="page">
  <!-- ── Header ── -->
  <div class="page-header">
    <div>
      <h1 class="page-title">{m.super_audit_title()}</h1>
      <p class="page-subtitle">{m.super_audit_subtitle()}</p>
    </div>
    <Button
      variant="danger-outline"
      onclick={() => (breakGlassExpanded = !breakGlassExpanded)}
      aria-expanded={breakGlassExpanded}
    >
      {m.super_audit_break_glass()}
    </Button>
  </div>

  <!-- ── Break-glass expandable section ── -->
  {#if breakGlassExpanded}
    <div class="break-glass-panel">
      <div class="bg-header">
        <span class="bg-icon">{@html Icons.alertTriangle}</span>
        <div class="bg-title-block">
          <h2 class="bg-title">{m.super_audit_break_glass_title()}</h2>
          <p class="bg-description">
            {m.super_audit_break_glass_description()}
          </p>
        </div>
      </div>

      <div class="bg-warning">
        <span aria-hidden="true" class="bg-warning-icon"
          >{@html Icons.alertTriangle}</span
        >
        {m.super_audit_break_glass_warning()}
      </div>

      <div class="bg-steps">
        <h3 class="bg-steps-title">{m.super_audit_break_glass_steps()}</h3>
        <ol class="bg-steps-list">
          <li>{m.super_audit_break_glass_step1()}</li>
          <li>{m.super_audit_break_glass_step2()}</li>
          <li>{m.super_audit_break_glass_step3()}</li>
          <li>{m.super_audit_break_glass_step4()}</li>
        </ol>
      </div>

      <div class="bg-actions">
        <Button
          href="/api/super/break-glass"
          variant="danger"
          target="_blank"
          rel="noopener noreferrer"
          onclick={() => (breakGlassExpanded = false)}
        >
          {m.super_audit_break_glass_btn()}
        </Button>
        <Button variant="outline" onclick={() => (breakGlassExpanded = false)}>
          {m.common_cancel()}
        </Button>
      </div>
    </div>
  {/if}

  <!-- ── Filtros ── -->
  <form method="GET" class="filters-bar">
    <input
      type="text"
      name="event_type"
      value={data.filters.event_type}
      placeholder={m.super_audit_event_placeholder()}
      class="filter-input"
    />
    <input
      type="text"
      name="tenant_id"
      value={data.filters.tenant_id}
      placeholder={m.super_audit_tenant_id_placeholder()}
      class="filter-input"
    />
    <Button type="submit" variant="primary">{m.common_filter()}</Button>
    {#if data.filters.event_type || data.filters.tenant_id}
      <Button href="/super/audit" variant="outline"
        >{m.super_audit_clear()}</Button
      >
    {/if}
  </form>

  <!-- ── Lista ── -->
  {#if data.items.length === 0}
    <div class="empty">
      <p>
        {data.filters.event_type || data.filters.tenant_id
          ? m.super_audit_empty_filter()
          : m.super_audit_empty()}
      </p>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{m.super_audit_event_col()}</th>
            <th>{m.super_audit_actor_col()}</th>
            <th>{m.super_audit_tenant_col()}</th>
            <th>{m.super_audit_target_col()}</th>
            <th>{m.super_audit_affected_col()}</th>
            <th>{m.common_date()}</th>
          </tr>
        </thead>
        <tbody>
          {#each data.items as item (item.id)}
            <tr>
              <td>
                <span class="event-cell">
                  <span class="event-icon" aria-hidden="true"
                    >{@html getIcon(item.event_type)}</span
                  >
                  <span class="event-type">{getEventName(item.event_type)}</span
                  >
                </span>
              </td>
              <td class="mono"
                >{item.actor_id ? item.actor_id.slice(0, 12) + "…" : "—"}</td
              >
              <td class="mono"
                >{item.tenant_id ? item.tenant_id.slice(0, 12) + "…" : "—"}</td
              >
              <td>
                {#if item.target_type}
                  <span class="target-cell">
                    <span class="target-type">{item.target_type}</span>
                    {#if item.target_id}
                      {@const metaName = getMetadataName(item.metadata)}
                      <span
                        class={metaName ? "target-name" : "mono target-id"}
                        title={item.target_id}
                      >
                        {metaName ? metaName : item.target_id.slice(0, 8) + "…"}
                      </span>
                    {/if}
                  </span>
                {:else}
                  —
                {/if}
              </td>
              <td>
                {#if item.bytes_affected > 0}
                  <span class="bytes-val"
                    >{formatBytes(item.bytes_affected)}</span
                  >
                {:else if item.count_affected > 0}
                  <span class="count-val"
                    >{m.audit_records({ count: item.count_affected })}</span
                  >
                {:else}
                  —
                {/if}
              </td>
              <td class="td-date">{formatDateTime(item.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if data.nextCursor}
      <div class="pagination">
        <Button
          href={`/super/audit?cursor=${data.nextCursor}${data.filters.event_type ? `&event_type=${data.filters.event_type}` : ""}${data.filters.tenant_id ? `&tenant_id=${data.filters.tenant_id}` : ""}`}
          variant="outline"
        >
          {m.common_load_more()}
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
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }

  .page-subtitle {
    color: var(--text-secondary);
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
  }

  /* ── Filtros ── */
  .filters-bar {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .filter-input {
    flex: 1;
    min-width: 180px;
    height: var(--size-input-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    background-color: var(--bg-input);
    color: var(--text-primary);
    outline: none;
    transition: box-shadow var(--duration-fast) var(--ease-out);
  }

  .filter-input:focus {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    border-color: var(--brand-600);
  }

  /* ── Table ── */
  .table-wrap {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    overflow-x: auto;
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
    white-space: nowrap;
    color: var(--text-secondary);
  }

  /* ── Event cell ── */
  .event-cell {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .event-icon {
    display: inline-flex;
    align-items: center;
    line-height: 1;
    color: var(--text-secondary);
  }

  .event-icon :global(svg) {
    width: var(--size-icon);
    height: var(--size-icon);
  }
  .event-type {
    font-weight: var(--weight-medium);
    font-size: var(--text-xs);
  }

  /* ── Target cell ── */
  .target-cell {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .target-type {
    background-color: var(--badge-info-bg);
    color: var(--badge-info-text);
    padding: 1px var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
  }

  .target-id {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .mono {
    font-family: monospace;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .bytes-val {
    color: var(--brand-600);
    font-weight: var(--weight-medium);
  }
  .count-val {
    color: var(--badge-info-text);
    font-weight: var(--weight-medium);
  }

  /* ── Break-glass panel ── */
  .break-glass-panel {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-danger);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .bg-header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .bg-icon {
    flex-shrink: 0;
    line-height: 1;
    color: var(--color-danger);
    width: var(--size-icon-lg);
    height: var(--size-icon-lg);
  }

  .bg-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .bg-title-block {
    flex: 1;
  }

  .bg-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    color: var(--color-danger);
    margin: 0 0 var(--space-1);
  }

  .bg-description {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  .bg-warning {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    background-color: var(--badge-error-bg);
    border: 1px solid var(--border-danger);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--color-danger);
  }

  .bg-warning .bg-warning-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .bg-steps {
    background-color: var(--bg-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .bg-steps-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--space-2);
  }

  .bg-steps-list {
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .bg-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    flex-wrap: wrap;
  }

  /* ── Empty / Pagination ── */
  .empty {
    text-align: center;
    padding: var(--space-12);
    color: var(--text-secondary);
    font-size: var(--text-sm);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }

  .pagination {
    display: flex;
    justify-content: center;
  }
</style>
