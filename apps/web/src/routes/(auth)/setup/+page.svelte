<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import PasswordChecklist from "$lib/components/auth/PasswordChecklist.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let loading = $state(false);
  let password = $state("");
</script>

```svelte
<div class="auth-card">
  <!-- Marca -->
  <div class="auth-brand">
    <span class="brand-name">{m.app_name()}</span>
  </div>

  <!-- Header -->
  <div class="auth-header">
    <h1 class="auth-title">{m.auth_setup_title()}</h1>
    <p class="auth-subtitle">{m.auth_setup_description()}</p>
  </div>

  {#if form?.error}
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
    <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />

    <div class="field">
      <label for="email">{m.common_email()}</label>
      <input
        id="email"
        type="email"
        name="email"
        value={form?.email ?? ""}
        autocomplete="email"
        placeholder="admin@empresa.com"
        required
        disabled={loading}
        aria-invalid={!!form?.error}
      />
    </div>

    <div class="field">
      <label for="password">{m.form_password_label()}</label>
      <input
        id="password"
        type="password"
        name="password"
        bind:value={password}
        autocomplete="new-password"
        placeholder="••••••••••••"
        required
        minlength={12}
        disabled={loading}
        aria-invalid={form?.error === "password_policy"}
        aria-describedby="pw-checklist"
      />
      <div id="pw-checklist">
        <PasswordChecklist {password} />
      </div>
    </div>

    <Button
      type="submit"
      variant="primary"
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? m.common_loading() : m.auth_setup_submit()}
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
  }

  label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  /* ── Inputs (pill shape) ── */
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
