# LOG.md — [NOME DO PROJECTO]
# Propósito: registo append-only de artefactos criados, gates passados e deploys por milestone
# Responde a: o que foi feito e quando?
# NÃO colocar aqui: estado actual (→ CONTEXT.md), bugs (→ BUGS.md), especificação (→ PLAN.md)
# Actualizar: no fim de cada milestone, antes de avançar para o seguinte

---

## M0 — [NOME] — [YYYY-MM-DD]

**Artefactos criados:**
- `[path/ficheiro]` — [o que faz]
- `[path/ficheiro]` — [o que faz]

**Gates:**
```
[G1: lint]        ✅ PASS
[G2: typecheck]   ✅ PASS
[G3: build]       ✅ PASS
[G4: testes]      ✅ [N]/[N] PASS
```

**Migrations aplicadas:** nenhuma | `[000N_nome.sql]` (local + prod)

**Deploy:** — | versão `[hash]` em `[URL]`

**Commit:** `[hash curto]` — `[mensagem]`

---

## M1 — [NOME] — [YYYY-MM-DD]

**Artefactos criados/modificados:**
- `[path/ficheiro]` — [o que faz]

**Artefactos modificados:**
- `[path/ficheiro]` — [o que mudou]

**Gates:**
```
[G1: lint]        ✅ PASS
[G2: typecheck]   ✅ PASS
[G3: build]       ✅ PASS
[G4: testes]      ✅ [N]/[N] PASS
[verificação M1]  ✅ PASS
```

**Migrations:** `[000N_nome.sql]` aplicada (local + prod)

**Deploy:** versão `[hash]` em `[URL]`

**Commit:** `[hash]` — `[mensagem]`

---

[repetir por cada milestone]
