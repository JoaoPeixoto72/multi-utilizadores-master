# CONTEXT.md — [NOME DO PROJECTO]
# Propósito: estado actual + comandos operacionais + stack + credenciais de teste
# Responde a: onde estou agora? como opero? qual é a stack exacta?
# NÃO colocar aqui: histórico (→ LOG.md), bugs (→ BUGS.md), especificação (→ PLAN.md)
# Actualizar: no início e fim de cada milestone; quando muda versão, URL ou credencial

---

## 1. IDENTIDADE DO PROJECTO

```
Nome:        [nome]
Descrição:   [uma linha]
Stack:       [ex: SvelteKit 2 + Hono + Cloudflare Workers D1/R2]
Monorepo:    [pnpm + turborepo | npm workspaces | sem monorepo]
URL prod:    [https://...]
GitHub:      [https://github.com/...] (branch: [main|genspark_ai_developer|...])
Local:       [/home/user/webapp/ ou caminho absoluto]
```

---

## 2. ESTADO ACTUAL

```
[M0]  ✅ DONE — [descrição curta]
[M1]  ✅ DONE — [descrição curta]
[M2]  🔄 EM CURSO — [descrição curta]
[M3]  pending — [descrição curta]
...

Próximo: [M2] — [descrição do que está por fazer]
```

### Último deploy
```
Versão/Commit: [hash ou versão]
Data:          [YYYY-MM-DD]
URL:           [https://...]
Migrations:    [lista de migrations aplicadas em prod]
```

---

## 3. STACK — VERSÕES LOCKED

### Runtime
```yaml
node:    [versão]
[npm|pnpm|yarn]: [versão]
[wrangler|outros CLI]: [versão]
```

### Dependências principais
```yaml
[framework frontend]: [versão]
[framework api]:      [versão]
[ORM/query builder]:  [versão]
[validação]:          [versão]
[testes]:             [versão]
[linting]:            [versão]
```

### Packages PROIBIDOS neste projecto
```yaml
- [package] — [motivo]
- [package] — [motivo]
```

---

## 4. INFRA / SERVIÇOS

| Serviço | Nome / ID | Estado |
|---------|-----------|--------|
| [Base de dados] | [nome/id] | ✅/❌ |
| [Storage] | [nome/id] | ✅/❌ |
| [Fila/Queue] | [nome/id] | ✅/❌ |
| [Email] | [provider/id] | ✅/❌ |

---

## 5. COMANDOS OPERACIONAIS

### Build e desenvolvimento
```bash
# Build
[comando exacto]

# Dev local
[comando exacto]

# Preview prod local
[comando exacto]
```

### Deploy
```bash
# Deploy produção
[comando exacto]

# Verificar deploy
[comando exacto]
```

### Base de dados
```bash
# Aplicar migrations (local)
[comando exacto]

# Aplicar migrations (produção)
[comando exacto]

# Query directa (debug)
[comando exacto]
```

### Testes
```bash
# Testes unitários
[comando exacto]

# Testes E2E
[comando exacto]

# Ver cobertura
[comando exacto]
```

### Gates rápidos
```bash
# Lint
[comando exacto]

# TypeScript
[comando exacto]

# Build completo
[comando exacto]
```

---

## 6. CREDENCIAIS DE TESTE

```
[Role/User 1]: [email] | [password] | [role] | [notas]
[Role/User 2]: [email] | [password] | [role] | [notas]
```

⚠️ Actualizar imediatamente após qualquer reset de password.

---

## 7. ESTRUTURA DO PROJECTO

```
[raiz]/
├── [pasta principal]/
│   ├── [subpasta] — [propósito]
│   └── ...
├── [config] — [propósito]
└── ...
```

### Ficheiros críticos
```
[path/ficheiro] — [porquê é crítico]
[path/ficheiro] — [porquê é crítico]
```

---

## 8. PADRÕES E REGRAS DESTE PROJECTO

### Autenticação
```
[descrever: tipo de sessão, onde guardada, como verificar]
```

### API
```
[descrever: framework, estrutura de rotas, onde está a lógica]
```

### Base de dados
```
[descrever: onde ficam as queries, regras de naming, tenant isolation se aplicável]
```

### Design / Frontend
```
[descrever: sistema de tokens, regras de CSS, bibliotecas permitidas]
```

---

## 9. DIAGNÓSTICO RÁPIDO

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| [sintoma] | [causa] | [solução] |
| [sintoma] | [causa] | [solução] |

---

*Actualizado: [YYYY-MM-DD] — [milestone] [DONE/EM CURSO]*
