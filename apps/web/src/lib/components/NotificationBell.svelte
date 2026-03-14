<!--
  NotificationBell.svelte — Sino de notificações com popup de ações (M6)

  Props:
    count: number — número de notificações não lidas (badge inicial do server)
    csrfToken: string — token CSRF para mutações
-->
<script lang="ts">
import { invalidateAll } from "$app/navigation";
import { formatDate } from "$lib/format.js";
import { Icons } from "$lib/icons.js";
import * as m from "$lib/paraglide/messages.js";

interface Notification {
  id: string;
  type: string;
  title_key: string;
  body_key: string;
  params: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

let { count = 0, csrfToken = "" }: { count: number; csrfToken: string } = $props();

let open = $state(false);
let loading = $state(false);
let localNotifications = $state<Notification[]>([]);
let fetched = $state(false);
let localCount = $state(0);

$effect(() => {
  localCount = count;
});

/** Headers comuns para mutações (inclui CSRF) */
function mutHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (csrfToken) h["x-csrf-token"] = csrfToken;
  return h;
}

function toggle(e: MouseEvent) {
  if (e) e.stopPropagation();
  if (open) {
    open = false;
    return;
  }
  open = true;
  fetchNotifications();
}

async function fetchNotifications() {
  loading = true;
  fetched = false;
  try {
    const res = await fetch("/api/user/notifications?limit=20");
    if (res.ok) {
      const data = (await res.json()) as { notifications?: Notification[] };
      localNotifications = data.notifications ?? [];
    } else {
      localNotifications = [];
    }
  } catch {
    localNotifications = [];
  }
  fetched = true;
  loading = false;
  localCount = localNotifications.filter((n) => n.is_read === 0).length;
}

async function markRead(id: string) {
  const res = await fetch(`/api/user/notifications/${id}/read`, {
    method: "PATCH",
    headers: mutHeaders(),
  });
  if (res.ok) {
    localNotifications = localNotifications.map((n) => (n.id === id ? { ...n, is_read: 1 } : n));
    localCount = localNotifications.filter((n) => n.is_read === 0).length;
    await invalidateAll();
  }
}

async function markAllRead() {
  loading = true;
  const res = await fetch("/api/user/notifications/read-all", {
    method: "POST",
    headers: mutHeaders(),
  });
  if (res.ok) {
    localNotifications = localNotifications.map((n) => ({
      ...n,
      is_read: 1,
    }));
    localCount = 0;
    await invalidateAll();
  }
  loading = false;
}

async function deleteNotification(id: string) {
  const res = await fetch(`/api/user/notifications/${id}`, {
    method: "DELETE",
    headers: mutHeaders(),
  });
  if (res.ok) {
    localNotifications = localNotifications.filter((n) => n.id !== id);
    localCount = localNotifications.filter((n) => n.is_read === 0).length;
    await invalidateAll();
  }
}

async function deleteAll() {
  loading = true;
  const res = await fetch("/api/user/notifications", {
    method: "DELETE",
    headers: mutHeaders(),
  });
  if (res.ok) {
    localNotifications = [];
    localCount = 0;
    await invalidateAll();
  }
  loading = false;
}

/**
 * Mapa de body_key (armazenado na DB) → chave i18n humanizada.
 * Se o body_key existir aqui, o template i18n é usado; caso contrário, fallback simples.
 */
const BODY_KEY_MAP: Record<string, (params: Record<string, string | number>) => string> = {
  notif_tenant_activated_body: (p) => m.notif_body_tenant_activated(p as any),
  notif_elevation_granted_body: (p) => m.notif_body_elevation_granted(p as any),
  notif_elevation_revoked_body: (p) => m.notif_body_elevation_revoked(p as any),
  notif_invite_accepted_body: (p) => m.notif_body_invite_accepted(p as any),
  notif_body_invite_accepted: (p) => m.notif_body_invite_accepted(p as any),
  notif_body_invite_sent: (p) => m.notif_body_invite_sent(p as any),
  notif_body_invite_cancelled: (p) => m.notif_body_invite_cancelled(p as any),
  notif_body_user_deactivated: (p) => m.notif_body_user_deactivated(p as any),
  notif_body_user_deleted: (p) => m.notif_body_user_deleted(p as any),
  "notification.backup_done.body": (p) => m.notif_body_backup_done(p as any),
  "notification.break_glass.body": (p) => m.notif_body_break_glass(p as any),
};

