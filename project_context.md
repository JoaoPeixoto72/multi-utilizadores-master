# Contexto do Projeto — archflow-refactor

## Stack e Estrutura
- Monorepo com `pnpm` + `turbo`
- `apps/web` = SvelteKit em Cloudflare Workers
- `apps/api` = Hono em Cloudflare Workers
- Deploy com `wrangler`
- Autenticação com sessão/cookies + CSRF
- O web comunica com a API via Cloudflare service binding

## Regras Técnicas Obrigatórias

- Em server-side/load/actions do web, **NÃO usar** `fetch('/api/...')` com URL relativa.
- Usar sempre: `platform.env.API.fetch(...)`
- Fazer forwarding de cookie com: `cookie: request.headers.get("cookie") ?? ""`
- **NÃO usar** `cookies.toString()` para encaminhar sessão para a API.
- Quando houver redirects em `load` ou `actions`, usar sempre: `throw redirect(...)`
- Diagnosticar primeiro no código e só depois corrigir.
- Se já existir um padrão funcional no mesmo ficheiro, reutilizar esse padrão.
- Fazer mudanças mínimas, focadas e reversíveis.
- Evitar refactors grandes.
- Não mexer em dependências/configs sem necessidade real.
- Não tocar em várias áreas ao mesmo tempo se o bug estiver isolado.
- Não assumir que uma funcionalidade existe; confirmar primeiro no código.

---

## Armadilhas Reais Já Encontradas — NÃO Repetir

### 1. `fetch('/api/...')` em server-side
Já causou: `Invalid URL`, actions que não chegavam à API, requests invisíveis no tail, falhas em Workers, erro `1042`.
**Regra:** usar `platform.env.API.fetch(...)`.

### 2. `cookies.toString()` em vez de `request.headers.get("cookie")`
Já causou: 401, sessão não encaminhada, páginas do super admin a falhar.
**Regra:** usar `request.headers.get("cookie") ?? ""`.

### 3. `redirect(...)` sem `throw`
Já causou fluxos partidos.
**Regra:** usar sempre `throw redirect(...)`.

### 4. Misturar padrões dentro do mesmo ficheiro
Já causou bugs enganadores: `load` correto com `platform.env.API.fetch(...)`, `actions` erradas com `fetch('/api/...')`. Metade da página funcionava, metade não.
**Regra:** se o `load` funciona, copiar exactamente o mesmo padrão nas `actions`.

### 5. Pensar que o problema é "da API/backend"
Já aconteceu a API nem receber pedido.
**Regra:** se a API não recebe request, o problema está quase sempre no web (form, action, fetch, URL, nome de action).

### 6. Assumir que algo era bug quando nunca foi implementado
Exemplo: marcação visual do preset activo.
**Regra:** confirmar primeiro se a funcionalidade já existe no código.

### 7. Corrigir demasiadas áreas ao mesmo tempo
Já causou regressões novas.
**Regra:** isolar o problema e tocar só nessa área.

### 8. Achar que 404/1042 significava "dados em falta"
Os dados existiam. A lista mostrava-os. O detalhe falhava por fetch/path/service binding errado.
**Regra:** antes de culpar BD, verificar se o endpoint está a ser chamado, se o path está correto, se o fetch é válido.

### 9. Lint a explodir por ficheiros gerados
**Regra:** se o lint der milhares de erros, verificar se está a incluir `.turbo`, `.svelte-kit`, caches, outputs.

### 10. Parecer "cache do Cloudflare" mas ser estado local
**Regra:** antes de culpar cache, verificar estado, hidratação SSR/client, stores, CSS variables.

### 11. Duas fontes de verdade para cores/themes
Já aconteceu ter o `tokens.css` a definir paletas e o `+layout.svelte` a extrair cores do `appConfig` sem as aplicar — 9 variáveis de cor eram extraídas mas **nunca chegavam ao DOM** (sem `setProperty`). Resultado: cores do settings não tinham efeito visual.
**Regra:** a fonte de verdade para cores é **exclusivamente** o `tokens.css`. O `+layout.svelte` é apenas um **bridge** que aplica overrides do `appConfig` via `setProperty` — **nunca** deve definir valores de cor hardcoded nem ser tratado como fonte de verdade.

