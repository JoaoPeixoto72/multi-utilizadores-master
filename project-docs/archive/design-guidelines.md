# DESIGN.md – GenSpark v2.2.2
# Sistema de Design – Clean Minimal SaaS

```
STATUS              = LOCKED
VERSION             = 2.2.2
AESTHETIC           = CLEAN_MINIMAL
FILL_MODE           = LOCKED
DESIGN_SOURCE       = preview.html (validated by human, 2026-02-21)
LAYOUTS             = [SIDEBAR, TOPNAV, COMPACT]
PALETTES            = [INDIGO, EMERALD, ROSE, AMBER, SLATE, OCEAN]
THEMES              = [LIGHT, DARK]
DEFAULT_LAYOUT      = SIDEBAR
DEFAULT_PALETTE     = INDIGO
DEFAULT_THEME       = LIGHT
USER_LAYOUT_SWITCH  = true
USER_PALETTE_SWITCH = true
USER_THEME_SWITCH   = true
DARK_MODE           = true
ICON_LIBRARY        = @lucide/svelte
FONT                = Inter (Google Fonts)
```

Scope: Input de design enviado no início do projecto junto com briefing.md, STACK_RUNTIME.md e STACK_SOFTWARE.md
O Architect lê a Secção 1 (aesthetic) e os metadados do cabeçalho na FASE 0 para preencher o questionário.
O Frontend Builder lê o documento completo antes de criar tokens.css e componentes UI.
Após tokens.css criado e validado, este ficheiro não é mais consultado — o contrato visual vive em tokens.css.

---

## 1. AESTHETIC DIRECTION

**CLEAN_MINIMAL** — O único aesthetic autorizado neste projecto.

Princípios:

1) **Superfícies limpas**: light e dark com cores sólidas (sem gradientes decorativos), sem glassmorphism, sem padrões de fundo.
2) **Contenção tipográfica**: hierarquia por tamanho/peso; cor apenas para estado/acção.
3) **Bordas em vez de sombras**: separação visual por bordas (tokenizadas). `box-shadow` é proibido em cards e tabelas, permitido apenas em modais/dropdowns/popovers. **Excepção explícita:** focus ring usa `--shadow-focus`.
4) **Espaço como elemento de design**: `padding` e `gap` controlados por tokens (não por compressão em componentes).

Referências visuais: Linear, Vercel Dashboard, Stripe Dashboard, Notion, Raycast.

---

## 2. SISTEMA DE TOKENS CSS

**Caminho obrigatório (ficheiro real no repo):** `apps/web/src/styles/tokens.css`
**Regra absoluta:** nenhum valor visual (cor, espaçamento, sizes em px, radius, sombra, duração, z-index) pode ser escrito directamente em componentes. Tudo passa pelos tokens abaixo.

**Excepções explícitas (permitidas sem token):**
- Breakpoints em media queries / Tailwind config (ex.: `1024px`) — CSS não suporta variáveis em media queries de forma standard.
- Unidades/keywords que não representam "decisão visual fixa": `%`, `vh`, `vw`, `fr`, `auto`, `none`.
- Números estruturais (ex.: `repeat(4, 1fr)`) podem existir em CSS de layout; preferir tokenizar quando fizer sentido e for suportado.

Este documento contém o **conteúdo canónico** de `tokens.css`. O Frontend Builder materializa este conteúdo em apps/web/src/styles/tokens.css sem alterações. A gate GS_TOKENS (gerada na PHASE_00) verifica que tokens.css existe e contém todas as variáveis declaradas neste documento.

### 2.1 Tokens de Superfície e Texto (Light + Dark)

