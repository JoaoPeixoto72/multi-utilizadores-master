<script lang="ts">
  /**
   * Sidebar.svelte — Sidebar 224 px com user-menu popup no rodapé
   *
   * Arquitectura do popup:
   *  - O popup é renderizado com position:fixed + coordenadas JS (getBoundingClientRect)
   *  - Um overlay invisível (position:fixed inset:0) captura cliques fora
   *  - O sidebar usa overflow apenas na zona de nav, não no componente raiz
   *  - Escape fecha o popup
   */
  import { page } from "$app/stores";
  import UserMenu from "./UserMenu.svelte";
  import { themeStore } from "$lib/stores/theme.svelte.js";
  import { Icons } from "$lib/icons.js";
  import * as m from "$lib/paraglide/messages.js";

  export interface NavItem {
    href: string;
    label: string;
    icon: string;
    badge?: string;
  }

  interface Props {
    navItems: NavItem[];
    brandLabel: string;
    brandBadge?: string;
    footerItems?: NavItem[];
    userEmail?: string;
    userName?: string | null;
    showTheme?: boolean;
    showPalette?: boolean;
  }

  let {
    navItems,
    brandLabel,
    brandBadge,
    footerItems = [],
    userEmail = "",
    userName = "",
    showTheme = true,
    showPalette = true,
  }: Props = $props();

  function isActive(href: string): boolean {
    return (
      $page.url.pathname === href || $page.url.pathname.startsWith(href + "/")
    );
  }
</script>

<aside class="sidebar" aria-label={m.nav_aria_sidebar()}>
  <!-- Brand -->
  <div class="sidebar-brand">
    <span class="brand-text">{brandLabel}</span>
    {#if brandBadge}
      <span class="brand-badge">{brandBadge}</span>
    {/if}
  </div>

  <!-- Nav (scrollable) -->
  <nav class="sidebar-nav">
    {#each navItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? "page" : undefined}
      >
        <span class="nav-icon" aria-hidden="true">{@html item.icon}</span>
        <span class="nav-label">{item.label}</span>
        {#if item.badge}
          <span class="nav-badge">{item.badge}</span>
        {/if}
      </a>
    {/each}

    {#each footerItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? "page" : undefined}
      >
        <span class="nav-icon" aria-hidden="true">{@html item.icon}</span>
        <span class="nav-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- Footer — user button (never scrolls) -->
  <div class="sidebar-footer">
    <UserMenu
      {userEmail}
      {userName}
      variant="full"
      popupPosition="right"
      {showTheme}
      {showPalette}
    />
  </div>
</aside>

<style>
  /* ── Sidebar shell ── */
  .sidebar {
    width: var(--size-sidebar-w);
    background-color: var(--bg-surface);
    border-right: var(--border-w-1) solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 100;
    /* NO overflow here — popup lives outside */
  }

  /* ── Brand ── */
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-5);
    height: var(--size-logo-zone-h);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    flex-shrink: 0;
  }

  .brand-text {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .brand-badge {
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    color: var(--brand-600);
    background-color: var(--brand-100);
    padding: var(--pad-badge-y) var(--pad-badge-x);
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
  }

  /* ── Nav (scrollable zone) ── */
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--nav-item-gap);
    padding: var(--nav-item-padding-y) var(--nav-item-padding-x);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    text-decoration: none;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .nav-item:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .nav-item.active {
    background-color: var(--nav-active-bg);
    color: var(--nav-active-text);
    font-weight: var(--weight-semibold);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--nav-icon-size);
    flex-shrink: 0;
  }

  .nav-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    display: block;
  }

  .nav-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-badge {
    font-size: var(--text-2xs);
    font-weight: var(--weight-bold);
    color: var(--badge-alert-text);
    background-color: var(--badge-alert-bg);
    padding: var(--pad-badge-count-y) var(--pad-badge-count-x);
    border-radius: var(--radius-full);
    min-width: 18px;
    text-align: center;
  }

  /* ── Footer (fixed, no scroll) ── */
  .sidebar-footer {
    border-top: var(--border-w-1) solid var(--border-subtle);
    padding: var(--space-3);
    flex-shrink: 0;
  }
</style>
