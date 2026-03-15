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
  const radius = $derived(data.radius ?? "lg");
  const fontId = $derived(data.fontFamily ?? "inter");
  const fontObj = $derived(
    fontsData.find((f) => f.id === fontId) || fontsData[0],
  );
  const borderActive = $derived(data.borderActive !== "false");
  const borderColor = $derived(data.borderColor ?? "");
  const inputBgColor = $derived(data.inputBgColor ?? "");
  const inputPadding = $derived(data.inputPadding ?? "");
  const buttonRadius = $derived(data.buttonRadius ?? "full");
  const buttonBgColor = $derived(data.buttonBgColor ?? "");
  const buttonTextColor = $derived(data.buttonTextColor ?? "");

  // Extract custom colors from appConfig
  const appConfig = $derived(data.appConfig ?? {});
  const colorPrimary = $derived(appConfig.ui_color_primary ?? "");
  const colorSecondary = $derived(appConfig.ui_color_secondary ?? "");
  const colorBackground = $derived(appConfig.ui_color_background ?? "");
  const colorSurface = $derived(appConfig.ui_color_surface ?? "");
  const colorActionBtn = $derived(appConfig.ui_color_action_btn ?? "");
  const colorActionText = $derived(appConfig.ui_color_action_text ?? "");
  const colorWarning = $derived(appConfig.ui_color_warning ?? "");
  const colorDanger = $derived(appConfig.ui_color_danger ?? "");
  const colorLink = $derived(appConfig.ui_color_link ?? "");

  // Aplicar atributos no <body> via $effect (Svelte 5 — svelte:body não suporta data-*)
  // Aplicamos as classes de tema e layout E as cores customizadas do appConfig
  $effect(() => {
    if (!browser) return;
    // Only set attributes if themeStore is initialized (has non-default values)
    // or if we're using the data values (initial render)
    const currentLayout = themeStore.layout || layout;
    const currentTheme = themeStore.theme || theme;
    const currentPalette = themeStore.palette || palette;
    
    document.body.setAttribute("data-layout", currentLayout);
    document.body.setAttribute("data-theme", currentTheme);
    // Remover classes de paleta anteriores e adicionar a nova
    const classList = document.body.classList;
    for (const cls of Array.from(classList)) {
      if (cls.startsWith("palette-")) classList.remove(cls);
    }
    classList.add(`palette-${currentPalette}`);

    // Apply custom branding colors from appConfig
    const root = document.documentElement;
    if (colorPrimary) root.style.setProperty("--color-primary", colorPrimary);
    if (colorSecondary) root.style.setProperty("--color-secondary", colorSecondary);
    if (colorBackground) root.style.setProperty("--bg-page", colorBackground);
    if (colorSurface) root.style.setProperty("--bg-surface", colorSurface);
    if (colorActionBtn) root.style.setProperty("--btn-action-bg", colorActionBtn);
    if (colorActionText) root.style.setProperty("--btn-action-text", colorActionText);
    if (colorWarning) root.style.setProperty("--color-warning", colorWarning);
    if (colorDanger) root.style.setProperty("--color-danger", colorDanger);
    if (colorLink) root.style.setProperty("--color-link", colorLink);
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
