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

  // Defaults: SIDEBAR / LIGHT / palette-indigo
  const layout = $derived(data.layout ?? "sidebar");
  const theme = $derived(data.theme ?? "light");
  const palette = $derived(data.palette ?? "indigo");
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

  // Aplicar atributos no <body> via $effect (Svelte 5 — svelte:body não suporta data-*)
  $effect(() => {
    if (!browser) return;
    document.body.setAttribute("data-layout", layout);
    document.body.setAttribute("data-theme", theme);
    // Remover classes de paleta anteriores e adicionar a nova
    const classList = document.body.classList;
    for (const cls of Array.from(classList)) {
      if (cls.startsWith("palette-")) classList.remove(cls);
    }
    classList.add(`palette-${palette}`);

    // Aplicar a Global Font ao CSS :root
    document.documentElement.style.setProperty("--font-sans", fontObj.family);

    // Aplicar substituição de bordas
    if (!borderActive) {
      document.documentElement.style.setProperty(
        "--border-input",
        "var(--bg-input)",
      );
      document.documentElement.style.setProperty(
        "--border-input-hover",
        "var(--bg-hover)",
      );
    } else {
      if (borderColor) {
        document.documentElement.style.setProperty(
          "--border-input",
          borderColor,
        );
        document.documentElement.style.setProperty(
          "--border-input-hover",
          borderColor,
        );
      } else {
        document.documentElement.style.removeProperty("--border-input");
        document.documentElement.style.removeProperty("--border-input-hover");
      }
    }

    // Input text block spacing and background colors
    if (inputBgColor) {
      document.documentElement.style.setProperty("--bg-input", inputBgColor);
    } else {
      document.documentElement.style.removeProperty("--bg-input");
    }

    if (inputPadding) {
      document.documentElement.style.setProperty("--space-4", inputPadding); // ui/Input.svelte base padding
    } else {
      document.documentElement.style.removeProperty("--space-4");
    }

    // Button custom variables
    const btnRadiusMap: Record<string, string> = {
      sm: "var(--radius-sm, 4px)",
      md: "var(--radius-md, 8px)",
      lg: "var(--radius-lg, 12px)",
      full: "9999px",
    };

    document.documentElement.style.setProperty(
      "--radius-btn",
      btnRadiusMap[buttonRadius] || "9999px",
    );

    // Mapeamento Dinamico de Cores Curadas da UI
    const appConfig = data.appConfig || {};
    const colorVars: Record<string, string[]> = {
      ui_color_primary: ["--brand-500", "--bg-selected", "--badge-brand-bg"],
      ui_color_secondary: [
        "--bg-surface-subtle",
        "--bg-hover",
        "--border-subtle",
      ],
      ui_color_background: ["--bg-page"],
      ui_color_surface: ["--bg-surface"],
      ui_color_action_btn: ["--btn-action-bg"],
      ui_color_action_text: ["--btn-action-text"],
      ui_color_warning: [
        "--status-pending-text",
        "--badge-warning-text",
        "--badge-warning-bg",
        "--status-pending-dot",
      ],
      ui_color_danger: [
        "--color-danger",
        "--status-error-text",
        "--badge-error-bg",
        "--status-inactive-text",
        "--status-inactive-dot",
      ],
      ui_color_link: ["--text-link"],
    };

    for (const [key, cssVars] of Object.entries(colorVars)) {
      const val = appConfig[key];
      if (val) {
        for (const cssVar of cssVars) {
          document.documentElement.style.setProperty(cssVar, val);
        }
      } else {
        for (const cssVar of cssVars) {
          document.documentElement.style.removeProperty(cssVar);
        }
      }
    }

    // Injetar variável CSS para o radius root dinâmico (com fallback para tokens)
    // Isto permiterá que modifiquemos o raio de todos os elementos.
    // Como tokens.css dita a variável principal localmente, reescrevemos o estilo em inline ou classes
    const radiusMap: Record<string, string> = {
      sm: "6px",
      md: "8px",
      lg: "12px",
      full: "9999px",
    };
    const val = radiusMap[radius] || "12px";

    // Reescrever variáveis no ROOT para propagar em cascata
    document.documentElement.style.setProperty(
      "--radius-sm",
      radius === "sm" ? "4px" : radius === "full" ? "9999px" : "6px",
    );
    document.documentElement.style.setProperty(
      "--radius-md",
      radius === "full" ? "9999px" : val,
    );
    document.documentElement.style.setProperty(
      "--radius-lg",
      radius === "full" ? "9999px" : val,
    );
    document.documentElement.style.setProperty(
      "--radius-xl",
      radius === "full" ? "9999px" : "16px",
    );
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