```css
:root {
  /* ── Superfícies (LIGHT) ── */
  --bg-page:            #f7f8fa;
  --bg-surface:         #ffffff;
  --bg-surface-hover:   #fafafa;
  --bg-surface-subtle:  #f3f4f6;
  --bg-overlay:         rgba(0, 0, 0, 0.30);

  /* ── Bordas (LIGHT) ── */
  --border-base:        #f0f0f2;
  --border-subtle:      #f5f5f7;
  --border-input:       #e5e7eb;
  --border-input-hover: #d1d5db;

  /* ── Texto (LIGHT) ── */
  --text-primary:       #111827;
  --text-secondary:     #4b5563;
  --text-muted:         #9ca3af;
  --text-xmuted:        #c4c4cc;
  --text-inverse:       #ffffff;

  /* ── Status ── */
  --status-active-dot:      #22c55e;
  --status-pending-dot:     #f59e0b;
  --status-inactive-dot:    #ef4444;
  --status-active-text:     #16a34a;
  --status-pending-text:    #d97706;
  --status-inactive-text:   #dc2626;

  /* ── Notificação / Badge de alerta ── */
  --badge-alert-bg:     #ef4444;
  --badge-alert-text:   #ffffff;

  /* ── Tabelas ── */
  --bg-table-header:    #fafafa;

  /* ── Métricas: semântica fixa (não varia com paleta) ── */
  --metric-admin-bg:       #f5f3ff;
  --metric-admin-icon:     #7c3aed;
  --metric-members-bg:     #eff6ff;
  --metric-members-icon:   #2563eb;
  --metric-storage-bg:     #fffbeb;
  --metric-storage-icon:   #d97706;
  --metric-emails-bg:      #ecfdf5;
  --metric-emails-icon:    #059669;
}

/* ── Dark mode: overrides ── */
[data-theme="dark"] {
  --bg-page:            #0b0f17;
  --bg-surface:         #0f1623;
  --bg-surface-hover:   #121b2b;
  --bg-surface-subtle:  #0c1320;
  --bg-overlay:         rgba(0, 0, 0, 0.55);

  --border-base:        #1f2a3a;
  --border-subtle:      #172233;
  --border-input:       #243246;
  --border-input-hover: #2f415c;

  --text-primary:       #e5e7eb;
  --text-secondary:     #b6c0cf;
  --text-muted:         #7f8aa3;
  --text-xmuted:        #58627a;

  --text-inverse:       #ffffff;

  --bg-table-header:    #0c1320;
}
```

### 2.2 Tokens de Marca (Paleta)

Cada paleta redefine **exclusivamente** as variáveis abaixo. O resto dos tokens mantém-se igual.

