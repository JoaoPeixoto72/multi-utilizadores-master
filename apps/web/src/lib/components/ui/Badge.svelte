<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: string; // e.g. "success", "warning", "error", "info", "owner", "role", "temp", "default"
    class?: string;
    children?: Snippet;
  }

  let { variant = "info", class: className = "", children }: Props = $props();

  const composedClass = $derived(`badge badge-${variant} ${className}`.trim());
</script>

<span class={composedClass}>
  {#if children}{@render children()}{/if}
</span>

<style>
  .badge,
  :global(.badge) {
    display: inline-flex;
    align-items: center;
    padding: var(--pad-badge-y, 2px) var(--pad-badge-x, 9px);
    border-radius: var(--radius-full, 9999px);
    font-size: var(--text-xs, 12px);
    font-weight: var(--weight-medium, 500);
    line-height: 1.4;
    white-space: nowrap;
  }

  :global(.badge-success) {
    background-color: var(--badge-success-bg, #dcfce7);
    color: var(--badge-success-text, #166534);
  }
  :global(.badge-warning) {
    background-color: var(--badge-warning-bg, #fef9c3);
    color: var(--badge-warning-text, #854d0e);
  }
  :global(.badge-error) {
    background-color: var(--badge-error-bg, #fee2e2);
    color: var(--badge-error-text, #991b1b);
  }
  :global(.badge-info) {
    background-color: var(--badge-info-bg, #dbeafe);
    color: var(--badge-info-text, #1e40af);
  }
  :global(.badge-role),
  :global(.badge-owner) {
    background-color: var(--badge-role-bg, #f5f3ff);
    color: var(--badge-role-text, #7c3aed);
  }
  :global(.badge-default) {
    background-color: var(--bg-surface-subtle, #f3f4f6);
    color: var(--text-secondary, #4b5563);
  }
  :global(.badge-temp) {
    background-color: var(--badge-warning-bg, #fef9c3);
    color: var(--badge-warning-text, #854d0e);
    border: 1px dashed var(--badge-warning-text, #854d0e);
  }
  :global(.badge-brand) {
    background-color: var(--badge-brand-bg, #eef2ff);
    color: var(--brand-700, #4338ca);
  }
</style>
