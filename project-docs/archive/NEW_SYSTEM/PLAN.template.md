# PLAN.md — [NOME DO PROJECTO]
# Propósito: especificação técnica de cada milestone — o que implementar e como verificar
# Responde a: o que tenho de fazer exactamente neste milestone?
# NÃO colocar aqui: estado actual (→ CONTEXT.md), bugs (→ BUGS.md), artefactos criados (→ LOG.md)
# Actualizar: marcar ✅ DONE nos checkpoints; ajustes com nota [delta-NN]

---

## MAPA DE MILESTONES

```
M0  — [Scaffolding / Setup inicial]
M1  — [Milestone 1: ex. Autenticação]
M2  — [Milestone 2: ex. Multi-tenancy]
...
MN  — [Milestone final: ex. QA + E2E]
```

---

## M0 — SETUP INICIAL

**Objectivo:** Projecto funcional, build a passar, estrutura base criada.

### Artefactos a criar
- [ ] `package.json` com engines e scripts
- [ ] Configuração do linter/formatter
- [ ] Configuração TypeScript (strict: true)
- [ ] Configuração de testes
- [ ] `.gitignore` + `.env.example`
- [ ] Estrutura de pastas
- [ ] [outros artefactos específicos da stack]

### Gates M0
```bash
# Todos devem passar antes de declarar M0 DONE
[lint command]     → exit 0
[typecheck command] → exit 0
[build command]    → exit 0
[test command]     → exit 0
```

### Checkpoint M0
```
[ ] Lint: PASS
[ ] TypeScript: PASS
[ ] Build: PASS
[ ] Testes: PASS
```

---

## M1 — [NOME DO MILESTONE]

**Objectivo:** [uma frase clara do que este milestone entrega]

### Schema DB (se aplicável)
```sql
-- [migration file: 000N_nome.sql]
CREATE TABLE [nome] (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  [campo]    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_[nome]_[campo] ON [nome]([campo]);
```

### Ficheiros a criar/modificar
```
[path/ficheiro] — [o que implementa]
[path/ficheiro] — [o que implementa]
```

### Endpoints (se aplicável)
```
GET    [path]           → [resposta esperada]
POST   [path]           → [body aceite] → [resposta esperada]
PUT    [path/:id]       → [body aceite] → [resposta esperada]
DELETE [path/:id]       → [resposta esperada]
```

### Regras de negócio
- [RN-01] [regra]
- [RN-02] [regra]

### Gates M1
```bash
[comandos específicos deste milestone]
```

### Verificações manuais M1
- [ ] [verificação específica — ex: POST com dados inválidos retorna 422]
- [ ] [verificação específica — ex: cookie httpOnly presente após login]
- [ ] [verificação específica — ex: logout invalida sessão em DB]

### Checkpoint M1
```
[ ] Lint: PASS
[ ] TypeScript: PASS
[ ] Build: PASS
[ ] Testes: [N]/[N] PASS
[ ] Smoke test principal: PASS
[ ] Verificações manuais: PASS
```

---

## M2 — [NOME DO MILESTONE]

[repetir estrutura do M1]

---

## MN — QA FINAL (último milestone)

**Objectivo:** Verificação completa de todos os flows críticos.

### Testes E2E (Playwright ou equivalente)
```
F1 — [flow 1: ex. login e dashboard]
F2 — [flow 2: ex. criar empresa + convite]
...
FN — [flow N]
```

### Gates finais
```bash
[comando E2E]          → [N]/[N] PASS
[lighthouse ou equiv.] → LCP/performance checks
[security headers]     → curl -sI [url] → verificar headers
```

### Checkpoint MN (FINAL)
```
[ ] Todos os milestones M0–MN: ✅ DONE
[ ] Testes E2E: [N]/[N] PASS
[ ] Build de produção: PASS
[ ] Deploy prod: PASS
[ ] Security headers: PASS
```

---

## REGRAS IMUTÁVEIS DESTE PROJECTO

[Decisões técnicas que não se alteram sem aprovação explícita]

```yaml
[regra 1]: [valor/decisão]
[regra 2]: [valor/decisão]
```

---

## GATES UNIVERSAIS (aplicar em todos os milestones)

```bash
# Adaptar os comandos à stack do projecto

# G1 — Linting sem erros
[lint command] → exit 0

# G2 — TypeScript sem erros
[tsc command] → exit 0

# G3 — Build sem erros
[build command] → exit 0

# G4 — Testes unitários passam
[test command] → exit 0

# G5 — Zero SQL fora da camada de queries (se aplicável)
grep -rE "SELECT|INSERT|UPDATE|DELETE" [src path] --include="*.ts" | grep -v queries/ → zero

# G6 — Zero secrets hardcoded
grep -rn "password|secret|api_key" [src path] --include="*.ts" | grep -v "test\|mock\|example" → zero resultados reais

# G7 — Zero console.log em produção (se aplicável)
grep -rn "console\.log" [src path] --include="*.ts" | grep -v test → zero
```

---

*Criado: [YYYY-MM-DD] | Stack: [stack id] | Milestones: M0–MN*
