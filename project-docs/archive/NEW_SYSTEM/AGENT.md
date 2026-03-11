# AGENT.md
# Sistema de trabalho para projectos de software com IA
# Versão: 1.0 — 2026-02-28
# Baseado em: experiência real de execução do projecto cf-base (M0–M15)
#
# COMO USAR:
#   1. Coloca este ficheiro em project-docs/ de cada novo projecto
#   2. No início de cada sessão, o agente lê: AGENT.md → CONTEXT.md → PLAN.md
#   3. Os outros ficheiros (LOG.md, BUGS.md) são consultados quando necessário
#   4. Tudo é agnóstico de stack — preenches CONTEXT.md para o teu projecto

---

## 1. PRINCÍPIOS DE TRABALHO

**Lê os ficheiros antes de escrever código.**
No início de cada sessão: CONTEXT.md primeiro, depois PLAN.md. Se existir LOG.md, ler
a última entrada. Se existir BUGS.md, verificar se há bugs abertos relevantes ao trabalho
actual. Nunca assumir o estado do projecto sem ler.

**Um milestone de cada vez.**
Executar o milestone actual do PLAN.md até ao fim antes de avançar. Marcar ✅ DONE
no checkpoint antes de passar ao seguinte. Se o milestone falhar a meio, registar o
ponto de paragem no LOG.md e não avançar.

**Verificar antes de declarar concluído.**
Qualquer milestone declarado como DONE deve ter passado os gates definidos no PLAN.md
para esse milestone. "Parece funcionar" não é suficiente. Executar os comandos de
verificação e registar o resultado.

**Actualizar os ficheiros de contexto.**
No fim de cada milestone: actualizar CONTEXT.md (estado actual), adicionar entrada ao
LOG.md, adicionar quaisquer novos bugs/descobertas ao BUGS.md. Não deixar os ficheiros
desactualizados — a próxima sessão depende deles.

**Registar o que falhou, não só o que funcionou.**
BUGS.md é append-only e permanente. Cada bug documentado evita repetir o mesmo erro.
O valor do BUGS.md cresce com o projecto — não é overhead, é memória.

---

## 2. FICHEIROS DO SISTEMA (criar no início de cada projecto)

```
project-docs/
├── AGENT.md        ← este ficheiro (copiar para cada projecto)
├── CONTEXT.md      ← estado actual + comandos operacionais (actualizar sempre)
├── PLAN.md         ← especificação técnica por milestone (fonte de verdade do que fazer)
├── LOG.md          ← registo append-only de artefactos + gates + deploys por milestone
├── BUGS.md         ← registo append-only de bugs, descobertas e regras de prevenção
└── SPEC.md         ← (opcional) briefing do produto / requisitos imutáveis
```

**Propósito de cada ficheiro:**
- `CONTEXT.md` — responde a "onde estou agora?". Stack, versões, URLs, credenciais de teste,
  comandos de build/deploy, estado de cada milestone, último deploy.
- `PLAN.md` — responde a "o que tenho de implementar?". Milestones com schema, ficheiros,
  endpoints, regras de negócio, gates de verificação. Não muda a não ser com aprovação.
- `LOG.md` — responde a "o que foi feito?". Entrada por milestone: artefactos criados,
  gates passados, versão deployada, commit. Append-only.
- `BUGS.md` — responde a "o que pode correr mal?". Entrada por bug: contexto, causa,
  solução, regra de prevenção. Append-only. Sem índice — os headings bastam.
- `SPEC.md` — opcional. Requisitos de produto, briefing, decisões imutáveis. Não muda.

---

## 3. REGRAS DE ESCRITA DOS FICHEIROS

### CONTEXT.md
- Actualizar no início e no fim de cada milestone
- Contém SEMPRE: stack exacta com versões, URLs de produção, credenciais de teste,
  comandos exactos de build/deploy/migrations, estado de cada milestone (✅/🔄/pending),
  último deploy (versão + data), ficheiros de configuração críticos
- NÃO contém: histórico (→ LOG.md), bugs (→ BUGS.md), especificação (→ PLAN.md)
- Formato: secções numeradas, comandos em blocos de código, tabelas para listas curtas

### PLAN.md
- Criado na fase de arquitectura, antes do primeiro milestone
- Contém: mapa de milestones, e por cada milestone: objectivo, schema DB (se aplicável),
  ficheiros a criar, endpoints com método+path+resposta, regras de negócio, gates de
  verificação obrigatórios
- Gates por milestone são específicos — não uma lista genérica de 20
- Marcar ✅ DONE no checkpoint de cada milestone quando concluído
- Ajustes técnicos permitidos com nota [delta-NN] para rastrear o que mudou

### LOG.md
- Entrada por milestone, append-only
- Contém: artefactos criados/modificados (lista), gates passados, versão deployada,
  commit hash, migrations aplicadas
- NÃO contém: bugs (→ BUGS.md), estado actual (→ CONTEXT.md), código
- Uma linha por artefacto — sem prosa desnecessária

