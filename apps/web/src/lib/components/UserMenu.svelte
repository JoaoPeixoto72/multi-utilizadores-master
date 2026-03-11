<script lang="ts">
    /**
     * UserMenu.svelte — Botão de avatar + popup de opções (M1/M11)
     * Reutilizável em sidebars ou topnav.
     */
    import { themeStore } from "$lib/stores/theme.svelte.js";
    import { Icons } from "$lib/icons.js";
    import * as m from "$lib/paraglide/messages.js";
    import Button from "$lib/components/ui/Button.svelte";

    interface Props {
        userEmail?: string;
        userName?: string | null;
        variant?: "full" | "avatar-only";
        popupPosition?: "right" | "bottom-right";
        showTheme?: boolean;
        showPalette?: boolean;
    }

    let {
        userEmail = "",
        userName = "",
        variant = "full",
        popupPosition = "right",
        showTheme = true,
        showPalette = true,
    }: Props = $props();

    let menuOpen = $state(false);
    let btnEl = $state<HTMLButtonElement | null>(null);
    function toggleMenu(e: MouseEvent) {
        if (e) e.stopPropagation();
        menuOpen = !menuOpen;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape" && menuOpen) {
            menuOpen = false;
            btnEl?.focus();
        }
    }

    function handleOutsideClick(e: MouseEvent) {
        if (!menuOpen) return;
        const target = e.target as HTMLElement;
        if (!target.closest(".user-menu-wrapper")) {
            menuOpen = false;
        }
    }

    const userInitial = $derived(
        (userName ? userName : userEmail)
            ? (userName || userEmail).charAt(0).toUpperCase()
            : "?",
    );

    const userShort = $derived(
        userName
            ? userName
            : userEmail
              ? (userEmail.split("@")[0] ?? userEmail).slice(0, 20)
              : m.nav_aria_user_menu(),
    );
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleOutsideClick} />

