<script lang="ts">
  /**
   * CompactSidebar.svelte — Sidebar icon-only 60 px
   *
   * Mesma arquitectura de popup do Sidebar.svelte:
   *  - Popup renderizado fora do <aside> com position:fixed + coordenadas JS
   *  - Overlay invisível para fechar ao clicar fora
   *  - Sidebar sem overflow no root — scroll apenas na nav
   */
  import { page } from "$app/stores";
  import * as m from "$lib/paraglide/messages.js";
  import UserMenu from "./UserMenu.svelte";
  import { Icons } from "$lib/icons.js";
  import type { NavItem } from "./Sidebar.svelte";

  interface Props {
    navItems: NavItem[];
    brandLabel: string;
    userEmail?: string;
    userName?: string | null;
    footerItems?: NavItem[];
    showTheme?: boolean;
    showPalette?: boolean;
  }

  let {
    navItems,
    brandLabel,
    userEmail = "",
    userName = "",
    footerItems = [],
    showTheme = true,
    showPalette = true,
  }: Props = $props();

  function isActive(href: string): boolean {
    return (
      $page.url.pathname === href || $page.url.pathname.startsWith(href + "/")
    );
  }

  const brandInitial = $derived(brandLabel.charAt(0).toUpperCase());
</script>

<aside class="compact-sidebar" aria-label={m.nav_aria_compact()}>
  <!-- Brand icon -->
  <div class="compact-brand" title={brandLabel}>
    <span class="brand-initial">{brandInitial}</span>
  </div>

  <!-- Nav (scrollable) -->
  <nav class="compact-nav">
    {#each navItems as item}
      <a
        href={item.href}
        class="compact-item"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? "page" : undefined}
        title={item.label}
        aria-label={item.label}
      >
        <span class="compact-icon" aria-hidden="true">{@html item.icon}</span>
        {#if item.badge}
          <span
            class="compact-badge"
            aria-label="{item.badge} {m.nav_notifications()}">{item.badge}</span
          >
        {/if}
        <span class="compact-tooltip" role="tooltip">{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- Footer (fixed, no scroll) -->
  <div class="compact-footer">
    {#each footerItems as item}
      <a
        href={item.href}
        class="compact-item"
        class:active={isActive(item.href)}
        title={item.label}
        aria-label={item.label}
      >
        <span class="compact-icon" aria-hidden="true">{@html item.icon}</span>
        <span class="compact-tooltip" role="tooltip">{item.label}</span>
      </a>
    {/each}

    <!-- User avatar button -->
    <UserMenu
      {userEmail}
      {userName}
      variant="avatar-only"
      popupPosition="right"
      {showTheme}
      {showPalette}
    />
  </div>
</aside>

<style>
  /* ── Compact sidebar shell ── */
  .compact-sidebar {
    width: var(--size-sidebar-compact-w);
    background-color: var(--bg-surface);
    border-right: var(--border-w-1) solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 100;
    /* NO overflow here — popup lives outside */
  }

  .compact-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: var(--size-logo-zone-h);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    flex-shrink: 0;
  }

  .brand-initial {
    width: var(--size-icon-btn);
    height: var(--size-icon-btn);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background-color: var(--brand-100);
    color: var(--brand-700);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  /* ── Nav (scrollable) ── */
  .compact-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
    padding: var(--space-4) var(--space-2);
    width: 100%;
    overflow-y: auto;
  }

  /* ── Footer (fixed, no scroll) ── */
  .compact-footer {
    border-top: var(--border-w-1) solid var(--border-subtle);
    padding: var(--space-3) var(--space-2);
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .compact-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-icon-btn);
    height: var(--size-icon-btn);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    text-decoration: none;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
    border: none;
    background: none;
    cursor: pointer;
  }

  .compact-item:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .compact-item.active {
    background-color: var(--nav-active-bg);
    color: var(--nav-active-text);
  }

  .compact-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .compact-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    display: block;
  }

  .compact-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: var(--text-2xs);
    font-weight: var(--weight-bold);
    color: var(--badge-alert-text);
    background-color: var(--badge-alert-bg);
    width: 14px;
    height: 14px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Tooltip ── */
  .compact-tooltip {
    position: absolute;
    left: calc(100% + var(--space-3));
    top: 50%;
    transform: translateY(-50%);
    background-color: var(--text-primary);
    color: var(--text-inverse);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-fast) var(--ease-default);
    z-index: var(--z-tooltip);
  }

  .compact-item:hover .compact-tooltip,
  .compact-item:focus .compact-tooltip {
    opacity: 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     Popup + overlay share styles with Sidebar.svelte via :global
     The um-* classes are defined in Sidebar.svelte's :global block.
     No need to duplicate them here.
     ══════════════════════════════════════════════════════════════════ */
</style>
