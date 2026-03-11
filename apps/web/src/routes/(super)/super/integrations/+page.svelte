<script lang="ts">
  /**
   * (super)/super/integrations/+page.svelte — Gestão de integrações (M7)
   *
   * Design inspirado em apps profissionais:
   *  - Cards fixos por provider (sempre visíveis)
   *  - Campo simples de API Key + email (sem JSON)
   *  - Apenas 1 activa por categoria (selector de predefinido)
   *  - Providers organizados por categoria (tabs)
   */
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import type { PageData, ActionData } from "./$types";
  import * as m from "$lib/paraglide/messages.js";
  import { Icons } from "$lib/icons.js";
  import { formatDateISO } from "$lib/format";
  import Button from "$lib/components/ui/Button.svelte";
  import Alert from "$lib/components/ui/Alert.svelte";

  interface Props {
    data: PageData;
    form: ActionData;
  }
  let { data, form }: Props = $props();

  // ── Definição de todos os providers conhecidos ─────────────────────────────
  const PROVIDER_DEFS = [
    // Email
    {
      category: "email",
      provider: "resend",
      label: "Resend",
      initial: "R",
      color: "#000000",
      description: "Envio de emails transacionais. Alta entregabilidade.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "re_xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em resend.com/api-keys",
        },
        {
          name: "from_email",
          label: "Email de envio",
          placeholder: "noreply@dominio.com",
          type: "email",
          hint: "Deve estar verificado no Resend",
        },
      ],
      docsUrl: "https://resend.com/api-keys",
    },
    {
      category: "email",
      provider: "sendgrid",
      label: "SendGrid",
      initial: "S",
      color: "#1A82E2",
      description: "Plataforma de email marketing e transacional.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "SG.xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em app.sendgrid.com/settings/api_keys",
        },
        {
          name: "from_email",
          label: "Email de envio",
          placeholder: "noreply@dominio.com",
          type: "email",
          hint: "Deve estar verificado no SendGrid",
        },
      ],
      docsUrl: "https://app.sendgrid.com/settings/api_keys",
    },
    {
      category: "email",
      provider: "mailgun",
      label: "Mailgun",
      initial: "M",
      color: "#F06B26",
      description: "API de email para developers com logs detalhados.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "key-xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em app.mailgun.com/settings/api_security",
        },
        {
          name: "from_email",
          label: "Email de envio",
          placeholder: "noreply@dominio.com",
          type: "email",
          hint: "Deve estar no domínio verificado no Mailgun",
        },
      ],
      docsUrl: "https://app.mailgun.com/settings/api_security",
    },
    // LLM / IA
    {
      category: "llm",
      provider: "openai",
      label: "OpenAI GPT",
      initial: "O",
      color: "#10A37F",
      description: "Modelos GPT-4o e GPT-4 Turbo da OpenAI.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "sk-proj-xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em platform.openai.com/api-keys",
        },
      ],
      docsUrl: "https://platform.openai.com/api-keys",
    },
    {
      category: "llm",
      provider: "anthropic",
      label: "Anthropic Claude",
      initial: "C",
      color: "#D97757",
      description: "Modelos Claude 3.5 Sonnet e Haiku da Anthropic.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "sk-ant-xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em console.anthropic.com/settings/keys",
        },
      ],
      docsUrl: "https://console.anthropic.com/settings/keys",
    },
    {
      category: "llm",
      provider: "mistral",
      label: "Mistral AI",
      initial: "M",
      color: "#FF7000",
      description: "Modelos Mistral Large e Mixtral eficientes.",
      fields: [
        {
          name: "api_key",
          label: "API Key",
          placeholder: "xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em console.mistral.ai/api-keys",
        },
      ],
      docsUrl: "https://console.mistral.ai/api-keys",
    },
    // Pagamentos
    {
      category: "payments",
      provider: "stripe",
      label: "Stripe",
      initial: "S",
      color: "#635BFF",
      description: "Processamento de pagamentos online global.",
      fields: [
        {
          name: "api_key",
          label: "Secret Key",
          placeholder: "sk_live_xxxxxxxxxxxx",
          type: "password",
          hint: "Obter em dashboard.stripe.com/apikeys",
        },
        {
          name: "webhook_secret",
          label: "Webhook Secret",
          placeholder: "whsec_xxxxxxxxxxxx",
          type: "password",
          hint: "Para verificar eventos de webhook",
        },
      ],
      docsUrl: "https://dashboard.stripe.com/apikeys",
    },
    // SMS
    {
      category: "sms",
      provider: "twilio",
      label: "Twilio",
      initial: "T",
      color: "#F22F46",
      description: "SMS, WhatsApp e comunicações programáticas.",
      fields: [
        {
          name: "account_sid",
          label: "Account SID",
          placeholder: "ACxxxxxxxxxxxxxxxx",
          type: "password",
          hint: "Obter em console.twilio.com",
        },
        {
          name: "auth_token",
          label: "Auth Token",
          placeholder: "xxxxxxxxxxxxxxxxxxxx",
          type: "password",
          hint: "",
        },
        {
          name: "from_number",
          label: "Número de envio",
          placeholder: "+351xxxxxxxxx",
          type: "text",
          hint: "Número Twilio verificado",
        },
      ],
      docsUrl: "https://console.twilio.com",
    },
    // PDF
    {
      category: "pdf",
      provider: "cloudflare_browser",
      label: "Cloudflare Browser",
      initial: "CF",
      color: "#F48120",
      description: "Geração de PDF via Cloudflare Browser Rendering.",
      fields: [
        {
          name: "cf_account_id",
          label: "Account ID",
          placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          type: "password",
          hint: "Cloudflare Dashboard → Overview",
        },
        {
          name: "cf_api_token",
          label: "API Token",
          placeholder: "xxxxxxxxxxxx",
          type: "password",
          hint: "Token com permissão Browser Rendering",
        },
      ],
      docsUrl: "https://developers.cloudflare.com/browser-rendering",
    },
  ] as const;

  type ProviderDef = (typeof PROVIDER_DEFS)[number];

  // ── Categorias com labels ──────────────────────────────────────────────────
  const CATEGORY_LABELS: Record<string, string> = {
    email: "Email",
    sms: "SMS",
    llm: "LLM / IA",
    cloud_storage: "Cloud Storage",
    calendar: "Calendário",
    payments: "Pagamentos",
    invoicing: "Faturação",
    pdf: "PDF",
  };

  // Categorias que têm providers definidos
  const definedCategories = [...new Set(PROVIDER_DEFS.map((p) => p.category))];

  // Tab activa
  let activeTab = $state(definedCategories[0]);

  // ── Helpers para integrations ──────────────────────────────────────────────
  function getIntegration(provider: string) {
    return data.integrations.find((i) => i.provider === provider) ?? null;
  }

  function isConfigured(provider: string) {
    return !!getIntegration(provider);
  }

  function isActive(provider: string) {
    const integ = getIntegration(provider);
    return integ?.is_active === 1;
  }

  function isTested(provider: string) {
    return !!getIntegration(provider)?.tested_at;
  }

  // ── Estado dos formulários inline ─────────────────────────────────────────
  // Mapa: provider → { fieldName: value }
  let formValues = $state<Record<string, Record<string, string>>>({});
  let loadingAction = $state<string | null>(null); // provider ID for loading state

  function getFieldValue(provider: string, field: string): string {
    return formValues[provider]?.[field] ?? "";
  }

  function setFieldValue(provider: string, field: string, value: string) {
    if (!formValues[provider]) formValues[provider] = {};
    formValues[provider][field] = value;
  }

  // ── Feedback global ────────────────────────────────────────────────────────
  let feedback = $state<{
    type: "success" | "error" | "info" | null;
    msg: string;
  }>({ type: null, msg: "" });
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  function showFeedback(
    type: "success" | "error" | "info",
    msg: string,
    ms = 8000,
  ) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedback = { type, msg };
    if (ms > 0)
      feedbackTimer = setTimeout(() => {
        feedback = { type: null, msg: "" };
      }, ms);
  }

  // ── Verify modal ──────────────────────────────────────────────────────────
  let verifyId = $state<string | null>(null);
  let verifyEmailVal = $state("");
  let verifyLoading = $state(false);
  let verifyResult = $state<{
    success: boolean;
    message: string;
    provider: string | null;
  }>({ success: false, message: "", provider: null });

  function openVerify(id: string) {
    verifyId = id;
    verifyEmailVal = "";
    verifyResult = { success: false, message: "", provider: null };
  }
  function closeVerify() {
    verifyId = null;
    verifyLoading = false;
    verifyResult = { success: false, message: "", provider: null };
  }

  // ── Query params (link de confirmação do email) ────────────────────────────
  $effect(() => {
    const confirm = page.url.searchParams.get("confirm");
    const msg = page.url.searchParams.get("msg");
    if (confirm === "ok")
      showFeedback("success", m.super_integration_confirm_ok(), 20000);
    else if (confirm === "error")
      showFeedback(
        "error",
        m.super_integration_confirm_error({ msg: msg ?? "" }),
      );
    else if (confirm === "invalid")
      showFeedback("error", m.super_integration_confirm_invalid());
  });

  function formatDate(iso: string | null) {
    return formatDateISO(iso);
  }

  // Verifica se o formulário do provider está preenchido
  function canSave(def: ProviderDef): boolean {
    return def.fields.every((f) => {
      const val = getFieldValue(def.provider, f.name).trim();
      return val.length > 3;
    });
  }
