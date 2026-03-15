<script lang="ts">
    /**
     * BrandingPreview.svelte — Um mock interativo que reage às cores escolhidas
     * no menu de configurações globais.
     */
    import { Icons } from "$lib/icons.js";

    interface Props {
        colors: {
            primary: string;
            secondary: string;
            background: string;
            surface: string;
            actionBtn: string;
            actionText: string;
            warning: string;
            danger: string;
            textPrimary?: string;
        };
        radius: string;
    }

    let { colors, radius }: Props = $props();

    const radiusMap: Record<string, string> = {
        sm: "4px",
        md: "8px",
        lg: "12px",
        full: "9999px",
    };

    const r = $derived(radiusMap[radius] || "12px");
    const tp = $derived(colors.textPrimary || "#111827");
</script>

<div
    class="preview-container"
    style:--p={colors.primary}
    style:--s={colors.secondary}
    style:--bg={colors.background}
    style:--surf={colors.surface}
    style:--ab={colors.actionBtn}
    style:--at={colors.actionText}
    style:--w={colors.warning}
    style:--d={colors.danger}
    style:--tp={tp}
    style:--r={r}
>
    <div class="mock-window">
        <!-- Header -->
        <header class="mock-header">
            <div class="mock-left">
                <div class="mock-avatar">A</div>
                <div class="mock-header-text">
                    <span class="mock-title">Dashboard</span>
                    <span class="mock-subtitle">Bem-vindo de volta</span>
                </div>
            </div>
            <div class="mock-header-actions">
                <button class="mock-btn-ghost">Cancelar</button>
                <button class="mock-btn-primary">Nova Ação</button>
            </div>
        </header>

        <!-- Content -->
        <div class="mock-body">
            <!-- Stats -->
            <div class="mock-grid">
                <div class="mock-card stats-card">
                    <div class="icon-box p-bg">
                        {@html Icons.layoutDashboard}
                    </div>
                    <div class="val">R$ 24.500</div>
                    <div class="lbl">Receita Total</div>
                    <div class="trend">+12%</div>
                </div>
                <div class="mock-card stats-card">
                    <div class="icon-box s-bg">{@html Icons.users}</div>
                    <div class="val">1.234</div>
                    <div class="lbl">Novos Usuários</div>
                    <div class="badge-active">Ativo</div>
                </div>
            </div>

            <!-- Quick Settings -->
            <div class="mock-section">
                <h4 class="mock-sec-title">Configurações Rápidas</h4>
                <div class="mock-card list-card">
                    <div class="list-item">
                        <span class="dot p-bg"></span>
                        <span class="text">Notificações por email</span>
                        <div class="mock-toggle active"></div>
                    </div>
                    <div class="list-item">
                        <span class="dot s-bg"></span>
                        <span class="text">Modo escuro automático</span>
                        <div class="mock-toggle"></div>
                    </div>
                </div>
            </div>

            <!-- Alerts -->
            <div class="mock-alert warn">
                <span class="msg"
                    ><b>Atenção necessária:</b> Seu plano expira em 3 dias. Renove
                    agora.</span
                >
            </div>

            <div class="mock-alert error">
                <span class="msg"
                    ><b>Ação irreversível:</b> Ao excluir esta conta, todos os dados
                    serão removidos.</span
                >
                <button class="mock-btn-danger">Excluir</button>
            </div>

            <!-- Form -->
            <div class="mock-section">
                <h4 class="mock-sec-title">Nova Tarefa</h4>
                <div class="mock-card form-card">
                    <div class="mock-field">
                        <span>Título</span>
                        <div class="mock-input">Digite o título...</div>
                    </div>
                    <div class="mock-field">
                        <span>Descrição</span>
                        <div class="mock-input tall">
                            Escreva os detalhes...
                        </div>
                    </div>
                    <div class="mock-form-actions">
                        <button class="mock-btn-action">Criar Tarefa</button>
                        <button class="mock-btn-ghost">Salvar Rascunho</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .preview-container {
        width: 100%;
        background-color: #f1f5f9;
        border-radius: 16px;
        padding: 24px;
        border: 1px dashed #cbd5e1;
        isolation: isolate;
    }

    .mock-window {
        background-color: var(--bg, #f8fafc);
        border-radius: var(--r);
        box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        color: var(--tp, #111827);
        font-family: sans-serif;
        isolation: isolate;
    }

    /* Header */
    .mock-header {
        padding: 16px 20px;
        background-color: var(--surf, #ffffff);
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .mock-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .mock-avatar {
        width: 32px;
        height: 32px;
        background-color: var(--p, #2563eb);
        color: white;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
    }
    .mock-header-text {
        display: flex;
        flex-direction: column;
    }
    .mock-title {
        font-size: 14px;
        font-weight: 700;
    }
    .mock-subtitle {
        font-size: 10px;
        color: #64748b;
    }
    .mock-header-actions {
        display: flex;
        gap: 8px;
    }

    /* Body */
    .mock-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .mock-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .mock-card {
        background-color: var(--surf, #fff);
        border-radius: var(--r);
        padding: 16px;
        border: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
    }

    .stats-card {
        position: relative;
        gap: 4px;
    }
    .icon-box {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
    }
    .icon-box :global(svg) {
        width: 14px;
        height: 14px;
        color: white;
    }
    .p-bg {
        background-color: var(--p);
    }
    .s-bg {
        background-color: var(--s);
    }

    .val {
        font-size: 18px;
        font-weight: 700;
    }
    .lbl {
        font-size: 11px;
        color: #64748b;
        font-weight: 500;
    }
    .trend {
        position: absolute;
        top: 12px;
        right: 12px;
        font-size: 10px;
        color: #d97706;
        background: #fffbeb;
        padding: 2px 6px;
        border-radius: 99px;
        font-weight: 600;
    }
    .badge-active {
        position: absolute;
        top: 12px;
        right: 12px;
        font-size: 10px;
        color: #059669;
        background: #ecfdf5;
        padding: 2px 6px;
        border-radius: 99px;
        font-weight: 600;
    }

    /* Sections */
    .mock-sec-title {
        font-size: 12px;
        font-weight: 600;
        margin: 0 0 10px 0;
        color: #334155;
    }
    .list-card {
        padding: 0;
        overflow: hidden;
    }
    .list-item {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    .list-item:last-child {
        border-bottom: none;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    .text {
        font-size: 12px;
        flex: 1;
        font-weight: 500;
    }
    .mock-toggle {
        width: 32px;
        height: 16px;
        background: #e2e8f0;
        border-radius: 99px;
        position: relative;
    }
    .mock-toggle::after {
        content: "";
        position: absolute;
        left: 2px;
        top: 2px;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
    }
    .mock-toggle.active {
        background: var(--p);
    }
    .mock-toggle.active::after {
        left: auto;
        right: 2px;
    }

    /* Alerts */
    .mock-alert {
        padding: 12px 16px;
        border-radius: var(--r);
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .warn {
        background-color: #fffbeb;
        border: 1px solid #fef3c7;
        color: var(--w, #92400e);
    }
    .error {
        background-color: #fef2f2;
        border: 1px solid #fee2e2;
        color: var(--d, #991b1b);
    }
    .msg {
        flex: 1;
    }

    /* Forms */
    .form-card {
        gap: 12px;
    }
    .mock-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .mock-field span {
        font-size: 10px;
        font-weight: 600;
        color: #475569;
    }
    .mock-input {
        border: 1px solid #e2e8f0;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        color: #94a3b8;
        background: #fcfcfc;
    }
    .tall {
        height: 60px;
    }

    /* Buttons */
    button {
        border: none;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        padding: 8px 14px;
        transition: opacity 0.2s;
        cursor: default;
    }
    .mock-btn-primary {
        background-color: var(--p);
        color: white;
    }
    .mock-btn-ghost {
        background-color: transparent;
        border: 1px solid #e2e8f0;
        color: #64748b;
    }
    .mock-btn-danger {
        background-color: var(--d);
        color: white;
        padding: 4px 10px;
        font-size: 10px;
    }
    .mock-btn-action {
        background-color: var(--ab);
        color: var(--at);
    }

    .mock-form-actions {
        display: flex;
        gap: 8px;
        margin-top: 4px;
    }
</style>
