/**
 * icons.ts — Biblioteca centralizada de ícones SVG inline (Lucide-style)
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  COMO USAR                                               ║
 * ║  import { Icons } from "$lib/icons";                     ║
 * ║  <span>{@html Icons.bell}</span>                         ║
 * ║                                                          ║
 * ║  COMO ADICIONAR NOVOS ÍCONES                             ║
 * ║  1. Encontre o path SVG em https://lucide.dev            ║
 * ║  2. Adicione na categoria correta abaixo                 ║
 * ║  3. Use svg(path) para 16×16 monocromático               ║
 * ║  4. O stroke/fill herda via CSS currentColor             ║
 * ║                                                          ║
 * ║  CATEGORIAS                                              ║
 * ║  nav        — itens de navegação / sidebar               ║
 * ║  actions    — botões de acção (criar, editar, apagar…)   ║
 * ║  status     — estados e feedback (ok, erro, aviso…)      ║
 * ║  ui         — elementos de interface (seta, fechar…)     ║
 * ║  domain     — ícones de domínio (empresa, utilizador…)   ║
 * ║  comms      — comunicação (email, notificação…)          ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Portável — sem dependência de pacotes externos de ícones.
 * Todos os SVGs são 24×24 viewBox, stroke-only, compatíveis com Lucide.
 */

/** Helper interno: constrói uma string SVG pronta para {@html} */
const svg = (path: string, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;

export const Icons = {
  // ── Navegação / Sidebar ──────────────────────────────────────────────────────
  /** Dashboard principal com painéis */
  layoutDashboard: svg(
    `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`,
  ),
  /** Banco de Dados */
  database: svg(
    `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>`,
  ),
  /** Equipa / membros */
  users: svg(
    `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  ),
  /** Notificações / sino */
  bell: svg(
    `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
  ),
  /** Sino desactivado (estado sem notificações) */
  bellOff: svg(
    `<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>`,
  ),
  /** Backups / armazenamento */
  hardDrive: svg(
    `<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>`,
  ),
  /** Histórico / logs */
  clipboardList: svg(
    `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>`,
  ),
  /** Perfil / conta */
  user: svg(`<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`),
  /** Definições / configurações */
  settings: svg(
    `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  ),
  /** Auditoria / pesquisa */
  search: svg(`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`),
  /** Actividade */
  activity: svg(
    `<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>`,
  ),
  /** Logout / sair */
  logOut: svg(
    `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`,
  ),

  // ── Domínio (Empresas / Módulos) ─────────────────────────────────────────────
  /** Empresa / tenant */
  building2: svg(
    `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`,
  ),
  /** Módulo / integração / energia */
  zap: svg(
    `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
  ),
  /** Segurança / permissões */
  shieldCheck: svg(
    `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
  ),
  /** Chave / token */
  key: svg(
    `<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>`,
  ),
  /** Globo / web */
  globe: svg(
    `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  ),

  // ── Comunicação ──────────────────────────────────────────────────────────────
  /** Email */
  mail: svg(
    `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
  ),

  // ── Acções (CRUD) ────────────────────────────────────────────────────────────
  /** Criar / adicionar */
  plus: svg(`<path d="M5 12h14"/><path d="M12 5v14"/>`),
  /** Editar / lápis */
  pencil: svg(`<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>`),
  /** Eliminar / lixo */
  trash2: svg(
    `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`,
  ),
  /** Copiar */
  copy: svg(
    `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  ),
  /** Enviar / partilhar */
  send: svg(`<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>`),
  /** Fazer download */
  download: svg(
    `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`,
  ),
  /** Fazer upload */
  upload: svg(
    `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>`,
  ),
  /** Restaurar / histórico */
  rotateBack: svg(
    `<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`,
  ),

  // ── Estado e Feedback ────────────────────────────────────────────────────────
  /** Confirmação / lido */
  check: svg(`<path d="M20 6 9 17l-5-5"/>`),
  /** Confirmar tudo */
  checkAll: svg(`<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>`),
  /** Fechar / erro */
  x: svg(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`),
  /** Aviso */
  alertTriangle: svg(
    `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>`,
  ),
  /** Informação */
  info: svg(`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`),
  /** Bloqueado */
  lock: svg(
    `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  ),
  /** Desbloqueado */
  unlock: svg(
    `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
  ),
  /** Carregar / loading */
  loader: svg(
    `<line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/>`,
  ),

  // ── UI / Navegação ───────────────────────────────────────────────────────────
  /** Seta para direita / próximo */
  chevronRight: svg(`<path d="m9 18 6-6-6-6"/>`),
  /** Seta para baixo */
  chevronDown: svg(`<path d="m6 9 6 6 6-6"/>`),
  /** Link externo / abrir em nova aba */
  externalLink: svg(
    `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  ),
  /** Menu hambúrguer */
  menu: svg(
    `<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>`,
  ),
  /** Filtro */
  filter: svg(`<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>`),
  /** Mais opções (vertical) */
  moreVertical: svg(
    `<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>`,
  ),
  /** Mais opções (horizontal) */
  moreHorizontal: svg(
    `<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>`,
  ),
  /** Sol / tema claro */
  sun: svg(
    `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
  ),
  /** Lua / tema escuro */
  moon: svg(`<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`),

  // ── Estatísticas / Métricas ──────────────────────────────────────────────────
  /** Estatísticas / gráfico de barras */
  barChart: svg(
    `<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>`,
  ),
  /** Tendência / crescimento */
  trendingUp: svg(
    `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  ),
  // ── Modificações Auto ─────────────────────────────────────────────────────────
  alertCircle: svg(
    `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  ),
  play: svg(`<polygon points="5 3 19 12 5 21 5 3"/>`),
  pause: svg(`<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`),
  layoutSidebar: svg(
    `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>`,
  ),
  layoutCompact: svg(
    `<rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="11" height="18" rx="1"/>`,
  ),
  layoutTopnav: svg(
    `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>`,
  ),
  chevronUp: svg(`<path d="m18 15-6-6-6 6"/>`),
  /** Paleta de cores */
  palette: svg(
    `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.6 1.95-1.44.13-.42.54-.56.93-.56h.12c2.2 0 4-1.8 4-4 0-.44-.1-.85-.29-1.22l-.08-.14c-.17-.29-.28-.56-.3-.79C18.25 10.39 22 10.03 22 7c0-2.76-4.48-5-10-5z"/>`,
  ),
} as const;

// Tipo utilitário: nomes de todos os ícones disponíveis
export type IconName = keyof typeof Icons;
