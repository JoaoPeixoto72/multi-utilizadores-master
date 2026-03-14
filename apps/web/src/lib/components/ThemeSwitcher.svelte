<script lang="ts">
/**
 * ThemeSwitcher.svelte — Selector de paleta / tema / layout (M11)
 *
 * Exibe um dropdown compacto para trocar:
 *   - Tema (light/dark)
 *   - Paleta de cores (6 opções)
 *   - Layout (3 opções)
 *
 * SVG icons only — zero emojis.
 * Usa themeStore — mudanças são imediatas, persistidas em cookies.
 */

import { Icons } from "$lib/icons.js";
import * as m from "$lib/paraglide/messages.js";
import { themeStore } from "$lib/stores/theme.svelte.js";

interface Props {
  modeOnly?: boolean;
  toggleOnly?: boolean;
}

let { modeOnly = false, toggleOnly = false }: Props = $props();

let open = $state(false);

function toggle() {
  open = !open;
}
function close() {
  open = false;
}

function handleClick(e: MouseEvent) {
  if (e) e.stopPropagation();
  if (toggleOnly) {
    themeStore.setTheme(themeStore.theme === "light" ? "dark" : "light");
  } else {
    toggle();
  }
}

// Fechar ao clicar fora
function handleOutsideClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".theme-switcher")) {
    close();
  }
}

// Fechar com Escape
function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && open) {
    close();
    event.preventDefault();
    event.stopPropagation();
  }
}
</script>

<svelte:window onclick={handleOutsideClick} onkeydown={handleKeydown} />

<div class="theme-switcher">
  <button
    class="switcher-btn"
    onclick={(e) => handleClick(e)}
    aria-label={m.theme_section_theme()}
    aria-expanded={toggleOnly ? undefined : open}
    aria-haspopup={toggleOnly ? undefined : "true"}
    title={m.theme_section_theme()}
  >
    <span class="switcher-icon" aria-hidden="true">
      {#if themeStore.theme === "dark"}
        {@html Icons.moon}
      {:else}
        {@html Icons.sun}
      {/if}
    </span>
  </button>

  {#if open}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="switcher-panel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-label={m.theme_section_theme()}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
      <!-- Tema -->
      <div class="section">
        <span class="section-label">{m.theme_section_theme()}</span>
        <div class="option-row">
          {#each ["light", "dark"] as t}
            <button
              type="button"
              class="option-btn"
              class:selected={themeStore.theme === t}
              onclick={(e) => {
                e.stopPropagation();
                themeStore.setTheme(t as "light" | "dark");
              }}
              aria-pressed={themeStore.theme === t}
            >
              <span class="opt-icon" aria-hidden="true">
                {#if t === "light"}
                  {@html Icons.sun}
                {:else}
                  {@html Icons.moon}
                {/if}
              </span>
              {t === "light" ? m.theme_light() : m.theme_dark()}
            </button>
          {/each}
        </div>
      </div>

      {#if !modeOnly}
        <!-- Paleta -->
        <div class="section">
          <span class="section-label">{m.theme_section_palette()}</span>
          <div class="palette-row">
            {#each ["indigo", "emerald", "rose", "amber", "slate", "ocean"] as p}
              <button
                type="button"
                class="palette-dot palette-bg-{p}"
                class:selected={themeStore.palette === p}
                onclick={(e) => {
                  e.stopPropagation();
                  themeStore.setPalette(p as any);
                }}
                title={themeStore.PALETTE_LABELS[
                  p as keyof typeof themeStore.PALETTE_LABELS
                ]}
                aria-label={themeStore.PALETTE_LABELS[
                  p as keyof typeof themeStore.PALETTE_LABELS
                ]}
                aria-pressed={themeStore.palette === p}
              >
                {#if themeStore.palette === p}
                  <span class="dot-check" aria-hidden="true"
                    >{@html Icons.check}</span
                  >
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Layout -->
        <div class="section">
          <span class="section-label">{m.theme_section_layout()}</span>
          <div class="option-row">
            {#each [{ val: "sidebar", icon: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>` }, { val: "compact", icon: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="11" height="18" rx="1"/></svg>` }, { val: "topnav", icon: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>` }] as lyt}
              <button
                type="button"
                class="option-btn"
                class:selected={themeStore.layout === lyt.val}
                onclick={(e) => {
                  e.stopPropagation();
                  themeStore.setLayout(lyt.val as any);
                }}
                aria-pressed={themeStore.layout === lyt.val}
                title={themeStore.LAYOUT_LABELS[
                  lyt.val as keyof typeof themeStore.LAYOUT_LABELS
                ]}
              >
                <span class="opt-icon">{@html lyt.icon}</span>
                {themeStore.LAYOUT_LABELS[
                  lyt.val as keyof typeof themeStore.LAYOUT_LABELS
                ]}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .theme-switcher {
    position: relative;
    display: inline-flex;
  }

  .switcher-btn {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-btn);
    height: var(--size-icon-btn);
    border-radius: var(--radius-md);
    border: none;
    background: none;
    cursor: pointer !important;
    color: var(--text-secondary);
    transition: all var(--duration-fast);
    pointer-events: auto !important;
  }

  .switcher-btn:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .switcher-icon {
    display: flex;
    align-items: center;
    line-height: 1;
    pointer-events: none;
  }

  .switcher-icon :global(svg) {
    width: var(--size-icon-ui);
    height: var(--size-icon-ui);
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Painel ── */
  .switcher-panel {
    position: absolute;
    right: 0;
    top: calc(100% + var(--space-2));
    background-color: var(--bg-surface);
    border: var(--border-w-1) solid var(--border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-popover);
    padding: var(--space-4);
    min-width: 240px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    pointer-events: auto !important;
  }

  /* ── Secção ── */
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-label {
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  /* ── Opções de texto ── */
  .option-row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .option-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    background-color: var(--bg-surface-subtle);
    border: var(--border-w-1) solid var(--border-base);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      border-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .option-btn:hover {
    background-color: var(--brand-50);
    border-color: var(--brand-200);
    color: var(--brand-700);
  }

  .option-btn.selected {
    background-color: var(--nav-active-bg);
    border-color: var(--brand-500);
    color: var(--nav-active-text);
    font-weight: var(--weight-semibold);
  }

  .opt-icon {
    display: flex;
    align-items: center;
  }

  .opt-icon :global(svg) {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Paleta de pontos ── */
  .palette-row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .palette-dot {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    border: var(--border-w-1) solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition:
      transform var(--duration-fast) var(--ease-default),
      box-shadow var(--duration-fast) var(--ease-default);
  }

  .palette-dot:hover {
    transform: scale(1.15);
  }

  .palette-dot.selected {
    box-shadow: var(--shadow-focus);
    transform: scale(1.1);
  }

  .dot-check {
    display: flex;
  }
  .dot-check :global(svg) {
    width: 12px;
    height: 12px;
    stroke: #fff;
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .palette-bg-indigo {
    background-color: var(--indigo-500, #6366f1);
  }
  .palette-bg-emerald {
    background-color: var(--emerald-500, #10b981);
  }
  .palette-bg-rose {
    background-color: var(--rose-500, #f43f5e);
  }
  .palette-bg-amber {
    background-color: var(--amber-500, #f59e0b);
  }
  .palette-bg-slate {
    background-color: var(--slate-500, #64748b);
  }
  .palette-bg-ocean {
    background-color: var(--ocean-500, #0ea5e9);
  }
</style>
