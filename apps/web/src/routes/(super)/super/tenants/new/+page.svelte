<script lang="ts">
  import { applyAction, enhance } from "$app/forms";
  import { goto } from "$app/navigation";
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

  // Storage: UI em MB, API recebe bytes
  // Default: 1024 MB (1 GB)
  let storageMb = $state(1024);
</script>

<div class="page">
  <div class="page-header">
    <a href="/super/tenants" class="back-link">{m.super_tenant_back()}</a>
    <h1 class="page-title">{m.super_tenant_create_title()}</h1>
  </div>

  <!-- Alertas -->
  {#if form?.error === "email_taken"}
    <Alert variant="error">{m.super_tenant_email_taken()}</Alert>
  {:else if form?.error === "owner_email_taken"}
    <Alert variant="error">{m.super_tenant_owner_email_taken()}</Alert>
  {:else if form?.error}
    <Alert variant="error">{m.error_generic_description()}</Alert>
  {/if}

  <div class="card">
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
    >
      <input type="hidden" name="_csrf" value={data.csrfToken ?? ""} />

      <fieldset class="fieldset">
        <legend class="legend">{m.super_tenant_section_data()}</legend>

        <Input
          label="{m.common_name()} *"
          id="name"
          type="text"
          name="name"
          value={form?.name ?? ""}
          required
          maxlength={120}
          disabled={loading}
          placeholder={m.super_tenant_new_name_placeholder()}
        />

        <Input
          label="{m.common_email()} *"
          id="email"
          type="email"
          name="email"
          value={form?.email ?? ""}
          required
          disabled={loading}
          placeholder={m.super_tenant_new_email_placeholder()}
        />

        <Input
          label={m.super_tenant_address()}
          id="address"
          type="text"
          name="address"
          maxlength={255}
          disabled={loading}
        />

        <div class="row">
          <Input
            label={m.common_phone()}
            id="phone"
            type="tel"
            name="phone"
            maxlength={30}
            disabled={loading}
          />
          <Input
            label={m.common_website()}
            id="website"
            type="url"
            name="website"
            disabled={loading}
          />
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="legend">{m.super_tenant_section_limits()}</legend>
        <div class="row">
          <div class="field">
            <label for="admin_seat_limit">{m.super_tenant_admin_seats()}</label>
            <input
              id="admin_seat_limit"
              type="number"
              name="admin_seat_limit"
              value="3"
              min={1}
              max={50}
              disabled={loading}
            />
            <p class="field-hint">{m.super_tenant_admin_seats_hint()}</p>
          </div>
          <div class="field">
            <label for="member_seat_limit"
              >{m.super_tenant_member_seats()}</label
            >
            <input
              id="member_seat_limit"
              type="number"
              name="member_seat_limit"
              value="0"
              min={0}
              max={200}
              disabled={loading}
            />
            <p class="field-hint">{m.super_tenant_member_seats_hint()}</p>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="client_seat_limit">{m.super_tenant_clients()}</label>
            <input
              id="client_seat_limit"
              type="number"
              name="client_seat_limit"
              value="0"
              min={0}
              max={500}
              disabled={loading}
            />
            <p class="field-hint">{m.super_tenant_client_seats_hint()}</p>
          </div>
          <div class="field">
            <label for="daily_email_limit">{m.super_tenant_daily_email()}</label
            >
            <input
              id="daily_email_limit"
              type="number"
              name="daily_email_limit"
              value="100"
              min={1}
              max={10000}
              disabled={loading}
            />
            <p class="field-hint">{m.super_tenant_daily_email_hint()}</p>
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label for="storage_mb">{m.super_tenant_storage()}</label>
            <!-- campo visível em MB; campo hidden converte para bytes -->
            <input
              id="storage_mb"
              type="number"
              min={1}
              max={102400}
              bind:value={storageMb}
              disabled={loading}
            />
            <input
              type="hidden"
              name="storage_limit_bytes"
              value={storageMb * 1024 * 1024}
            />
            <p class="field-hint">{m.super_tenant_storage_hint()}</p>
          </div>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="legend">{m.super_tenant_section_owner()}</legend>
        <div class="field">
          <Input
            label="{m.super_tenant_owner_email()} *"
            id="owner_email"
            type="email"
            name="owner_email"
            value={form?.owner_email ?? ""}
            required
            disabled={loading}
            placeholder={m.super_tenant_new_owner_placeholder()}
          />
          <p class="field-hint">{m.super_tenant_invite_hint()}</p>
        </div>
      </fieldset>

      <div class="actions">
        <Button href="/super/tenants" variant="outline"
          >{m.common_cancel()}</Button
        >
        <Button type="submit" variant="primary" {loading}>
          {loading ? m.common_loading() : m.super_tenant_create_title()}
        </Button>
      </div>
    </form>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--page-content-max-w);
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .back-link {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }

  .card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .fieldset {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .legend {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    padding: 0 var(--space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  .field input {
    height: var(--size-input-h);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-input);
    background-color: var(--bg-input);
    padding: 0 var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-primary);
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: box-shadow var(--duration-fast) var(--ease-out);
  }

  .field input:focus {
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    border-color: var(--brand-600);
  }

  .field input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin: 0;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
</style>
