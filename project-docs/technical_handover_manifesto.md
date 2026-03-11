# Manifesto de Transição Técnica — Projeto: Multi-Utilizadores Genspark

Este documento serve como guia mestre para qualquer IA ou equipa de engenharia que assuma o desenvolvimento desta aplicação. Contém a lógica estrutural e as decisões de design que sustentam o sistema.

## 1. Stack Tecnológica
*   **Frontend**: SvelteKit com **Svelte 5 (Runes)**. Uso intensivo de `$state`, `$derived` e `$effect`.
*   **Backend**: **Hono** (executado em Cloudflare Workers).
*   **Base de Dados**: **Cloudflare D1** (SQLite) com **Drizzle ORM**.
*   **Internacionalização**: **Paraglide-js** (geração de mensagens tipo-seguras).
*   **Estilização**: **Vanilla CSS puro**. Baseado em "Design Tokens" e variáveis CSS reativas.

## 1.1 Arquitetura Monorepo
O projeto utiliza uma estrutura de **Monorepo** (gerida por **TurboRepo** e **pnpm workspaces**), o que facilita a partilha de tipos e configurações entre o frontend e o backend:
*   `apps/web`: Aplicação SvelteKit (Frontend).
*   `apps/api`: Servidor Hono (API/Backend).
*   `packages/*`: (Opcional) Pacotes partilhados de lógica ou UI.

## 2. Arquitetura e Segurança
*   **Multi-Tenancy**: Isolamento de dados via `tenant_id`. Todo o acesso nas rotas `/admin/*` é validado contra o tenant do utilizador.
*   **Autenticação**: Baseada em Sessões (Hono cookies). Sem JWT no cliente para máxima segurança.
*   **Configuração Global**: Uma tabela `app_config` guarda as preferências de branding que afectam todos os utilizadores (Cores, Fontes, Border-Radius).

## 3. Sistema de Design (O Coração da UI)
*   **Sem Tailwind**: O projeto evita utilitários de CSS atómicos em favor de um sistema de tokens semânticos em `src/app.css`.
*   **Branding Dinâmico**: As cores personalizadas configuradas no painel SuperAdmin são injetadas via `:root` no `+layout.svelte`.
*   **Layouts**: Suporta três modos principais: `sidebar` (clássico), `compact` (barra lateral ícones) e `topnav` (horizontal).
*   **Temas**: Suporte nativo para **Dark/Light mode** via atributo `data-theme` no `body`.

## 4. Ficheiros Críticos (Devem ser lidos primeiro)
1.  `STACK_LOCK.md`: A "Constituição" do projeto. Contém as regras proibitivas e decisões de engenharia permanentes.
2.  `BUILD_PLAN.md`: O roteiro de funcionalidades implementadas e futuras.
3.  `src/lib/stores/theme.svelte.ts`: Gere o estado reativo da interface (layout, paleta, tema).
4.  `src/routes/+layout.svelte`: Onde a "magia" da injeção de cores e fontes acontece.
5.  `src/routes/(super)/super/settings/+page.svelte`: O centro de controlo de Branding com o preview em tempo real.

## 5. Instruções para a IA
*   **Prioridade Visual**: Qualquer nova funcionalidade deve seguir a estética premium iniciada (glassmorphism, micro-animações, cores harmoniosas).
*   **Não quebrar a reatividade**: Ao modificar estilos, usa sempre as variáveis CSS existentes (`--brand-500`, `--bg-surface`, etc.).
*   **Segurança Primeiro**: Nunca exponhas segredos de ambiente no cliente. Usa as rotas de API do Hono.

---
*Gerado por Antigravity (Advanced Agentic Coding @ Google Deepmind)*
*Última Validação Técnica: Março de 2026 — Stack confirmada como estável e topo de gama para Cloudflare Workers.*
