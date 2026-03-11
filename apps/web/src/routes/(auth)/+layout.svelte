<script lang="ts">
/**
 * (auth)/+layout.svelte — Layout das páginas de autenticação
 * R: design-guidelines.md §5.1 — bg-page, sem sidebar/topnav, card centrado
 * R: STACK_LOCK.md §14 — tokens only, zero hex/px hardcoded
 */
interface Props {
  children: import("svelte").Snippet;
}
let { children }: Props = $props();
</script>

<div class="auth-shell">
  <main class="auth-main">
    {@render children()}
  </main>
</div>

<style>
  .auth-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: var(--bg-page);
    padding: var(--space-8);
  }

  .auth-main {
    width: 100%;
    max-width: var(--size-auth-card-w);
  }
</style>
