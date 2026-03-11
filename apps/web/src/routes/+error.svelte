<script lang="ts">
  import { page } from "$app/state";
  import * as m from "$lib/paraglide/messages.js";
</script>

<div class="error-page">
  <p class="error-code" aria-label={m.error_code_label()}>{page.status}</p>
  <h1 class="error-title">{page.error?.message ?? m.error_generic_title()}</h1>
  <p class="error-description">{m.error_generic_description()}</p>
  <a href="/" class="btn-primary">
    {m.error_go_home()}
  </a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--space-8);
    background-color: var(--bg-page);
    text-align: center;
  }

  .error-code {
    font-size: var(--size-error-code);
    font-weight: var(--weight-bold);
    color: var(--text-muted);
    line-height: var(--leading-tight);
    margin-bottom: var(--space-4);
  }

  .error-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .error-description {
    font-size: var(--text-base);
    color: var(--text-muted);
    max-width: var(--size-error-maxw);
    line-height: var(--leading-normal);
    margin-bottom: var(--space-7);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    height: var(--size-control-h);
    padding: 0 var(--pad-btn-primary-x);
    background-color: var(--brand-600);
    color: var(--text-inverse);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    text-decoration: none;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  .btn-primary:hover {
    background-color: var(--brand-700);
  }

  .btn-primary:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }
</style>
