<script lang="ts">
  import { enhance } from "$app/forms";
  import * as m from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { formatDateShort, formatBytes } from "$lib/format";
  import type { ActionData, PageData } from "./$types";

  interface UserRow {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_owner: number;
    is_temp_owner: number;
    status: string;
    created_at: number;
  }

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let loadingAction = $state<string | null>(null);
  let showDeleteConfirm = $state(false);
  let elevateUserId = $state("");
  let elevateHours = $state(24);
  let transferUserId = $state("");

  function formatDate(ts: number): string {
    return formatDateShort(ts);
  }

  // Storage em MB para o form
  const storageMB = $derived(
    Math.round(data.tenant.storage_limit_bytes / (1024 * 1024)),
  );

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

  function roleLabel(u: UserRow): string {
    if (u.is_temp_owner === 1) return m.super_tenant_owner_temp();
    if (u.is_owner === 1) return m.super_tenant_owner_fixed();
    if (u.role === "tenant_admin") return m.super_tenant_role_admin();
    if (u.role === "member") return m.super_tenant_role_member();
    if (u.role === "client") return m.super_tenant_role_client();
    return m.super_tenant_role_collab();
  }

  // Utilizadores elegíveis para elevação: sócios activos que não são owners
  const elevateEligible = $derived(
    (data.users?.members ?? []).filter(
      (u: UserRow) =>
        u.status === "active" && u.is_temp_owner === 0 && u.is_owner === 0,
    ),
  );

  const tempOwners = $derived(data.users?.tempOwners ?? []);
  const hasElevation = $derived(tempOwners.length > 0);

  // Utilizadores elegíveis para transfer: sócios activos (incluindo temp owner)
  const transferEligible = $derived(
    [...(data.users?.members ?? []), ...(data.users?.tempOwners ?? [])].filter(
      (u: UserRow) => u.status === "active" && u.is_owner === 0,
    ),
  );
</script>

