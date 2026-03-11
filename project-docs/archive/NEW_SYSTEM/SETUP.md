# SETUP.md — Como iniciar um novo projecto com este sistema
# Versão: 1.0 — 2026-02-28
# Este ficheiro é um guia de uso — não vai para project-docs/ do projecto

---

## PASSO 1 — Copiar os ficheiros do sistema

```bash
# No novo projecto
mkdir project-docs
cp AGENT.md          project-docs/AGENT.md
cp CONTEXT.template.md  project-docs/CONTEXT.md
cp PLAN.template.md     project-docs/PLAN.md
cp LOG.template.md      project-docs/LOG.md
cp BUGS.template.md     project-docs/BUGS.md
```

Opcional:
```bash
cp SPEC.template.md  project-docs/SPEC.md   # se houver briefing de produto
```

---

## PASSO 2 — Fase de arquitectura (antes de escrever código)

**O agente deve:**

1. Ler o briefing do utilizador (SPEC.md se existir)
2. Fazer as perguntas de arquitectura necessárias — no máximo 5-8 perguntas directas:
   - Stack preferida ou usar padrão?
   - Base de dados: tipo e provider?
   - Autenticação: sessões, OAuth, ou outro?
   - Deploy: onde e como?
   - Módulos: quais as funcionalidades principais?
3. Preencher CONTEXT.md com a stack escolhida e versões locked
4. Escrever PLAN.md com os milestones, schema, endpoints e gates
5. Mostrar o PLAN.md ao utilizador e aguardar aprovação antes de começar a implementar

**O utilizador aprova o PLAN.md.** A partir daqui, o PLAN.md é a fonte de verdade.

---

## PASSO 3 — Execução milestone a milestone

Para cada milestone:

```
1. Ler PLAN.md §MN
2. Implementar os artefactos listados
3. Executar os gates do milestone
4. Se gates passam: marcar ✅ DONE no PLAN.md
5. Actualizar CONTEXT.md (estado do milestone)
6. Adicionar entrada ao LOG.md
7. Registar quaisquer bugs/descobertas no BUGS.md
8. Commit + deploy se aplicável
9. Passar ao MN+1
```

---

## PASSO 4 — Manutenção dos ficheiros de contexto

**CONTEXT.md deve estar sempre actualizado.** É o ficheiro mais importante.
Se estiver desactualizado, a próxima sessão começa com premissas erradas.

Checklist de CONTEXT.md após cada milestone:
- [ ] Estado do milestone marcado (✅/🔄/pending)
- [ ] Último deploy actualizado (versão + data)
- [ ] Credenciais de teste actualizadas (se mudaram)
- [ ] Comandos operacionais actualizados (se mudaram)
- [ ] Diagnóstico rápido actualizado (se novos sintomas encontrados)

**BUGS.md deve crescer com o projecto.** Cada entrada vale mais do que parece —
na próxima sessão, o agente vai ler BUGS.md antes de trabalhar em áreas complexas
e vai evitar repetir os mesmos erros.

---

## SOBRE A QUANTIDADE DE FICHEIROS

O sistema usa 4 ficheiros (CONTEXT, PLAN, LOG, BUGS) mais este AGENT.md.
Cinco ficheiros é o número certo. Mais do que isso e o agente deixa de ler tudo.
Menos do que isso e perde-se contexto importante.

**Por que não juntar tudo num ficheiro só?**
Porque cada ficheiro tem um padrão de acesso diferente:
- CONTEXT.md — lido no início de CADA sessão
- PLAN.md — lido quando se está a implementar um milestone
- LOG.md — lido ocasionalmente para verificar histórico
- BUGS.md — lido quando se encontra um problema parecido com algo passado

Ficheiros separados permitem ao agente ler apenas o que precisa, sem overhead.

---

## SOBRE O QUE NÃO INCLUIR

**Não incluir no AGENT.md:**
- Especificação técnica de stack (vai para CONTEXT.md)
- Lista de todos os packages permitidos/proibidos (vai para CONTEXT.md)
- Design tokens ou mockups (ficheiros separados se necessário)
- Qualquer coisa que seja específica de um projecto

**Não incluir no PLAN.md:**
- Comandos operacionais (vão para CONTEXT.md)
- Bugs e descobertas (vão para BUGS.md)
- Artefactos criados por milestone (vão para LOG.md)

A separação de responsabilidades entre ficheiros é o que torna o sistema funcional.
Se um ficheiro tenta ser tudo, acaba por não servir para nada.

---

## CHECKLIST DE QUALIDADE DO SISTEMA

Antes de começar a implementar, verificar:

- [ ] CONTEXT.md preenchido com stack e versões reais
- [ ] PLAN.md tem milestones com gates executáveis (não aspiracionais)
- [ ] Gates no PLAN.md usam comandos disponíveis no projecto
- [ ] BUGS.md tem pelo menos o template inicial
- [ ] LOG.md tem pelo menos o template inicial
- [ ] AGENT.md está em project-docs/ (para o agente ler na próxima sessão)

---

*Versão 1.0 — 2026-02-28*
