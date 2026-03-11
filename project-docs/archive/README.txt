================================================================================
README.txt — cf-base
Guia de arranque para nova conversa de IA
Versão: 2.0 — estável, não actualizar excepto se a estrutura de docs mudar
================================================================================

O QUE É ESTE PROJECTO
----------------------
cf-base é um boilerplate multi-empresa SaaS 100% Cloudflare.
Permite criar empresas (tenants), gerir equipas com roles hierárquicos,
controlar permissões por módulo, receber notificações e integrar serviços
externos (email, SMS, LLM, pagamentos, etc.).

Stack:   SvelteKit 2 + Svelte 5 + Hono + Cloudflare Workers Static Assets + D1 SQLite
Monorepo: pnpm + turborepo
URL:     https://cf-base.acemang-jedi.workers.dev
GitHub:  https://github.com/JoaoPeixoto72/multi-utilizadores (branch: genspark_ai_developer)
Local:   /home/user/webapp/

COMO USAR O SISTEMA DE DOCS (para IA em nova conversa)
-------------------------------------------------------
Lê nesta ordem exacta — não saltes passos:

  1. KNOWLEDGE.md          (5 min) — estado actual, comandos, regras, endpoints, credenciais
                                      Responde a: onde estou? como opero? o que não fazer?

  2. LESSONS_LEARNED.md    (2 min) — o índice no topo lista todos os bugs por número e milestone
                                      Responde a: que erros foram cometidos? como evitá-los?

  3. BUILD_PLAN.md §MX     (2 min) — ler SÓ a secção do milestone que vais implementar
                                      Responde a: o que tenho de criar exactamente?

  Consultar quando necessário:
  — breifing.md            → roles, hierarquias, regras de negócio (LOCKED)
  — design/tokens.css      → variáveis CSS (fonte de verdade para UI)
  — RUNLOG.md              → artefactos criados por milestone (histórico)
  — TESTS_LOG.md           → testes smoke executados por milestone (histórico)

PROPÓSITO DE CADA DOCUMENTO (regra de não duplicação)
------------------------------------------------------
  KNOWLEDGE.md        → estado actual + comandos + regras + proibições + endpoints
                        ACTUALIZAR: quando milestone muda, versão deploy muda, credencial muda
                        NÃO colocar: plano de tarefas, diagnóstico de bugs, histórico

  BUILD_PLAN.md       → especificação técnica de cada milestone (schema, ficheiros, endpoints)
                        ACTUALIZAR: marcar ✅ DONE no checkpoint; [delta-NN] para ajustes
                        NÃO colocar: comandos operacionais, estado actual, regras de deploy

  RUNLOG.md           → artefactos criados por milestone + gates + deploy + commit
                        ACTUALIZAR: append-only no fim de cada milestone
                        NÃO colocar: bugs, diagnósticos, testes, estado actual

  LESSONS_LEARNED.md  → todos os problemas/bugs encontrados — contexto, causa, solução, regra
                        ACTUALIZAR: quando se encontra e resolve qualquer problema
                        NÃO colocar: estado actual, comandos, artefactos

  TESTS_LOG.md        → smoke tests executados por milestone — endpoint, resultado, data
                        ACTUALIZAR: append-only no fim de cada milestone
                        NÃO colocar: código, diagnósticos, estado

  breifing.md         → contexto do produto, hierarquias, regras de negócio — LOCKED
  design/tokens.css   → tokens CSS canónico — LOCKED (fonte de verdade para UI)

FIM DE MILESTONE — CHECKLIST DE DOCUMENTAÇÃO
---------------------------------------------
No fim de cada milestone, actualizar nesta ordem:

  1. LESSONS_LEARNED.md  → adicionar entradas para bugs encontrados (LL-NN)
  2. TESTS_LOG.md        → adicionar resultados dos smoke tests do milestone
  3. RUNLOG.md           → adicionar entrada com artefactos, gates, deploy, commit
  4. BUILD_PLAN.md       → marcar checkpoint ✅ DONE com gates e versão
  5. KNOWLEDGE.md        → actualizar versão deploy, estado milestone, próximo milestone
  6. git commit + push

================================================================================
