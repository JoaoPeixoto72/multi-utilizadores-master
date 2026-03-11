<script lang="ts">
  /**
   * Header.svelte — Barra de topo partilhada
   *
   * Contém (da esquerda para a direita):
   *   [título]  →→→  [NotificationBell]
   *
   * User menu + ThemeSwitcher ficam na sidebar (rodapé).
   */
  import NotificationBell from "./NotificationBell.svelte";
  import ThemeSwitcher from "./ThemeSwitcher.svelte";

  interface Props {
    unreadCount?: number;
    title?: string;
    csrfToken?: string;
  }

  let { unreadCount = 0, title = "", csrfToken = "" }: Props = $props();
</script>

<header class="header">
  <div class="header-left">
    {#if title}
      <span class="header-title">{title}</span>
    {/if}
  </div>

  <div class="header-right">
    <ThemeSwitcher toggleOnly={true} />
    <!-- Sino de notificações com popup -->
    <NotificationBell count={unreadCount} {csrfToken} />
  </div>
</header>

<style>
  .header {
    height: var(--size-header-h);
    background-color: var(--bg-surface);
    border-bottom: var(--border-w-1) solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--pad-header-x);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .header-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
</style>
