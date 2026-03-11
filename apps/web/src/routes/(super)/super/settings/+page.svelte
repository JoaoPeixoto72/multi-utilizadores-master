<script lang="ts">
  /**
   * (super)/super/settings/+page.svelte — Configurações globais do sistema
   */
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import { themeStore, type Palette } from "$lib/stores/theme.svelte.js";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";
  import fontsData from "$lib/fonts.json";
  import BrandingPreview from "$lib/components/BrandingPreview.svelte";
  import { enhance } from "$app/forms";
  import type { ActionData, PageData } from "./$types";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  let activeTab = $state<"branding" | "design" | "system" | "env">("branding");
  let isSaving = $state(false);

  // Valores iniciais do formulário (preenchidos com appConfig ou defaults do sistema)
  const initialConfig = data.appConfig || {};
  const currentPalette = (initialConfig.ui_theme_palette ||
    data.palette ||
    "indigo") as Palette;
  const brandColor = themeStore.PALETTE_COLORS[currentPalette] || "#4f46e5";

  let config = $state({
    ui_theme_palette: currentPalette,
    ui_theme_secondary: initialConfig.ui_theme_secondary || "slate",
    ui_color_primary: initialConfig.ui_color_primary || brandColor,
    ui_color_secondary: initialConfig.ui_color_secondary || "#64748b",
    ui_color_background: initialConfig.ui_color_background || "#f8fafc",
    ui_color_surface: initialConfig.ui_color_surface || "#ffffff",
    ui_color_action_btn: initialConfig.ui_color_action_btn || brandColor,
    ui_color_action_text: initialConfig.ui_color_action_text || "#ffffff",
    ui_color_warning: initialConfig.ui_color_warning || "#f59e0b",
    ui_color_danger: initialConfig.ui_color_danger || "#dc2626",
    ui_color_link: initialConfig.ui_color_link || brandColor,
    ui_border_radius: initialConfig.ui_border_radius || "lg",
    ui_font_family: initialConfig.ui_font_family || "inter",
    ui_input_border_active: initialConfig.ui_input_border_active ?? "true",
    ui_input_border_color: initialConfig.ui_input_border_color ?? "",
    ui_input_bg_color: initialConfig.ui_input_bg_color ?? "",
    ui_input_padding: initialConfig.ui_input_padding ?? "12px",

    ui_button_radius: initialConfig.ui_button_radius ?? "full",
    ui_button_bg_color: initialConfig.ui_button_bg_color ?? "",
    ui_button_text_color: initialConfig.ui_button_text_color ?? "",

    sys_invite_ttl_seconds: initialConfig.sys_invite_ttl_seconds || "86400",
    sys_temp_owner_ttl_seconds:
      initialConfig.sys_temp_owner_ttl_seconds || "86400",
    sys_email_reset_ttl_seconds:
      initialConfig.sys_email_reset_ttl_seconds || "3600",
    sys_image_max_kb: initialConfig.sys_image_max_kb || "200",
    sys_image_max_px: initialConfig.sys_image_max_px || "512",
  });

  const colorCategories = [
    {
      id: "ui_color_primary",
      label: "Cor Primária",
      hint: "Destaque para botões primários, links principais, tabs ativas.",
    },
    {
      id: "ui_color_secondary",
      label: "Cor Secundária",
      hint: "Cor de suporte para elementos de fundo secundários e bordas subtis.",
    },
    {
      id: "ui_color_background",
      label: "Fundo da Interface Global",
      hint: "Cor de fundo abrangente da Web App.",
    },
    {
      id: "ui_color_surface",
      label: "Fundo das Superfícies/Cards",
      hint: "Fundo dos painéis e blocos na frente.",
    },
    {
      id: "ui_color_action_btn",
      label: "Fundo dos Botões de Ação",
      hint: "Cor de fundo de botões secundários/tabelas (ex: Filtrar, Editar).",
    },
    {
      id: "ui_color_action_text",
      label: "Texto dos Botões de Ação",
      hint: "Cor do texto nos botões de ação.",
    },
    {
      id: "ui_color_warning",
      label: "Avisos / Alertas (Warning)",
      hint: "Laranja/Amarelo dos botões e badges associados a alertas.",
    },
    {
      id: "ui_color_danger",
      label: "Perigo / Apagar (Danger)",
      hint: "Vermelho indicativo de processos destrutivos (Apagar, Suspender).",
    },
    {
      id: "ui_color_link",
      label: "Cor dos Links",
      hint: "Define a cor padrão para texto sublinhado ou texto clicável externo.",
    },
  ] as const;

  const colorPresets = [
    { name: "Indigo", color: "#4f46e5" },
    { name: "Emerald", color: "#059669" },
    { name: "Rose", color: "#e11d48" },
    { name: "Amber", color: "#d97706" },
    { name: "Slate", color: "#475569" },
    { name: "Ocean", color: "#0284c7" },
    { name: "Dark", color: "#111827" },
    { name: "Light", color: "#f9fafb" },
    { name: "White", color: "#ffffff" },
  ];

  const radii = [
    { id: "sm", name: "Suave (sm)" },
    { id: "md", name: "Médio (md)" },
    { id: "lg", name: "Arredondado (lg)" },
    { id: "full", name: "Pílula (full)" },
  ];

  const rapidPresets = [
    {
      id: "original",
      name: "Original (Reset)",
      colors: {
        ui_color_primary: "#4f46e5",
        ui_color_secondary: "#64748b",
        ui_color_background: "#f8fafc",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#4f46e5",
        ui_color_action_text: "#ffffff",
        ui_color_warning: "#f59e0b",
        ui_color_danger: "#dc2626",
        ui_color_link: "#4f46e5",
      },
    },
    {
      id: "modern",
      name: "Moderno",
      colors: {
        ui_color_primary: "#2563eb",
        ui_color_secondary: "#64748b",
        ui_color_background: "#f8fafc",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#2563eb",
        ui_color_action_text: "#ffffff",
        ui_color_warning: "#f59e0b",
        ui_color_danger: "#dc2626",
        ui_color_link: "#2563eb",
      },
    },
    {
      id: "vibrant",
      name: "Vibrante",
      colors: {
        ui_color_primary: "#ec4899",
        ui_color_secondary: "#8b5cf6",
        ui_color_background: "#fdf2f8",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#ec4899",
        ui_color_action_text: "#ffffff",
        ui_color_warning: "#f97316",
        ui_color_danger: "#ef4444",
        ui_color_link: "#ec4899",
      },
    },
    {
      id: "soft",
      name: "Suave",
      colors: {
        ui_color_primary: "#6366f1",
        ui_color_secondary: "#94a3b8",
        ui_color_background: "#f1f5f9",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#f8fafc",
        ui_color_action_text: "#475569",
        ui_color_warning: "#fbbf24",
        ui_color_danger: "#f87171",
        ui_color_link: "#6366f1",
      },
    },
    {
      id: "dark",
      name: "Escuro",
      colors: {
        ui_color_primary: "#818cf8",
        ui_color_secondary: "#94a3b8",
        ui_color_background: "#0f172a",
        ui_color_surface: "#1e293b",
        ui_color_action_btn: "#334155",
        ui_color_action_text: "#f8fafc",
        ui_color_warning: "#fbbf24",
        ui_color_danger: "#f87171",
        ui_color_link: "#818cf8",
      },
    },
    {
      id: "midnight",
      name: "Midnight",
      colors: {
        ui_color_primary: "#8b5cf6",
        ui_color_secondary: "#334155",
        ui_color_background: "#020617",
        ui_color_surface: "#0f172a",
        ui_color_action_btn: "#1e293b",
        ui_color_action_text: "#f1f5f9",
        ui_color_warning: "#f59e0b",
        ui_color_danger: "#e11d48",
        ui_color_link: "#a78bfa",
      },
    },
    {
      id: "nature",
      name: "Natureza",
      colors: {
        ui_color_primary: "#059669",
        ui_color_secondary: "#d97706",
        ui_color_background: "#f0fdf4",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#10b981",
        ui_color_action_text: "#ffffff",
        ui_color_warning: "#fbbf24",
        ui_color_danger: "#ef4444",
        ui_color_link: "#059669",
      },
    },
    {
      id: "corporate",
      name: "Corporativo",
      colors: {
        ui_color_primary: "#1e40af",
        ui_color_secondary: "#475569",
        ui_color_background: "#f8fafc",
        ui_color_surface: "#ffffff",
        ui_color_action_btn: "#1e3a8a",
        ui_color_action_text: "#ffffff",
        ui_color_warning: "#d97706",
        ui_color_danger: "#b91c1c",
        ui_color_link: "#1e40af",
      },
    },
  ];

  function applyPreset(preset: (typeof rapidPresets)[0]) {
    Object.assign(config, preset.colors);
  }
