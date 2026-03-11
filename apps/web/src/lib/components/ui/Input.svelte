<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";

    interface Props extends HTMLInputAttributes {
        label?: string;
        error?: string;
        id?: string;
    }

    let {
        label,
        error,
        value = $bindable(""),
        id = "input-" + Math.random().toString(36).slice(2, 9),
        class: className = "",
        ...rest
    }: Props = $props();
</script>

<div class="field {className}">
    {#if label}
        <label for={id}>{label}</label>
    {/if}
    <input
        {id}
        bind:value
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
    />
    {#if error}
        <div id="{id}-error" class="error-msg" role="alert">{error}</div>
    {/if}
</div>

<style>
    .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1, 4px);
    }

    .field label {
        font-size: var(--text-sm, 13px);
        font-weight: var(--weight-medium, 500);
        color: var(--text-primary, #111827);
    }

    .field input {
        width: 100%;
        height: var(--size-input-h, 44px);
        padding: 0 var(--space-4, 12px);
        font-size: var(--text-sm, 13px);
        color: var(--text-primary, #111827);
        background-color: var(--bg-input, #f3f4f6);
        border: 1px solid var(--border-input, #e5e7eb);
        border-radius: var(--radius-md, 8px);
        transition:
            border-color var(--duration-fast, 100ms) var(--ease-default, ease),
            box-shadow var(--duration-fast, 100ms) var(--ease-default, ease);
        outline: none;
    }

    .field input::placeholder {
        color: var(--text-muted, #9ca3af);
    }

    .field input:focus {
        border-color: var(--brand-500, #6366f1);
        box-shadow: var(--focus-ring, 0 0 0 3px rgba(99, 102, 241, 0.15));
    }

    .field input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .field input[aria-invalid="true"] {
        border-color: var(--color-danger, #dc2626);
    }

    .error-msg {
        font-size: var(--text-xs, 12px);
        color: var(--color-danger, #dc2626);
    }
</style>