<div class="page">
  <!-- ── Header ── -->
  <div class="page-header">
    <a href="/super/tenants" class="back-link">← {m.super_nav_tenants()}</a>
    <div class="header-row">
      <div>
        <h1 class="page-title">{data.tenant.name}</h1>
        <p class="page-sub">{data.tenant.email}</p>
      </div>
      <Badge variant={data.tenant.status}>
        {statusLabel(data.tenant.status)}
      </Badge>
    </div>
  </div>

  <!-- ── Feedback ── -->
  {#if data.created}
    <Alert variant="success">{m.super_tenant_created()}</Alert>
  {/if}
  {#if form?.success === "limits_updated"}
    <Alert variant="success">{m.super_tenant_limits_updated()}</Alert>
  {:else if form?.success === "activated"}
    <Alert variant="success">{m.super_tenant_activated_msg()}</Alert>
  {:else if form?.success === "deactivated"}
    <Alert variant="success">{m.super_tenant_deactivated_msg()}</Alert>
  {:else if form?.success === "elevated"}
    <Alert variant="success">{m.super_tenant_elevated()}</Alert>
  {:else if form?.success === "elevation_revoked"}
    <Alert variant="success">{m.super_tenant_elevation_revoked()}</Alert>
  {:else if form?.success === "ownership_transferred"}
    <Alert variant="success">{m.super_tenant_ownership_transferred()}</Alert>
  {:else if form?.success === "soft_deleted"}
    <Alert variant="success">{m.super_tenant_soft_deleted()}</Alert>
  {:else if form?.action_error}
    <Alert variant="error">{m.error_generic_description()}</Alert>
  {/if}

  <div class="grid-2">
    <!-- ── Info ── -->
    <div class="card">
      <h2 class="card-title">{m.super_tenant_info()}</h2>
      <div class="info-layout">
        <div class="info-logo-col">
          {#if data.tenant.logo_key}
            <div class="logo-placeholder-lg" aria-hidden="true">
              {@html Icons.building2}
            </div>
            <p class="logo-label">{m.company_logo()}</p>
          {:else}
            <div class="logo-placeholder-lg empty" aria-hidden="true">
              {@html Icons.building2}
            </div>
            <p class="logo-label text-muted">{m.company_logo()}</p>
          {/if}
        </div>
        <dl class="info-list">
          <div class="info-row">
            <dt>ID</dt>
            <dd class="mono">{data.tenant.id}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_company_email()}</dt>
            <dd>{data.tenant.email}</dd>
          </div>
          {#if data.tenant.address}
            <div class="info-row">
              <dt>{m.super_tenant_address()}</dt>
              <dd>{data.tenant.address}</dd>
            </div>
          {/if}
          {#if data.tenant.phone}
            <div class="info-row">
              <dt>{m.common_phone()}</dt>
              <dd>{data.tenant.phone}</dd>
            </div>
          {/if}
          {#if data.tenant.website}
            <div class="info-row">
              <dt>{m.common_website()}</dt>
              <dd>
                <a href={data.tenant.website} target="_blank" rel="noopener"
                  >{data.tenant.website}</a
                >
              </dd>
            </div>
          {/if}
          <div class="info-row">
            <dt>{m.super_tenant_created_at()}</dt>
            <dd>{formatDate(data.tenant.created_at)}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_owner()}</dt>
            <dd>{data.owner?.email ?? m.super_tenant_no_owner()}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_admin_seats()}</dt>
            <dd>{data.seats.admins} / {data.tenant.admin_seat_limit}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_member_seats()}</dt>
            <dd>
              {data.seats.collaborators} / {data.tenant.member_seat_limit}
            </dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_clients()}</dt>
            <dd>{data.seats.clients} / {data.tenant.client_seat_limit}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_storage()}</dt>
            <dd>{formatBytes(data.tenant.storage_limit_bytes)}</dd>
          </div>
          <div class="info-row">
            <dt>{m.super_tenant_daily_email()}</dt>
            <dd>
              {data.tenant.daily_email_limit}
              {m.super_tenant_emails_per_day()}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- ── Limites editáveis ── -->
    <div class="card">
      <h2 class="card-title">{m.super_tenant_limits_title()}</h2>
      <form
        method="POST"
        action="?/update_limits"
        use:enhance={() => {
          loadingAction = "limits";
          return async ({ update }) => {
            loadingAction = null;
            await update();
          };
        }}
      >
        <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
        <div class="limits-grid">
          <div class="field">
            <label for="admin_seat_limit">
              {m.super_tenant_admin_seats()}
            </label>
            <span class="field-hint">{m.super_tenant_admin_seats_hint()}</span>
            <input
              id="admin_seat_limit"
              type="number"
              name="admin_seat_limit"
              value={data.tenant.admin_seat_limit}
              min={1}
              max={50}
              disabled={loadingAction === "limits"}
            />
          </div>
          <div class="field">
            <label for="member_seat_limit">
              {m.super_tenant_member_seats()}
            </label>
            <span class="field-hint">{m.super_tenant_member_seats_hint()}</span>
            <input
              id="member_seat_limit"
              type="number"
              name="member_seat_limit"
              value={data.tenant.member_seat_limit}
              min={0}
              max={200}
              disabled={loadingAction === "limits"}
            />
          </div>
          <div class="field">
            <label for="client_seat_limit">
              {m.super_tenant_clients()}
            </label>
            <span class="field-hint">{m.super_tenant_client_seats_hint()}</span>
            <input
              id="client_seat_limit"
              type="number"
              name="client_seat_limit"
              value={data.tenant.client_seat_limit}
              min={0}
              max={500}
              disabled={loadingAction === "limits"}
            />
          </div>

          <div class="field">
            <label for="daily_email_limit">{m.super_tenant_daily_email()}</label
            >
            <span class="field-hint">{m.super_tenant_daily_email_hint()}</span>
            <input
              id="daily_email_limit"
              type="number"
              name="daily_email_limit"
              value={data.tenant.daily_email_limit}
              min={1}
              max={10000}
              disabled={loadingAction === "limits"}
            />
          </div>
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={loadingAction === "limits"}
        >
          {loadingAction === "limits"
            ? m.common_loading()
            : m.super_tenant_save_limits()}
        </Button>
      </form>
    </div>

    <!-- ── Armazenamento ── -->
    <div class="card">
      <h2 class="card-title">{m.super_tenant_storage()} (MB)</h2>
      <div class="storage-container">
        <div
          class="progress-bar-bg"
          style="height: 8px; background: var(--border-base); border-radius: var(--radius-full); overflow: hidden; margin-bottom: var(--space-2);"
        >
          <div
            class="progress-bar-fill"
            style="height: 100%; width: {Math.min(
              100,
              Math.round(
                ((data.storage_used ?? 0) / data.tenant.storage_limit_bytes) *
                  100,
              ),
            )}%; background: var(--brand-500);"
          ></div>
        </div>
        <div
          class="progress-info"
          style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-6);"
        >
          {formatBytes(data.storage_used ?? 0)} / {formatBytes(
            data.tenant.storage_limit_bytes,
          )} ({Math.round(
            ((data.storage_used ?? 0) / data.tenant.storage_limit_bytes) * 100,
          )}%)
        </div>

        <form
          method="POST"
          action="?/update_storage"
          use:enhance={() => {
            loadingAction = "storage";
            return async ({ update }) => {
              loadingAction = null;
              await update();
            };
          }}
        >
          <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
          <div class="field">
            <!-- Envia MB, o servidor converte para bytes -->
            <input
              id="storage_limit_mb"
              type="number"
              name="storage_limit_mb"
              value={storageMB}
              min={1}
              max={102400}
              step={1}
              disabled={loadingAction === "storage"}
            />
          </div>
          <div style="margin-top: var(--space-4);">
            <Button
              type="submit"
              variant="primary"
              disabled={loadingAction === "storage"}
            >
              {loadingAction === "storage"
                ? m.common_loading()
                : m.super_tenant_save_limits()}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>

    <!-- ── Acções ── -->
  {#if data.tenant.status !== "deleted"}
    <div class="card">
      <h2 class="card-title">{m.common_actions()}</h2>
      <div class="actions-row">
        {#if data.tenant.status === "inactive"}
          <form
            method="POST"
            action="?/activate"
            use:enhance={() => {
              loadingAction = "activate";
              return async ({ update }) => {
                loadingAction = null;
                await update();
              };
            }}
          >
            <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
            <Button type="submit" variant="success" disabled={!!loadingAction}>
              {m.super_tenant_activate()}
            </Button>
          </form>
        {:else if data.tenant.status === "active"}
          <form
            method="POST"
            action="?/deactivate"
            use:enhance={() => {
              loadingAction = "deactivate";
              return async ({ update }) => {
                loadingAction = null;
                await update();
              };
            }}
          >
            <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
            <Button type="submit" variant="warning" disabled={!!loadingAction}>
              {m.super_tenant_deactivate()}
            </Button>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── Equipa (árvore de utilizadores) ── -->
  <div class="card">
    <h2 class="card-title">{m.super_tenant_team_title()}</h2>

    <!-- Owner fixo -->
    <div class="team-section">
      <span class="team-section-label">{m.super_tenant_owner_fixed()}</span>
      {#if data.users?.owner}
        <div class="user-row">
          <span class="user-avatar-sm"
            >{(data.users.owner.email ?? "?").charAt(0).toUpperCase()}</span
          >
          <div class="user-info">
            <span class="user-email">{data.users.owner.email}</span>
            {#if data.users.owner.display_name}
              <span class="user-name">{data.users.owner.display_name}</span>
            {/if}
          </div>
          <Badge variant="default" class="bg-blue-100 text-blue-800"
            >{m.super_tenant_owner_fixed()}</Badge
          >
        </div>
      {:else}
        <p class="no-data">—</p>
      {/if}
    </div>

    <!-- Owner temporário (se existir) -->
    {#if hasElevation}
      <div class="team-section">
        <span class="team-section-label">{m.super_tenant_owner_temp()}</span>
        {#each tempOwners as u}
          <div class="user-row">
            <span class="user-avatar-sm"
              >{(u.email ?? "?").charAt(0).toUpperCase()}</span
            >
            <div class="user-info">
              <span class="user-email">{u.email}</span>
            </div>
            <Badge variant="warning">{m.super_tenant_owner_temp()}</Badge>
            <!-- Revogar elevação -->
            <form
              method="POST"
              action="?/revoke_elevation"
              use:enhance={() => {
                loadingAction = "revoke";
                return async ({ update }) => {
                  loadingAction = null;
                  await update();
                };
              }}
            >
              <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
              <input type="hidden" name="user_id" value={u.id} />
              <Button
                type="submit"
                variant="warning"
                size="xs"
                disabled={!!loadingAction}
              >
                {m.super_tenant_revoke_elevation()}
              </Button>
            </form>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Sócios -->
    <div class="team-section">
      <span class="team-section-label"
        >{m.super_tenant_members()} ({(data.users?.members ?? []).length})</span
      >
      {#if (data.users?.members ?? []).length === 0}
        <p class="no-data">{m.super_tenant_no_members()}</p>
      {:else}
        {#each data.users.members as u}
          <div class="user-row">
            <span class="user-avatar-sm"
              >{(u.email ?? "?").charAt(0).toUpperCase()}</span
            >
            <div class="user-info">
              <span class="user-email">{u.email}</span>
            </div>
            <Badge variant="default" class="bg-gray-100 text-gray-800"
              >{m.super_tenant_role_member()}</Badge
            >
          </div>
        {/each}
      {/if}
    </div>

    <!-- Colaboradores -->
    <div class="team-section">
      <span class="team-section-label"
        >{m.super_tenant_collaborators()} ({(data.users?.collaborators ?? [])
          .length})</span
      >
      {#if (data.users?.collaborators ?? []).length === 0}
        <p class="no-data">{m.super_tenant_no_collaborators()}</p>
      {:else}
        {#each data.users.collaborators as u}
          <div class="user-row">
            <span class="user-avatar-sm"
              >{(u.email ?? "?").charAt(0).toUpperCase()}</span
            >
            <div class="user-info">
              <span class="user-email">{u.email}</span>
            </div>
            <Badge variant="default" class="bg-gray-100 text-gray-800"
              >{m.super_tenant_role_collab()}</Badge
            >
          </div>
        {/each}
      {/if}
    </div>

    <!-- Clientes -->
    <div class="team-section">
      <span class="team-section-label"
        >{m.super_tenant_clients()} ({(data.users?.clients ?? []).length})</span
      >
      {#if (data.users?.clients ?? []).length === 0}
        <p class="no-data">{m.super_tenant_no_clients()}</p>
      {:else}
        {#each data.users.clients as u}
          <div class="user-row">
            <span class="user-avatar-sm"
              >{(u.email ?? "?").charAt(0).toUpperCase()}</span
            >
            <div class="user-info">
              <span class="user-email">{u.email}</span>
            </div>
            <Badge variant="default" class="bg-gray-100 text-gray-800"
              >{m.super_tenant_role_client()}</Badge
            >
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- ── Elevar sócio ── -->
  {#if elevateEligible.length > 0 && !hasElevation}
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{m.super_tenant_elevate_title()}</h2>
        <p class="card-desc">{m.super_tenant_elevate_desc()}</p>
      </div>
      <form
        method="POST"
        action="?/elevate"
        use:enhance={() => {
          loadingAction = "elevate";
          return async ({ update }) => {
            loadingAction = null;
            await update();
          };
        }}
      >
        <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
        <div class="inline-form">
          <select
            name="user_id"
            class="select-input"
            bind:value={elevateUserId}
            required
          >
            <option value="">{m.super_tenant_select_member()}</option>
            {#each elevateEligible as u}
              <option value={u.id}>{u.email}</option>
            {/each}
          </select>
          <div class="field-narrow">
            <label for="dur-hours">{m.super_tenant_duration_hours()}</label>
            <input
              id="dur-hours"
              type="number"
              name="duration_hours"
              bind:value={elevateHours}
              min={1}
              max={168}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!!loadingAction || !elevateUserId}
          >
            {m.super_tenant_elevate_btn()}
          </Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- ── Transferir ownership ── -->
  {#if transferEligible.length > 0}
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">{m.super_tenant_transfer_title()}</h2>
        <p class="card-desc card-desc-warn">{m.super_tenant_transfer_desc()}</p>
      </div>
      <form
        method="POST"
        action="?/transfer_ownership"
        use:enhance={() => {
          loadingAction = "transfer";
          return async ({ update }) => {
            loadingAction = null;
            await update();
          };
        }}
      >
        <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
        <div class="inline-form">
          <select
            name="new_owner_id"
            class="select-input"
            bind:value={transferUserId}
            required
          >
            <option value="">{m.super_tenant_select_member()}</option>
            {#each transferEligible as u}
              <option value={u.id}>{u.email}</option>
            {/each}
          </select>
          <Button
            type="submit"
            variant="warning"
            disabled={!!loadingAction || !transferUserId}
            onclick={(e) => {
              if (!confirm(m.super_tenant_confirm_transfer()))
                e.preventDefault();
            }}
          >
            {m.super_tenant_transfer_btn()}
          </Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- ── Apagar Permanentemente ── -->
  <div class="card card-danger">
    <div class="danger-header">
      <div class="card-header">
        <h2 class="card-title card-title-danger">
          {m.super_tenant_delete_title()}
        </h2>
        <p class="card-desc">{m.super_tenant_delete_warning()}</p>
      </div>
      <Button
        type="button"
        variant="danger"
        onclick={() => (showDeleteConfirm = !showDeleteConfirm)}
        aria-expanded={showDeleteConfirm}
      >
        {m.super_tenant_delete_permanently()}
      </Button>
    </div>

    {#if showDeleteConfirm}
      <div class="delete-confirm-panel">
        <p class="delete-confirm-text">
          <span class="delete-warn-icon">{@html Icons.alertTriangle}</span>
          {m.super_tenant_delete_confirm()}
        </p>
        <form
          method="POST"
          action="?/hard_delete"
          use:enhance={() => {
            loadingAction = "delete";
            return async ({ update }) => {
              loadingAction = null;
              await update();
            };
          }}
        >
          <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />
          <div class="delete-confirm-actions">
            <Button
              type="button"
              variant="outline"
              onclick={() => (showDeleteConfirm = false)}
            >
              {m.common_cancel()}
            </Button>
            <Button type="submit" variant="danger" disabled={!!loadingAction}>
              {loadingAction === "delete"
                ? m.common_loading()
                : m.super_tenant_delete_permanently()}
            </Button>
          </div>
        </form>
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

  /* ── Header ── */
  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .back-link {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-decoration: none;
  }
  .back-link:hover {
    color: var(--text-primary);
  }

  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }
  .page-sub {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: var(--space-1) 0 0;
  }

  /* ── Grid ── */
  .grid-2 {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  /* ── Cards ── */
  .card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .card-danger {
    border-color: color-mix(in srgb, #dc2626 30%, transparent);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }
  .card-title-danger {
    color: #dc2626;
  }

  /* ── Danger card ── */
  .danger-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .card-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* ── Info layout ── */
  .info-layout {
    display: flex;
    gap: var(--space-6);
    align-items: flex-start;
  }

  .info-logo-col {
    --logo-max: 64px;
    width: calc(var(--logo-max) + var(--space-8));
    height: calc(var(--logo-max) + var(--space-8));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    background-color: var(--bg-body);
    border: 1px dashed var(--border-subtle);
    border-radius: var(--radius-lg);
    color: var(--text-secondary);
  }

  .logo-placeholder-lg {
    width: var(--logo-max);
    height: var(--logo-max);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-placeholder-lg.empty {
    opacity: 0.5;
  }

  .logo-placeholder-lg :global(svg) {
    width: 100%;
    height: 100%;
  }

  .logo-label {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    margin: 0;
  }

  .text-muted {
    opacity: 0.7;
  }

  /* ── Info list ── */
  .info-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }

  .info-row {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: var(--space-3);
    font-size: var(--text-sm);
    align-items: baseline;
  }

  .info-row dt {
    white-space: nowrap;
  }

  .info-row dt {
    color: var(--text-secondary);
  }
  .info-row dd {
    color: var(--text-primary);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mono {
    font-family: monospace;
    font-size: var(--text-xs);
  }

  /* ── Actions row ── */
  .actions-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
  }

  .actions-row form {
    display: inline-flex;
  }

  /* ── Limits form ── */
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .limits-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field label {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  .field-hint {
    font-size: var(--text-2xs);
    color: var(--text-muted);
    opacity: 0.75;
    line-height: 1.3;
    margin-bottom: var(--space-1);
  }

  .field input {
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background-color: var(--bg-input);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
    outline: none;
  }

  .field input:focus {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    border-color: var(--brand-600);
  }
  .field input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Team section ── */
  .team-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .team-section:last-child {
    border-bottom: none;
  }

  .team-section-label {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .user-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
  }

  .user-avatar-sm {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    background-color: var(--brand-100);
    color: var(--brand-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .user-email {
    font-size: var(--text-sm);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-name {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .no-data {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Inline form ── */
  .inline-form {
    display: flex;
    gap: var(--space-3);
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .select-input {
    flex: 1;
    min-width: 200px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background-color: var(--bg-input);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-primary);
    outline: none;
  }

  .select-input:focus {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    border-color: var(--brand-600);
  }

  .field-narrow {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-narrow label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--weight-medium);
  }

  .field-narrow input {
    width: 80px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background-color: var(--bg-input);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-primary);
    outline: none;
  }

  .card-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .card-desc-warn {
    color: #854d0e;
  }

  /* ── Delete Confirm Panel ── */
  .delete-confirm-panel {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid color-mix(in srgb, #dc2626 20%, transparent);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .delete-confirm-text {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-primary);
    margin: 0;
  }

  .delete-warn-icon {
    color: #dc2626;
    display: flex;
  }
  .delete-warn-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .delete-confirm-actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
