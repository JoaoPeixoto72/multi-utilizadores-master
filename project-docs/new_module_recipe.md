# Guia: Como Criar um Novo Módulo na Aplicação

Para adicionar uma nova funcionalidade (ex: "Módulo de Vendas" ou "Gestão de Projetos"), a outra IA deve seguir estes 5 passos obrigatórios:

## Passo 1: Definir a Base de Dados
Onde: `packages/shared/src/schemas/`
*   Criar um ficheiro `.ts` com a tabela usando Drizzle ORM.
*   Lembrar de incluir sempre o campo `tenant_id` para manter o isolamento multi-tenant.
*   Exportar a tabela no `index.ts` do pacote shared.

## Passo 2: Gerar e Aplicar Migrações
Onde: Raiz do projeto
*   Usar os comandos da Drizzle para gerar a migração de base de dados.
*   Aplicar ao ambiente local e produtivo via Wrangler (Cloudflare D1).

## Passo 3: Criar as Queries (Lógica de Dados)
Onde: `apps/api/src/db/queries/`
*   Criar um ficheiro para as funções de leitura e escrita (CRUD).
*   **Importante**: Todas as queries de leitura devem ter um filtro `where(eq(table.tenant_id, currentTenantId))`.

## Passo 4: Criar a API (Rotas Hono)
Onde: `apps/api/src/routes/admin/` (ou `super/`)
*   Criar um ficheiro para os endpoints (GET, POST, PATCH, DELETE).
*   Usos o middleware de autenticação existente para garantir que só utilizadores autorizados acedem.
*   Registar a nova rota no `apps/api/src/index.ts`.

## Passo 5: Criar a Interface (SvelteKit)
Onde: `apps/web/src/routes/(admin)/`
*   Criar a pasta com o nome do módulo.
*   `+page.server.ts`: Para carregar os dados da API usando o `fetch` interno.
*   `+page.svelte`: Para a UI.
    *   **Padrão Gold**: Usar os componentes em `$lib/components/ui/` (Button, Input, Alert, etc.).
    *   **Estilo**: Seguir os tokens de CSS disponíveis no `app.css`.

---
## Prompt de Exemplo para a Nova IA:
*"Preciso que cries um novo módulo de 'Tarefas'. Segue a arquitetura do projeto: define a tabela no `packages/shared`, cria as queries e rotas no `apps/api` garantindo o isolamento por `tenant_id`, e cria a página de listagem e criação no `apps/web` usando os componentes UI de base e o sistema de design tokens."*
