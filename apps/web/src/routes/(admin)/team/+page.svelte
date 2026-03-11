<script lang="ts">
  /**
   * (admin)/team/+page.svelte — Gestão de equipa com 3 tabs
   *
   * R: BUILD_PLAN.md §M3.3
   * R: design-guidelines.md §5 — tokens only
   * R: LL-05 — enhance com { result } + goto() para redirects
   * R: STACK_LOCK.md §14 — sem Tailwind
   *
   * Tabs: Colaboradores | Convites | Permissões
   * 4 estados por tabela: loading | error | empty | populated
   */
  import * as m from "$lib/paraglide/messages.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { applyAction, enhance } from "$app/forms";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { formatDateShort, formatDateTimeExp } from "$lib/format";
  import type { PageData, ActionData } from "./$types";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  // Tab activa — sincroniza com URL (derivada da prop, sem $effect)
  let activeTab = $state<string>(data.activeTab ?? "collaborators");
  // Re-sync when server data changes (e.g., navigation)
  $effect.pre(() => {
    if (data.activeTab && data.activeTab !== activeTab) {
      activeTab = data.activeTab;
    }
  });

  function setTab(tab: string) {
    activeTab = tab;
    goto(`?tab=${tab}`, { replaceState: true, noScroll: true });
  }

  // Estado de loading/confirmação
  let loading = $state(false);
  let confirmAction = $state<null | {
    type:
      | "deactivate"
      | "reactivate"
      | "delete_collaborator"
      | "delete_member"
      | "delete_client"
      | "cancel_invite"
      | "delete_invite";
    id: string;
    email: string;
  }>(null);

  // Formulário de convite
  let showInviteForm = $state(false);
  let inviteEmail = $state("");
  let inviteRole = $state<"member" | "collaborator" | "client">("collaborator");
  let submitResult = $state<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function openInviteForm(
    defaultRole: "member" | "collaborator" | "client" = "collaborator",
  ) {
    inviteRole = defaultRole;
    showInviteForm = true;
    inviteEmail = "";
    submitResult = null;
  }

  function closeInviteForm() {
    showInviteForm = false;
    submitResult = null;
  }

  const isOwner = $derived(
    data.adminUser.is_owner === 1 || data.adminUser.is_temp_owner === 1,
  );
  const isMember = $derived(data.adminUser.role === "member" && !isOwner);

  function formatDate(ts: number): string {
    return formatDateShort(ts);
  }

  function formatDateExp(ts: number): string {
    return formatDateTimeExp(ts);
  }

  function statusLabel(s: string): string {
    return (
      {
        active: m.status_active(),
        inactive: m.status_inactive(),
        deleted: m.status_deleted(),
      }[s] ?? s
    );
  }

  const inviteStatusLabel: Record<string, string> = {
    pending: m.team_invitation_status_pending(),
    accepted: m.team_invitation_status_accepted(),
    cancelled: m.team_invitation_status_cancelled(),
    expired: m.team_invitation_status_expired(),
  };

  // CSRF token do layout
  const csrfToken = $derived($page.data.csrfToken ?? "");

  // Re-fetch ao concluir acção
  $effect(() => {
    if (
      form?.invite_success ||
      form?.deactivate_success ||
      form?.reactivate_success ||
      form?.delete_success ||
      form?.cancel_success ||
      form?.resend_success ||
      form?.permissions_success
    ) {
      confirmAction = null;
      showInviteForm = false;
      invalidateAll();
    }
  });
</script>

