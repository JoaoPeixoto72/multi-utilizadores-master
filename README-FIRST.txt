# ── LOCAL DEV (dois terminais) ──
# Terminal 1:
cd apps/api
pnpm dev                    # → localhost:8787
# Terminal 2:
cd apps/web
pnpm dev                    # → build + wrangler dev → localhost:8788
# ── DEPLOY STAGING ──
pnpm deploy:staging         # (na raiz do projecto)
# ── DEPLOY PRODUÇÃO ──
pnpm deploy:production      # (na raiz do projecto)