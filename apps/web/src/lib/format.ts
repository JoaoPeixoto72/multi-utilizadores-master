/**
 * format.ts — Utilitários de formatação partilhados
 *
 * Centraliza LOCALE_MAP e funções de formatDate para
 * evitar duplicação em dezenas de ficheiros .svelte.
 *
 * USO:
 *   import { formatDateShort, formatDateTime } from "$lib/format";
 *   formatDateShort(unixTimestamp);  // "01/03/2026"
 *   formatDateTime(unixTimestamp);   // "01/03/2026, 14:30"
 */
import { getLocale } from "$lib/paraglide/runtime.js";

/** Mapa Paraglide locale → BCP 47 completo */
const LOCALE_MAP: Record<string, string> = {
  pt: "pt-PT",
  en: "en-GB",
};

/** Resolve o locale BCP 47 actual */
export function getDateLocale(): string {
  return LOCALE_MAP[getLocale()] ?? "pt-PT";
}

/**
 * Data curta a partir de UNIX timestamp (segundos).
 * Ex: "01/03/2026"
 */
export function formatDateShort(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(getDateLocale());
}

/**
 * Data + hora a partir de UNIX timestamp (segundos).
 * Ex: "01/03/2026, 14:30"
 */
export function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(getDateLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Data curta a partir de Date ou milissegundos.
 * Ex: "01/03/2026, 14:30"
 */
export function formatDateTimeMs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(getDateLocale(), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Data formatada a partir de ISO string — curta com hora.
 * Ex: "01 mar., 14:30"
 */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(getDateLocale(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Data formatada a partir de ISO string.
 * Ex: "01 mar. 2026"
 */
export function formatDateISO(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(getDateLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * Data + hora (com expiração) a partir de UNIX timestamp (segundos).
 * Ex: "01/03/2026 14:30"
 */
export function formatDateTimeExp(ts: number): string {
  const d = new Date(ts * 1000);
  const loc = getDateLocale();
  return (
    d.toLocaleDateString(loc) +
    " " +
    d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })
  );
}

/**
 * Formata bytes para leitura humana.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
