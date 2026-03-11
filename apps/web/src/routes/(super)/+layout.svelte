<script lang="ts">
  /**
   * (super)/+layout.svelte — Layout Super Utilizador
   *
   * User menu + ThemeSwitcher movidos para o rodapé da Sidebar.
   * Header simplificado (apenas título).
   */
  import { onMount } from "svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { page } from "$app/stores";

  import Sidebar from "$lib/components/Sidebar.svelte";
  import CompactSidebar from "$lib/components/CompactSidebar.svelte";
  import Header from "$lib/components/Header.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import { themeStore } from "$lib/stores/theme.svelte.js";
  import { Icons } from "$lib/icons.js";
  import Button from "$lib/components/ui/Button.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";

  interface Props {
    children: import("svelte").Snippet;
    data: import("./$types").LayoutData;
  }
  let { children, data }: Props = $props();

  const navItems = [
    {
      href: "/super/dashboard",
      label: m.super_nav_dashboard(),
      icon: Icons.layoutDashboard,
    },
    {
      href: "/super/tenants",
      label: m.super_nav_tenants(),
      icon: Icons.building2,
    },
    {
      href: "/super/integrations",
      label: m.super_integrations_title(),
      icon: Icons.zap,
    },
    { href: "/super/backups", label: m.nav_backups(), icon: Icons.hardDrive },
    { href: "/super/audit", label: m.super_audit_title(), icon: Icons.search },
    {
      href: "/super/settings",
      label: m.super_nav_settings(),
      icon: Icons.settings,
    },
  ];

  const userEmail = $derived(
    (data as Record<string, unknown>).user
      ? (((data as Record<string, unknown>).user as { email?: string }).email ??
          "")
      : "",
  );

  const userName = $derived(
    (data as Record<string, unknown>).user
      ? (((data as Record<string, unknown>).user as { display_name?: string })
          .display_name ?? "")
      : "",
  );

  onMount(() => {
    themeStore.init();
  });

  const currentLayout = $derived(themeStore.layout);
  let drawerOpen = $state(false);
</script>

<!-- Mobile overlay -->
{#if drawerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="drawer-overlay"
    onclick={() => {
      drawerOpen = false;
    }}
    role="button"
    tabindex="-1"
    aria-label={m.common_close_menu()}
  ></div>
{/if}

<!-- Mobile drawer -->
{#if drawerOpen}
  <div class="mobile-drawer">
    <Sidebar
      {navItems}
      brandLabel={m.app_name()}
      brandBadge={m.super_brand_badge()}
      {userEmail}
    />
  </div>
{/if}

<div class="shell">
  <!-- Apenas UMA sidebar visível consoante o layout -->
  {#if currentLayout === "compact"}
    <CompactSidebar
      {navItems}
      brandLabel={m.app_name()}
      {userEmail}
      {userName}
      showPalette={false}
      showTheme={false}
    />
  {:else if currentLayout !== "topnav"}
    <Sidebar
      {navItems}
      brandLabel={m.app_name()}
      brandBadge={m.super_brand_badge()}
      {userEmail}
      {userName}
      showPalette={false}
      showTheme={false}
    />
  {/if}

  <!-- Área principal -->
  <div class="main-wrap">
    <!-- TopNav (layout=topnav) -->
    {#if currentLayout === "topnav"}
      <nav class="topnav" aria-label={m.common_top_nav()}>
        <div class="topnav-brand">
          <span class="brand-text">{m.app_name()}</span>
          <Badge variant="default" class="brand-badge"
            >{m.super_brand_badge()}</Badge
          >
        </div>
        <div class="topnav-items">
          {#each navItems as item}
            <a
              href={item.href}
              class="topnav-item"
              class:active={$page.url.pathname.startsWith(item.href)}
            >
              <span class="topnav-icon" aria-hidden="true"
                >{@html item.icon}</span
              >
              <span>{item.label}</span>
            </a>
          {/each}
        </div>
        <!-- ThemeSwitcher no topnav (só neste layout) -->
        <div class="topnav-right">
          <ThemeSwitcher toggleOnly={true} />
          <NotificationBell
            count={(data as any).unreadCount ?? 0}
            csrfToken={data.csrfToken ?? ""}
          />
          <UserMenu
            {userEmail}
            {userName}
            variant="avatar-only"
            popupPosition="bottom-right"
            showPalette={false}
            showTheme={false}
          />
        </div>
      </nav>
    {/if}

    <!-- Header com NotificationBell -->
    {#if currentLayout !== "topnav"}
      <div class="header-wrap-row">
        <Button
          variant="ghost"
          size="sm"
          class="mobile-menu-btn"
          onclick={() => {
            drawerOpen = !drawerOpen;
          }}
          aria-label={m.common_open_menu()}
          aria-expanded={drawerOpen}>☰</Button
        >
        <Header
          title={m.super_dashboard_title()}
          unreadCount={(data as any).unreadCount ?? 0}
          csrfToken={data.csrfToken ?? ""}
        />
      </div>
    {/if}

    <!-- Conteúdo -->
    <main class="content" id="main-content">
      {@render children()}
    </main>
  </div>
</div>

<style>
  .shell {
    display: flex;
    min-height: 100vh;
    background-color: var(--bg-page);
    position: relative;
  }

  .main-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }

  /* ── TopNav ── */
  .topnav {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--size-header-h);
    background-color: var(--bg-surface);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    padding: 0 var(--pad-header-x);
    flex-shrink: 0;
  }

  .topnav-brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .brand-text {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }

  .topnav-items {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
  }

  .topnav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    text-decoration: none;
    transition:
      background-color var(--duration-fast) var(--ease-default),
      color var(--duration-fast) var(--ease-default);
  }

  .topnav-item:hover {
    background-color: var(--bg-surface-subtle);
    color: var(--text-primary);
  }

  .topnav-item.active {
    background-color: var(--nav-active-bg);
    color: var(--nav-active-text);
    font-weight: var(--weight-semibold);
  }

  .topnav-icon {
    display: flex;
    align-items: center;
  }

  .topnav-icon :global(svg) {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
  }

  .topnav-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  :global(.drawer-overlay) {
    position: fixed;
    inset: 0;
    background-color: var(--bg-overlay);
    z-index: calc(var(--z-modal) - 10);
  }

  :global(.mobile-drawer) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: var(--z-modal);
    box-shadow: var(--shadow-modal);
  }

  .content {
    flex: 1;
    padding: var(--pad-page-main);
    overflow-y: auto;
  }

  /* ── Header row (Header + hamburger) ── */
  .header-wrap-row {
    display: flex;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    background-color: var(--bg-surface);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
  }

  .header-wrap-row :global(.header) {
    flex: 1;
    border-bottom: none;
  }

  /* ── Mobile hamburger ── */
  :global(.mobile-menu-btn) {
    display: none !important;
  }

  @media (max-width: 1024px) {
    :global(.mobile-menu-btn) {
      display: inline-flex !important;
      margin-left: var(--space-4);
      flex-shrink: 0;
    }
  }
</style>