```css
/* ── INDIGO (default) ── */
.palette-indigo {
  --brand-50:         #f0f4ff;
  --brand-100:        #e0e9ff;
  --brand-200:        #c7d7fe;
  --brand-500:        #6366f1;
  --brand-600:        #4f46e5;
  --brand-700:        #4338ca;
  --brand-800:        #3730a3;
  --badge-role-bg:    #f5f3ff;
  --badge-role-text:  #7c3aed;
  --nav-active-bg:    #f0f4ff;
  --nav-active-text:  #4338ca;
  --avatar-bg:        #f0f4ff;
  --avatar-text:      #4338ca;
  --ring-color:       rgba(99, 102, 241, 0.15);
}

/* ── EMERALD ── */
.palette-emerald {
  --brand-50:         #ecfdf5;
  --brand-100:        #d1fae5;
  --brand-200:        #a7f3d0;
  --brand-500:        #10b981;
  --brand-600:        #059669;
  --brand-700:        #047857;
  --brand-800:        #065f46;
  --badge-role-bg:    #ecfdf5;
  --badge-role-text:  #047857;
  --nav-active-bg:    #ecfdf5;
  --nav-active-text:  #065f46;
  --avatar-bg:        #ecfdf5;
  --avatar-text:      #047857;
  --ring-color:       rgba(16, 185, 129, 0.15);
}

/* ── ROSE ── */
.palette-rose {
  --brand-50:         #fff1f2;
  --brand-100:        #ffe4e6;
  --brand-200:        #fecdd3;
  --brand-500:        #f43f5e;
  --brand-600:        #e11d48;
  --brand-700:        #be123c;
  --brand-800:        #9f1239;
  --badge-role-bg:    #fff1f2;
  --badge-role-text:  #be123c;
  --nav-active-bg:    #fff1f2;
  --nav-active-text:  #be123c;
  --avatar-bg:        #fff1f2;
  --avatar-text:      #be123c;
  --ring-color:       rgba(244, 63, 94, 0.15);
}

/* ── AMBER ── */
.palette-amber {
  --brand-50:         #fffbeb;
  --brand-100:        #fef3c7;
  --brand-200:        #fde68a;
  --brand-500:        #f59e0b;
  --brand-600:        #d97706;
  --brand-700:        #b45309;
  --brand-800:        #92400e;
  --badge-role-bg:    #fffbeb;
  --badge-role-text:  #92400e;
  --nav-active-bg:    #fffbeb;
  --nav-active-text:  #92400e;
  --avatar-bg:        #fffbeb;
  --avatar-text:      #92400e;
  --ring-color:       rgba(245, 158, 11, 0.15);
}

/* ── SLATE ── */
.palette-slate {
  --brand-50:         #f8fafc;
  --brand-100:        #f1f5f9;
  --brand-200:        #e2e8f0;
  --brand-500:        #64748b;
  --brand-600:        #475569;
  --brand-700:        #334155;
  --brand-800:        #1e293b;
  --badge-role-bg:    #f1f5f9;
  --badge-role-text:  #334155;
  --nav-active-bg:    #f1f5f9;
  --nav-active-text:  #1e293b;
  --avatar-bg:        #f1f5f9;
  --avatar-text:      #334155;
  --ring-color:       rgba(100, 116, 139, 0.15);
}

/* ── OCEAN ── */
.palette-ocean {
  --brand-50:         #eff8ff;
  --brand-100:        #dbeafe;
  --brand-200:        #bfdbfe;
  --brand-500:        #0ea5e9;
  --brand-600:        #0284c7;
  --brand-700:        #0369a1;
  --brand-800:        #075985;
  --badge-role-bg:    #eff8ff;
  --badge-role-text:  #0369a1;
  --nav-active-bg:    #eff8ff;
  --nav-active-text:  #0369a1;
  --avatar-bg:        #eff8ff;
  --avatar-text:      #0369a1;
  --ring-color:       rgba(14, 165, 233, 0.15);
}
```

#### 2.2.1 Paletas em Dark Mode (overrides)

```css
[data-theme="dark"].palette-indigo {
  --nav-active-bg:   rgba(99, 102, 241, 0.16);
  --nav-active-text: #c7d7fe;
  --badge-role-bg:   rgba(99, 102, 241, 0.16);
  --badge-role-text: #c7d7fe;
  --avatar-bg:       rgba(99, 102, 241, 0.16);
  --avatar-text:     #c7d7fe;
  --ring-color:      rgba(99, 102, 241, 0.28);
}
[data-theme="dark"].palette-emerald {
  --nav-active-bg:   rgba(16, 185, 129, 0.16);
  --nav-active-text: #a7f3d0;
  --badge-role-bg:   rgba(16, 185, 129, 0.16);
  --badge-role-text: #a7f3d0;
  --avatar-bg:       rgba(16, 185, 129, 0.16);
  --avatar-text:     #a7f3d0;
  --ring-color:      rgba(16, 185, 129, 0.28);
}
[data-theme="dark"].palette-rose {
  --nav-active-bg:   rgba(244, 63, 94, 0.16);
  --nav-active-text: #fecdd3;
  --badge-role-bg:   rgba(244, 63, 94, 0.16);
  --badge-role-text: #fecdd3;
  --avatar-bg:       rgba(244, 63, 94, 0.16);
  --avatar-text:     #fecdd3;
  --ring-color:      rgba(244, 63, 94, 0.28);
}
[data-theme="dark"].palette-amber {
  --nav-active-bg:   rgba(245, 158, 11, 0.16);
  --nav-active-text: #fde68a;
  --badge-role-bg:   rgba(245, 158, 11, 0.16);
  --badge-role-text: #fde68a;
  --avatar-bg:       rgba(245, 158, 11, 0.16);
  --avatar-text:     #fde68a;
  --ring-color:      rgba(245, 158, 11, 0.28);
}
[data-theme="dark"].palette-slate {
  --nav-active-bg:   rgba(100, 116, 139, 0.18);
  --nav-active-text: #e2e8f0;
  --badge-role-bg:   rgba(100, 116, 139, 0.18);
  --badge-role-text: #e2e8f0;
  --avatar-bg:       rgba(100, 116, 139, 0.18);
  --avatar-text:     #e2e8f0;
  --ring-color:      rgba(100, 116, 139, 0.30);
}
[data-theme="dark"].palette-ocean {
  --nav-active-bg:   rgba(14, 165, 233, 0.16);
  --nav-active-text: #bfdbfe;
  --badge-role-bg:   rgba(14, 165, 233, 0.16);
  --badge-role-text: #bfdbfe;
  --avatar-bg:       rgba(14, 165, 233, 0.16);
  --avatar-text:     #bfdbfe;
  --ring-color:      rgba(14, 165, 233, 0.28);
}
```