### BUGS.md
- Entrada por bug, append-only, formato ### BUG-NN — [título] — [data]
- Contém: milestone, contexto (o que estava a fazer), sintoma (o que foi observado),
  causa raiz (porquê aconteceu), solução aplicada (o que foi feito), regra de prevenção
- SEM índice — é overhead de manutenção. Os headings são navegáveis directamente.
- Documentar QUALQUER descoberta relevante — não só bugs críticos

---

## 4. PROTOCOLO DE INÍCIO DE SESSÃO

```
1. Ler CONTEXT.md — identificar milestone actual e estado
2. Ler PLAN.md — ler a especificação do milestone actual
3. Se LOG.md existir — ler a última entrada para verificar ponto de paragem
4. Se BUGS.md existir e o trabalho actual for complexo — ler as últimas entradas
5. Confirmar com o utilizador: "Estou no milestone MX. Vou [acção]. Continuar?"
   (omitir se o utilizador já deu instrução clara)
```

Nunca começar a escrever código sem ter feito os passos 1 e 2.

---

## 5. PROTOCOLO DE FIM DE MILESTONE

```
1. Executar os gates definidos no PLAN.md para este milestone
2. Registar resultado de cada gate (PASS/FAIL) — sem fingir PASS
3. Se algum gate falhar: resolver antes de declarar DONE
4. Actualizar CONTEXT.md: marcar milestone ✅ DONE, actualizar versão deploy
5. Adicionar entrada ao LOG.md
6. Adicionar quaisquer novos bugs/descobertas ao BUGS.md
7. Fazer commit com mensagem descritiva
8. Deploy se aplicável — registar versão no CONTEXT.md
```

---

## 6. GATES — FILOSOFIA

Os gates devem ser **executáveis no ambiente do projecto** sem instalar ferramentas
extra. Gates que requerem ferramentas não disponíveis (semgrep, gitleaks, lighthouse)
são aspiracionais — listar como "recomendados" mas não bloquear o milestone por eles.

Gates obrigatórios mínimos (adaptar à stack):
- Linting/formatação sem erros
- TypeScript sem erros (se TypeScript)
- Build sem erros
- Testes unitários passam
- Smoke test do endpoint/funcionalidade principal do milestone

Gates específicos por milestone são mais úteis do que uma lista genérica de 20 gates
aplicada a todos os milestones. Definir no PLAN.md quais gates se aplicam a cada M.

---

## 7. DESCOBERTAS SOBRE IA E CONTEXTO

Estas são observações reais sobre como o agente perde contexto e como prevenir:

**A maior causa de perda de contexto é não ler os ficheiros no início da sessão.**
O remédio é o protocolo de início de sessão (secção 4). Se o agente não leu CONTEXT.md,
vai assumir coisas erradas sobre versões, paths, endpoints e estado.

**Ficheiros demasiado longos são ignorados parcialmente.**
CONTEXT.md deve caber numa leitura — idealmente < 400 linhas. Se crescer muito,
fazer limpeza: mover histórico para LOG.md, remover secções obsoletas.

**Gates irrealistas geram alucinações.**
Se um gate diz "semgrep --config=auto deve dar exit 0" mas semgrep não está instalado,
o agente vai ou ignorar o gate ou inventar que passou. Definir apenas gates que se
conseguem executar.

**Nomes de ficheiros com propósito explícito no header previnem confusão.**
Cada ficheiro começa com: propósito, o que NÃO colocar aqui, quando actualizar.
Isso evita que o agente coloque bugs no LOG, estado no PLAN, etc.

**Feedback loops curtos são melhores que planos perfeitos.**
Um milestone pequeno com gates reais é melhor que um milestone grande com gates
aspiracionais. Se algo corre mal num milestone pequeno, é fácil de corrigir. Se
corre mal num milestone grande, o custo de reversão é alto.

**O agente não mantém estado entre sessões — os ficheiros são o estado.**
Tudo o que o agente precisar de saber na próxima sessão tem de estar nos ficheiros.
"O utilizador sabe" não é suficiente. Documentar sempre.

---

## 8. SOBRE SYSTEM PROMPTS ELABORADOS

O sistema original tinha um system prompt de 400 linhas com 4 "facetas" (Architect,
Builder Frontend, Builder Backend, Verifier), 20 gates automáticos e 15 verificações
manuais. Na prática:

- As facetas não foram seguidas — o agente faz tudo numa só sessão
- Muitos gates foram marcados como PASS sem serem executados
- O "Verifier" nunca emitiu um relatório formal
- O system prompt não foi relido a meio do projecto

**Conclusão:** um system prompt longo não substitui ficheiros de contexto actualizados.
O agente lê os ficheiros de contexto em cada sessão. O system prompt é lido uma vez
e esquecido. Portanto: ficheiros de contexto ricos > system prompt elaborado.

Este AGENT.md é intencionalmente curto. O seu valor está em ser lido e seguido,
não em ser exaustivo.

---

*Versão 1.0 — criado após execução completa do projecto cf-base (M0–M15, 26 bugs documentados)*
