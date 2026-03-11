<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";

  interface Props {
    password: string;
  }
  let { password }: Props = $props();

  const checks = $derived({
    minLength: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  });
</script>

<ul class="checklist" aria-label={m.auth_password_requirements()} role="list">
  <li class:pass={checks.minLength} aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    {m.auth_password_min_length()}
  </li>
  <li class:pass={checks.uppercase} aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    {m.auth_password_uppercase()}
  </li>
  <li class:pass={checks.lowercase} aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    {m.auth_password_lowercase()}
  </li>
  <li class:pass={checks.special} aria-live="polite">
    <span class="dot" aria-hidden="true"></span>
    {m.auth_password_special()}
  </li>
</ul>

<style>
  .checklist {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-status-gap);
    font-size: var(--text-xs);
    color: var(--text-muted);
    transition: color var(--duration-fast) var(--ease-default);
  }

  li.pass {
    color: var(--status-active-text);
  }

  .dot {
    width: var(--size-status-dot);
    height: var(--size-status-dot);
    border-radius: var(--radius-full);
    background-color: var(--status-inactive-dot);
    flex-shrink: 0;
    transition: background-color var(--duration-fast) var(--ease-default);
  }

  li.pass .dot {
    background-color: var(--status-active-dot);
  }
</style>