### 12. Hidden input a enviar ID do preset em vez do nome da paleta CSS
Já aconteceu o formulário de settings enviar `ui_theme_palette = "blue"` ou `"sunset"` (IDs internos dos presets rápidos), mas esses nomes **não correspondem** a classes CSS (`.palette-blue` não existe). Resultado: após gravar, a paleta não era aplicada.
**Regra:** o hidden input de paleta deve enviar sempre `config.ui_theme_palette` (nome real mapeado pelo `presetToPalette`), **nunca** o `activePresetId`.

### 13. `setProperty` inline a bloquear dark mode
O `setProperty` no `<body>` (inline style) tem **especificidade CSS superior** a `[data-theme="dark"]` no `tokens.css`. Se se aplicar `--bg-page: #f8fafc` (light) via inline, a regra dark `--bg-page: #0b0f17` do CSS é completamente ignorada. Resultado: toggle dark mode só mudava botões e inputs, mas fundos/textos ficavam em light.
**Regra:** cores de superfície/semânticas (`--bg-page`, `--bg-surface`, `--text-primary`, `--color-warning`, `--color-danger`, `--color-link`, `--color-secondary`, `--btn-action-*`) só devem ser aplicadas via `setProperty` em **light mode**. Em **dark mode**, fazer `removeProperty` para que as regras `[data-theme="dark"]` do `tokens.css` tomem efeito. Cores de marca (`--brand-*`, `--color-primary`) podem ser aplicadas em ambos os modos.

### 14. Presets de cor só funcionarem para "custom"
Já aconteceu os presets rápidos (Emerald, Ocean, etc.) guardarem todas as cores no `appConfig`, mas o `$effect` do layout só aplicar `setProperty` quando `palette === "custom"`. Resultado: só o preset Custom mudava as cores; todos os outros ficavam com os defaults do `:root`.
**Regra:** os presets guardam cores no appConfig — o `setProperty` deve actuar **sempre que existam valores** no appConfig, independentemente do nome da paleta.

---

## Estado Actual do Projeto
- Login funcional
- Setup funcional
- Integração web/api funcional
- Create tenant redireciona para `/super/tenants`
- Detalhe de tenant já abre
- Fluxo principal de tenants/empresas está funcional
- Várias actions de tenant já foram corrigidas para usar o fetch interno correto
- Área de empresas actualmente estável
- **Sistema de cores/themes corrigido** — fonte de verdade única em `tokens.css`
- Presets rápidos e paleta custom funcionais
- Dark mode funcional com todos os elementos

---

## Forma de Trabalhar

1. Primeiro identificar os ficheiros envolvidos
2. Depois explicar a causa real do problema
3. Só depois aplicar correções
4. Usar logs/tails para inferir onde o erro realmente está
5. Se existir um padrão funcional noutro ficheiro semelhante, reutilizá-lo
6. Não inventar arquitectura nova
7. Se precisar propor mudanças, fazer só as mínimas necessárias

## Checklist Mental Antes de Mexer em Código

1. O request está mesmo a sair do web?
2. A API está mesmo a receber esse request?
3. O ficheiro já tem um padrão funcional que devo copiar?
4. Estou a usar `platform.env.API.fetch(...)`?
5. Estou a encaminhar `cookie` correctamente?
6. Estou a usar `throw redirect(...)`?
7. Isto é bug real ou feature nunca implementada?
8. Estou a tocar só na área do problema actual?
9. Estou a respeitar a fonte de verdade única (tokens.css para cores)?
10. Se uso `setProperty`, conflita com dark mode?

## Validação Obrigatória no Fim de Qualquer Correção

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test
```

## Arquitectura de Cores/Themes (Fonte de Verdade)

```
tokens.css (FONTE DE VERDADE)
├── :root → cores base light mode
├── [data-theme="dark"] → overrides dark mode
├── .palette-indigo/.emerald/.rose/... → cores de marca (--brand-*)
├── [data-theme="dark"].palette-* → marca em dark mode
└── .palette-custom → fallbacks para custom

+layout.server.ts
├── Carrega appConfig da API (cores guardadas na BD)
└── Entrega palette, theme, appConfig ao layout

+layout.svelte (BRIDGE — não é fonte de verdade)
├── $effect → aplica palette class + data-theme no <body>
├── BRAND_CSS_MAP → setProperty sempre (light + dark)
└── SURFACE_CSS_MAP → setProperty só em light, removeProperty em dark

theme.svelte.ts (STORE)
├── Gere cookies (cf_layout, cf_palette, cf_theme)
└── applyToBody() → classes + data-attributes
```
