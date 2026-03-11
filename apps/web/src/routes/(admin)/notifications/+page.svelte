<script lang="ts">
  /**
   * (admin)/notifications/+page.svelte — Lista de notificações (M6)
   *
   * R: BUILD_PLAN.md §M6.4
   * R: design-guidelines.md §5
   */
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import type { PageData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { getDateLocale } from "$lib/format";
  import { Icons } from "$lib/icons.js";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  // Mapa de ícones SVG e labels por tipo de notificação (usando i18n)
  function TYPE_META(t: string): { icon: string; label: string } {
    const map: Record<string, { icon: string; label: string }> = {
      invite_accepted: {
        icon: Icons.check,
        label: m.notif_type_invite_accepted(),
      },
      invite_expired: { icon: Icons.x, label: m.notif_type_invite_expired() },
      elevation_granted: {
        icon: Icons.key,
        label: m.notif_type_elevation_granted(),
      },
      elevation_expired: {
        icon: Icons.lock,
        label: m.notif_type_elevation_expired(),
      },
      elevation_revoked: {
        icon: Icons.unlock,
        label: m.notif_type_elevation_revoked(),
      },
      delete_requested: {
        icon: Icons.trash2,
        label: m.notif_type_delete_requested(),
      },
      email_change_confirm: {
        icon: Icons.mail,
        label: m.notif_type_email_change(),
      },
      tenant_activated: {
        icon: Icons.building2,
        label: m.notif_type_tenant_activated(),
      },
      tenant_deactivated: {
        icon: Icons.shieldCheck,
        label: m.notif_type_tenant_deactivated(),
      },
      invite_sent: { icon: Icons.send, label: m.notif_type_invite_sent() },
      invite_cancelled: {
        icon: Icons.x,
        label: m.notif_type_invite_cancelled(),
      },
      user_deactivated: {
        icon: Icons.user,
        label: m.notif_type_user_deactivated(),
      },
      user_deleted: { icon: Icons.trash2, label: m.notif_type_user_deleted() },
    };
    return map[t] ?? { icon: Icons.bell, label: t };
  }

  function formatDate(iso: string): string {
    return new Intl.DateTimeFormat(getDateLocale(), {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  function parseParams(raw: string | null): Record<string, string | number> {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Mapa de body_key (armazenado na DB) → chave i18n humanizada.
   */
  const BODY_KEY_MAP: Record<
    string,
    (params: Record<string, string | number>) => string
  > = {
    notif_tenant_activated_body: (p) => m.notif_body_tenant_activated(p as any),
    notif_elevation_granted_body: (p) =>
      m.notif_body_elevation_granted(p as any),
    notif_elevation_revoked_body: (p) =>
      m.notif_body_elevation_revoked(p as any),
    notif_invite_accepted_body: (p) => m.notif_body_invite_accepted(p as any),
    notif_body_invite_accepted: (p) => m.notif_body_invite_accepted(p as any),
    notif_body_invite_sent: (p) => m.notif_body_invite_sent(p as any),
    notif_body_invite_cancelled: (p) => m.notif_body_invite_cancelled(p as any),
    notif_body_user_deactivated: (p) => m.notif_body_user_deactivated(p as any),
    notif_body_user_deleted: (p) => m.notif_body_user_deleted(p as any),
    "notification.backup_done.body": (p) => m.notif_body_backup_done(p as any),
    "notification.break_glass.body": (p) => m.notif_body_break_glass(p as any),
  };

  // Construir mensagem humanizada
  function buildBody(bodyKey: string, paramsRaw: string | null): string {
    const params = parseParams(paramsRaw);
    const fn = BODY_KEY_MAP[bodyKey];
    if (fn) return fn(params);
    // Fallback: substituição simples de {param}
    const template = bodyKey ?? "";
    return template.replace(/\{(\w+)\}/g, (_, k) =>
      String(params[k] ?? `{${k}}`),
    );
  }

  function getMeta(type: string) {
    return TYPE_META(type);
  }

  /** Headers comuns para mutações (inclui CSRF) */
  function mutHeaders(): HeadersInit {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const csrfToken = $page.data.csrfToken;
    if (csrfToken) h["x-csrf-token"] = csrfToken;
    return h;
  }

  async function markRead(id: string) {
    await fetch(`/api/user/notifications/${id}/read`, {
      method: "PATCH",
      headers: mutHeaders(),
    });
    await invalidateAll();
  }

  async function markAllRead() {
    await fetch("/api/user/notifications/read-all", {
      method: "POST",
      headers: mutHeaders(),
    });
    await invalidateAll();
  }

  async function deleteNotification(id: string) {
    await fetch(`/api/user/notifications/${id}`, {
      method: "DELETE",
      headers: mutHeaders(),
    });
    await invalidateAll();
  }

  async function deleteAll() {
    await fetch("/api/user/notifications", {
      method: "DELETE",
      headers: mutHeaders(),
    });
    await invalidateAll();
  }
</script>

<div class="notif-page">
  <div class="page-header">
    <h1 class="page-title">{m.notif_title()}</h1>
    {#if data.unreadCount > 0}
      <Badge variant="error"
        >{m.notif_unread_many({ count: data.unreadCount })}</Badge
      >
    {/if}
    {#if data.notifications.length > 0}
      <div class="header-actions">
        <Button variant="outline" size="sm" onclick={markAllRead}>
          {@html Icons.check}
          {m.notif_bell_mark_all_read()}
        </Button>
        <Button variant="danger" size="sm" onclick={deleteAll}>
          {@html Icons.trash2}
          {m.notif_bell_delete_all()}
        </Button>
      </div>
    {/if}
  </div>

  {#if data.notifications.length === 0}
    <div class="empty-state">
      <p class="empty-icon" aria-hidden="true">{@html Icons.bell}</p>
      <p class="empty-msg">{m.notif_bell_empty()}</p>
    </div>
  {:else}
    <ul class="notif-list" aria-label={m.notif_title()}>
      {#each data.notifications as notif (notif.id)}
        {@const meta = getMeta(notif.type)}
        <li class="notif-item" class:unread={notif.is_read === 0}>
          <span class="notif-icon" aria-hidden="true">{@html meta.icon}</span>
          <div class="notif-body">
            <p class="notif-label">{meta.label}</p>
            <p class="notif-text">{buildBody(notif.body_key, notif.params)}</p>
            <time class="notif-time" datetime={notif.created_at}
              >{formatDate(notif.created_at)}</time
            >
          </div>
          <div class="notif-actions flex flex-row items-center gap-2">
            {#if notif.link}
              <Button
                href={notif.link}
                variant="outline"
                size="xs"
                onclick={() => markRead(notif.id)}
              >
                {@html Icons.externalLink}
                <span class="ms-1">{m.common_view()}</span>
              </Button>
            {/if}
            {#if notif.is_read === 0}
              <Button
                variant="outline"
                size="xs"
                onclick={() => markRead(notif.id)}
              >
                {@html Icons.check}
                <span class="ms-1">{m.notif_bell_mark_read()}</span>
              </Button>
            {/if}
            <Button
              variant="ghost"
              size="xs"
              onclick={() => deleteNotification(notif.id)}
            >
              {@html Icons.trash2} <span class="ms-1">{m.common_delete()}</span>
            </Button>
          </div>
        </li>
      {/each}
    </ul>

    {#if data.nextCursor}
      <div class="pagination">
        <Button href="?cursor={data.nextCursor}" variant="outline" size="sm"
          >{m.notif_load_more()}</Button
        >
      </div>
    {/if}
  {/if}
</div>

<style>
  .notif-page {
    max-width: var(--page-content-max-w);
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
    flex: 1;
  }

  .header-actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  /* ── Lista ── */
  .notif-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .notif-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-4);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    transition: background-color var(--duration-fast) ease;
  }

  .notif-item.unread {
    border-left: 3px solid var(--brand-500);
    background-color: color-mix(
      in srgb,
      var(--brand-500) 5%,
      var(--bg-surface)
    );
  }

  .notif-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--text-secondary);
  }
  .notif-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }

  .notif-body {
    flex: 1;
    min-width: 0;
  }

  .notif-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--space-1);
  }

  .notif-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0 0 var(--space-1);
  }

  .notif-time {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .notif-actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* ── Empty ── */
  .empty-state {
    text-align: center;
    padding: var(--space-12) var(--space-6);
  }

  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 0 var(--space-3);
    color: var(--text-muted);
  }
  .empty-icon :global(svg) {
    width: 40px;
    height: 40px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
    opacity: 0.5;
  }

  .empty-msg {
    color: var(--text-secondary);
    font-size: var(--text-base);
    margin: 0;
  }

  /* ── Pagination ── */
  .pagination {
    margin-top: var(--space-6);
    text-align: center;
  }
</style>
