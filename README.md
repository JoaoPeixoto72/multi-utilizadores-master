# ArchFlow — Setup Guide

## Requisitos

- **Node.js** ≥ 24.14
- **pnpm** ≥ 10
- Conta **Cloudflare** (para D1, R2, Workers)

## 1. Clonar

```bash
git clone https://github.com/JoaoPeixoto72/multi-utilizadores-master.git archflow
cd archflow
```

## 2. Instalar dependências

```bash
pnpm install
```

## 3. Criar `.dev.vars`

Criar o ficheiro `apps/api/.dev.vars` (nunca commitar — está no `.gitignore`):

```ini
# Autenticação (gerar hex aleatório de 64 chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CSRF_SECRET=<gerar>
SESSION_SECRET=<gerar>

# Criptografia
ENCRYPTION_KEY=<gerar>

# Cloudflare (opcional — para PDF via Browser Rendering)
CF_ACCOUNT_ID=
CF_API_TOKEN=

# Ambiente
APP_ENV=development
APP_URL=http://localhost:8788
API_URL=http://localhost:8787
```

## 4. Criar recursos Cloudflare

```bash
cd apps/api

# D1
pnpm exec wrangler d1 create arch
# → copiar o database_id para apps/api/wrangler.toml

# R2
pnpm exec wrangler r2 bucket create arch-storage

# Migrações
pnpm exec wrangler d1 migrations apply arch --local
```

## 5. Seed do super admin

```bash
cd apps/api
pnpm exec wrangler d1 execute arch --local --command "INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES ('super-1', 'admin@archflow.local', '<bcrypt_hash>', 'super_user', 'Super Admin', datetime('now'));"
```

## 6. Correr localmente

```bash
# Terminal 1 — API (localhost:8787)
cd apps/api
pnpm dev

# Terminal 2 — Web (localhost:8788)
cd apps/web
pnpm dev
```

Abrir **http://localhost:8788**

## 7. Deploy

```bash
# Staging
pnpm deploy:staging

# Produção
pnpm deploy:production
```

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Dev local (turbo → api + web) |
| `pnpm run build` | Build completo |
| `pnpm run lint` | Lint (Biome) |
| `pnpm run typecheck` | Type check (svelte-check + tsc) |
| `pnpm run test` | Testes |
| `pnpm deploy:staging` | Deploy para staging |
| `pnpm deploy:production` | Deploy para produção |
