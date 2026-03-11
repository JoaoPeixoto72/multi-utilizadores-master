<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import type { ActionData, PageData } from "./$types";

  interface Props {
    form: ActionData;
    data: PageData;
  }
  let { form, data }: Props = $props();

  let loading = $state(false);
  let email = $state("");
  let password = $state("");

  $effect(() => {
    if (form?.email) {
      email = form.email;
    }
  });
</script>

<div class="auth-card">
  <!-- Marca -->
  <div class="auth-brand">
    <span class="brand-name">{m.app_name()}</span>
  </div>

  <!-- Header -->
  <div class="auth-header">
    <h1 class="auth-title">{m.auth_login_title()}</h1>
    <p class="auth-subtitle">{m.auth_login_subtitle()}</p>
  </div>

  <!-- Alertas -->
  {#if page.url.searchParams.has("registered")}
    <Alert variant="success">{m.auth_setup_already_done()}</Alert>
  {/if}

  {#if page.url.searchParams.get("reset") === "true"}
    <Alert variant="success">{m.auth_reset_success()}</Alert>
  {/if}

  {#if form?.error === "auth_invalid_credentials"}
    <Alert variant="error">{m.auth_invalid_credentials()}</Alert>
  {:else if form?.error === "rate_limited"}
    <Alert variant="error">{m.auth_login_rate_limited()}</Alert>
  {:else if form?.error}
    <Alert variant="error">{m.error_generic_description()}</Alert>
  {/if}

  <!-- Formulário -->
  <form
    method="POST"
    use:enhance={() => {
      loading = true;
      return async ({ result }) => {
        loading = false;
        if (result.type === "redirect") {
          goto(result.location, { replaceState: false });
        } else {
          await applyAction(result);
        }
      };
    }}
    novalidate
  >
    <!-- CSRF hidden field -->
    <input type="hidden" name="_csrf" value={data?.csrfToken ?? ""} />

    <div class="field">
      <label for="email">{m.common_email()}</label>
      <input
        id="email"
        type="email"
        name="email"
        bind:value={email}
        autocomplete="email"
        placeholder="o.teu@email.com"
        required
        aria-invalid={form?.error ? "true" : undefined}
        aria-describedby={form?.error ? "form-error" : undefined}
        disabled={loading}
      />
    </div>

    <div class="field">
      <div class="field-header">
        <label for="password">{m.form_password_label()}</label>
      </div>
      <input
        id="password"
        type="password"
        name="password"
        bind:value={password}
        autocomplete="current-password"
        placeholder="••••••••••••"
        required
        aria-invalid={form?.error ? "true" : undefined}
        disabled={loading}
      />
    </div>

    <!-- Linha esqueci password -->
    <div class="forgot-row">
      <a class="forgot-link" href="/password-reset"
        >{m.auth_login_forgot_password()}</a
      >
    </div>

    <Button
      type="submit"
      variant="primary"
      disabled={loading || !email || !password}
    >
      {loading ? m.common_loading() : m.auth_login_submit()}
    </Button>
  </form>
</div>

<style>
  /* ── Card ── */
  .auth-card {
    background-color: var(--bg-surface);
    border-radius: var(--radius-xl);
    padding: var(--size-auth-card-padding);
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
    box-shadow: var(--shadow-modal);
  }

  /* ── Marca ── */
  .auth-brand {
    display: flex;
    align-items: center;
  }

  .brand-name {
    font-size: var(--text-lg);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
  }

  /* ── Header ── */
  .auth-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .auth-title {
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
    line-height: var(--leading-tight);
  }

  .auth-subtitle {
    font-size: var(--text-base);
    color: var(--text-secondary);
    margin: 0;
    line-height: var(--leading-normal);
    font-weight: var(--weight-medium);
  }

  /* ── Formulário ── */
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transition: background-color var(--duration-fast) var(--ease-out);
  }

  .field-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  /* ── Link "esqueci" ── */
  .forgot-row {
    display: flex;
    justify-content: flex-end;
    margin-top: calc(-1 * var(--space-2));
  }

  .forgot-link {
    font-size: var(--text-sm);
    color: var(--brand-600);
    text-decoration: none;
    font-weight: var(--weight-medium);
  }

  .forgot-link:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  /* ── Inputs (pill shape como referência) ── */
  input[type="email"],
  input[type="password"] {
    height: var(--size-input-h-lg);
    padding: 0 var(--space-6);
    border: 1.5px solid var(--border-input);
    border-radius: var(--radius-full);
    font-size: var(--text-base);
    color: var(--text-primary);
    background-color: var(--bg-surface-subtle);
    transition:
      border-color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default);
    width: 100%;
    box-sizing: border-box;
  }

  input[type="email"]::placeholder,
  input[type="password"]::placeholder {
    color: var(--text-muted);
  }

  input[type="email"]:hover,
  input[type="password"]:hover {
    border-color: var(--border-input-hover);
    background-color: var(--bg-surface);
  }

  input[type="email"]:focus,
  input[type="password"]:focus {
    outline: none;
    box-shadow: var(--focus-ring);
    border-color: var(--brand-500);
    background-color: var(--bg-surface);
  }

  input[aria-invalid="true"] {
    border-color: var(--status-error-border);
    background-color: var(--status-error-bg);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
