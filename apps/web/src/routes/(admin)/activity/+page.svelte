<script lang="ts">
  /**
   * (admin)/activity/+page.svelte — Histórico de actividade (M9)
   *
   * R: BUILD_PLAN.md §M9.5
   */
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import type { ActionData, PageData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { formatDateTime } from "$lib/format";
  import { Icons } from "$lib/icons.js";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let showCleanModal = $state(false);
  let cleaning = $state(false);

  // Mapa de acções para ícone SVG + label i18n
  const ACTION_META: Record<string, { icon: string; label: () => string }> = {
    "user.invite": { icon: Icons.mail, label: m.activity_action_user_invite },
    "user.invite.resend": {
      icon: Icons.mail,
      label: m.activity_action_user_invite_resend,
    },
    "user.invite.cancel": {
      icon: Icons.x,
      label: m.activity_action_user_invite_cancel,
    },
    "user.invite.accept": {
      icon: Icons.check,
      label: m.activity_action_user_invite_accept,
    },
    "user.deactivate": {
      icon: Icons.shieldCheck,
      label: m.activity_action_user_deactivate,
    },
    "user.reactivate": {
      icon: Icons.shieldCheck,
      label: m.activity_action_user_reactivate,
    },
    "user.delete": { icon: Icons.trash2, label: m.activity_action_user_delete },
    "user.elevation.grant": {
      icon: Icons.key,
      label: m.activity_action_user_elevation_grant,
    },
    "user.elevation.revoke": {
      icon: Icons.key,
      label: m.activity_action_user_elevation_revoke,
    },
    "backup.create": {
      icon: Icons.hardDrive,
      label: m.activity_action_backup_create,
    },
    "backup.delete": {
      icon: Icons.trash2,
      label: m.activity_action_backup_delete,
    },
    "company.update": {
      icon: Icons.building2,
      label: m.activity_action_company_update,
    },
    "company.logo.upload": {
      icon: Icons.user,
      label: m.activity_action_company_logo_upload,
    },
    "integration.activate": {
      icon: Icons.zap,
      label: m.activity_action_integration_activate,
    },
    "integration.deactivate": {
      icon: Icons.zap,
      label: m.activity_action_integration_deactivate,
    },
  };

  function getAction(action: string) {
    return (
      ACTION_META[action] ?? { icon: Icons.clipboardList, label: () => action }
    );
  }

  function formatDate(ts: number): string {
    return formatDateTime(ts);
  }
</script>

<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">{m.activity_title()}</h1>
      <p class="page-subtitle">{m.activity_subtitle()}</p>
    </div>
    <div class="header-actions">
      <Button
        href="/api/admin/activity/export"
        variant="secondary"
        target="_blank"
      >
        {m.activity_export()}
      </Button>
      <Button variant="danger" onclick={() => (showCleanModal = true)}>
        {m.activity_clean()}
      </Button>
    </div>
  </div>

  <!-- Filtros -->
  <form method="GET" class="filters-bar">
    <input
      type="text"
      name="actor_id"
      value={data.filters.actor_id}
      placeholder={m.activity_user_placeholder()}
      class="filter-input"
    />
    <input
      type="text"
      name="action"
      value={data.filters.action}
      placeholder={m.activity_action_placeholder()}
      class="filter-input"
    />
    <Button type="submit" variant="primary">{m.common_filter()}</Button>
    {#if data.filters.actor_id || data.filters.action}
      <Button href="/activity" variant="secondary"
        >{m.activity_clear_filters()}</Button
      >
    {/if}
  </form>

  <!-- Mensagem de resultado da acção -->
  {#if form?.success === false}
    <Alert variant="error">{form.error}</Alert>
  {/if}
  {#if form?.success === true}
    <Alert variant="success">
      {m.activity_clean_success({ deleted: form.deleted })}
    </Alert>
  {/if}

  <!-- Lista de actividades -->
  {#if data.items.length === 0}
    <div class="empty-state">
      <p>
        {data.filters.actor_id || data.filters.action
          ? m.activity_empty_filter()
          : m.activity_empty()}
      </p>
    </div>
  {:else}
    <div class="activity-list">
      {#each data.items as item (item.id)}
        {@const meta = getAction(item.action)}
        <div class="activity-item">
          <span class="activity-icon" aria-hidden="true">{@html meta.icon}</span
          >
          <div class="activity-body">
            <div class="activity-main">
              <span class="activity-label">{meta.label()}</span>
              {#if item.target_name}
                <span class="activity-target">→ {item.target_name}</span>
              {/if}
              {#if item.was_temp_owner}
                <Badge variant="warning">{m.activity_owner_temp()}</Badge>
              {/if}
            </div>
            <div class="activity-meta">
              <span class="actor-name">{item.actor_name}</span>
              <span class="separator">·</span>
              <span class="activity-date">{formatDate(item.created_at)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if data.nextCursor}
      <div class="pagination">
        <Button
          href={`/activity?cursor=${data.nextCursor}${data.filters.actor_id ? `&actor_id=${data.filters.actor_id}` : ""}${data.filters.action ? `&action=${data.filters.action}` : ""}`}
          variant="secondary"
        >
          {m.common_load_more()}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<!-- Modal confirmação limpar histórico -->
{#if showCleanModal}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <h2 class="modal-title">{m.activity_clean_confirm_title()}</h2>
      <p class="modal-body">
        {m.activity_clean_confirm_body()}<br /><br />
        <strong>{m.activity_clean_confirm_precondition()}</strong>
      </p>
      <div class="modal-actions">
        <Button variant="secondary" onclick={() => (showCleanModal = false)}>
          {m.common_cancel()}
        </Button>
        <form
          method="POST"
          action="?/clean"
          use:enhance={() => {
            cleaning = true;
            showCleanModal = false;
            return async ({ update }) => {
              cleaning = false;
              await update();
              await invalidateAll();
            };
          }}
        >
          <input
            type="hidden"
            name="csrf_token"
            value={$page.data.csrfToken ?? ""}
          />
          <Button type="submit" variant="danger" disabled={cleaning}>
            {cleaning ? m.activity_cleaning() : m.activity_clean_confirm_btn()}
          </Button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    max-width: var(--page-content-max-w);
    padding: 0;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
    gap: var(--space-4);
  }
  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    margin: 0;
    color: var(--text-primary);
  }
  .page-subtitle {
    color: var(--text-muted);
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
  }
  .header-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .filters-bar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  .filter-input {
    flex: 1;
    min-width: 180px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    background: var(--bg-input);
    color: var(--text-primary);
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .activity-item {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }
  .activity-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-ui);
    height: var(--size-icon-ui);
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--text-secondary);
  }
  .activity-icon :global(svg) {
    width: var(--size-icon-ui);
    height: var(--size-icon-ui);
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }
  .activity-body {
    flex: 1;
    min-width: 0;
  }
  .activity-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: 2px;
  }
  .activity-label {
    font-weight: var(--weight-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }
  .activity-target {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .activity-meta {
    font-size: var(--text-xs);
    color: var(--text-muted);
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }
  .actor-name {
    font-weight: var(--weight-medium);
  }
  .separator {
    opacity: 0.4;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12);
    color: var(--text-muted);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
  }
  .pagination {
    text-align: center;
    margin-top: var(--space-6);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }
  .modal {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    max-width: var(--size-modal-w);
    width: 90%;
    box-shadow: var(--shadow-modal);
  }
  .modal-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    margin: 0 0 var(--space-4);
    color: var(--text-primary);
  }
  .modal-body {
    color: var(--text-secondary);
    line-height: var(--leading-loose);
    margin-bottom: var(--space-5);
    font-size: var(--text-sm);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