</script>

<div class="page">
  <!-- ── Header ── -->
  <div class="page-header">
    <h1 class="page-title">{m.super_settings_title()}</h1>
  </div>

  {#if form?.success}
    <div
      style="color: var(--status-active-text); font-weight: bold; background: var(--status-success-bg); padding: var(--space-4); border-radius: var(--radius-md);"
    >
      Configurações atualizadas com sucesso. Pode ser necessário recarregar a
      página para o design ser aplicado.
    </div>
  {/if}

  {#if form && "error" in form}
    <div
      style="color: var(--status-inactive-text); font-weight: bold; background: var(--status-error-bg); padding: var(--space-4); border-radius: var(--radius-md);"
    >
      {(form as any).error}
    </div>
  {/if}

  <!-- ── Tabs ── -->
  <div class="tabs-wrapper">
    <div class="tabs" role="tablist">
      <button
        class="tab {activeTab === 'branding' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "branding")}
        role="tab"
        aria-selected={activeTab === "branding"}
      >
        <span class="tab-icon">{@html Icons.palette}</span>
        Identidade Visual
      </button>
      <button
        class="tab {activeTab === 'design' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "design")}
        role="tab"
        aria-selected={activeTab === "design"}
      >
        <span class="tab-icon">{@html Icons.layoutDashboard}</span>
        Estrutura e Fonte
      </button>
      <button
        class="tab {activeTab === 'system' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "system")}
        role="tab"
        aria-selected={activeTab === "system"}
      >
        <span class="tab-icon">{@html Icons.settings}</span>
        Variáveis de Sistema
      </button>
      <button
        class="tab {activeTab === 'env' ? 'tab-active' : ''}"
        onclick={() => (activeTab = "env")}
        role="tab"
        aria-selected={activeTab === "env"}
      >
        <span class="tab-icon">{@html Icons.database}</span>
        {m.super_settings_env_vars()}
      </button>
    </div>
  </div>

  <form
    method="POST"
    use:enhance={() => {
      isSaving = true;
      return async ({ update }) => {
        isSaving = false;
        await update();
      };
    }}
  >
    <input type="hidden" name="_csrf" value={data.csrfToken} />

    <!-- ── TAB: Branding (Advanced Colors) ── -->
    {#if activeTab === "branding"}
      <div class="tab-content">
        <div class="branding-layout">
          <!-- Lateral: Controles -->
          <aside class="branding-controls">
            <div class="controls-card">
              <header class="card-header-minimal">
                <span class="icon">{@html Icons.palette}</span>
                <h3>Paleta de Cores</h3>
              </header>

              <div class="color-inputs-stack">
                {#each colorCategories as cat}
                  <div class="color-field">
                    <div class="field-info">
                      <label for={cat.id}>{cat.label}</label>
                      <span class="hint">{cat.hint}</span>
                    </div>
                    <div class="picker-row">
                      <input
                        id={cat.id}
                        type="color"
                        class="hex-picker"
                        value={(config as any)[cat.id]}
                        oninput={(e) =>
                          ((config as any)[cat.id] = e.currentTarget.value)}
                      />
                      <input
                        type="text"
                        name={cat.id}
                        class="hex-input"
                        bind:value={(config as any)[cat.id]}
                        placeholder="#hex"
                      />
                    </div>
                  </div>
                {/each}
              </div>

              <div class="presets-section">
                <span class="section-label">Presets Rápidos</span>
                <div class="presets-grid">
                  {#each rapidPresets as p}
                    <button
                      type="button"
                      class="preset-btn"
                      onclick={() => applyPreset(p)}
                    >
                      {p.name}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="tips-box">
                <span class="icon">💡</span>
                <div class="tips-content">
                  <strong>Dicas de Leveza:</strong>
                  <ul>
                    <li>Use fundo #FAFAFA ou #F9FAFB (cinza muito claro)</li>
                    <li>Cards sempre brancos ou tons muito claros</li>
                    <li>Sombras: 0 1px 3px rgba(0,0,0,0.1)</li>
                  </ul>
                </div>
              </div>
            </div>
          </aside>

          <!-- Principal: Preview -->
          <main class="branding-preview-area">
            <div class="preview-sticky">
              <div class="preview-header-info">
                <h4>Prévia em Tempo Real</h4>
                <p>
                  Veja como as cores se comportam na interface da plataforma.
                </p>
              </div>
              <BrandingPreview
                colors={{
                  primary: config.ui_color_primary,
                  secondary: config.ui_color_secondary,
                  background: config.ui_color_background,
                  surface: config.ui_color_surface,
                  actionBtn: config.ui_color_action_btn,
                  actionText: config.ui_color_action_text,
                  warning: config.ui_color_warning,
                  danger: config.ui_color_danger,
                }}
                radius={config.ui_border_radius}
              />
            </div>
          </main>
        </div>

        <div class="form-actions-fixed">
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "A guardar..." : "Salvar Identidade Visual"}
          </Button>
        </div>
      </div>
    {/if}

    <!-- ── TAB: Design (Structure) ── -->
    {#if activeTab === "design"}
      <div class="tab-content">
        <section class="section">
          <h2 class="section-title">Estrutura e Fonte</h2>
          <p class="section-desc">
            Configurações de tipografia e formas geométricas da interface.
          </p>

          <div class="card p-6 flex flex-col gap-6">
            <!-- Border Radius -->
            <div class="field-group">
              <label class="field-label" for="ui_border_radius"
                >Arredondamento Padrão (Border-Radius)</label
              >
              <p class="field-hint">
                Define o nível de arredondamento de botões, caixas de texto,
                cartões e diálogos.
              </p>

              <div class="radius-grid">
                {#each radii as r}
                  <label
                    class="radius-option"
                    class:active={config.ui_border_radius === r.id}
                  >
                    <input
                      type="radio"
                      name="ui_border_radius"
                      value={r.id}
                      bind:group={config.ui_border_radius}
                      class="sr-only"
                    />
                    <div
                      class="radius-preview"
                      style="border-radius: var(--radius-{r.id});"
                    >
                      A
                    </div>
                    <span class="radius-name">{r.name}</span>
                  </label>
                {/each}
              </div>
            </div>

            <hr class="divider" />

            <!-- Fonte -->
            <div class="field-group">
              <label class="field-label" for="ui_font_family"
                >Tipografia Global (Google Fonts)</label
              >
              <p class="field-hint">
                Define a fonte primária utilizada na plataforma.
              </p>
              <select
                class="select-field"
                name="ui_font_family"
                bind:value={config.ui_font_family}
              >
                {#each fontsData as font}
                  <option value={font.id}>{font.name}</option>
                {/each}
              </select>
            </div>

            <hr class="divider" />

            <!-- Estilo das Bordas de Input -->
            <div class="field-group">
              <label class="field-label" for="ui_input_border_active"
                >Bordas das Caixas de Texto</label
              >
              <p class="field-hint">
                Se desactivado, as caixas de texto usam apenas a cor de fundo
                simulando um estilo "flat".
              </p>
              <select
                class="select-field"
                name="ui_input_border_active"
                bind:value={config.ui_input_border_active}
              >
                <option value="true">Activo (Com linha de borda)</option>
                <option value="false"
                  >Desactivo (Flat / Background apenas)</option
                >
              </select>
            </div>

            {#if config.ui_input_border_active === "true"}
              <div class="field-group indented">
                <label class="field-label" for="ui_input_border_color"
                  >Cor da Borda (Opcional)</label
                >
                <p class="field-hint">
                  Deixe em branco para usar a cor padrão. Exemplo: #e5e7eb.
                </p>
                <input
                  type="text"
                  name="ui_input_border_color"
                  bind:value={config.ui_input_border_color}
                  placeholder="#e5e7eb"
                  class="input-field"
                />
              </div>
            {/if}

            <div class="field-group">
              <label class="field-label" for="ui_input_bg_color"
                >Cor de Fundo da Caixa de Texto (Opcional)</label
              >
              <input
                type="text"
                name="ui_input_bg_color"
                bind:value={config.ui_input_bg_color}
                placeholder="#ffffff ou transparent"
                class="input-field"
              />
            </div>

            <div class="field-group">
              <label class="field-label" for="ui_input_padding"
                >Espaçamento Interno do Texto (Opcional)</label
              >
              <p class="field-hint">
                Afastamento entre o texto e a borda da caixa. Padrão: 12px.
              </p>
              <input
                type="text"
                name="ui_input_padding"
                bind:value={config.ui_input_padding}
                placeholder="Exemplo: 16px"
                class="input-field"
              />
            </div>
          </div>
        </section>

        <!-- SECÇÃO: Botões -->
        <section class="section">
          <h2 class="section-title">Botões</h2>
          <div class="card p-6 flex flex-col gap-8">
            <div class="field-group">
              <label class="field-label">Arredondamento Padrão de Botões</label>
              <p class="field-hint">
                O nível de border-radius aplicado globalmente aos botões de
                ação.
              </p>
              <div class="radius-grid">
                {#each radii as r}
                  <label
                    class="radius-option"
                    class:active={config.ui_button_radius === r.id}
                  >
                    <input
                      type="radio"
                      name="ui_button_radius"
                      value={r.id}
                      bind:group={config.ui_button_radius}
                      class="sr-only"
                    />
                    <div
                      class="radius-preview"
                      style="border-radius: var(--radius-{r.id}); background-color: {config.ui_button_bg_color ||
                        'var(--brand-500)'}"
                    ></div>
                    <span class="color-name">{r.name}</span>
                  </label>
                {/each}
              </div>
            </div>

            <div class="field-group">
              <label class="field-label" for="ui_button_bg_color"
                >Cor de Fundo Dinâmico (Botões) Opcional</label
              >
              <p class="field-hint">
                Substitui a Paleta de Cores apenas no uso global de Botões.
              </p>
              <input
                type="text"
                name="ui_button_bg_color"
                bind:value={config.ui_button_bg_color}
                placeholder="#2563eb"
                class="input-field"
              />
            </div>

            <div class="field-group">
              <label class="field-label" for="ui_button_text_color"
                >Cor do Texto dos Botões (Opcional)</label
              >
              <p class="field-hint">
                Importante para garantir legibilidade da cor de fundo dinâmica.
              </p>
              <input
                type="text"
                name="ui_button_text_color"
                bind:value={config.ui_button_text_color}
                placeholder="#ffffff"
                class="input-field"
              />
            </div>
          </div>
        </section>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "A guardar..." : "Guardar Design"}
          </Button>
        </div>
      </div>
    {/if}

    <!-- ── TAB: Sistema ── -->
    {#if activeTab === "system"}
      <div class="tab-content">
        <section class="section">
          <h2 class="section-title">Limites Temporais (TTL)</h2>
          <p class="section-desc">
            Define a duração em segundos para as diversas ações expirarem.
          </p>

          <div class="card p-6 flex flex-col gap-6">
            <div class="field">
              <label for="sys_invite_ttl_seconds"
                >Expiração de Convites de Equipa (segundos)</label
              >
              <span class="field-hint"
                >Tempo até um convite pendente ser invalidado. Predefinição:
                86400 (24 horas).</span
              >
              <input
                id="sys_invite_ttl_seconds"
                name="sys_invite_ttl_seconds"
                type="number"
                bind:value={config.sys_invite_ttl_seconds}
                min="3600"
                required
              />
            </div>

            <div class="field">
              <label for="sys_temp_owner_ttl_seconds"
                >Duração da Elevação Temporária a Owner (segundos)</label
              >
              <span class="field-hint"
                >Tempo máximo que um utilizador tem o poder de super
                administrador dentro da empresa. Predefinição: 86400 (24 horas).</span
              >
              <input
                id="sys_temp_owner_ttl_seconds"
                name="sys_temp_owner_ttl_seconds"
                type="number"
                bind:value={config.sys_temp_owner_ttl_seconds}
                min="3600"
                required
              />
            </div>

            <div class="field">
              <label for="sys_email_reset_ttl_seconds"
                >Expiração de Link de Confirmação de Email (segundos)</label
              >
              <span class="field-hint"
                >Tempo para confirmar uma modificação de email no perfil de
                utilizador. Predefinição: 3600 (1 hora).</span
              >
              <input
                id="sys_email_reset_ttl_seconds"
                name="sys_email_reset_ttl_seconds"
                type="number"
                bind:value={config.sys_email_reset_ttl_seconds}
                min="300"
                required
              />
            </div>

            <hr class="divider" />

            <div class="field">
              <label for="sys_image_max_kb"
                >Tamanho limite de Imagens (KB)</label
              >
              <span class="field-hint"
                >Tamanho máximo permitido para upload de imagens (Avatar, Logo).
                Predefinição: 200 KB.</span
              >
              <input
                id="sys_image_max_kb"
                name="sys_image_max_kb"
                type="number"
                bind:value={config.sys_image_max_kb}
                min="50"
                required
              />
            </div>

            <div class="field">
              <label for="sys_image_max_px"
                >Resolução limite de Imagens (Pixeis)</label
              >
              <span class="field-hint"
                >Dimensão (Largura e Altura) máxima redimensionada no cliente
                antes do envio. Predefinição: 512.</span
              >
              <input
                id="sys_image_max_px"
                name="sys_image_max_px"
                type="number"
                bind:value={config.sys_image_max_px}
                min="128"
                required
              />
            </div>
          </div>
        </section>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? "A guardar..." : "Guardar Variáveis Padrão"}
          </Button>
        </div>
      </div>
    {/if}
  </form>

  <!-- ── TAB: Ambiente ── -->
  {#if activeTab === "env"}
    <div class="tab-content">
      <p class="page-desc">
        Configurações intrínsecas ao ambiente (Environment Variables e Secrets
        Cloudflare). Valores de apenas leitura.
      </p>

      <!-- ── Variáveis públicas ── -->
      <section class="section">
        <h2 class="section-title">{m.super_settings_env_vars()}</h2>
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>{m.super_settings_var_col()}</th>
                <th>{m.super_settings_value_col()}</th>
                <th>{m.super_settings_desc_col()}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.publicVars as v}
                <tr>
                  <td><code class="var-key">{v.key}</code></td>
                  <td><span class="var-value">{v.value}</span></td>
                  <td class="td-desc">{v.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Secrets ── -->
      <section class="section">
        <h2 class="section-title">{m.super_settings_secrets()}</h2>
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>{m.super_settings_secret_col()}</th>
                <th>{m.common_status()}</th>
                <th>{m.super_settings_desc_col()}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.secretVars as s}
                <tr>
                  <td><code class="var-key">{s.key}</code></td>
                  <td>
                    <Badge variant={s.configured ? "success" : "destructive"}>
                      {s.configured
                        ? m.super_settings_configured()
                        : m.super_settings_missing()}
                    </Badge>
                  </td>
                  <td class="td-desc">{s.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Serviços Cloudflare ── -->
      <section class="section">
        <h2 class="section-title">{m.super_settings_cf_services()}</h2>
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>{m.super_settings_service_col()}</th>
                <th>{m.super_settings_binding_col()}</th>
                <th>{m.common_status()}</th>
                <th>{m.super_settings_desc_col()}</th>
              </tr>
            </thead>
            <tbody>
              {#each data.cloudflareServices as svc}
                <tr>
                  <td class="td-name">{svc.label}</td>
                  <td><code class="var-key">{svc.binding}</code></td>
                  <td>
                    <Badge variant={svc.active ? "success" : "warning"}>
                      {svc.active
                        ? m.super_settings_active()
                        : m.super_settings_inactive()}
                    </Badge>
                  </td>
                  <td class="td-desc">{svc.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--page-content-max-w);
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }

  .page-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  /* ── Tabs ── */
  .tabs-wrapper {
    border-bottom: 1px solid var(--border-subtle);
  }

  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: -1px;
    overflow-x: auto;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text-primary);
  }

  .tab.tab-active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }

  .tab-icon {
    display: flex;
    align-items: center;
  }

  .tab-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    animation: fadeIn var(--duration-normal) var(--ease-out);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Secções ── */
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-title {
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0;
    padding-bottom: var(--space-4);
    border-bottom: 2px solid var(--border-subtle);
  }

  /* ── Branding Layout ── */
  .branding-layout {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: var(--space-8);
    align-items: flex-start;
  }

  .branding-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .controls-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    box-shadow: var(--shadow-sm);
  }

  .card-header-minimal {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
  }
  .card-header-minimal .icon :global(svg) {
    width: 20px;
    height: 20px;
    color: var(--brand-500);
  }
  .card-header-minimal h3 {
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
  }

  .color-inputs-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .color-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field-info {
    display: flex;
    flex-direction: column;
  }
  .field-info label {
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
  }
  .field-info .hint {
    font-size: 10px;
    color: var(--text-muted);
  }

  .picker-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .hex-picker {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--border-input);
    border-radius: var(--radius-sm);
    cursor: pointer;
    background: transparent;
  }
  .hex-input {
    flex: 1;
    height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-family: monospace;
    color: var(--text-primary);
    background-color: var(--bg-input);
  }

  .presets-section {
    margin-top: var(--space-8);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .presets-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .preset-btn {
    padding: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    background: var(--bg-surface-subtle);
    border: 1px solid var(--border-base);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--duration-fast);
  }
  .preset-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-500);
    color: var(--brand-700);
  }

  .tips-box {
    margin-top: var(--space-8);
    background: var(--brand-50);
    border: 1px solid var(--brand-100);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    display: flex;
    gap: var(--space-3);
  }
  .tips-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .tips-content strong {
    font-size: var(--text-xs);
    color: var(--brand-900);
  }
  .tips-content ul {
    margin: 0;
    padding-left: var(--space-4);
    font-size: 11px;
    color: var(--brand-700);
  }

  .branding-preview-area {
    position: relative;
    padding-top: var(--space-2);
  }

  .preview-sticky {
    position: sticky;
    top: calc(var(--size-header-h) + var(--space-4));
  }

  .preview-header-info {
    margin-bottom: var(--space-4);
  }
  .preview-header-info h4 {
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    margin-bottom: 2px;
  }
  .preview-header-info p {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .form-actions-fixed {
    margin-top: var(--space-10);
    display: flex;
    justify-content: flex-end;
  }

  .section-desc {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Forms e Inputs ── */
  .field-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-label {
    font-weight: var(--weight-semibold);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .field-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .field label {
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }
  .field input {
    height: var(--size-input-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    background-color: var(--bg-input);
    color: var(--text-primary);
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
  }
  .input-field {
    height: var(--size-input-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    background-color: var(--bg-input);
    color: var(--text-primary);
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
    width: 100%;
    max-width: 300px;
  }
  .field input:focus,
  .input-field:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: var(--shadow-focus);
    background-color: var(--bg-surface);
  }

  .select-field {
    height: var(--size-input-h);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-input);
    border-radius: var(--radius-md);
    background-color: var(--bg-input);
    color: var(--text-primary);
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
    max-width: 300px;
  }
  .select-field:focus {
    outline: none;
    border-color: var(--brand-500);
    box-shadow: var(--shadow-focus);
    background-color: var(--bg-surface);
  }

  .indented {
    padding-left: var(--space-4);
    border-left: 2px solid var(--border-subtle);
  }

  .p-6 {
    padding: var(--space-6);
  }
  .flex {
    display: flex;
  }
  .flex-col {
    flex-direction: column;
  }
  .gap-6 {
    gap: var(--space-6);
  }
  .divider {
    border: 0;
    border-top: 1px solid var(--border-subtle);
    margin: 0;
  }

  /* ── Palettes / UI Radio options ── */
  /* Removed unused palette and color-swatch selectors */

  /* ── Radius Grid ── */
  .radius-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-3);
  }

  .radius-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    background-color: var(--bg-surface);
    transition: all var(--duration-fast);
  }

  .radius-option:hover {
    border-color: var(--border-input-hover);
    background-color: var(--bg-hover);
  }

  .radius-option.active {
    border-color: var(--brand-500);
    background-color: var(--nav-active-bg);
    color: var(--nav-active-text);
  }

  .radius-preview {
    width: 48px;
    height: 32px;
    background-color: var(--brand-100);
    border: 1px solid var(--brand-200);
    color: var(--brand-700);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
  }

  .radius-name {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  :global([data-theme="dark"] .radius-option.active) {
    background-color: var(--bg-selected);
  }
  :global([data-theme="dark"] .radius-preview) {
    background-color: var(--border-base);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  /* ── Card / Table (ReadOnly) ── */
  .card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .table th {
    padding: var(--space-3) var(--space-4);
    text-align: left;
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    border-bottom: 1px solid var(--border-subtle);
    background-color: var(--bg-table-header);
  }

  .table td {
    padding: var(--space-3) var(--space-4);
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);
    vertical-align: middle;
  }

  .table tr:last-child td {
    border-bottom: none;
  }

  .td-desc {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .td-name {
    font-weight: var(--weight-medium);
  }

  .var-key {
    font-family: monospace;
    font-size: var(--text-xs);
    background-color: var(--bg-subtle);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
  }

  .var-value {
    font-family: monospace;
    font-size: var(--text-sm);
    color: var(--text-primary);
  }
</style>
