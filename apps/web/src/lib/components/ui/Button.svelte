<script lang="ts">
  import type { Snippet } from "svelte";
  import type {
    HTMLButtonAttributes,
    HTMLAnchorAttributes,
  } from "svelte/elements";

  type ButtonOrAnchorProps = HTMLButtonAttributes & HTMLAnchorAttributes;
  interface Props extends ButtonOrAnchorProps {
    variant?:
      | "primary"
      | "secondary"
      | "success"
      | "warning"
      | "danger"
      | "outline"
      | "danger-outline"
      | "action"
      | "ghost";
    size?: "default" | "md" | "sm" | "xs" | "icon";
    href?: string;
    loading?: boolean;
    children?: Snippet;
    target?: string;
    download?: string | boolean;
  }

  let {
    type = "button", // Added default type
    variant = "primary",
    size = "sm", // Changed from "md" to "sm" for discrete design
    disabled = false, // Added disabled prop with default
    loading = false,
    class: className = "", // Restore class remap
    href,
    children,
    ...rest
  }: Props = $props();

  const baseClass = "btn";
  const variantClass = $derived(
    variant !== "primary" && variant !== "ghost"
      ? `btn-${variant}`
      : variant === "primary"
        ? "btn-primary"
        : "",
  );
  const sizeClass = $derived(
    size === "md"
      ? "btn-md"
      : size === "xs"
        ? "btn-xs"
        : size === "sm"
          ? "btn-sm"
          : "",
  );

  // Helper to compose classes safely
  const composedClass = $derived(
    [baseClass, variantClass, sizeClass, className].filter(Boolean).join(" "),
  );
</script>

{#if href}
  <a {href} class={composedClass} {...rest as any}>
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    class={composedClass}
    disabled={loading || disabled}
    aria-busy={loading}
    {...rest}
  >
    {#if children}{@render children()}{/if}
  </button>
{/if}

<style>
  /* ── Base ── */
  .btn,
  :global(.btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-btn-icon-gap, 6px);
    padding: var(--pad-btn-y, 8px) var(--pad-btn-x, 19px);
    height: var(--size-btn-h-md, 44px);
    font-size: var(--text-sm, 13px);
    font-weight: var(--weight-medium, 500);
    line-height: 1;
    border-radius: var(--radius-btn, var(--radius-full, 9999px));
    border: 1px solid transparent;
    cursor: pointer;
    transition:
      background-color var(--duration-fast, 100ms) var(--ease-default, ease),
      border-color var(--duration-fast, 100ms) var(--ease-default, ease),
      color var(--duration-fast, 100ms) var(--ease-default, ease);
    text-decoration: none;
    white-space: nowrap;
    user-select: none;
  }

  .btn:disabled,
  :global(.btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ── Primary (outline / discreet) ── */
  .btn-primary,
  :global(.btn-primary) {
    background-color: transparent;
    color: var(--text-primary, #111827);
    border-color: var(--border-input, #e5e7eb);
  }
  .btn-primary:hover,
  :global(.btn-primary:hover) {
    background-color: var(--bg-surface-hover, #fafafa);
    border-color: var(--border-input-hover, #d1d5db);
  }

  /* ── Secondary ── */
  .btn-secondary,
  :global(.btn-secondary) {
    background-color: var(--bg-surface, #fff);
    color: var(--text-primary, #111827);
    border-color: var(--border-input, #e5e7eb);
  }
  .btn-secondary:hover,
  :global(.btn-secondary:hover) {
    background-color: var(--bg-surface-hover, #fafafa);
    border-color: var(--border-input-hover, #d1d5db);
  }

  /* ── Danger (transparent red bg on hover) ── */
  .btn-danger,
  :global(.btn-danger) {
    background-color: transparent;
    color: var(--status-inactive-text, #ef4444);
    border-color: transparent;
  }
  .btn-danger:hover,
  :global(.btn-danger:hover) {
    background-color: var(--badge-error-bg, #fef2f2);
    color: var(--status-inactive-text, #ef4444);
  }

  /* ── Outline ── */
  .btn-outline,
  :global(.btn-outline) {
    background-color: transparent;
    color: var(--text-primary, #111827);
    border-color: var(--border-input, #e5e7eb);
  }
  .btn-outline:hover,
  :global(.btn-outline:hover) {
    background-color: var(--bg-surface-hover, #fafafa);
    border-color: var(--border-input-hover, #d1d5db);
  }

  /* ── Danger Outline ── */
  .btn-danger-outline,
  :global(.btn-danger-outline) {
    background-color: transparent;
    color: var(--status-inactive-text, #ef4444);
    border-color: var(--badge-error-border, #fca5a5);
  }
  .btn-danger-outline:hover,
  :global(.btn-danger-outline:hover) {
    background-color: var(--badge-error-bg, #fef2f2);
  }

  /* ── Action (filtrar, nova empresa) ── */
  .btn-action,
  :global(.btn-action) {
    background-color: var(--btn-action-bg, transparent);
    color: var(--btn-action-text, var(--text-primary));
    border-color: var(--btn-action-border, rgba(17, 24, 39, 0.55));
  }
  .btn-action:hover,
  :global(.btn-action:hover) {
    background-color: var(--btn-action-bg-hover, rgba(17, 24, 39, 0.08));
    border-color: var(--btn-action-border-hover, rgba(17, 24, 39, 0.75));
  }

  /* ── Success ── */
  .btn-success,
  :global(.btn-success) {
    background-color: transparent;
    color: var(--status-success-text, #16a34a);
    border-color: transparent;
  }
  .btn-success:hover,
  :global(.btn-success:hover) {
    background-color: var(--status-success-bg, #f0fdf4);
  }

  /* ── Warning (transparent orange bg on hover) ── */
  .btn-warning,
  :global(.btn-warning) {
    background-color: transparent;
    color: var(--badge-warning-text, #b45309);
    border-color: transparent;
  }
  .btn-warning:hover,
  :global(.btn-warning:hover) {
    background-color: var(--badge-warning-bg, #fef3c7);
  }

  /* ── Ghost ── */
  .btn-ghost,
  :global(.btn-ghost) {
    background-color: transparent;
    color: var(--text-secondary, #4b5563);
    border-color: transparent;
    padding: var(--space-1, 4px) var(--space-2, 8px);
    height: auto;
  }
  .btn-ghost:hover,
  :global(.btn-ghost:hover) {
    background-color: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  /* ── Sizes ── */
  .btn-sm,
  :global(.btn-sm) {
    height: var(--size-btn-h-sm, 32px);
    padding: var(--space-1, 4px) var(--space-4, 12px);
    font-size: var(--text-xs, 12px);
  }
  .btn-md,
  :global(.btn-md) {
    height: var(--size-btn-h-md, 44px);
    padding: var(--pad-btn-y, 8px) var(--pad-btn-x, 19px);
    font-size: var(--text-sm, 13px);
  }

  .btn-xs,
  :global(.btn-xs) {
    height: 24px;
    padding: 2px var(--space-2, 8px);
    font-size: var(--text-2xs, 10px);
    border-radius: var(--radius-sm, 6px);
  }

  /* ── Icon-only ── */
  a.btn,
  :global(a.btn) {
    text-decoration: none;
  }
</style>
