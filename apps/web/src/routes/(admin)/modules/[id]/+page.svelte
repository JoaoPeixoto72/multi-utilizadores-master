<script lang="ts">
/**
 * (admin)/modules/[id]/+page.svelte — Módulo placeholder (M4)
 *
 * R: BUILD_PLAN.md §M4.2
 * R: design-guidelines.md §5 — tokens only
 *
 * Placeholder: módulos reais implementados em M10.
 */
import * as m from "$lib/paraglide/messages.js";
import { Icons } from "$lib/icons";
import type { PageData } from "./$types";

interface Props { data: PageData; }
let { data }: Props = $props();
</script>

<div class="page">
  <div class="page-header">
    <a href="/dashboard" class="back-link">
      <span aria-hidden="true">←</span>
      {m.common_previous()}
    </a>
    <h1 class="page-title">{data.moduleId}</h1>
  </div>

  <div class="placeholder">
    <span class="placeholder-icon">{@html Icons.zap}</span>
    <h2 class="placeholder-title">{m.module_placeholder_title()}</h2>
    <p class="placeholder-text">{m.module_placeholder_body()}</p>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease-out);
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
    text-transform: capitalize;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-16) var(--space-8);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .placeholder-icon {
    display: inline-flex;
    color: var(--text-muted);
    opacity: 0.4;
  }

  .placeholder-icon :global(svg) {
    width: 48px;
    height: 48px;
  }

  .placeholder-title {
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .placeholder-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    max-width: 400px;
    margin: 0;
  }
</style>