const TITLE_KEY_MAP: Record<string, () => string> = {
  notif_tenant_activated_title: () => m.notif_title_tenant_activated(),
  notif_elevation_granted_title: () => m.notif_title_elevation_granted(),
  notif_elevation_revoked_title: () => m.notif_title_elevation_revoked(),
  notif_invite_accepted_title: () => m.notif_title_invite_accepted(),
  notif_title_invite_accepted: () => m.notif_title_invite_accepted(),
  notif_title_invite_sent: () => m.notif_title_invite_sent(),
  notif_title_invite_cancelled: () => m.notif_title_invite_cancelled(),
  notif_title_user_deactivated: () => m.notif_title_user_deactivated(),
  notif_title_user_deleted: () => m.notif_title_user_deleted(),
  "notification.backup_done.title": () => m.notif_title_backup_done(),
  "notification.break_glass.title": () => m.notif_title_break_glass(),
};

function buildBody(bodyKey: string, paramsRaw: string | null): string {
  try {
    const params = paramsRaw ? JSON.parse(paramsRaw) : {};
    const fn = BODY_KEY_MAP[bodyKey];
    if (fn) return fn(params);
    // Fallback: substituição simples de {param}
    return bodyKey.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  } catch {
    return bodyKey;
  }
}

function buildTitle(titleKey: string): string {
  const fn = TITLE_KEY_MAP[titleKey];
  if (fn) return fn();
  return titleKey;
}

// Fechar ao clicar fora
function handleOutside(e: MouseEvent) {
  if (!open) return;
  const target = e.target as HTMLElement;
  if (!target.closest(".notif-bell-wrap")) {
    open = false;
  }
}

const unread = $derived(localNotifications.filter((n) => n.is_read === 0).length);
</script>

<svelte:window onclick={handleOutside} />

