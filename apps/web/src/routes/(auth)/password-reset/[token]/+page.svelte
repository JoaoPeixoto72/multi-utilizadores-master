<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import PasswordChecklist from "$lib/components/auth/PasswordChecklist.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let loading = $state(false);
  let password = $state("");
</script>

<div class="auth-card">
  <h1 class="auth-title">{m.auth_reset_new_title()}</h1>

  {#if form?.error === "invalid_token"}
    <div class="alert alert-error" role="alert" aria-live="assertive">
      {m.auth_reset_invalid_token()}
    </div>
    <div class="auth-links">
      <a href="/password-reset">{m.auth_reset_title()}</a>
    </div>
  {:else if form?.error}
    <div class="alert alert-error" role="alert" aria-live="assertive">
      {m.error_generic_description()}
    </div>
  {:else}
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
        <label for="password">{m.form_new_password_label()}</label>
        <input
          id="password"
          type="password"
          name="password"
          bind:value={password}
          autocomplete="new-password"
          required
          minlength={12}
          disabled={loading}
          aria-invalid={form?.error === "password_policy" ? "true" : undefined}
          aria-describedby="pw-checklist"
        />
        <div id="pw-checklist">
          <PasswordChecklist {password} />
        </div>
      </div>

      <button type="submit" class="btn-primary" disabled={loading} aria-busy={loading}>
        {loading ? m.common_loading() : m.auth_reset_new_submit()}
      </button>
    </form>
  {/if}
</div>

<style>
  .auth-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .auth-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .alert {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
  }

  .alert-error {
    background-color: var(--status-error-bg);
    color: var(--status-error-text);
    border: 1px solid var(--status-error-border);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

  input {
    height: var(--size-input-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    background-color: var(--bg-surface);
    transition: border-color var(--duration-fast) var(--ease-default);
    width: 100%;
    box-sizing: border-box;
  }

  input:hover {
    border-color: var(--border-input-hover);
  }

  input:focus {
    outline: none;
    box-shadow: var(--focus-ring);
    border-color: var(--brand-500);
  }

  input[aria-invalid="true"] {
    border-color: var(--status-error-border);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    height: var(--size-btn-h-md);
    padding: 0 var(--space-5);
    background-color: var(--brand-600);
    color: var(--color-white);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-default);
    width: 100%;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--brand-700);
  }

  .btn-primary:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-links {
    text-align: center;
    font-size: var(--text-sm);
  }

  .auth-links a {
    color: var(--brand-600);
    text-decoration: none;
  }

  .auth-links a:hover {
    text-decoration: underline;
  }
</style>
