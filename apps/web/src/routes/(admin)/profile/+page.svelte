<script lang="ts">
  /**
   * (admin)/profile/+page.svelte — Página de perfil (M5)
   *
   * R: BUILD_PLAN.md §M5.4
   * R: design/tokens.css — variáveis CSS (nunca Tailwind para cor/espaçamento)
   * R: LL-05 — enhance com { result } + goto() para redirects
   * R: LL-08 — Svelte 5: $derived para valores reactivos
   */
  import * as m from "$lib/paraglide/messages.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { Icons } from "$lib/icons.js";
  import type { PageData, ActionData } from "./$types";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  const profile = $derived(data.profile);
  const company = $derived(data.company);
  const isOwner = $derived(data.isOwner);

  // Tab activa
  let activeTab = $state<"personal" | "email" | "password" | "company">(
    "personal",
  );

  // Loading state
  let loading = $state(false);

  // Modal de confirmação
  let confirmModal = $state<null | {
    type: "remove_avatar" | "remove_logo" | "self_delete";
  }>(null);

  // Mensagens de feedback
  let successMsg = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  function setMsg(success?: string, error?: string) {
    successMsg = success ?? null;
    errorMsg = error ?? null;
    if (success || error) {
      setTimeout(() => {
        successMsg = null;
        errorMsg = null;
      }, 5000);
    }
  }

  // Processar resultado de form action
  $effect(() => {
    if (form) {
      const f = form as { action?: string; success?: boolean; error?: string };
      if (f.success) {
        const msgs: Record<string, string> = {
          update_profile: m.profile_saved(),
          change_email: m.profile_change_email_success(),
          change_password: m.profile_change_password_success(),
          update_company: m.company_saved(),
        };
        setMsg(msgs[f.action ?? ""] ?? "");
      } else if (f.error) {
        setMsg(undefined, f.error);
      }
    }
  });

  // Quota de storage
  const storagePercent = $derived(
    company
      ? Math.min(
          100,
          Math.round((company.storage_used / company.storage_limit) * 100),
        )
      : 0,
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // CSRF token da página
  const csrfToken = $derived($page.data.csrfToken ?? "");

  // Password checklist
  let newPasswordVal = $state("");
  const hasMinLen = $derived(newPasswordVal.length >= 12);
  const hasUpper = $derived(/[A-Z]/.test(newPasswordVal));
  const hasLower = $derived(/[a-z]/.test(newPasswordVal));
  const hasSpecial = $derived(/[^a-zA-Z0-9]/.test(newPasswordVal));
  const passwordValid = $derived(
    hasMinLen && hasUpper && hasLower && hasSpecial,
  );

  // Auto-delete state
  let selfDeleteConfirm = $state(false);
</script>

<div class="profile-page">
  <div class="profile-header">
    <h1 class="profile-title">{m.profile_title()}</h1>
  </div>

  <!-- Feedback global -->
  {#if successMsg}
    <Alert variant="success" role="alert">{successMsg}</Alert>
  {/if}
  {#if errorMsg}
    <Alert variant="error" role="alert">{errorMsg}</Alert>
  {/if}

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button
      class="tab-btn"
      class:active={activeTab === "personal"}
      onclick={() => (activeTab = "personal")}
      role="tab"
      aria-selected={activeTab === "personal"}
    >
      {m.profile_personal_section()}
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "email"}
      onclick={() => (activeTab = "email")}
      role="tab"
      aria-selected={activeTab === "email"}
    >
      {m.profile_change_email_title()}
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "password"}
      onclick={() => (activeTab = "password")}
      role="tab"
      aria-selected={activeTab === "password"}
    >
      {m.profile_change_password_title()}
    </button>
    {#if isOwner}
      <button
        class="tab-btn"
        class:active={activeTab === "company"}
        onclick={() => (activeTab = "company")}
        role="tab"
        aria-selected={activeTab === "company"}
      >
        {m.profile_company_section()}
      </button>
    {/if}
  </div>

  <!-- ── Tab: Dados pessoais ─────────────────────────────────────────── -->
  {#if activeTab === "personal"}
    <div class="card">
      <!-- Avatar -->
      <div class="avatar-section">
        <div class="avatar-placeholder">
          {#if profile?.avatar_key}
            <span class="avatar-icon" aria-hidden="true"
              >{@html Icons.user}</span
            >
          {:else}
            <span class="avatar-icon" aria-hidden="true"
              >{@html Icons.user}</span
            >
          {/if}
        </div>
        <div class="avatar-actions">
          <p class="avatar-hint">{m.profile_avatar_hint()}</p>
          <Button variant="secondary" href="?edit=true">
            <label for="avatar-input">
              {m.profile_avatar_upload()}
            </label>
          </Button>
          <input
            id="avatar-input"
            type="file"
            accept="image/png, image/jpeg, image/webp"
            class="file-input-hidden"
            onchange={async (e) => {
              const input = e.currentTarget as HTMLInputElement;
              const file = input.files?.[0];
              if (!file) return;

              if (file.size > 200 * 1024) {
                setMsg(undefined, m.profile_avatar_hint());
                input.value = ""; // reset input
                return;
              }

              loading = true;
              try {
                // Send original file directly without client-side optimization.
                // Cloudflare Image Resizing will format and resize it upon delivery.
                const fd = new FormData();
                fd.append("file", file);

                const res = await fetch("/api/user/profile/avatar", {
                  method: "POST",
                  headers: { "x-csrf-token": csrfToken },
                  body: fd,
                });
                if (res.ok) {
                  setMsg(m.profile_saved());
                  window.location.reload();
                } else {
                  const err = (await res.json()) as { detail?: string };
                  setMsg(undefined, err.detail ?? m.profile_save_error());
                }
              } catch (err: any) {
                setMsg(
                  undefined,
                  m.profile_save_error() +
                    (err.message ? " (" + err.message + ")" : ""),
                );
              } finally {
                loading = false;
              }
            }}
          />
          {#if profile?.avatar_key}
            <Button
              variant="ghost"
              class="text-danger"
              onclick={() => (confirmModal = { type: "remove_avatar" })}
            >
              {m.profile_avatar_remove()}
            </Button>
          {/if}
        </div>
      </div>

      <!-- Formulário dados pessoais -->
      <form
        method="POST"
        action="?/update_profile"
        use:enhance={() => {
          loading = true;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              await applyAction(result);
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="first_name"
              >{m.profile_first_name()}</label
            >
            <input
              id="first_name"
              name="first_name"
              type="text"
              class="form-input"
              value={profile?.first_name ?? ""}
              maxlength="100"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="last_name"
              >{m.profile_last_name()}</label
            >
            <input
              id="last_name"
              name="last_name"
              type="text"
              class="form-input"
              value={profile?.last_name ?? ""}
              maxlength="100"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="display_name"
            >{m.profile_display_name()}</label
          >
          <input
            id="display_name"
            name="display_name"
            type="text"
            class="form-input"
            value={profile?.display_name ?? ""}
            maxlength="100"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="profile_email"
            >{m.common_email()}</label
          >
          <input
            id="profile_email"
            type="email"
            class="form-input form-input-disabled"
            value={profile?.email ?? ""}
            disabled
          />
          {#if profile?.email_pending}
            <p class="form-hint form-hint-warning">
              {m.profile_email_pending()}:
              <strong>{profile.email_pending}</strong>
            </p>
          {/if}
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="phone">{m.common_phone()}</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              class="form-input"
              value={profile?.phone ?? ""}
              maxlength="30"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="website">{m.common_website()}</label>
            <input
              id="website"
              name="website"
              type="url"
              class="form-input"
              value={profile?.website ?? ""}
              maxlength="255"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="preferred_language"
            >{m.profile_language()}</label
          >
          <select
            id="preferred_language"
            name="preferred_language"
            class="form-select"
          >
            <option value="pt" selected={profile?.preferred_language === "pt"}>
              {m.profile_language_pt()}
            </option>
            <option value="en" selected={profile?.preferred_language === "en"}>
              {m.profile_language_en()}
            </option>
          </select>
        </div>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "…" : m.profile_save()}
          </Button>
        </div>
      </form>

      <!-- Exportar RGPD -->
      <div class="divider"></div>
      <div class="rgpd-section">
        <h3 class="section-subtitle">{m.profile_rgpd_title()}</h3>
        <p class="section-desc">{m.profile_rgpd_description()}</p>
        <Button
          href="/api/user/profile/export-rgpd"
          variant="secondary"
          download
        >
          {m.profile_rgpd_export()}
        </Button>
      </div>

      <!-- Auto-delete -->
      <div class="divider"></div>
      <div class="rgpd-section">
        <h3 class="section-subtitle">{m.user_self_delete_title()}</h3>
        <p class="section-desc">{m.user_self_delete_body()}</p>
        <Button
          variant="danger"
          onclick={() => (confirmModal = { type: "self_delete" })}
        >
          {m.user_self_delete_title()}
        </Button>
      </div>
    </div>
  {/if}

  <!-- ── Tab: Alterar email ──────────────────────────────────────────── -->
  {#if activeTab === "email"}
    <div class="card">
      <form
        method="POST"
        action="?/change_email"
        use:enhance={() => {
          loading = true;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              await applyAction(result);
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="form-group">
          <label class="form-label" for="current_password_email">
            {m.profile_change_email_current_password()}
          </label>
          <input
            id="current_password_email"
            name="current_password"
            type="password"
            class="form-input"
            required
            autocomplete="current-password"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="new_email"
            >{m.profile_change_email_new_email()}</label
          >
          <input
            id="new_email"
            name="new_email"
            type="email"
            class="form-input"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "…" : m.profile_change_email_submit()}
          </Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- ── Tab: Alterar password ──────────────────────────────────────── -->
  {#if activeTab === "password"}
    <div class="card">
      <form
        method="POST"
        action="?/change_password"
        use:enhance={() => {
          loading = true;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              await applyAction(result);
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="form-group">
          <label class="form-label" for="current_password_pwd">
            {m.profile_change_password_current()}
          </label>
          <input
            id="current_password_pwd"
            name="current_password"
            type="password"
            class="form-input"
            required
            autocomplete="current-password"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="new_password"
            >{m.profile_change_password_new()}</label
          >
          <input
            id="new_password"
            name="new_password"
            type="password"
            class="form-input"
            required
            minlength="12"
            autocomplete="new-password"
            bind:value={newPasswordVal}
          />
          <ul class="password-checklist">
            <li class:check-ok={hasMinLen}>
              {@html hasMinLen ? Icons.check : Icons.x}
              {m.auth_password_min_length()}
            </li>
            <li class:check-ok={hasUpper}>
              {@html hasUpper ? Icons.check : Icons.x}
              {m.auth_password_uppercase()}
            </li>
            <li class:check-ok={hasLower}>
              {@html hasLower ? Icons.check : Icons.x}
              {m.auth_password_lowercase()}
            </li>
            <li class:check-ok={hasSpecial}>
              {@html hasSpecial ? Icons.check : Icons.x}
              {m.auth_password_special()}
            </li>
          </ul>
        </div>

        <div class="form-actions">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !passwordValid}
          >
            {loading ? "…" : m.profile_change_password_submit()}
          </Button>
        </div>
      </form>
    </div>
  {/if}

  <!-- ── Tab: Empresa (só owner) ───────────────────────────────────── -->
  {#if activeTab === "company" && isOwner && company}
    <div class="card">
      <!-- Quota de storage -->
      <div class="storage-section">
        <div class="storage-header">
          <span class="storage-label">{m.profile_storage_used()}</span>
          <span class="storage-value">
            {formatBytes(company.storage_used)}
            {m.profile_storage_of()}
            {formatBytes(company.storage_limit)}
          </span>
        </div>
        <div class="storage-bar-bg">
          <div
            class="storage-bar-fill"
            style="width: {storagePercent}%"
            class:storage-bar-warning={storagePercent > 70}
            class:storage-bar-danger={storagePercent > 90}
          ></div>
        </div>
        <p class="storage-percent">{storagePercent}%</p>
      </div>

      <!-- Logo -->
      <div class="logo-section">
        <p class="form-label">{m.company_logo()}</p>
        <div class="logo-area">
          {#if company.logo_key}
            <div class="logo-placeholder" aria-hidden="true">
              {@html Icons.building2}
            </div>
            <Button
              variant="ghost"
              class="text-danger"
              onclick={() => (confirmModal = { type: "remove_logo" })}
            >
              {m.company_logo_remove()}
            </Button>
            <Button variant="secondary" href="?edit=true">
              <label for="logo-input">
                {m.company_logo_upload()}
              </label>
            </Button>
            <input
              id="logo-input"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              class="file-input-hidden"
              onchange={async (e) => {
                const input = e.currentTarget as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;

                if (file.size > 200 * 1024) {
                  setMsg(undefined, m.company_logo_hint());
                  input.value = ""; // reset input
                  return;
                }

                loading = true;
                try {
                  // Send original file directly without client-side optimization.
                  // Cloudflare Image Resizing will format and resize it upon delivery.
                  const fd = new FormData();
                  fd.append("file", file);

                  const res = await fetch("/api/admin/company/logo", {
                    method: "POST",
                    headers: { "x-csrf-token": csrfToken },
                    body: fd,
                  });
                  if (res.ok) {
                    setMsg(m.company_saved());
                    window.location.reload();
                  } else {
                    const err = (await res.json()) as { detail?: string };
                    setMsg(undefined, err.detail ?? m.company_save_error());
                  }
                } catch (err: any) {
                  setMsg(
                    undefined,
                    m.company_save_error() +
                      (err.message ? " (" + err.message + ")" : ""),
                  );
                } finally {
                  loading = false;
                }
              }}
            />
            <p class="form-hint">{m.company_logo_hint()}</p>
          {/if}
        </div>
      </div>

      <!-- Formulário dados empresa -->
      <form
        method="POST"
        action="?/update_company"
        use:enhance={() => {
          loading = true;
          return async ({ result }) => {
            loading = false;
            if (result.type === "redirect") {
              goto(result.location);
            } else {
              await applyAction(result);
            }
          };
        }}
      >
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="form-group">
          <label class="form-label" for="company_name">{m.company_name()}</label
          >
          <input
            id="company_name"
            name="name"
            type="text"
            class="form-input"
            value={company.name}
            required
            maxlength="200"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="company_email"
            >{m.company_email()}</label
          >
          <input
            id="company_email"
            type="email"
            class="form-input form-input-disabled"
            value={company.email}
            disabled
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="company_address"
            >{m.company_address()}</label
          >
          <input
            id="company_address"
            name="address"
            type="text"
            class="form-input"
            value={company.address ?? ""}
            maxlength="500"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="company_phone"
              >{m.common_phone()}</label
            >
            <input
              id="company_phone"
              name="phone"
              type="tel"
              class="form-input"
              value={company.phone ?? ""}
              maxlength="30"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="company_website"
              >{m.common_website()}</label
            >
            <input
              id="company_website"
              name="website"
              type="url"
              class="form-input"
              value={company.website ?? ""}
              maxlength="255"
            />
          </div>
        </div>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "…" : m.company_save()}
          </Button>
        </div>
      </form>
    </div>
  {/if}
</div>

<!-- ── Modal de confirmação ────────────────────────────────────────── -->
{#if confirmModal}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal">
      <h2 class="modal-title">
        {#if confirmModal.type === "remove_avatar"}
          {m.confirm_remove_avatar_title()}
        {:else if confirmModal.type === "remove_logo"}
          {m.confirm_remove_logo_title()}
        {:else}
          {m.user_self_delete_title()}
        {/if}
      </h2>
      <p class="modal-body">
        {#if confirmModal.type === "remove_avatar"}
          {m.confirm_remove_avatar_body()}
        {:else if confirmModal.type === "remove_logo"}
          {m.confirm_remove_logo_body()}
        {:else}
          {m.user_self_delete_body()}
          <label class="self-delete-confirm">
            <input type="checkbox" bind:checked={selfDeleteConfirm} />
            {m.user_self_delete_confirm()}
          </label>
        {/if}
      </p>
      <div class="modal-actions">
        <Button
          variant="ghost"
          onclick={() => {
            confirmModal = null;
            selfDeleteConfirm = false;
          }}
        >
          {m.common_cancel()}
        </Button>
        <Button
          variant="danger"
          disabled={confirmModal.type === "self_delete" && !selfDeleteConfirm}
          onclick={async () => {
            if (confirmModal?.type === "self_delete") {
              confirmModal = null;
              loading = true;
              try {
                const res = await fetch("/api/user/profile", {
                  method: "DELETE",
                  headers: { "x-csrf-token": csrfToken },
                });
                if (res.ok) {
                  window.location.href = "/login";
                } else {
                  const err = (await res.json()) as { detail?: string };
                  setMsg(undefined, err.detail ?? m.profile_save_error());
                }
              } catch {
                setMsg(undefined, m.profile_save_error());
              } finally {
                loading = false;
                selfDeleteConfirm = false;
              }
              return;
            }
            const url =
              confirmModal?.type === "remove_avatar"
                ? "/api/user/profile/avatar"
                : "/api/admin/company/logo";
            confirmModal = null;
            loading = true;
            try {
              const res = await fetch(url, {
                method: "DELETE",
                headers: { "x-csrf-token": csrfToken },
              });
              if (res.ok) {
                setMsg(m.profile_saved());
                window.location.reload();
              } else {
                const err = (await res.json()) as { detail?: string };
                setMsg(undefined, err.detail ?? m.profile_save_error());
              }
            } catch {
              setMsg(undefined, m.profile_save_error());
            } finally {
              loading = false;
            }
          }}
        >
          {m.common_confirm()}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ────────────────────────────────────────────────────────── */
  .profile-page {
    max-width: var(--page-content-max-w);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .profile-header {
    margin-bottom: var(--space-6);
  }

  .profile-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
  }

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  .tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-5);
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }

  .tab-btn.active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }

  .tab-btn:hover {
    color: var(--text-primary);
    border-bottom-color: var(--border-subtle);
  }

  /* ── Card ────────────────────────────────────────────────────────────── */
  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
  }

  /* ── Avatar ──────────────────────────────────────────────────────────── */
  .avatar-section {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .avatar-placeholder {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-full);
    background: var(--bg-surface-subtle);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-actions {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .avatar-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin: 0;
  }

  .file-input-hidden {
    display: none;
  }

  /* ── Formulário ──────────────────────────────────────────────────────── */
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .form-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  .form-input,
  .form-select {
    height: var(--size-btn-h-md);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    background: var(--bg-page);
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-100);
  }

  .form-input-disabled {
    background: var(--bg-surface-subtle);
    color: var(--text-muted);
    cursor: not-allowed;
  }

  .form-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin: 0;
  }

  .form-hint-warning {
    color: var(--status-pending-text);
  }

  .form-actions {
    margin-top: var(--space-5);
    display: flex;
    justify-content: flex-end;
  }

  /* ── Divider ─────────────────────────────────────────────────────────── */
  .divider {
    border: none;
    border-top: 1px solid var(--border-subtle);
    margin: var(--space-6) 0;
  }

  /* ── RGPD ────────────────────────────────────────────────────────────── */
  .rgpd-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-subtitle {
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .section-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Storage bar ─────────────────────────────────────────────────────── */
  .storage-section {
    margin-bottom: var(--space-5);
    padding: var(--space-4);
    background: var(--bg-surface-subtle);
    border-radius: var(--radius-md);
  }

  .storage-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .storage-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  .storage-value {
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .storage-bar-bg {
    height: 8px;
    background: var(--border-subtle);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .storage-bar-fill {
    height: 100%;
    background: var(--brand-500);
    border-radius: var(--radius-full);
    transition: width 0.4s ease;
  }

  .storage-bar-fill.storage-bar-warning {
    background: #f59e0b;
  }

  .storage-bar-fill.storage-bar-danger {
    background: var(--status-inactive-dot);
  }

  .storage-percent {
    font-size: var(--text-xs);
    color: var(--text-muted);
    text-align: right;
    margin: var(--space-1) 0 0;
  }

  /* ── Logo section ─────────────────────────────────────────────────────── */
  .logo-section {
    margin-bottom: var(--space-5);
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-2);
    flex-wrap: wrap;
  }

  /* ── Modal ───────────────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg-overlay, rgba(0, 0, 0, 0.4));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
  }

  .modal {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    max-width: var(--size-modal-w-compact);
    width: 90%;
    box-shadow: var(--shadow-popover);
  }

  .modal-title {
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--space-3);
  }

  .modal-body {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0 0 var(--space-5);
  }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }

  /* ── Password checklist ──────────────────────────────────────────── */
  .password-checklist {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .password-checklist li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--status-error-text);
  }

  .password-checklist li.check-ok {
    color: var(--status-success-text);
  }

  .password-checklist li :global(svg) {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    flex-shrink: 0;
  }

  /* ── Avatar icon SVG ────────────────────────────────────────────── */
  .avatar-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .avatar-icon :global(svg) {
    width: 32px;
    height: 32px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  /* ── Logo placeholder ───────────────────────────────────────────── */
  .logo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .logo-placeholder :global(svg) {
    width: 32px;
    height: 32px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.5;
  }

  /* ── Self-delete ────────────────────────────────────────────────── */
  .self-delete-confirm {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .self-delete-confirm input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--status-error-text);
  }
</style>
