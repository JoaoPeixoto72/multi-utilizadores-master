<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "success" | "error" | "warning" | "info";
    class?: string;
    title?: string;
    children?: Snippet;
    role?: "alert" | "status" | "none";
    ariaLive?: "polite" | "assertive" | "off";
  }

  let {
    variant = "info",
    class: className = "",
    title,
    children,
    role,
    ariaLive,
  }: Props = $props();

  const composedClass = $derived(`alert alert-${variant} ${className}`.trim());

  // Smart defaults for a11y based on variant
  const defaultRole = $derived(
    role ?? (["error", "warning"].includes(variant) ? "alert" : "status"),
  );
  const defaultAriaLive = $derived(
    ariaLive ??
      (["error", "warning"].includes(variant) ? "assertive" : "polite"),
  );
</script>

<div class={composedClass} role={defaultRole} aria-live={defaultAriaLive}>
  {#if title}
    <strong>{title}</strong>
  {/if}
  {#if children}{@render children()}{/if}
</div>

<style>
  .alert,
  :global(.alert) {
    padding: var(--space-4, 12px) var(--space-5, 16px);
    border-radius: var(--radius-md, 8px);
    font-size: var(--text-sm, 13px);
    line-height: var(--leading-normal, 1.5);
    border: 1px solid transparent;
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
  }

  .alert strong {
    font-weight: var(--weight-semibold, 600);
  }

  :global(.alert-error) {
    background-color: var(--status-error-bg, #fef2f2);
    color: var(--status-error-text, #dc2626);
    border-color: var(--status-error-border, #fecaca);
  }

  :global(.alert-success) {
    background-color: var(--status-success-bg, #f0fdf4);
    color: var(--status-success-text, #16a34a);
    border-color: var(--status-success-border, #bbf7d0);
  }

  :global(.alert-warning) {
    background-color: var(--badge-warning-bg, #fef9c3);
    color: var(--badge-warning-text, #854d0e);
    border-color: #fde68a;
  }

  :global(.alert-info) {
    background-color: var(--status-info-bg, #eff6ff);
    color: var(--status-info-text, #2563eb);
    border-color: var(--status-info-border, #bfdbfe);
  }
</style>
