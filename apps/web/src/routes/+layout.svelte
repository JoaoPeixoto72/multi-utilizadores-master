<script lang="ts">
  /**
   * +layout.svelte — Layout raiz
   *
   * Responsabilidades:
   * - Aplica data-layout, data-theme, .palette-{name} no <body> via $effect
   * - Importa app.css (tokens + reset)
   * - Inicializa i18n (Paraglide)
   *
   * R: design-guidelines.md §3.1 — atributos de root
   * R: STACK_LOCK.md §14 — persistência via cookies
   */
  import "../app.css";
  import { browser } from "$app/environment";
  import type { LayoutData } from "./$types";
  import fontsData from "$lib/fonts.json";

  interface Props {
    data: LayoutData;
    children: import("svelte").Snippet;
  }

  let { data, children }: Props = $props();

  // Initialize theme store on mount
  import { onMount } from "svelte";
  onMount(() => {
    themeStore.init();
  });

  // Defaults: SIDEBAR / LIGHT / palette-indigo
  // Use themeStore values for theme/palette/layout to ensure consistency
  // between client-side changes and server-side initial values
  import { themeStore } from "$lib/stores/theme.svelte.js";
  
  const layout = $derived(themeStore.layout ?? data.layout ?? "sidebar");
  const theme = $derived(themeStore.theme ?? data.theme ?? "light");
  const palette = $derived(themeStore.palette ?? data.palette ?? "indigo");
  const fontId = $derived(data.fontFamily ?? "inter");
  const fontObj = $derived(
    fontsData.find((f) => f.id === fontId) || fontsData[0],
  );

  // appConfig com cores vindas da BD via +layout.server.ts
  const appConfig = $derived(data.appConfig ?? {});

  // Cores de MARCA — aplicam sempre (não conflitam com dark mode)
  const BRAND_CSS_MAP: [string, string][] = [
    ["--brand-500", "ui_color_primary"],
    ["--brand-600", "ui_color_primary"],
    ["--brand-primary", "ui_color_primary"],
    ["--color-primary", "ui_color_primary"],
  ];

  // Cores de SUPERFÍCIE/SEMÂNTICAS — só em light mode
  // Em dark mode, tokens.css [data-theme="dark"] define estas variáveis.
  // setProperty no body tem especificidade superior ao CSS, por isso
  // precisamos de removeProperty em dark para deixar o CSS actuar.
  const SURFACE_CSS_MAP: [string, string][] = [
    ["--color-secondary", "ui_color_secondary"],
    ["--bg-page", "ui_color_background"],
    ["--bg-surface", "ui_color_surface"],
    ["--btn-action-bg", "ui_color_action_btn"],
    ["--btn-action-text", "ui_color_action_text"],
    ["--color-warning", "ui_color_warning"],
    ["--color-danger", "ui_color_danger"],
    ["--color-link", "ui_color_link"],
    ["--text-primary", "ui_color_text_primary"],
  ];

  // Aplicar atributos no <body> via $effect (Svelte 5 — svelte:body não suporta data-*)
  // Aplica classe de paleta E cores do appConfig (presets guardam cores na BD)
  $effect(() => {
    if (!browser) return;
    const currentLayout = themeStore.layout || layout;
    const currentTheme = themeStore.theme || theme;
    const currentPalette = themeStore.palette || palette;
    const isDark = currentTheme === "dark";

    document.body.setAttribute("data-layout", currentLayout);
    document.body.setAttribute("data-theme", currentTheme);

    // Remover classes de paleta anteriores e adicionar a nova
    const classList = document.body.classList;
    for (const cls of Array.from(classList)) {
      if (cls.startsWith("palette-")) classList.remove(cls);
    }
    classList.add(`palette-${currentPalette}`);

    // Cores de marca — aplicar sempre (light e dark)
    for (const [cssVar, configKey] of BRAND_CSS_MAP) {
      const value = appConfig[configKey];
      if (value) {
        document.body.style.setProperty(cssVar, value);
      } else {
        document.body.style.removeProperty(cssVar);
      }
    }

    // Cores de superfície — só em light mode
    // Em dark mode, remover para que [data-theme="dark"] no tokens.css actue
    for (const [cssVar, configKey] of SURFACE_CSS_MAP) {
      if (isDark) {
        document.body.style.removeProperty(cssVar);
      } else {
        const value = appConfig[configKey];
        if (value) {
          document.body.style.setProperty(cssVar, value);
        } else {
          document.body.style.removeProperty(cssVar);
        }
      }
    }
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link href={fontObj.url} rel="stylesheet" />
</svelte:head>

{@render children()}