### 2.3 Tokens de Tipografia

```css
:root {
  --font-sans:   'Inter', system-ui, -apple-system, sans-serif;
  --font-mono:   'JetBrains Mono', 'Fira Code', monospace;

  --text-2xs:    10px;
  --text-xs:     12px;
  --text-sm:     13px;
  --text-base:   14px;
  --text-lg:     16px;
  --text-xl:     20px;
  --text-metric: 24px;

  --weight-normal:   400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700;

  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-loose:  1.75;

  --tracking-normal: 0em;
  --tracking-wide:   0.04em;
  --tracking-wider:  0.06em;
  --tracking-widest: 0.08em;
}
```

### 2.4 Tokens de Espaçamento

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  10px;
  --space-4:  12px;
  --space-5:  16px;
  --space-6:  20px;
  --space-7:  24px;
  --space-8:  32px;

  --space-nav-y:        7px;
  --space-status-gap:   5px;
  --space-btn-icon-gap: 6px;
  --space-compact-nav:  9px;
}
```

### 2.5 Tokens de Radius

```css
:root {
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;
}
```

### 2.6 Tokens de Sizes (Layout + Controls + Content)

```css
:root {
  /* Border widths */
  --border-w-1:               1px;

  /* Layout */
  --size-header-h:            56px;
  --size-subbar-h:            44px;
  --size-sidebar-w:           224px;
  --size-sidebar-compact-w:   60px;
  --size-logo-zone-h:         56px;

  /* Page paddings */
  --pad-page-main:            var(--space-7);
  --pad-header-x:             var(--space-7);

  /* Controls */
  --size-control-h:           36px;
  --size-icon-btn:            32px;
  --size-pagination-btn:      28px;

  /* Icons */
  --size-icon-inline:         14px;
  --size-icon-ui:             16px;
  --size-icon-empty:          48px;

  /* Status */
  --size-status-dot:          6px;

  /* Metric icon */
  --size-metric-icon-box:     32px;
  --size-metric-icon:         14px;

  /* Header search */
  --size-search-w:            200px;
  --pad-search-left:          var(--space-8);
  --offset-search-icon-left:  var(--space-3);

  /* Select chevron */
  --offset-select-icon-right: var(--space-3);

  /* Modais */
  --size-modal-w:             420px;
  --size-modal-w-wide:        560px;
  --size-modal-w-compact:     320px;
  --pad-modal-viewport:       var(--space-8);
  --pad-modal-x:              22px;
  --pad-modal-header-top:     18px;
  --pad-modal-header-bottom:  16px;
  --pad-modal-body-y:         var(--space-6);
  --pad-modal-footer-y:       14px;

  /* Tables */
  --pad-table-x:              var(--space-6);
  --pad-th-y:                 var(--space-3);
  --pad-td-y:                 var(--space-4);

  /* Empty states */
  --pad-empty-y:              48px;
  --pad-empty-x:              var(--space-6);

  /* Buttons */
  --pad-btn-primary-x:        14px;
  --pad-btn-secondary-x:      13px;

  /* Badges */
  --pad-badge-y:              2px;
  --pad-badge-x:              9px;
  --pad-badge-count-y:        1px;
  --pad-badge-count-x:        6px;

  /* Progress bar */
  --size-progress-h:          4px;

  /* Auth card */
  --size-auth-card-w:         380px;

  /* Toast */
  --size-toast-w:             320px;

  /* Drawer */
  --size-drawer-w:            480px;

  /* Settings tabs column */
  --size-settings-tabs-w:     200px;

  /* Error pages */
  --size-error-code:          80px;
  --size-error-maxw:          400px;

  /* Avatars */
  --size-avatar-sm:           30px;
  --size-avatar-md:           40px;
  --text-avatar-sm:           11px;
  --text-avatar-md:           14px;
}
```

### 2.7 Tokens de Elevação

```css
:root {
  --shadow-none:    none;
  --shadow-modal:   0 20px 60px rgba(0, 0, 0, 0.12);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-focus:   0 0 0 3px var(--ring-color);
}
```

### 2.8 Tokens de Motion

```css
:root {
  --duration-fast:   100ms;
  --duration-normal: 150ms;
  --duration-slow:   200ms;
  --ease-default:    ease;
  --ease-in-out:     ease-in-out;
}
```

### 2.9 Tokens de Z-Index

```css
:root {
  --z-base:    0;
  --z-raised:  10;
  --z-sticky:  40;
  --z-overlay: 50;
  --z-modal:   100;
  --z-toast:   200;
  --z-tooltip: 300;
}
```

---

## 3. SISTEMA DE LAYOUTS

A aplicação suporta **3 layouts**, seleccionável por utilizador ou
pré-configurado por projecto. A troca de layout **não muda CSS de
componente** — apenas atributos/classes no root.

### 3.1 Atributos de root (aplicados via svelte:body)

```
[data-layout="sidebar"]  | [data-layout="topnav"] | [data-layout="compact"]
[data-theme="light"]     | [data-theme="dark"]
.palette-indigo          | .palette-emerald        | etc.
```

Todos os três aplicados simultaneamente no `<body>` via `<svelte:body>` em
`+layout.svelte`. Aplicados via <svelte:body> em +layout.svelte. Padrão de implementação definido pelo Frontend Builder.

---

### 3.2 LAYOUT: SIDEBAR

- Header: `height: var(--size-header-h)`
- Sidebar: `width: var(--size-sidebar-w)`
- Main: `flex: 1; overflow-y: auto`

Sidebar:
- Background: `var(--bg-surface)`
- Border-right: `var(--border-w-1) solid var(--border-base)`
- Logo zone: `height: var(--size-logo-zone-h)`
- Nav item: `padding: var(--space-nav-y) var(--space-4)`, `border-radius: var(--radius-md)`, `gap: var(--space-3)`
- Active: `background: var(--nav-active-bg)`, `color: var(--nav-active-text)`
- User zone: `border-top: var(--border-w-1) solid var(--border-subtle)`
- Section labels: `font-size: var(--text-2xs)`, `font-weight: var(--weight-bold)`, uppercase, `color: var(--text-xmuted)`

Header (sidebar layout):
- Height: `var(--size-header-h)`
- Background: `var(--bg-surface)`
- Border-bottom: `var(--border-w-1) solid var(--border-base)`
- Padding-x: `var(--pad-header-x)`
- H1: `var(--text-base)`, weight `var(--weight-semibold)`

---

### 3.3 LAYOUT: TOPNAV

Primary bar:
- Height: `var(--size-header-h)`
- Padding-x: `var(--pad-header-x)`
- Background: `var(--bg-surface)`
- Border-bottom: `var(--border-w-1) solid var(--border-base)`
- Nav item: `padding: var(--space-2) var(--space-3)`, radius `var(--radius-sm)`, active bg/text via tokens

Sub-bar:
- Height: `var(--size-subbar-h)`
- Background: `var(--bg-surface)`
- Border-bottom: `var(--border-w-1) solid var(--border-subtle)`
- Padding-x: `var(--pad-header-x)`
- Conteúdo: Page title (esquerda) + actions (direita)

---

### 3.4 LAYOUT: COMPACT

Compact sidebar:
- Width: `var(--size-sidebar-compact-w)`
- Background: `var(--bg-surface)`
- Border-right: `var(--border-w-1) solid var(--border-base)`
- Nav item: icon-only, centered, `padding: var(--space-compact-nav)`, `border-radius: var(--radius-md)`

Regras:
- Labels hidden
- Section labels hidden
- User zone: avatar centrado sem nome/role
- Tooltips: `title="[i18n label]"` obrigatório (acessibilidade nativa)

---

### 3.5 Mobile (< 1024px)

> Breakpoint `1024px` é uma **excepção permitida** (ver Secção 2 — excepções de tokens).

- Sidebar (SIDEBAR/COMPACT) vira off-canvas drawer, aberto por hamburger no header.
- TOPNAV vira hamburger com dropdown.
- Header sticky.
- Main `100vw`.

---

### 3.6 Troca de Paleta / Layout / Tema

Persistência via cookies exclusivamente (nunca localStorage nem sessionStorage). O padrão de implementação do store de preferências (layout/paleta/tema) é definido pelo Frontend Builder seguindo STACK_LOCK.md.padroes_integracao.

Se `USER_THEME_SWITCH = false`, o tema fica fixo em `DEFAULT_THEME`
e a UI de selecção não é gerada. Mesmo assim, `data-theme` é sempre
aplicado no `<body>` com o valor fixo. O mesmo aplica-se a
`USER_LAYOUT_SWITCH` e `USER_PALETTE_SWITCH`.

---

## 4. COMPONENTES

**Regras globais (frontend):**
- Componentes **não** podem conter hex/rgb nem valores em **px** "soltos".
- Componentes **não** podem conter strings de UI (i18n obrigatório).
  Qualquer copy neste documento é **conceptual**; implementação usa `m.*()` (Paraglide).

### 4.1 Botões

Primary:
- `height: var(--size-control-h)`
- `padding: 0 var(--pad-btn-primary-x)`
- `background: var(--brand-600)` / hover `var(--brand-700)`
- `color: var(--text-inverse)`
- `border-radius: var(--radius-md)`
- `gap: var(--space-btn-icon-gap)`

Secondary:
- `height: var(--size-control-h)`
- `padding: 0 var(--pad-btn-secondary-x)`
- `background: var(--bg-surface)` / hover `var(--bg-surface-subtle)`
- `border: var(--border-w-1) solid var(--border-input)` / hover `var(--border-input-hover)`
- `color: var(--text-secondary)`

Icon button:
- `width/height: var(--size-icon-btn)`
- hover bg `var(--bg-surface-subtle)`
- color `var(--text-muted)` → hover `var(--text-secondary)`

Regras:
- Máximo 1 Primary por toolbar/secção.
- Destrutivos: estilo Secondary + `color: var(--status-inactive-text)` + confirmação modal.

---

### 4.2 Inputs e Selects

- Height: `var(--size-control-h)`
- Padding-x: `var(--space-4)`
- Border: `var(--border-w-1) solid var(--border-input)` / hover `var(--border-input-hover)`
- Background: `var(--bg-surface)`
- Text: `var(--text-primary)`
- Focus border: `var(--brand-500)`
- Focus ring: `box-shadow: var(--shadow-focus)`
- Placeholder: `var(--text-xmuted)`

Labels:
- `font-size: var(--text-xs)`, weight `var(--weight-medium)`
- `color: var(--text-secondary)`
- `margin-bottom: var(--space-2)`

Erro:
- `font-size: var(--text-xs)`, `color: var(--status-inactive-text)`
- `margin-top: var(--space-1)`, ícone `var(--size-icon-inline)`

Select:
- `appearance: none`
- chevron: `right: var(--offset-select-icon-right)`

---

### 4.3 Cards de Métricas

- Background: `var(--bg-surface)`
- Border: `var(--border-w-1) solid var(--border-base)`
- Radius: `var(--radius-lg)`
- Padding: `var(--space-6)`
- No shadow

Icon box:
- `width/height: var(--size-metric-icon-box)`, radius `var(--radius-md)`
- icon `var(--size-metric-icon)`, cores via `--metric-*`

Progress bar:
- height: `var(--size-progress-h)`, bg: `var(--bg-surface-subtle)`
- radius: `var(--radius-full)`, fill: token semântico

---

### 4.4 Tabelas

Table card:
- bg: `var(--bg-surface)`, border: `var(--border-w-1) solid var(--border-base)`
- radius: `var(--radius-lg)`, overflow hidden, no shadow

TH:
- padding: `var(--pad-th-y) var(--pad-table-x)`
- `font-size: var(--text-2xs)`, uppercase, tracking wider
- `color: var(--text-muted)`, bg: `var(--bg-table-header)`
- border-bottom: `var(--border-w-1) solid var(--border-subtle)`

TD:
- padding: `var(--pad-td-y) var(--pad-table-x)`
- font-size `var(--text-sm)`, color `var(--text-secondary)`

Row:
- divider via `var(--border-w-1) solid var(--border-subtle)`
- hover bg `var(--bg-surface-hover)`

Footer:
- padding: `var(--pad-td-y) var(--pad-table-x)`
- border-top: `var(--border-w-1) solid var(--border-subtle)`
- font-size `var(--text-xs)`, color `var(--text-muted)`

Empty state:
- icon `var(--size-icon-empty)`, color `var(--text-xmuted)`
- padding: `var(--pad-empty-y) var(--pad-empty-x)`
- título: `var(--text-base)`, `var(--weight-semibold)`, `var(--text-primary)`
- descrição: `var(--text-sm)`, `var(--text-muted)`

---

### 4.5 Badges

Role badge:
- bg/text: `var(--badge-role-bg)` / `var(--badge-role-text)`
- padding: `var(--pad-badge-y) var(--pad-badge-x)`, radius: `var(--radius-full)`
- font-size `var(--text-xs)`

Neutro:
- bg `var(--bg-surface-subtle)`, text `var(--text-secondary)`, padding igual

Count badge (nav):
- bg `var(--brand-600)`, text `var(--text-inverse)`
- padding: `var(--pad-badge-count-y) var(--pad-badge-count-x)`
- font-size `var(--text-2xs)`

---

### 4.6 Avatares

- sm: `var(--size-avatar-sm)`, font `var(--text-avatar-sm)`
- md: `var(--size-avatar-md)`, font `var(--text-avatar-md)`
- radius: `var(--radius-full)`
- bg/text: `var(--avatar-bg)` / `var(--avatar-text)`

---

### 4.7 Status Indicators

- container: inline-flex, gap `var(--space-status-gap)`, font-size `var(--text-xs)`
- dot: `width/height: var(--size-status-dot)`, radius `var(--radius-full)`
- cores: `--status-*-dot` e `--status-*-text`

---

### 4.8 Modais

- backdrop: `var(--bg-overlay)`
- box: bg `var(--bg-surface)`, radius `var(--radius-lg)`, shadow `var(--shadow-modal)`
- width: `var(--size-modal-w)` | wide `var(--size-modal-w-wide)` | compact `var(--size-modal-w-compact)`
- max-width: `calc(100vw - var(--pad-modal-viewport))`

Paddings:
- Header: `padding: var(--pad-modal-header-top) var(--pad-modal-x) var(--pad-modal-header-bottom)`
- Body: `padding: var(--pad-modal-body-y) var(--pad-modal-x)`
- Footer: `padding: var(--pad-modal-footer-y) var(--pad-modal-x)`
- Dividers: `var(--border-w-1) solid var(--border-subtle)`

Regras: sem stacking, click outside fecha, Escape fecha, focus trap obrigatório, destrutivo requer confirmação.

---

### 4.9 Toasts

- position: bottom-right fixed, z-index `var(--z-toast)`, offset `var(--space-7)`
- width: `var(--size-toast-w)`, radius: `var(--radius-lg)`
- shadow: `var(--shadow-popover)`, padding: `var(--space-4) var(--space-5)`
- máx 3 simultâneos (FIFO)

---

### 4.10 Ícones

Única biblioteca: `@lucide/svelte`.
- inline: `var(--size-icon-inline)`, UI: `var(--size-icon-ui)`, empty: `var(--size-icon-empty)`
- Cor: herda ou `var(--text-muted)` / `var(--text-xmuted)`. Nunca hardcoded.

---

### 4.11 Search Input no Header

- width: `var(--size-search-w)`, height: `var(--size-control-h)`
- padding-left: `var(--pad-search-left)`
- border: `var(--border-w-1) solid var(--border-input)`, radius: `var(--radius-md)`
- bg: `var(--bg-surface)`
- icon: left `var(--offset-search-icon-left)`, size `var(--size-icon-inline)`, color `var(--text-xmuted)`

---

## 5. PADRÕES DE PÁGINAS

### 5.1 Auth
- bg: `var(--bg-page)`, sem sidebar/topnav
- card: width `var(--size-auth-card-w)`, padding `var(--space-8)`
- bg `var(--bg-surface)`, border `var(--border-w-1) solid var(--border-base)`, radius `var(--radius-lg)`

### 5.2 Dashboard / Overview
- main padding: `var(--pad-page-main)`
- métricas: grid 4 colunas, gap `var(--space-5)`, margin-bottom `var(--space-6)`
- tabela full width abaixo

### 5.3 List Page
- header: flex between, margin-bottom `var(--space-6)`
- tabela full width com paginação no footer

### 5.4 Detail Page
- drawer de edição: width `var(--size-drawer-w)`, slide da direita

### 5.5 Settings Page
- tabs verticais: width `var(--size-settings-tabs-w)`, estilo idêntico a nav items

### 5.6 Error Pages (404/403/500)
- código: `font-size: var(--size-error-code)`, color `var(--text-muted)`, weight bold
- descrição: max-width `var(--size-error-maxw)`, color `var(--text-muted)`
- CTA: botão Primary (copy via i18n)

---

## 6. FEEDBACK, LOADING E ERROS

- Loading em writes: spinner no botão, `disabled`, sem bloquear página.
- List loading: skeleton rows.
- Success: toast com mensagem específica via i18n.
- Errors: campo inline + toast API; proibidas mensagens genéricas.

---

## 7. ACESSIBILIDADE

- WCAG AA em light e dark.
- Focus ring: `box-shadow: var(--shadow-focus)`.
- Keyboard: navegação e modais completos.
- ARIA: icon buttons com `aria-label`; modais com `role="dialog" aria-modal="true"`.
- `aria-current="page"` no item activo.

---

## 8. ANTI-PATTERNS (HARD STOPS)

| Anti-pattern | Motivo |
|---|---|
| Cores hardcoded (`#...`, `rgb(...)`, `bg-indigo-600`) | Quebra tokens/paletas |
| Valores visuais px soltos em componentes | Quebra contrato de tokens |
| `box-shadow` em cards/tabelas (excepto focus ring) | Viola CLEAN_MINIMAL |
| Modais sobre modais | Proibido |
| Texto inline em componentes | Viola i18n |
| `localStorage` ou `sessionStorage` (qualquer uso) | Proibido — usar cookieStore |
| Tabela/lista sem empty state | UX incompleta |
| Acção destrutiva sem confirmação | Segurança/UX |
| `{@html}` | XSS |
| `outline: none` sem substituto | Acessibilidade |
| Gradientes decorativos | Viola CLEAN_MINIMAL |
| Mistura de bibliotecas de ícones | Inconsistência visual |

---

*Fim do DESIGN.md – GenSpark v2.2.2*
