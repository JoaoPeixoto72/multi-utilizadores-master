/**
 * stores/theme.svelte.ts — Store de preferências visuais (M11)
 *
 * R: BUILD_PLAN.md §M11.1
 * R: design-guidelines.md §3 — paletas, temas, layouts
 *
 * Controla:
 *   layout  — "sidebar" | "compact" | "topnav"
 *   palette — "indigo" | "emerald" | "rose" | "amber" | "slate" | "ocean"
 *   theme   — "light" | "dark"
 *
 * Persiste em cookies (nunca localStorage).
 * Actualiza data-layout, data-theme e classe palette-* no <body>.
 * A troca de tema não causa re-render — apenas muda atributos no root.
 */

export type Layout = "sidebar" | "compact" | "topnav";
export type Palette = "indigo" | "emerald" | "rose" | "amber" | "slate" | "ocean";
export type Theme = "light" | "dark";

export const LAYOUTS: Layout[] = ["sidebar", "compact", "topnav"];
export const PALETTES: Palette[] = ["indigo", "emerald", "rose", "amber", "slate", "ocean"];
export const THEMES: Theme[] = ["light", "dark"];

const PALETTE_LABELS: Record<Palette, string> = {
  indigo: "Indigo",
  emerald: "Esmeralda",
  rose: "Rosa",
  amber: "Âmbar",
  slate: "Cinza",
  ocean: "Oceano",
};

const LAYOUT_LABELS: Record<Layout, string> = {
  sidebar: "Sidebar",
  compact: "Compacta",
  topnav: "Topo",
};

const PALETTE_COLORS: Record<Palette, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  slate: "#64748b",
  ocean: "#0ea5e9",
};

// ── Helpers de cookie ─────────────────────────────────────────────────────────

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // 1 ano; SameSite=Lax; path=/
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: sync cookie for theme preferences; Cookie Store API is async and not universally supported
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

// ── Aplicar ao DOM ────────────────────────────────────────────────────────────

function applyToBody(layout: Layout, palette: Palette, theme: Theme): void {
  if (typeof document === "undefined") return;

  const body = document.body;

  // data-layout
  body.setAttribute("data-layout", layout);

  // data-theme
  body.setAttribute("data-theme", theme);

  // palette class — remover antigas, adicionar nova
  for (const p of PALETTES) {
    body.classList.remove(`palette-${p}`);
  }
  body.classList.add(`palette-${palette}`);
}

// ── Estado reactivo ($state) ──────────────────────────────────────────────────

function createThemeStore() {
  let layout = $state<Layout>("sidebar");
  let palette = $state<Palette>("indigo");
  let theme = $state<Theme>("light");

  /**
   * Inicializar a partir de cookies.
   * Chamar no onMount do root layout.
   */
  function init(): void {
    const savedLayout = getCookie("cf_layout") as Layout | null;
    const savedPalette = getCookie("cf_palette") as Palette | null;
    const savedTheme = getCookie("cf_theme") as Theme | null;

    if (savedLayout && LAYOUTS.includes(savedLayout)) layout = savedLayout;
    if (savedPalette && PALETTES.includes(savedPalette)) palette = savedPalette;
    if (savedTheme && THEMES.includes(savedTheme)) theme = savedTheme;

    applyToBody(layout, palette, theme);
  }

  function setLayout(v: Layout): void {
    layout = v;
    setCookie("cf_layout", v);
    applyToBody(layout, palette, theme);
  }

  function setPalette(v: Palette): void {
    palette = v;
    setCookie("cf_palette", v);
    applyToBody(layout, palette, theme);
  }

  function setTheme(v: Theme): void {
    theme = v;
    setCookie("cf_theme", v);
    applyToBody(layout, palette, theme);
  }

  function toggleTheme(): void {
    setTheme(theme === "light" ? "dark" : "light");
  }

  return {
    get layout() {
      return layout;
    },
    get palette() {
      return palette;
    },
    get theme() {
      return theme;
    },
    init,
    setLayout,
    setPalette,
    setTheme,
    toggleTheme,
    PALETTE_LABELS,
    LAYOUT_LABELS,
    PALETTE_COLORS,
  };
}

export const themeStore = createThemeStore();
