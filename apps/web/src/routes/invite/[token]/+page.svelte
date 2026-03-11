<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import PasswordChecklist from "$lib/components/auth/PasswordChecklist.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
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
  <!-- Marca -->
  <div class="auth-brand">
    <span class="brand-name">{m.app_name()}</span>
  </div>

  <!-- Header -->
  <div class="auth-header">
    <h1 class="auth-title">{m.invite_title()}</h1>
    <p class="auth-subtitle">{m.invite_subtitle()}</p>
  </div>

  <!-- Alertas -->
  {#if form?.error === "invalid_token"}
    <Alert variant="error">
      {m.invite_invalid()}
    </Alert>
  {:else if form?.error}
    <Alert variant="error" ariaLive="assertive">
      {m.error_generic_description()}
    </Alert>
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

    <!-- Email (só leitura — vem do convite) -->
    <Input
      label={m.common_email()}
      id="email"
      type="email"
      name="email"
      value={data.invite.email}
      autocomplete="email"
      disabled
      readonly
      aria-readonly="true"
    />

    <!-- Nome -->
    <Input
      label={m.common_name()}
      id="display_name"
      type="text"
      name="display_name"
      autocomplete="name"
      placeholder={m.invite_name_placeholder()}
      disabled={loading}
      maxlength={100}
    />

    <!-- Password -->
    <Input
      label={m.form_password_label()}
      id="password"
      type="password"
      name="password"
      value={password}
      oninput={(e) => (password = e.currentTarget.value)}
      autocomplete="new-password"
      placeholder={m.common_password_placeholder()}
      required
      minlength={12}
      disabled={loading}
      aria-invalid={form?.error === "password_policy" ? "true" : undefined}
      aria-describedby="pw-checklist"
    />
    <div id="pw-checklist" style="margin-top: calc(-1 * var(--space-2))">
      <PasswordChecklist {password} />
    </div>

    <Button type="submit" variant="primary" {loading}>
      {loading ? m.common_loading() : m.invite_submit()}
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
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Campos ── */
  :global(form) {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
