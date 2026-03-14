import type { Handle } from "@sveltejs/kit";

const VALID_LAYOUTS = ["sidebar", "compact", "topnav"] as const;
const VALID_PALETTES = ["indigo", "emerald", "rose", "amber", "slate", "ocean"] as const;
const VALID_THEMES = ["light", "dark"] as const;

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const handle: Handle = async ({ event, resolve }) => {
  const cookieHeader = event.request.headers.get("cookie");

  const rawLayout = parseCookie(cookieHeader, "cf_layout");
  const rawPalette = parseCookie(cookieHeader, "cf_palette");
  const rawTheme = parseCookie(cookieHeader, "cf_theme");

  const layout = (VALID_LAYOUTS as readonly string[]).includes(rawLayout ?? "")
    ? rawLayout!
    : "sidebar";
  const palette = (VALID_PALETTES as readonly string[]).includes(rawPalette ?? "")
    ? rawPalette!
    : "indigo";
  const theme = (VALID_THEMES as readonly string[]).includes(rawTheme ?? "")
    ? rawTheme!
    : "light";

  return resolve(event, {
    transformPageChunk({ html }) {
      return html.replace(
        '<body data-sveltekit-preload-data="hover">',
        `<body data-sveltekit-preload-data="hover" data-layout="${layout}" data-theme="${theme}" class="palette-${palette}">`,
      );
    },
  });
};