<div class="page">
  <!-- Cabeçalho -->
  <div class="page-header">
    <h1 class="page-title">{m.team_title()}</h1>
    {#if isOwner || isMember}
      <Button variant="primary" onclick={() => openInviteForm()}>
        {m.team_invite_btn()}
      </Button>
    {/if}
  </div>

  <!-- Erros globais -->
  {#if data.errors.load}
    <Alert variant="error" role="alert">{data.errors.load}</Alert>
  {/if}
  {#if form?.action_error}
    <Alert variant="error" role="alert">{form.action_error}</Alert>
  {/if}

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    {#if isOwner || isMember}
      <button
        role="tab"
        class="tab"
        class:active={activeTab === "members"}
        aria-selected={activeTab === "members"}
        onclick={() => setTab("members")}
      >
        {m.team_tab_members()} ({data.members.length})
      </button>
    {/if}
    <button
      role="tab"
      class="tab"
      class:active={activeTab === "collaborators"}
      aria-selected={activeTab === "collaborators"}
      onclick={() => setTab("collaborators")}
    >
      {m.team_tab_collaborators()} ({data.collaborators.length})
    </button>
    <button
      role="tab"
      class="tab"
      class:active={activeTab === "clients"}
      aria-selected={activeTab === "clients"}
      onclick={() => setTab("clients")}
    >
      {m.team_tab_clients()} ({data.clients.length})
    </button>
    {#if isOwner}
      <button
        role="tab"
        class="tab"
        class:active={activeTab === "permissions"}
        aria-selected={activeTab === "permissions"}
        onclick={() => setTab("permissions")}
      >
        {m.team_tab_permissions()}
      </button>
    {/if}
    <button
      role="tab"
      class="tab"
      class:active={activeTab === "invitations"}
      aria-selected={activeTab === "invitations"}
      onclick={() => setTab("invitations")}
    >
      {m.team_tab_invitations()} ({data.invitations.length})
    </button>
  </div>

  <!-- ═══ TAB: Sócios ═══════════════════════════════════════════════════════ -->
  {#if activeTab === "members" && (isOwner || isMember)}
    {#if data.members.length === 0}
      <div class="empty">{m.team_empty_members()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_name()}</th>
              <th>{m.common_email()}</th>
              <th>{m.common_status()}</th>
              <th>{m.team_joined_col()}</th>
              {#if isOwner}<th>{m.common_actions()}</th>{/if}
            </tr>
          </thead>
          <tbody>
            {#each data.members as user}
              <tr>
                <td>
                  {user.display_name ?? "—"}
                  {#if user.is_owner === 1}
                    <Badge variant="owner">{m.team_owner_badge()}</Badge>
                  {:else if user.is_temp_owner === 1}
                    <Badge variant="temp">{m.team_owner_temp_badge()}</Badge>
                  {/if}
                </td>
                <td class="td-secondary">{user.email}</td>
                <td>
                  <Badge variant={user.status}>
                    {statusLabel(user.status)}
                  </Badge>
                </td>
                <td class="td-secondary">{formatDate(user.created_at)}</td>
                {#if isOwner}
                  <td class="td-actions">
                    <div class="actions-group">
                      {#if user.is_owner !== 1}
                        {#if user.status === "active"}
                          <Button
                            variant="warning"
                            size="sm"
                            onclick={() =>
                              (confirmAction = {
                                type: "deactivate",
                                id: user.id,
                                email: user.email,
                              })}
                          >
                            {m.team_deactivate()}
                          </Button>
                        {:else if user.status === "inactive"}
                          <Button
                            variant="success"
                            size="sm"
                            onclick={() =>
                              (confirmAction = {
                                type: "reactivate",
                                id: user.id,
                                email: user.email,
                              })}
                          >
                            {m.team_reactivate()}
                          </Button>
                        {/if}
                        <Button
                          variant="danger"
                          size="sm"
                          onclick={() =>
                            (confirmAction = {
                              type: "delete_member",
                              id: user.id,
                              email: user.email,
                            })}
                        >
                          {m.common_delete()}
                        </Button>
                      {/if}
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <!-- ═══ TAB: Colaboradores ═══════════════════════════════════════════════ -->
  {#if activeTab === "collaborators"}
    {#if data.collaborators.length === 0}
      <div class="empty">{m.team_empty_collaborators()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_name()}</th>
              <th>{m.common_email()}</th>
              <th>{m.common_status()}</th>
              <th>{m.team_joined_col()}</th>
              <th>{m.common_actions()}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.collaborators as user}
              <tr>
                <td>{user.display_name ?? "—"}</td>
                <td class="td-secondary">{user.email}</td>
                <td>
                  <Badge variant={user.status}>
                    {statusLabel(user.status)}
                  </Badge>
                </td>
                <td class="td-secondary">{formatDate(user.created_at)}</td>
                <td class="td-actions">
                  <div class="actions-group">
                    {#if user.status === "active"}
                      <Button
                        variant="warning"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "deactivate",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.team_deactivate()}
                      </Button>
                    {:else if user.status === "inactive"}
                      <Button
                        variant="success"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "reactivate",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.team_reactivate()}
                      </Button>
                    {/if}
                    {#if isOwner || isMember}
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "delete_collaborator",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.common_delete()}
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <!-- ═══ TAB: Clientes ════════════════════════════════════════════════════ -->
  {#if activeTab === "clients"}
    {#if data.clients.length === 0}
      <div class="empty">{m.team_empty_clients()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_name()}</th>
              <th>{m.common_email()}</th>
              <th>{m.common_status()}</th>
              <th>{m.team_joined_col()}</th>
              <th>{m.common_actions()}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.clients as user}
              <tr>
                <td>{user.display_name ?? "—"}</td>
                <td class="td-secondary">{user.email}</td>
                <td>
                  <Badge variant={user.status}>
                    {statusLabel(user.status)}
                  </Badge>
                </td>
                <td class="td-secondary">{formatDate(user.created_at)}</td>
                <td class="td-actions">
                  <div class="actions-group">
                    {#if user.status === "active"}
                      <Button
                        variant="warning"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "deactivate",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.team_deactivate()}
                      </Button>
                    {:else if user.status === "inactive"}
                      <Button
                        variant="success"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "reactivate",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.team_reactivate()}
                      </Button>
                    {/if}
                    {#if isOwner || isMember}
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "delete_client",
                            id: user.id,
                            email: user.email,
                          })}
                      >
                        {m.common_delete()}
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}

  <!-- ═══ TAB: Permissões ═══════════════════════════════════════════════════ -->
  {#if activeTab === "permissions" && isOwner}
    {#if data.permissions.length === 0}
      <div class="empty">{m.team_empty_permissions()}</div>
    {:else}
      <div class="permissions-list">
        {#each data.permissions as row}
          <div class="permission-card">
            <div class="permission-header">
              <span class="perm-email">{row.email}</span>
              {#if row.display_name}
                <span class="perm-name">{row.display_name}</span>
              {/if}
            </div>
            <form
              method="POST"
              action="?/update_permissions"
              class="perm-form"
              use:enhance={() => {
                return async ({ result }) => {
                  if (result.type === "redirect") {
                    goto(result.location);
                  } else {
                    await applyAction(result);
                  }
                };
              }}
            >
              <input type="hidden" name="user_id" value={row.user_id} />
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input
                type="hidden"
                name="permissions"
                value={JSON.stringify(row.module_permissions)}
              />
              <div class="perm-info">
                <span class="perm-label">{m.team_active_modules()}</span>
                <span class="perm-value">
                  {Object.keys(row.module_permissions).length === 0
                    ? m.team_no_permissions()
                    : Object.keys(row.module_permissions).join(", ")}
                </span>
              </div>
              <Button type="submit" size="sm"
                >{m.team_permissions_save()}</Button
              >
            </form>
          </div>
        {/each}
      </div>
      {#if form?.permissions_success}
        <Alert variant="success">{m.team_permissions_saved()}</Alert>
      {/if}
    {/if}
  {/if}

  <!-- ═══ TAB: Convites ═════════════════════════════════════════════════════ -->
  {#if activeTab === "invitations"}
    {#if data.invitations.length === 0}
      <div class="empty">{m.team_empty_invitations()}</div>
    {:else}
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{m.common_email()}</th>
              <th>{m.team_role_col()}</th>
              <th>{m.team_invitation_expires()}</th>
              <th>{m.common_status()}</th>
              <th>{m.common_actions()}</th>
            </tr>
          </thead>
          <tbody>
            {#each data.invitations as invite}
              <tr>
                <td>{invite.email}</td>
                <td>
                  <Badge variant="role">
                    {invite.role === "member"
                      ? m.team_invite_role_member()
                      : invite.role === "client"
                        ? m.team_invite_role_client()
                        : m.team_invite_role_collaborator()}
                  </Badge>
                </td>
                <td class="td-secondary">{formatDateExp(invite.expires_at)}</td>
                <td>
                  <Badge variant={`invite-${invite.status}`}>
                    {inviteStatusLabel[invite.status] ?? invite.status}
                  </Badge>
                </td>
                <td class="td-actions">
                  <div class="actions-group">
                    {#if invite.status === "pending"}
                      <form
                        method="POST"
                        action="?/resend_invite"
                        use:enhance={() => {
                          return async ({ result }) => {
                            if (result.type === "redirect") {
                              goto(result.location);
                            } else {
                              await applyAction(result);
                            }
                          };
                        }}
                      >
                        <input
                          type="hidden"
                          name="invite_id"
                          value={invite.id}
                        />
                        <input
                          type="hidden"
                          name="csrf_token"
                          value={csrfToken}
                        />
                        <Button type="submit" size="sm"
                          >{m.team_invitation_resend()}</Button
                        >
                      </form>
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "cancel_invite",
                            id: invite.id,
                            email: invite.email,
                          })}
                      >
                        {m.common_cancel()}
                      </Button>
                    {/if}
                    {#if invite.status === "cancelled" || invite.status === "expired"}
                      <Button
                        variant="danger"
                        size="sm"
                        onclick={() =>
                          (confirmAction = {
                            type: "delete_invite",
                            id: invite.id,
                            email: invite.email,
                          })}
                      >
                        {m.common_delete()}
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<!-- ═══ MODAL: Convidar ═══════════════════════════════════════════════════════ -->
{#if showInviteForm}
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={m.team_invite_title()}
  >
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{m.team_invite_title()}</h2>
        <button
          class="modal-close"
          onclick={closeInviteForm}
          aria-label={m.common_close()}>×</button
        >
      </div>

      {#if submitResult?.type === "error" || form?.invite_error}
        <Alert variant="error" role="alert"
          >{submitResult?.message || form?.invite_error}</Alert
        >
      {/if}
      {#if submitResult?.type === "success" || form?.invite_success}
        <Alert variant="success"
          >{submitResult?.message || m.team_invite_success()}</Alert
        >
      {/if}

      <form
        method="POST"
        action="?/invite"
        use:enhance={() => {
          loading = true;
          submitResult = null;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              if (result.type === "success") {
                submitResult = {
                  type: "success",
                  message: m.team_invite_success(),
                };
                inviteEmail = "";
                await invalidateAll();
              } else if (
                result.type === "failure" &&
                result.data?.invite_error
              ) {
                submitResult = {
                  type: "error",
                  message: result.data.invite_error as string,
                };
                await applyAction(result);
              } else {
                await applyAction(result);
              }
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="form-group">
          <label for="invite_email" class="form-label"
            >{m.common_email()} *</label
          >
          <input
            id="invite_email"
            type="email"
            name="email"
            bind:value={inviteEmail}
            class="form-input"
            required
            placeholder={m.team_invite_email_placeholder()}
            disabled={loading}
          />
        </div>

        <div class="form-group">
          <label for="invite_role" class="form-label"
            >{m.team_invite_role()}</label
          >
          <select
            id="invite_role"
            name="role"
            bind:value={inviteRole}
            class="form-select"
            disabled={loading}
          >
            {#if isOwner}
              <option value="member">{m.team_invite_role_member()}</option>
            {/if}
            <option value="collaborator"
              >{m.team_invite_role_collaborator()}</option
            >
            <option value="client">{m.team_invite_role_client()}</option>
          </select>
        </div>

        <div class="modal-footer">
          <Button
            type="button"
            variant="secondary"
            onclick={closeInviteForm}
            disabled={loading}
          >
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !inviteEmail}
          >
            {loading ? m.common_loading() : m.team_invite_submit()}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ═══ MODAL: Confirmação de acção destrutiva ════════════════════════════════ -->
{#if confirmAction}
  {@const action = confirmAction}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal modal-sm">
      <div class="modal-header">
        <h2 class="modal-title">
          {#if action.type === "deactivate"}{m.confirm_deactivate_title()}
          {:else if action.type === "reactivate"}{m.confirm_reactivate_title()}
          {:else if action.type === "delete_collaborator" || action.type === "delete_member" || action.type === "delete_client" || action.type === "delete_invite"}{m.confirm_delete_title()}
          {:else if action.type === "cancel_invite"}{m.confirm_cancel_invite_title()}
          {/if}
        </h2>
      </div>

      <p class="confirm-body">
        {#if action.type === "deactivate"}{m.confirm_deactivate_body()}
        {:else if action.type === "reactivate"}{m.confirm_reactivate_body()}
        {:else if action.type === "delete_collaborator" || action.type === "delete_member" || action.type === "delete_client" || action.type === "delete_invite"}{m.confirm_delete_body()}
        {:else if action.type === "cancel_invite"}{m.confirm_cancel_invite_body()}
        {/if}
      </p>
      <p class="confirm-email">{action.email}</p>

      <form
        method="POST"
        action="?/{action.type === 'deactivate'
          ? 'deactivate'
          : action.type === 'reactivate'
            ? 'reactivate'
            : action.type === 'delete_collaborator'
              ? 'delete_collaborator'
              : action.type === 'delete_member'
                ? 'delete_member'
                : action.type === 'delete_client'
                  ? 'delete_client'
                  : action.type === 'delete_invite'
                    ? 'delete_invite'
                    : 'cancel_invite'}"
        use:enhance={() => {
          loading = true;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              await applyAction(result);
              if (result.type === "success") {
                confirmAction = null;
                await invalidateAll();
              }
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />
        {#if action.type === "cancel_invite" || action.type === "delete_invite"}
          <input type="hidden" name="invite_id" value={action.id} />
        {:else}
          <input type="hidden" name="user_id" value={action.id} />
        {/if}

        <div class="modal-footer">
          <Button
            variant="secondary"
            onclick={() => (confirmAction = null)}
            disabled={loading}
          >
            {m.common_cancel()}
          </Button>
          <Button
            type="submit"
            variant={action.type === "reactivate" ? "success" : "danger"}
            disabled={loading}
          >
            {loading ? m.common_loading() : m.common_confirm()}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

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

  /* ── Tabs ── */
  .tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 0;
  }

  .tab {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
    margin-bottom: -1px;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }

  /* ── Empty ── */
  .empty {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    padding: var(--space-12);
    text-align: center;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
  }

  /* ── Permissions ── */
  .permissions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .permission-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .permission-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .perm-email {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
  }

  .perm-name {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .perm-info {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    font-size: var(--text-sm);
  }

  .perm-label {
    color: var(--text-secondary);
    font-weight: var(--weight-medium);
  }

  .perm-value {
    color: var(--text-primary);
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

  .td-secondary {
    color: var(--text-secondary);
  }

  .td-actions {
    /* Retirar display: flex do TD directo para evitar o bug do quadrado branco nas linhas vazias */
  }

  .actions-group {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }

  .perm-form {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: var(--bg-overlay, rgba(0, 0, 0, 0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    padding: var(--space-4);
  }

  .modal {
    background-color: var(--bg-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-popover);
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-6);
  }

  .modal-sm {
    max-width: 360px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    border: none;
    background: none;
    font-size: var(--text-xl);
    color: var(--text-secondary);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .modal-close:hover {
    background-color: var(--bg-hover);
  }

  .modal-footer {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    padding-top: var(--space-2);
  }

  /* ── Form ── */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .form-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-primary);
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    background-color: var(--bg-surface);
    transition: border-color var(--duration-fast) var(--ease-out);
    box-sizing: border-box;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .form-input:disabled,
  .form-select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Confirm modal ── */
  .confirm-body {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: var(--leading-relaxed);
  }

  .confirm-email {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }
</style>