</script>

<div class="page">
  <!-- ── Header ── -->
  <div class="page-header">
    <h1 class="page-title">{m.super_integrations_title()}</h1>
  </div>

  <!-- Feedback Global -->
  {#if feedback.msg}
    <Alert
      variant={feedback.type === "success" ? "success" : "error"}
      class="feedback-alert"
    >
      <span class="alert-icon" aria-hidden="true" slot="icon">
        {@html feedback.type === "success" ? Icons.check : Icons.x}
      </span>
      {feedback.msg}
      <Button
        variant="ghost"
        size="sm"
        class="alert-close"
        onclick={() => (feedback = { type: null, msg: "" })}
        aria-label={m.common_close()}
      >
        <span aria-hidden="true">{@html Icons.x}</span>
      </Button>
    </Alert>
  {/if}

  <!-- ── Tabs de categoria ── -->
  <div class="tabs-wrapper">
    <nav
      class="tabs"
      role="tablist"
      aria-label={m.super_integration_categories_label()}
    >
      {#each definedCategories as cat}
        {@const catInteg = data.integrations.filter((i) => i.category === cat)}
        {@const hasActive = catInteg.some((i) => i.is_active === 1)}
        {@const hasAny = catInteg.length > 0}
        <button
          role="tab"
          class="tab"
          class:tab-active={activeTab === cat}
          onclick={() => (activeTab = cat)}
          aria-selected={activeTab === cat}
        >
          {CATEGORY_LABELS[cat] ?? cat}
          {#if hasActive}
            <span
              class="tab-dot tab-dot-active"
              title={m.super_integration_has_active()}
            ></span>
          {:else if hasAny}
            <span
              class="tab-dot tab-dot-configured"
              title={m.super_integration_configured()}
            ></span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>

  <!-- ── Grid de providers da categoria activa ── -->
  {#each definedCategories as cat}
    {#if activeTab === cat}
      {@const providersInCat = PROVIDER_DEFS.filter((p) => p.category === cat)}
      {@const activeInCat = data.integrations.find(
        (i) => i.category === cat && i.is_active === 1,
      )}

      <!-- Selector de predefinido (se há mais de 1 provider configurado) -->
      {@const configuredInCat = data.integrations.filter(
        (i) => i.category === cat,
      )}
      {#if configuredInCat.length > 1}
        <div class="default-selector">
          <span class="default-label">Provider predefinido:</span>
          <div class="default-options">
            {#each configuredInCat as integ}
              <form
                method="POST"
                action={integ.is_active === 1 ? "?/deactivate" : "?/activate"}
                use:enhance={() =>
                  async ({ result }) => {
                    if (result.type === "success")
                      showFeedback(
                        "success",
                        integ.is_active === 1
                          ? "Desactivado."
                          : `${integ.provider} definido como activo.`,
                        8000,
                      );
                    else if (result.type === "failure" && result.data)
                      showFeedback(
                        "error",
                        ((result.data as Record<string, unknown>)
                          .error as string) ?? "Erro.",
                      );
                    await invalidateAll();
                  }}
              >
                <input type="hidden" name="id" value={integ.id} />
                <button
                  type="submit"
                  class="radio-btn"
                  class:radio-btn-active={integ.is_active === 1}
                  disabled={!integ.tested_at && integ.is_active === 0}
                >
                  <span
                    class="radio-circle"
                    class:radio-circle-filled={integ.is_active === 1}
                  ></span>
                  {integ.provider}
                </button>
              </form>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Cards dos providers -->
      <div class="providers-grid">
        {#each providersInCat as def}
          {@const integ = getIntegration(def.provider)}
          {@const configured = !!integ}
          {@const active = integ?.is_active === 1}
          {@const tested = !!integ?.tested_at}

          <div
            class="provider-card"
            class:card-configured={configured}
            class:card-active={active}
          >
            <!-- Header do card -->
            <div class="provider-header">
              <span
                class="provider-avatar"
                style="background-color: {def.color};">{def.initial}</span
              >
              <div class="provider-info">
                <span class="provider-name">{def.label}</span>
                <span class="provider-desc">{def.description}</span>
              </div>
              <span
                class="provider-status"
                class:status-active={active}
                class:status-configured={configured && !active}
                class:status-none={!configured}
              >
                {active
                  ? "Activo"
                  : configured
                    ? "Configurado"
                    : "Não configurado"}
              </span>
            </div>

            <!-- Formulário de credenciais (sempre visível) -->
            {#if configured}
              <!-- Já configurado — mostrar estado e opções -->
              <div class="configured-state">
                <div class="cred-info">
                  <span class="cred-icon" aria-hidden="true"
                    >{@html Icons.key}</span
                  >
                  <span>{m.super_integration_api_key_configured()}</span>
                  {#if tested}
                    <span class="tested-tag">
                      <span aria-hidden="true">{@html Icons.check}</span>
                      Testada {formatDate(integ?.tested_at ?? null)}
                    </span>
                  {:else}
                    <span class="untested-tag"
                      >{m.super_integration_untested()}</span
                    >
                  {/if}
                </div>

                <div class="configured-actions">
                  <!-- Testar -->
                  <form
                    method="POST"
                    action="?/test"
                    use:enhance={() => {
                      loadingAction = def.provider;
                      return async ({ result }) => {
                        loadingAction = null;
                        if (result.type === "success" && result.data) {
                          const d = result.data as Record<string, unknown>;
                          const tr = d.testResult as
                            | { ok: boolean; message: string }
                            | undefined;
                          if (tr)
                            showFeedback(
                              tr.ok ? "success" : "error",
                              tr.message,
                              12000,
                            );
                        }
                        await invalidateAll();
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={integ?.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={loadingAction === def.provider}
                    >
                      <span aria-hidden="true">{@html Icons.zap}</span>
                      Testar
                    </Button>
                  </form>

                  <!-- Verificar email (só categoria email) -->
                  {#if def.category === "email"}
                    <Button
                      type="button"
                      variant="secondary"
                      onclick={() => openVerify(integ?.id ?? "")}
                      disabled={loadingAction === def.provider}
                    >
                      <span aria-hidden="true">{@html Icons.mail}</span>
                      Verificar email
                    </Button>
                  {/if}

                  <!-- Activar / Desactivar -->
                  {#if !active}
                    <form
                      method="POST"
                      action="?/activate"
                      use:enhance={() => {
                        loadingAction = def.provider;
                        return async ({ result }) => {
                          loadingAction = null;
                          if (result.type === "success")
                            showFeedback(
                              "success",
                              `${def.label} activado.`,
                              8000,
                            );
                          else if (result.type === "failure" && result.data)
                            showFeedback(
                              "error",
                              ((result.data as Record<string, unknown>)
                                .error as string) ?? "Erro.",
                            );
                          await invalidateAll();
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={integ?.id} />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={!tested || loadingAction === def.provider}
                        title={!tested ? "Teste primeiro" : "Activar"}
                      >
                        <span aria-hidden="true">{@html Icons.play}</span>
                        Activar
                      </Button>
                    </form>
                  {:else}
                    <form
                      method="POST"
                      action="?/deactivate"
                      use:enhance={() => {
                        loadingAction = def.provider;
                        return async () => {
                          loadingAction = null;
                          showFeedback(
                            "info",
                            `${def.label} desactivado.`,
                            6000,
                          );
                          await invalidateAll();
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={integ?.id} />
                      <Button
                        type="submit"
                        variant="warning"
                        disabled={loadingAction === def.provider}
                      >
                        <span aria-hidden="true">{@html Icons.pause}</span>
                        Desactivar
                      </Button>
                    </form>
                  {/if}

                  <!-- Remover -->
                  <form
                    method="POST"
                    action="?/delete"
                    use:enhance={() => {
                      loadingAction = def.provider;
                      return async () => {
                        loadingAction = null;
                        await invalidateAll();
                        showFeedback("info", `${def.label} removido.`, 6000);
                      };
                    }}
                  >
                    <input type="hidden" name="id" value={integ?.id} />
                    <Button
                      type="submit"
                      variant="danger"
                      disabled={loadingAction === def.provider}
                      onclick={(e) => {
                        if (!confirm(`Remover ${def.label}?`))
                          e.preventDefault();
                      }}
                    >
                      <span aria-hidden="true">{@html Icons.trash2}</span>
                      Remover
                    </Button>
                  </form>
                </div>
              </div>
            {:else}
              <!-- Ainda não configurado — mostrar formulário simples -->
              <form
                method="POST"
                action="?/create"
                use:enhance={() => {
                  loadingAction = def.provider;
                  return async ({ result, update }) => {
                    loadingAction = null;
                    await update({ reset: false });
                    if (result.type === "success") {
                      showFeedback(
                        "success",
                        `${def.label} guardado com sucesso!`,
                      );
                      formValues[def.provider] = {};
                      await invalidateAll();
                    } else if (result.type === "failure" && result.data) {
                      showFeedback(
                        "error",
                        ((result.data as Record<string, unknown>)
                          .error as string) ?? "Erro ao guardar.",
                      );
                    }
                  };
                }}
              >
                <input type="hidden" name="category" value={def.category} />
                <input type="hidden" name="provider" value={def.provider} />

                <div class="fields-row">
                  {#each def.fields as field}
                    <div class="field-wrap">
                      <input
                        type={field.type}
                        name={field.name}
                        class="field-input"
                        placeholder={field.placeholder}
                        value={getFieldValue(def.provider, field.name)}
                        oninput={(e) =>
                          setFieldValue(
                            def.provider,
                            field.name,
                            (e.target as HTMLInputElement).value,
                          )}
                        autocomplete="new-password"
                        aria-label={field.label}
                      />
                    </div>
                  {/each}

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!canSave(def) || loadingAction === def.provider}
                  >
                    {#if loadingAction === def.provider}
                      <span class="spinner"></span>
                    {:else}
                      {m.common_save()}
                    {/if}
                  </Button>
                </div>

                <!-- Hints dos campos -->
                <div class="fields-hints">
                  {#each def.fields as field}
                    {#if field.hint}
                      <span class="field-label-hint"
                        >{field.label}: {field.hint}</span
                      >
                    {/if}
                  {/each}
                </div>

                <!-- Link para obter API key -->
                <a
                  href={def.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="docs-link"
                >
                  <span aria-hidden="true">{@html Icons.externalLink}</span>
                  {m.common_get_api_key()}
                </a>
              </form>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/each}
</div>

<!-- ── Modal: Verificar email ── -->
{#if verifyId !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={closeVerify}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal" onclick={(e) => e.stopPropagation()} role="document">
      <div class="modal-header">
        <h3 class="modal-title">
          <span aria-hidden="true">{@html Icons.mail}</span>
          {m.super_integration_verify_title()}
        </h3>
        <button
          class="modal-close"
          onclick={closeVerify}
          aria-label={m.common_close()}
        >
          <span aria-hidden="true">{@html Icons.x}</span>
        </button>
      </div>
      <div class="modal-body">
        <p>{m.super_integration_verify_body()}</p>
        <form
          method="POST"
          action="?/verify"
          use:enhance={() => {
            verifyLoading = true;
            return async ({ result }) => {
              verifyLoading = false;
              if (result.type === "success" && result.data) {
                const d = result.data as Record<string, unknown>;
                if (d.verifySuccess) {
                  verifyResult = {
                    success: true,
                    message: d.verifySuccess as string,
                    provider: null,
                  };
                  showFeedback("success", d.verifySuccess as string, 20000);
                } else if (d.verifyError) {
                  verifyResult = {
                    success: false,
                    message: d.verifyError as string,
                    provider: d.provider as string,
                  };
                  showFeedback("error", d.verifyError as string, 12000);
                }
              } else if (result.type === "failure" && result.data) {
                verifyResult = {
                  success: false,
                  message:
                    ((result.data as Record<string, unknown>)
                      .verifyError as string) ?? "Erro ao enviar.",
                  provider: (result.data as Record<string, unknown>)
                    .provider as string,
                };
                showFeedback(
                  "error",
                  ((result.data as Record<string, unknown>)
                    .verifyError as string) ?? "Erro ao enviar.",
                  12000,
                );
              }
            };
          }}
        >
          <input type="hidden" name="id" value={verifyId} />
          <div class="modal-field">
            <label for="verify-email-input"
              >{m.common_email_destination()}</label
            >
            <input
              id="verify-email-input"
              type="email"
              name="verify_email"
              bind:value={verifyEmailVal}
              placeholder={m.team_invite_email_placeholder()}
              required
              autofocus
            />
          </div>
          <div class="modal-actions">
            <Button type="button" variant="outline" onclick={closeVerify}>
              {m.common_close()}
            </Button>
            {#if !verifyResult.success}
              <Button
                type="submit"
                variant="primary"
                disabled={verifyLoading || !verifyEmailVal.includes("@")}
              >
                {#if verifyLoading}<span class="spinner"></span>
                  {m.common_sending()}{:else}{m.common_send_verification()}{/if}
              </Button>
            {:else}
              <Button
                type="button"
                variant="secondary"
                onclick={(e) => {
                  closeVerify();
                }}
              >
                {m.common_close()}
              </Button>
            {/if}
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ── */
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: var(--page-content-max-w);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    margin: 0;
  }

  /* ── Alertas ── */
  .alert {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    border: 1px solid transparent;
  }
  .alert-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .alert-icon svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .alert-msg {
    flex: 1;
  }
  .alert-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0.5;
    border-radius: var(--radius-sm);
    color: inherit;
    transition: opacity var(--duration-fast);
  }
  .alert-close:hover {
    opacity: 1;
  }
  .alert-close svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .alert-success {
    background-color: var(--badge-success-bg);
    color: var(--badge-success-text);
    border-color: color-mix(
      in srgb,
      var(--badge-success-text) 20%,
      transparent
    );
  }
  .alert-info {
    background-color: var(--badge-info-bg);
    color: var(--badge-info-text);
    border-color: color-mix(in srgb, var(--badge-info-text) 20%, transparent);
  }

  /* ── Tabs (underline style) ── */
  .tabs-wrapper {
    border-bottom: 1px solid var(--border-subtle);
  }

  .tabs {
    display: flex;
    gap: 0;
    flex-wrap: wrap;
    margin-bottom: -1px;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text-primary);
    border-bottom-color: var(--border-subtle);
  }

  .tab.tab-active {
    color: var(--text-primary);
    border-bottom-color: var(--text-primary);
    font-weight: var(--weight-semibold);
  }

  .tab-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tab-dot-active {
    background-color: var(--badge-success-text);
  }
  .tab.tab-active .tab-dot-active {
    background-color: var(--badge-success-text);
  }

  .tab-dot-configured {
    background-color: var(--badge-warning-text);
  }
  .tab.tab-active .tab-dot-configured {
    background-color: var(--badge-warning-text);
  }

  /* ── Selector de predefinido ── */
  .default-selector {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    flex-wrap: wrap;
  }

  .default-label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .default-options {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .radio-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
    background: none;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .radio-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .radio-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .radio-btn-active {
    background-color: var(--badge-success-bg);
    color: var(--badge-success-text);
    border-color: var(--badge-success-text);
  }

  .radio-circle {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid currentColor;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .radio-circle-filled::after {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    display: block;
  }

  /* ── Grid de providers ── */
  .providers-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* ── Provider card ── */
  .provider-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    transition: border-color var(--duration-fast);
  }

  .card-active {
    border-color: color-mix(in srgb, #16a34a 40%, transparent);
    background-color: color-mix(in srgb, #16a34a 3%, var(--bg-surface));
  }

  /* ── Header do card ── */
  .provider-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .provider-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    flex-shrink: 0;
    letter-spacing: -0.5px;
  }

  .provider-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .provider-name {
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
  }

  .provider-desc {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .provider-status {
    display: inline-flex;
    align-items: center;
    padding: 3px var(--space-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    flex-shrink: 0;
  }

  .status-active {
    background: var(--badge-success-bg);
    color: var(--badge-success-text);
  }
  .status-configured {
    background: var(--badge-info-bg);
    color: var(--badge-info-text);
  }
  .status-none {
    background: var(--bg-subtle);
    color: var(--text-secondary);
  }

  /* ── Estado configurado ── */
  .configured-state {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .cred-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    flex-wrap: wrap;
  }

  .cred-icon {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  .tested-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--text-xs);
    color: var(--badge-success-text);
  }

  .tested-tag svg {
    width: 11px;
    height: 11px;
    stroke: currentColor;
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .untested-tag {
    font-size: var(--text-xs);
    color: #ca8a04;
    background: #fef9c3;
    padding: 1px var(--space-2);
    border-radius: var(--radius-full);
  }

  .configured-actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  /* ── Botões de acção ── */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
    background: none;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition: all var(--duration-fast);
    white-space: nowrap;
  }

  .action-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }
  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .action-btn svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  .action-btn-positive {
    color: var(--badge-success-text);
    border-color: var(--badge-success-bg);
  }
  .action-btn-positive:hover {
    background: var(--badge-success-bg);
  }

  .action-btn-warn {
    color: var(--badge-warning-text);
    border-color: var(--badge-warning-bg);
  }
  .action-btn-warn:hover {
    background: var(--badge-warning-bg);
  }

  .action-btn-danger {
    color: var(--badge-error-text);
    border-color: var(--badge-error-bg);
  }
  .action-btn-danger:hover {
    background: var(--badge-error-bg);
  }

  /* ── Formulário inline (não configurado) ── */
  form {
    display: contents;
  }

  .fields-row {
    display: flex;
    gap: var(--space-2);
    align-items: stretch;
    flex-wrap: wrap;
  }

  .field-wrap {
    flex: 1;
    min-width: 180px;
  }

  .field-input {
    width: 100%;
    height: var(--size-btn-h-md);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background-color: var(--bg-page);
    color: var(--text-primary);
    font-size: var(--text-sm);
    outline: none;
    box-sizing: border-box;
    transition:
      border-color var(--duration-fast),
      box-shadow var(--duration-fast);
  }

  .field-input:focus {
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-100);
  }

  .save-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 0 var(--space-5);
    height: var(--size-input-h);
    border-radius: var(--radius-full);
    background-color: var(--text-primary);
    color: var(--bg-surface);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    border: none;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity var(--duration-fast);
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  .save-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .fields-hints {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: calc(-1 * var(--space-2));
  }

  .field-label-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .docs-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--text-xs);
    color: var(--brand-600);
    text-decoration: none;
    font-weight: var(--weight-medium);
    transition: color var(--duration-fast);
  }

  .docs-link:hover {
    color: var(--brand-700);
    text-decoration: underline;
  }

  .docs-link svg {
    width: 11px;
    height: 11px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Spinner ── */
  .spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }

  .modal {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 460px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .modal-title svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex-shrink: 0;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    transition: background var(--duration-fast);
  }
  .modal-close:hover {
    background: var(--bg-hover);
  }
  .modal-close svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .modal-body {
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .modal-body > p {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .modal-field label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--text-secondary);
  }

  .modal-field input {
    height: var(--size-btn-h-md);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background-color: var(--bg-page);
    color: var(--text-primary);
    font-size: var(--text-sm);
    outline: none;
    box-sizing: border-box;
    transition:
      border-color var(--duration-fast),
      box-shadow var(--duration-fast);
  }

  .modal-field input:focus {
    border-color: var(--brand-500);
    box-shadow: 0 0 0 3px var(--brand-100);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--pad-btn-y) var(--pad-btn-x);
    border-radius: var(--radius-full);
    background-color: var(--text-primary);
    color: var(--bg-surface);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    border: none;
    cursor: pointer;
    transition: opacity var(--duration-fast);
  }
  .btn-primary:hover:not(:disabled) {
    opacity: 0.88;
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--pad-btn-x);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
    background: none;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition: background var(--duration-fast);
  }
  .btn-outline:hover {
    background: var(--bg-hover);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .fields-row {
      flex-direction: column;
    }
    .provider-header {
      flex-wrap: wrap;
    }
  }
</style>
