<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
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
</script>

```html
<div class="auth-card">
  <div class="auth-header">
    <h1 class="auth-title">{m.auth_reset_title()}</h1>
    <p class="auth-subtitle">{m.auth_reset_description()}</p>
  </div>

  <!-- Alertas de sucesso e erro -->
  {#if form?.sent}
    <Alert variant="success">{m.auth_reset_sent()}</Alert>
  {/if}

  {#if form?.error === "rate_limited"}
    <Alert variant="error">{m.auth_login_rate_limited()}</Alert>
  {:else if form?.error}
    <Alert variant="error">{m.error_generic_description()}</Alert>
  {/if}

  {#if !form?.sent}
    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          loading = false;
          await update();
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
          autocomplete="email"
          placeholder="o.teu@email.com"
          required
          disabled={loading}
        />
      </div>

      <div class="actions">
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? m.common_loading() : m.auth_reset_submit()}
        </Button>
        <div class="back-link">
          <a href="/login">{m.auth_login_submit()}</a>
        </div>
      </div>
    </form>
  {/if}
</div>

<style>
  .auth-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-xl);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
    box-shadow: var(--shadow-modal);
  }

  .auth-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .auth-title {
    font-size: var(--text-metric);
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

  input[type="email"] {
    height: var(--size-input-h);
    padding: 0 var(--space-5);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-primary);
    background-color: var(--bg-surface-subtle);
    transition:
      border-color var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default);
    width: 100%;
    box-sizing: border-box;
  }

  input[type="email"]::placeholder {
    color: var(--text-muted);
  }

  input[type="email"]:hover {
    border-color: var(--border-input-hover);
    background-color: var(--bg-surface);
  }

  input[type="email"]:focus {
    outline: none;
    box-shadow: var(--focus-ring);
    border-color: var(--brand-500);
    background-color: var(--bg-surface);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .back-link {
    text-align: center;
    font-size: var(--text-sm);
  }

  .back-link a {
    color: var(--brand-600);
    text-decoration: none;
    font-weight: var(--weight-medium);
  }
</style>
