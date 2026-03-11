<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";
</script>

<div class="home">
  <h1>{m.app_name()}</h1>
  <p>{m.home_description()}</p>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--space-8);
    background-color: var(--bg-page);
  }

  h1 {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin-bottom: var(--space-4);
  }

  p {
    font-size: var(--text-base);
    color: var(--text-muted);
  }
</style>