<div class="user-menu-wrapper">
    {#if variant === "full"}
        <button
            bind:this={btnEl}
            class="user-btn-full"
            onclick={(e) => toggleMenu(e)}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-label={m.nav_aria_user_menu()}
        >
            <span class="user-avatar">{userInitial}</span>
            <span class="user-name">{userShort}</span>
            <span class="user-chevron" aria-hidden="true">
                {@html menuOpen ? Icons.chevronDown : Icons.chevronUp}
            </span>
        </button>
    {:else}
        <button
            bind:this={btnEl}
            class="user-avatar-btn"
            onclick={(e) => toggleMenu(e)}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-label={m.nav_aria_user_menu()}
            title={m.nav_aria_user_menu()}
        >
            <span class="user-avatar">{userInitial}</span>
        </button>
    {/if}

    {#if menuOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
        <div
            class="um-popup pos-{popupPosition}"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label={m.nav_aria_user_options()}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="um-user-info">
                <span class="um-avatar">{userInitial}</span>
                <div class="um-details">
                    {#if userName}<span class="um-name">{userName}</span>{/if}
                    <span class="um-email">{userEmail || "—"}</span>
                </div>
            </div>

            {#if showTheme}
                <div class="um-divider"></div>

                <!-- Tema -->
                <div class="um-section">
                    <span class="um-section-label"
                        >{m.theme_section_theme()}</span
                    >
                    <div class="um-row">
                        {#each ["light", "dark"] as t}
                            <button
                                type="button"
                                class="um-opt"
                                class:selected={themeStore.theme === t}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    themeStore.setTheme(t as "light" | "dark");
                                }}
                            >
                                <span aria-hidden="true" class="um-opt-icon">
                                    {@html t === "light"
                                        ? Icons.sun
                                        : Icons.moon}
                                </span>
                                {t === "light"
                                    ? m.theme_light()
                                    : m.theme_dark()}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if showPalette}
                <div class="um-divider"></div>

                <!-- Paleta -->
                <div class="um-section">
                    <span class="um-section-label"
                        >{m.theme_section_palette()}</span
                    >
                    <div class="um-palette-row">
                        {#each ["indigo", "emerald", "rose", "amber", "slate", "ocean"] as p}
                            <button
                                type="button"
                                class="um-palette-dot palette-bg-{p}"
                                class:selected={themeStore.palette === p}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    themeStore.setPalette(
                                        p as Parameters<
                                            typeof themeStore.setPalette
                                        >[0],
                                    );
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
            {/if}

            <div class="um-divider"></div>

            <!-- Layout -->
            <div class="um-section">
                <span class="um-section-label">{m.theme_section_layout()}</span>
                <div class="um-row">
                    {#each [{ val: "sidebar", icon: Icons.layoutSidebar }, { val: "compact", icon: Icons.layoutCompact }, { val: "topnav", icon: Icons.layoutTopnav }] as lyt}
                        <button
                            type="button"
                            class="um-opt"
                            class:selected={themeStore.layout === lyt.val}
                            onclick={(e) => {
                                e.stopPropagation();
                                themeStore.setLayout(
                                    lyt.val as Parameters<
                                        typeof themeStore.setLayout
                                    >[0],
                                );
                            }}
                            title={themeStore.LAYOUT_LABELS[
                                lyt.val as keyof typeof themeStore.LAYOUT_LABELS
                            ]}
                        >
                            <span class="um-opt-icon">{@html lyt.icon}</span>
                            {themeStore.LAYOUT_LABELS[
                                lyt.val as keyof typeof themeStore.LAYOUT_LABELS
                            ]}
                        </button>
                    {/each}
                </div>
            </div>

            <div class="um-divider"></div>

            <Button
                href="/logout"
                variant="ghost"
                class="um-logout"
                size="sm"
                onclick={(e) => e.stopPropagation()}
            >
                <span class="um-opt-icon">{@html Icons.logOut}</span>
                {m.auth_logout()}
            </Button>
        </div>
    {/if}
</div>

<style>
    .user-menu-wrapper {
        position: relative;
        display: inline-flex;
        z-index: 50;
    }

    /* Variant: Full (sidebar bottom) */
    .user-btn-full {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        padding: var(--space-2);
        border-radius: var(--radius-md);
        border: none;
        background: none;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all var(--duration-fast);
        text-align: left;
    }

    .user-btn-full:hover {
        background-color: var(--bg-surface-subtle);
        color: var(--text-primary);
    }

    /* Variant: Avatar-only (compact sidebar or topnav) */
    .user-avatar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--size-icon-btn);
        height: var(--size-icon-btn);
        border-radius: var(--radius-md);
        border: none;
        background: none;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all var(--duration-fast);
    }

    .user-avatar-btn:hover {
        background-color: var(--bg-surface-subtle);
        color: var(--text-primary);
    }

    .user-avatar {
        width: 28px;
        height: 28px;
        border-radius: var(--radius-full);
        background-color: var(--brand-600);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        flex-shrink: 0;
    }

    .user-name {
        flex: 1;
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .user-chevron {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }
    .user-chevron :global(svg) {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
    }

    /* Popup Styles (Ported from Sidebar.svelte) */

    :global(.um-popup) {
        position: absolute;
        width: 240px;
        background-color: var(--bg-surface);
        border: var(--border-w-1) solid var(--border-base);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-popover);
        padding: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        z-index: 10000;
        pointer-events: auto !important;
    }

    :global(.um-popup.pos-right) {
        left: calc(100% + 8px);
        bottom: 0;
    }

    :global(.um-popup.pos-bottom-right) {
        top: calc(100% + 8px);
        right: 0;
    }

    :global(.um-user-info) {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1);
    }

    :global(.um-details) {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    :global(.um-name) {
        font-size: var(--text-sm);
        font-weight: var(--weight-semibold);
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    :global(.um-email) {
        font-size: var(--text-xs);
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    :global(.um-avatar) {
        width: 32px;
        height: 32px;
        border-radius: var(--radius-full);
        background-color: var(--brand-600);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        flex-shrink: 0;
    }

    :global(.um-divider) {
        height: 1px;
        background-color: var(--border-subtle);
        margin: 0 calc(-1 * var(--space-3));
    }

    :global(.um-section) {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    :global(.um-section-label) {
        font-size: var(--text-2xs);
        font-weight: var(--weight-semibold);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider);
    }

    :global(.um-row) {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
    }

    :global(.um-opt) {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--text-xs);
        font-weight: var(--weight-medium);
        color: var(--text-secondary);
        background-color: var(--bg-surface-subtle);
        border: var(--border-w-1) solid var(--border-base);
        border-radius: var(--radius-sm);
        padding: var(--space-1) var(--space-2);
        cursor: pointer !important;
        transition: all var(--duration-fast);
        pointer-events: auto !important;
    }

    :global(.um-opt:hover) {
        background-color: var(--brand-50);
        border-color: var(--brand-200);
        color: var(--brand-700);
    }

    :global(.um-opt.selected) {
        background-color: var(--nav-active-bg);
        border-color: var(--brand-500);
        color: var(--nav-active-text);
        font-weight: var(--weight-semibold);
    }

    :global(.um-opt-icon) {
        display: flex;
        align-items: center;
    }
    :global(.um-opt-icon svg) {
        width: 12px;
        height: 12px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.75;
    }

    :global(.um-palette-row) {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
    }

    :global(.um-palette-dot) {
        width: 22px;
        height: 22px;
        border-radius: var(--radius-full);
        border: 2px solid transparent;
        cursor: pointer !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--duration-fast);
        padding: 0;
        pointer-events: auto !important;
    }

    :global(.um-palette-dot:hover) {
        transform: scale(1.15);
    }

    :global(.um-palette-dot.selected) {
        box-shadow:
            0 0 0 2px var(--bg-surface),
            0 0 0 4px currentColor;
        transform: scale(1.1);
    }

    :global(.um-palette-dot .dot-check) {
        display: flex;
    }
    :global(.um-palette-dot .dot-check svg) {
        width: 11px;
        height: 11px;
        stroke: #fff;
        fill: none;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    :global(.palette-bg-indigo) {
        background-color: var(--indigo-500, #6366f1);
        color: var(--indigo-600);
    }
    :global(.palette-bg-emerald) {
        background-color: var(--emerald-500, #10b981);
        color: var(--emerald-600);
    }
    :global(.palette-bg-rose) {
        background-color: var(--rose-500, #f43f5e);
        color: var(--rose-600);
    }
    :global(.palette-bg-amber) {
        background-color: var(--amber-500, #f59e0b);
        color: var(--amber-600);
    }
    :global(.palette-bg-slate) {
        background-color: var(--slate-500, #64748b);
        color: var(--slate-600);
    }
    :global(.palette-bg-ocean) {
        background-color: var(--ocean-500, #0ea5e9);
        color: var(--ocean-600);
    }

    :global(.um-logout) {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-1);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
        color: var(--status-inactive-text);
        text-decoration: none;
        transition: background-color var(--duration-fast);
        cursor: pointer !important;
        pointer-events: auto !important;
    }

    :global(.um-logout:hover) {
        background-color: var(--badge-error-bg);
    }
</style>
