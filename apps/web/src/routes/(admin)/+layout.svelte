<script lang="ts">
  /**
   * (admin)/+layout.svelte — Layout de administração
   *
   * Fix: Sidebar e CompactSidebar só renderizadas quando o layout corresponde.
   * Ícones SVG monocromáticos via Icons.
   */
  import { onMount } from "svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { page } from "$app/stores";
  import type { LayoutData } from "./$types";

  import Sidebar from "$lib/components/Sidebar.svelte";
  import CompactSidebar from "$lib/components/CompactSidebar.svelte";
  import Header from "$lib/components/Header.svelte";
  import NotificationBell from "$lib/components/NotificationBell.svelte";
  import UserMenu from "$lib/components/UserMenu.svelte";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { themeStore } from "$lib/stores/theme.svelte.js";
  import { Icons } from "$lib/icons.js";

  interface Props {
    data: LayoutData;
    children: import("svelte").Snippet;
  }
  let { data, children }: Props = $props();

  const adminUser = $derived(data.adminUser);
  const unreadNotifCount = $derived(data.unreadNotifCount ?? 0);
  const csrfToken = $derived(
    (($page.data as Record<string, unknown>).csrfToken as string) ?? "",
  );

  const isOwner = $derived(
    adminUser.is_owner === 1 || adminUser.is_temp_owner === 1,
  );
  const isMember = $derived(adminUser.role === "member");
  const isAdmin = $derived(adminUser.role === "tenant_admin" || isOwner);

  function roleLabel(
    role: string,
    is_owner: number,
    is_temp_owner: number,
  ): string {
    if (is_owner === 1 && is_temp_owner === 0) return m.role_owner();
    if (is_temp_owner === 1) return m.role_owner_temp();
    if (role === "tenant_admin") return m.role_admin();
    if (role === "member") return m.role_member();
    return m.role_collaborator();
  }

  const navItems = $derived([
    {
      href: "/dashboard",
      label: m.admin_dashboard_title(),
      icon: Icons.layoutDashboard,
    },
    ...(isAdmin || isMember
      ? [{ href: "/team", label: m.team_title(), icon: Icons.users }]
      : []),
    {
      href: "/notifications",
      label: m.nav_notifications(),
      icon: Icons.bell,
      badge: unreadNotifCount > 0 ? String(unreadNotifCount) : undefined,
    },
    ...(isAdmin || isMember
      ? [{ href: "/backups", label: m.nav_backups(), icon: Icons.hardDrive }]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/activity",
            label: m.nav_activity(),
            icon: Icons.clipboardList,
          },
        ]
      : []),
  ]);

  const footerItems = [
    { href: "/profile", label: m.nav_profile(), icon: Icons.user },
  ];

  const topNavItems = $derived([...navItems, ...footerItems]);

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
  <div class="mobile-drawer" aria-label={m.common_mobile_menu()}>
    <Sidebar
      navItems={topNavItems}
      brandLabel={m.app_name()}
      footerItems={[]}
      userEmail={adminUser.email}
      userName={adminUser.display_name}
      showTheme={false}
    />
  </div>
{/if}

<div class="shell">
  <!-- Apenas UMA sidebar visível consoante o layout -->
  {#if currentLayout === "compact"}
    <CompactSidebar
      {navItems}
      brandLabel={m.app_name()}
      {footerItems}
      userEmail={adminUser.email}
      userName={adminUser.display_name}
      showTheme={false}
    />
  {:else if currentLayout !== "topnav"}
    <Sidebar
      {navItems}
      brandLabel={m.app_name()}
      {footerItems}
      userEmail={adminUser.email}
      userName={adminUser.display_name}
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
        </div>
        <div class="topnav-items">
          {#each topNavItems as item}
            <a
              href={item.href}
              class="topnav-item"
              class:active={$page.url.pathname === item.href ||
                $page.url.pathname.startsWith(item.href + "/")}
            >
              <span class="topnav-icon" aria-hidden="true"
                >{@html item.icon}</span
              >
              <span>{item.label}</span>
            </a>
          {/each}
        </div>
        <!-- Controles à direita no topnav -->
        <div class="topnav-right">
          <ThemeSwitcher toggleOnly={true} />
          <NotificationBell count={unreadNotifCount} {csrfToken} />
          <UserMenu
            userEmail={adminUser.email}
            userName={adminUser.display_name}
            variant="avatar-only"
            popupPosition="bottom-right"
            showTheme={false}
          />
        </div>
      </nav>
    {/if}

    <!-- Header com NotificationBell e Hamburger mobile -->
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
        <Header unreadCount={unreadNotifCount} {csrfToken} />
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

  /* ── Mobile ── */

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

  @media (max-width: 1024px) {
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
    border-bottom: none; /* remove to avoid double border */
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
