<script lang="ts">
  /**
   * (admin)/backups/+page.svelte — Backups da empresa (M8/M12)
   *
   * R: BUILD_PLAN.md §M8.4, §M12
   */
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import type { PageData, ActionData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { formatDateTimeMs, formatBytes } from "$lib/format";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let creating = $state(false);
  let deleteId = $state<string | null>(null);
  let showConfig = $state(false);

  function freqLabels() {
    return {
      daily: m.backup_freq_daily(),
      weekly: m.backup_freq_weekly(),
      monthly: m.backup_freq_monthly(),
    };
  }

  function dayLabels() {
    return [
      m.backup_day_sun(),
      m.backup_day_mon(),
      m.backup_day_tue(),
      m.backup_day_wed(),
      m.backup_day_thu(),
      m.backup_day_fri(),
      m.backup_day_sat(),
    ];
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return "—";
    return formatBytes(bytes);
  }

  function formatDate(ts: number | null): string {
    if (!ts) return "—";
    return formatDateTimeMs(ts);
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

  function statusClass(status: string): string {
    return (
      { pending: "warning", running: "info", done: "success", failed: "error" }[
        status
      ] ?? ""
    );
  }
</script>

<div class="page-container">
  <div class="page-header">
    <h1 class="page-title">{m.backup_title()}</h1>
    <div class="header-actions">
      <Button
        variant="outline"
        size="sm"
        onclick={() => (showConfig = !showConfig)}
      >
        {m.backup_auto_config()}
      </Button>
      <form
        method="POST"
        action="?/create"
        use:enhance={() => {
          creating = true;
          return async ({ result, update }) => {
            creating = false;
            if (result.type === "success") await invalidateAll();
            else await update();
          };
        }}
      >
        <input type="hidden" name="_csrf" value={$page.data.csrfToken ?? ""} />
        <input type="hidden" name="type" value="db_only" />
        <Button type="submit" variant="outline" size="sm" disabled={creating}>
          {creating ? m.backup_creating() : m.backup_new()}
        </Button>
      </form>
    </div>
  </div>

  {#if form?.error}
    <Alert variant="error" role="alert">{form.error}</Alert>
  {/if}

  {#if showConfig}
    <div class="config-card card">
      <h2 class="card-title">{m.backup_auto_title()}</h2>
      <form
        method="POST"
        action="?/update_config"
        use:enhance={() => {
          return async ({ result, update }) => {
            if (result.type === "success") {
              showConfig = false;
              await invalidateAll();
            } else await update();
          };
        }}
      >
        <input type="hidden" name="_csrf" value={$page.data.csrfToken ?? ""} />
        <div class="form-row">
          <label class="form-label">
            <input
              type="checkbox"
              name="enabled"
              value="true"
              checked={data.config.enabled}
            />
            {m.backup_enabled()}
          </label>
        </div>
        <div class="form-row">
          <label class="form-label" for="frequency"
            >{m.backup_frequency()}</label
          >
          <select id="frequency" name="frequency" class="form-select">
            {#each Object.entries(freqLabels()) as [val, label]}
              <option value={val} selected={data.config.frequency === val}
                >{label}</option
              >
            {/each}
          </select>
        </div>
        {#if data.config.frequency === "weekly"}
          <div class="form-row">
            <label class="form-label" for="day_of_week"
              >{m.backup_day_of_week()}</label
            >
            <select id="day_of_week" name="day_of_week" class="form-select">
              {#each dayLabels() as day, i}
                <option value={i} selected={data.config.day_of_week === i}
                  >{day}</option
                >
              {/each}
            </select>
          </div>
        {/if}
        <div class="form-row">
          <label class="form-label" for="retention_days"
            >{m.backup_retention()}</label
          >
          <input
            id="retention_days"
            name="retention_days"
            type="number"
            min="1"
            max="365"
            value={data.config.retention_days}
            class="form-input w-[100px]"
          />
        </div>
        <div class="form-actions">
          <Button type="submit" variant="primary">{m.common_save()}</Button>
          <Button variant="ghost" onclick={() => (showConfig = false)}
            >{m.common_cancel()}</Button
          >
        </div>
      </form>
    </div>
  {/if}

  {#if data.backups.length === 0}
    <div class="empty-state">
      <p>{m.backup_empty()}</p>
    </div>
  {:else}
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>{m.common_date()}</th>
            <th>{m.common_type()}</th>
            <th>{m.common_status()}</th>
            <th>{m.backup_size_col()}</th>
            <th>{m.backup_expires_col()}</th>
            <th>{m.common_actions()}</th>
          </tr>
        </thead>
        <tbody>
          {#each data.backups as b (b.id)}
            <tr>
              <td>{formatDate(b.created_at)}</td>
              <td
                ><Badge
                  >{b.type === "full"
                    ? m.super_backup_type_full()
                    : m.super_backup_type_db()}</Badge
                ></td
              >
              <td
                ><Badge variant={statusClass(b.status) || "default"}
                  >{statusLabel(b.status)}</Badge
                ></td
              >
              <td>{formatSize(b.size_bytes)}</td>
              <td>{formatDate(b.download_expires_at)}</td>
              <td class="actions-cell">
                {#if b.status === "done" && b.r2_key && b.download_expires_at && Date.now() < b.download_expires_at}
                  <Button
                    href={`/api/admin/backups/${b.id}/download`}
                    variant="outline"
                    size="sm"
                    download="backup.sqlite">{m.backup_download_btn()}</Button
                  >
                {/if}
                <Button
                  variant="ghost"
                  class="text-danger"
                  size="sm"
                  onclick={() => (deleteId = b.id)}>🗑</Button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if deleteId}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={m.confirm_delete_title()}
  >
    <div class="modal-card">
      <h2 class="modal-title">{m.confirm_delete_title()}</h2>
      <p class="modal-body">{m.confirm_delete_body()}</p>
      <div class="modal-actions">
        <form
          method="POST"
          action="?/delete"
          use:enhance={() => {
            deleteId = null;
            return async ({ result, update }) => {
              if (result.type === "success") await invalidateAll();
              else await update();
            };
          }}
        >
          <input
            type="hidden"
            name="_csrf"
            value={$page.data.csrfToken ?? ""}
          />
          <input type="hidden" name="id" value={deleteId} />
          <Button type="submit" variant="danger">{m.common_delete()}</Button>
        </form>
        <Button variant="ghost" onclick={() => (deleteId = null)}
          >{m.common_cancel()}</Button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    padding: 0;
    max-width: var(--page-content-max-w);
  }
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
  }
  .header-actions {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    margin-bottom: var(--space-6);
  }
  .card-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    margin-bottom: var(--space-4);
  }
  .config-card {
    max-width: 480px;
  }
  .form-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    flex-wrap: wrap;
  }
  .form-label {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .form-select,
  .form-input {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--bg-input);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }
  .form-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  .empty-state {
    text-align: center;
    padding: var(--space-12);
    color: var(--text-secondary);
  }
  .table-wrapper {
    overflow-x: auto;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .data-table th {
    text-align: left;
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    background-color: var(--bg-table-header);
  }
  .data-table td {
    padding: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }
  .actions-cell {
    display: flex;
    gap: var(--space-2);
  }
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay, rgba(0, 0, 0, 0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }
  .modal-card {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    max-width: 400px;
    width: 90%;
    box-shadow: var(--shadow-modal, var(--shadow-popover));
  }
  .modal-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    margin-bottom: var(--space-3);
  }
  .modal-body {
    color: var(--text-secondary);
    margin-bottom: var(--space-6);
  }
  .modal-actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