<div class="notif-bell-wrap">
  <button
    class="notif-btn"
    onclick={(e) => toggle(e)}
    aria-label="{m.notif_title()} ({localCount})"
    aria-expanded={open}
    aria-haspopup="true"
  >
    <span class="bell-icon" aria-hidden="true">{@html Icons.bell}</span>
    {#if localCount > 0}
      <span class="badge" aria-live="polite"
        >{localCount > 99 ? "99+" : localCount}</span
      >
    {/if}
  </button>

  {#if open}
     <!-- svelte-ignore a11y_no_static_element_interactions -->
     <div
       class="notif-popup"
       tabindex="-1"
       role="dialog"
       aria-label={m.notif_title()}
       onclick={(e) => e.stopPropagation()}
       onkeydown={(e) => e.stopPropagation()}
     >
      <!-- Cabeçalho popup -->
      <div class="popup-header">
        <span class="popup-title">{m.notif_title()}</span>
        {#if localNotifications.length > 0}
          <div class="popup-actions">
            {#if unread > 0}
              <button
                type="button"
                class="popup-action-btn"
                onclick={(e) => {
                  e.stopPropagation();
                  markAllRead();
                }}
                disabled={loading}
              >
                <span aria-hidden="true">{@html Icons.check}</span>
                {m.notif_bell_mark_all_read()}
              </button>
            {/if}
            <button
              type="button"
              class="popup-action-btn popup-action-danger"
              onclick={(e) => {
                e.stopPropagation();
                deleteAll();
              }}
              disabled={loading}
            >
              <span aria-hidden="true">{@html Icons.trash2}</span>
              {m.notif_bell_delete_all()}
            </button>
          </div>
        {/if}
      </div>

      <!-- Lista -->
      {#if loading}
        <div class="popup-empty">{m.notif_bell_loading()}</div>
      {:else if !fetched}
        <div class="popup-empty">{m.notif_bell_loading()}</div>
      {:else if localNotifications.length === 0}
        <div class="popup-empty">{m.notif_bell_empty()}</div>
      {:else}
        <ul class="popup-list" role="list">
          {#each localNotifications as notif (notif.id)}
            <li class="popup-item" class:unread={notif.is_read === 0}>
              <div class="popup-item-body">
                <strong class="popup-item-title"
                  >{buildTitle(notif.title_key)}</strong
                >
                <p class="popup-item-text">
                  {buildBody(notif.body_key, notif.params)}
                </p>
                <time class="popup-item-time"
                  >{formatDate(notif.created_at)}</time
                >
              </div>
              <div class="popup-item-btns">
                {#if notif.link}
                  <a
                    href={notif.link}
                    class="item-btn"
                    onclick={(e) => {
                      e.stopPropagation();
                      markRead(notif.id);
                      open = false;
                    }}
                    title="→">{@html Icons.externalLink}</a
                  >
                {/if}
                {#if notif.is_read === 0}
                  <button
                    type="button"
                    class="item-btn"
                    onclick={(e) => {
                      e.stopPropagation();
                      markRead(notif.id);
                    }}
                    title={m.notif_bell_mark_read()}
                  >
                    {@html Icons.check}
                  </button>
                {/if}
                <button
                  type="button"
                  class="item-btn item-btn-danger"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif.id);
                  }}
                  title={m.common_delete()}
                >
                  {@html Icons.trash2}
                </button>
              </div>
            </li>
          {/each}
        </ul>

        <div class="popup-footer">
          <a
            href="/notifications"
            class="popup-link"
            onclick={(e) => {
              e.stopPropagation();
              open = false;
            }}
          >
            {m.notif_bell_view_all()}
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .notif-bell-wrap {
    position: relative;
  }

  .notif-btn {
    position: relative;
    z-index: 10;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-btn);
    height: var(--size-icon-btn);
    border-radius: var(--radius-full);
    border: none;
    background: none;
    cursor: pointer !important;
    color: var(--text-secondary);
    transition: all var(--duration-fast);
    pointer-events: auto !important;
  }

  .notif-btn:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .bell-icon {
    display: flex;
    align-items: center;
  }

  .bell-icon :global(svg) {
    width: var(--size-icon-ui);
    height: var(--size-icon-ui);
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }

  .badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 var(--pad-badge-count-x);
    border-radius: var(--radius-full);
    background-color: var(--badge-alert-bg);
    color: var(--badge-alert-text);
    font-size: var(--text-2xs);
    font-weight: var(--weight-bold);
    line-height: 16px;
    text-align: center;
    pointer-events: none;
  }

  /* ── Popup ── */
  .notif-popup {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    width: 340px;
    max-height: 440px;
    background-color: var(--bg-surface);
    border: var(--border-w-1) solid var(--border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-popover);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    overflow: hidden;
    pointer-events: auto !important;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .popup-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
  }

  .popup-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }

  .popup-action-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    transition: background-color var(--duration-fast) var(--ease-default);
    white-space: nowrap;
  }

  .popup-action-btn:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .popup-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .popup-action-danger {
    color: var(--status-inactive-text);
  }
  .popup-action-danger:hover:not(:disabled) {
    background-color: var(--badge-error-bg);
  }

  .popup-action-btn :global(svg) {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }

  /* ── Lista ── */
  .popup-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }

  .popup-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .popup-item:last-child {
    border-bottom: none;
  }

  .popup-item:hover {
    background-color: var(--bg-hover);
  }

  .popup-item.unread {
    border-left: 3px solid var(--brand-500);
    padding-left: calc(var(--space-4) - 3px);
  }

  .popup-item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .popup-item-title {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
  }

  .popup-item-text {
    font-size: var(--text-xs);
    color: var(--text-primary);
    margin: 0;
    line-height: var(--leading-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .popup-item-time {
    font-size: var(--text-2xs);
    color: var(--text-muted);
  }

  .popup-item-btns {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
    align-items: center;
  }

  .item-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--text-secondary);
    text-decoration: none;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .item-btn:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .item-btn-danger:hover {
    background-color: var(--badge-error-bg);
    color: var(--status-inactive-text);
  }

  .item-btn :global(svg) {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }

  /* ── Empty / Footer ── */
  .popup-empty {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .popup-footer {
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-w-1) solid var(--border-subtle);
    text-align: center;
    flex-shrink: 0;
  }

  .popup-link {
    font-size: var(--text-xs);
    color: var(--brand-600);
    text-decoration: none;
    font-weight: var(--weight-medium);
  }

  .popup-link:hover {
    text-decoration: underline;
  }
</style>
