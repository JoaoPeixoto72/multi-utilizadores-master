---
documento: briefing
versao: 6.5
data: 2026-02-24
estado: LOCKED
instrucao: Este documento é a lei do projecto. Nunca modificar.
           O Architect lê este documento uma vez na FASE 0.
           Todas as alterações posteriores vão para briefing.delta.md.
---

# PRODUCT BRIEF v6.5 — Aplicação Base (boilerplate multi‑empresa Cloudflare)

# 1. VISÃO GERAL

## 1.1 O que é

Boilerplate reutilizável para webapps multi‑empresa alojadas 100% na Cloudflare. Não tem negócio próprio: é a base sólida onde módulos futuros encaixam sem mexer no núcleo.

Inclui de raiz: autenticação e sessões, utilizadores e convites, perfis, limites e quotas, notificações, backups, integrações externas, internacionalização, tema visual e sistema de módulos extensível.

## 1.2 Modelo de empresa (tenancy)

A empresa é uma entidade separada (tabela `tenants`) com:
- Dados da empresa (nome, morada, email, telefone, website, logótipo)
- Limites de núcleo (admin seats, member seats, storage, emails diários)
- Limites de módulos (em `tenant_module_limits`)
- Idiomas permitidos
- Status e timestamps

Utilizadores pertencem a uma empresa via `tenant_id`. O super user não pertence a nenhuma empresa (`tenant_id = null`).

Quando o super user convida o primeiro administrador (owner fixo), o sistema cria automaticamente o registo da empresa e o utilizador com `role=tenant_admin` e `is_owner=true`. O super user pode criar múltiplas empresas independentes, sem relação entre si.

## 1.3 Isolamento de dados

- Cada empresa é um workspace isolado
- Empresas diferentes nunca vêem dados umas das outras
- Cada email existe uma única vez em toda a aplicação
- Um utilizador pertence a exactamente uma empresa
- Não é possível convidar um email que já exista como utilizador noutra empresa

---

# 2. ROLES, OWNERSHIP E HIERARQUIA

## 2.1 Níveis de acesso (4 fixos)

### Super user (1 por app)
- Administra a plataforma e todas as empresas
- Isento de quotas (emails, armazenamento)
- Não pertence a nenhuma empresa (`tenant_id = null`)
- Não gere sócios nem colaboradores directamente
- Executa operações ao nível da empresa (limites, estado, hard delete, transferência de ownership)
- **Relação plataforma ↔ empresa:** o super user interage operacionalmente com a empresa **apenas** via owner fixo (ver 2.4)

### Owner fixo (exactamente 1 por empresa, sempre)
- Responsável da empresa (`is_owner = true`)
- Criado automaticamente no convite inicial da empresa
- **É o representante oficial da empresa perante o super user** (ponte operacional: owner fixo = interface humana da empresa)
- **Acções exclusivas do owner fixo:**
  - Pedir eliminação da empresa ao super user
  - Pedir mais recursos ao super user (assentos, espaço)
  - Convidar sócios
  - Editar dados da empresa
  - Limpar histórico de actividade
  - Fazer backup do histórico de actividade
- Pode eliminar sócios e colaboradores
- **Regra absoluta:** owner não elimina owner — nem a si próprio, nem o owner temporário

### Owner temporário (máximo 1 em simultâneo com o fixo)
- Sócio elevado temporariamente pelo super user
- Duração configurável (defeito: 24 horas)
- **Pode fazer tudo o que o owner fixo pode, excepto:**
  - Pedir eliminação da empresa (exclusivo do owner fixo)
  - Eliminar qualquer owner (fixo ou temporário)
- Acções realizadas são permanentes mesmo após expiração

### Sócio (0 ou mais por empresa)
- Convidado pelo owner fixo ou owner temporário (`is_owner = false`)
- Pode convidar e eliminar colaboradores
- Pode consultar histórico de actividade
- **Pode auto-eliminar-se** (soft delete) a partir do seu perfil, **excepto** se estiver actualmente elevado como owner temporário
- **Não pode:**
  - Convidar sócios
  - Eliminar sócios
  - Editar dados da empresa
  - Limpar histórico de actividade
  - Fazer backup do histórico de actividade
  - Pedir recursos ao super user
  - Pedir eliminação da empresa

### Colaborador (0 ou mais por empresa)
- Usa módulos conforme permissões atribuídas
- Gere o próprio perfil
- Sem acesso a ferramentas administrativas do núcleo
- Pode eliminar-se a si próprio (soft delete)
- Sem sub-roles no núcleo — diferenciação é responsabilidade de cada módulo

## 2.2 Diagrama de roles

```
┌──────────────────────────────────────────────────────┐
│                    SUPER USER                        │
│  • Administra plataforma e todas as empresas         │
│  • Isento de quotas — tenant_id = null               │
│  • Não elimina sócios/colaboradores directamente     │
│  • Executa transferência de ownership                │
└──────────────────────────────────────────────────────┘
                          │ convida
                          ▼
┌──────────────────────────────────────────────────────┐
│          OWNER FIXO (exactamente 1, sempre)          │
│  • is_owner = true                                   │
│  • Ponte operacional com o super user                │
│  • Acções exclusivas: pedir eliminação empresa,      │
│    pedir recursos, convidar sócios                   │
│  • Elimina: sócios e colaboradores                   │
│  • Não elimina outro owner                           │
└──────────────────────────────────────────────────────┘
          │ convida              │ (super user eleva)
          ▼                      ▼
┌─────────────────┐  ┌──────────────────────────────────┐
│  SÓCIO (0+)     │  │    OWNER TEMPORÁRIO (máx. 1)     │
│  is_owner=false │  │  • Sócio elevado pelo super user │
│  Convida/elimina│  │  • Quase todos os privilégios    │
│  colaboradores  │  │  • NÃO pode: pedir eliminação    │
│  Pode auto-     │  │    empresa, eliminar owners      │
│  eliminar-se*   │  │  • Duração configurável (24h)    │
└─────────────────┘  └──────────────────────────────────┘
          │ convida
          ▼
┌──────────────────────────────────────────────────────┐
│                  COLABORADOR (0+)                    │
│  • Usa módulos conforme permissões                   │
│  • Gere próprio perfil                               │
│  • Pode eliminar-se a si próprio                     │
└──────────────────────────────────────────────────────┘

HIERARQUIA DE ELIMINAÇÃO:
  Colaborador      → elimina: a si próprio
  Sócio            → elimina: colaboradores (e pode auto-eliminar-se*)
  Owner fixo       → elimina: sócios e colaboradores
  Owner temporário → elimina: sócios e colaboradores
  Super user       → executa transferência de ownership
                     (soft delete do owner fixo anterior
                      é parte da operação atómica)

REGRAS ABSOLUTAS:
  • Owner não elimina owner (nem a si próprio)
  • Super user não elimina sócios nem colaboradores directamente
  • Owner fixo não elimina owner temporário (espera que reverta)
  • Owner temporário não elimina owner fixo
  * Sócio não pode auto-eliminar-se enquanto está elevado como owner temporário
```

## 2.3 Modelo de ownership (invariante: sempre 1 owner fixo)

**Invariante:** cada empresa tem sempre exactamente 1 owner fixo. O estado "sem owner fixo" nunca existe, nem por instantes.

### Transferência atómica de ownership

Única forma de remover o owner fixo. Executada pelo super user quando necessário (ex: owner deve sair da empresa).

**Processo:**
1. Super user selecciona um sócio para se tornar o novo owner fixo
2. Se o sócio seleccionado estiver actualmente elevado como owner temporário: a elevação é revertida primeiro, dentro da mesma operação
3. O sistema executa numa transacção atómica:
   - sócio promovido a owner fixo (`is_owner = true`)
   - owner fixo anterior soft-deleted (anonimizado, sessão invalidada)
4. Se qualquer parte falhar: rollback completo — nenhum estado muda
5. Pop-up de confirmação explícita antes de executar:  
   "O owner actual será permanentemente removido e não poderá recuperar o acesso. Esta acção é irreversível."

**Notas sobre seats:**
- A ocupação de admin seats após a transferência segue as regras normais de contagem (ver Secção 4.1). A operação não deve deixar a empresa em estado inconsistente.

**Efeito:** existe sempre exactamente 1 owner fixo antes e depois da operação.

### Elevação temporária (quando existe owner fixo)

O super user pode elevar 1 sócio a owner temporário. Máximo 2 owners em simultâneo: 1 fixo + 1 temporário. Ver secção 3.7 para o processo completo.

## 2.4 Privacidade e visibilidade de dados

**O super user vê (read-only na ficha da empresa):**
- Dados da empresa: nome, morada, email, telefone, website, logótipo
- Dados de contacto do owner fixo: nome, apelido, email, telefone, website
- Árvore de utilizadores: ID do owner fixo, IDs dos sócios, contagem total de colaboradores

**O super user nunca vê:**
- Dados pessoais de sócios ou colaboradores (apenas IDs na árvore)

**O owner é informado** na interface que o super user tem acesso aos seus dados pessoais e aos dados da empresa exclusivamente para fins de contacto e suporte.

---

# 3. FUNCIONALIDADES NUCLEARES

## 3.1 Autenticação

### Setup inicial
- Primeiro acesso leva ao setup inicial
- Super user define email, password e nome da aplicação
- Após execução, setup fica indisponível permanentemente (devolve 404)

### Login
- Página única para todos os roles
- Mensagem de erro sempre genérica — nunca revela se o email existe, se a password está errada, ou se a conta está desactivada
- Após N tentativas falhadas de login a partir do mesmo IP, o acesso fica temporariamente bloqueado  
  **(N, janelas e duração configuráveis nas Definições globais → Segurança)**
- Após credenciais correctas:
  - se utilizador pertence a empresa: verifica se empresa está activa
  - se desactivada: "a aplicação está desactivada de momento"
  - se activa: encaminha para o painel do role correspondente

### Sessões
- Uma sessão activa por utilizador — novo login invalida a anterior
- Logout invalida sessão e limpa cookie no dispositivo actual

## 3.2 Convites (única forma de entrar)

Sem auto-registo. Três tipos de convite:

### Convite de owner fixo (super user → nova empresa)
O super user preenche:
- Dados do owner: nome, apelido, email (obrigatórios)
- Dados da empresa: nome (obrigatório), morada, email, telefone, website (opcionais)
- Limites de núcleo: admin seats, member seats, storage, emails diários
- Limites de módulos (se existirem módulos registados)
- Idiomas permitidos e idioma do convite

Após criação, o super user não pode editar nenhum campo. Para alterar: cancelar e criar novo.

### Convite de sócio (owner fixo ou owner temporário → novo administrador)
- Email obrigatório; idioma do convite
- Sem permissões a configurar — acesso definido pelo role
- Ocupa 1 admin seat

### Convite de colaborador (owner fixo, owner temporário, ou sócio → novo colaborador)
- Email obrigatório
- Permissões de módulos (defeito: nenhuma)
- Idioma do convite (defeito: idioma do administrador que convida)
- Ocupa 1 member seat

### Processo de aceitação
1. Destinatário clica no link do email
2. Define password (checklist visual em tempo real)
3. Preenche perfil básico
4. Permissões de módulos aplicadas automaticamente (só colaboradores)
5. Se alguma permissão referir módulo indisponível: conta criada na mesma, administrador configura depois
6. Não entra automaticamente — tem de fazer login

### Regras globais de convites
- Convite pendente bloqueia o email em toda a aplicação e ocupa slot imediatamente
- Quando expira, o convite deixa de bloquear email e slot; o registo é removido pelo cron/limpeza oportunista
- Link expira em 24 horas (configurável)
- Reenvio cancela o anterior e cria novo token — link antigo deixa de funcionar
- Convite só persiste se o email for enviado com sucesso — rollback completo se falhar, erro devolvido ao utilizador
- Histórico de convites aceites e cancelados guardado permanentemente
- Todos os administradores vêem todos os convites da empresa; cada convite mostra quem o criou
- Módulos adicionados depois de colaboradores já existirem não dão acesso automático — administrador vai à página de Permissões e define manualmente

## 3.3 Gestão de equipa

### Soft delete (anonimização irreversível)
Quando um utilizador é eliminado (por si próprio ou por alguém acima na hierarquia):
- Nome → "Removed User"
- Email → `deleted_{id}@removed.invalid`
- Telefone e website → vazios
- Password substituída por valor que impede login
- Foto de perfil apagada do armazenamento (liberta quota)
- Permissões de módulos eliminadas
- Dados de módulos tratados pelo handler `onUserDelete` de cada módulo
- Sessão invalidada
- Slot libertado (member seat ou admin seat conforme role)
- Irreversível

**Auto-eliminação:**
- Colaborador pode auto-eliminar-se
- Sócio pode auto-eliminar-se excepto enquanto está elevado como owner temporário

### Desactivar/reactivar colaborador
- Qualquer administrador pode desactivar ou reactivar um colaborador
- Desactivar: corta acesso imediatamente (sessão invalidada), slot mantém-se ocupado
- Reversível

### Desactivar empresa (super user)
- Invalida todas as sessões (owner fixo, owner temporário, sócios, colaboradores; elevação revogada automaticamente)
- Cancela todos os convites pendentes (slots libertados)
- Enquanto desactivada: ninguém consegue entrar; utilizadores não conseguem eliminar-se a si próprios
- Reactivar: restaura acesso a utilizadores activos; convites cancelados não voltam

### Pedido de eliminação de empresa
- Apenas o owner fixo pode pedir
- Pedido enviado ao super user via notificação
- Sistema regista quem pediu e quem executou

### Hard delete de empresa (super user)
- Exige backup completo + download concluído nos últimos 60 minutos
- Confirmação forte: escrever nome da empresa
- Apaga tudo na plataforma: empresa, utilizadores, convites, sessões, notificações, permissões, histórico, backups internos, ficheiros no armazenamento
- Chama `onTenantDelete` de cada módulo registado
- Não apaga backups fora da plataforma (downloads locais ou plataformas externas)

## 3.4 Notificações

- Sino no cabeçalho com badge de não lidas
- Lista ordenada por data (mais recente primeiro); paginação cursor-based (20 por página)
- Cada notificação tem link directo para a página relevante (quando aplicável)
- Clicar numa notificação marca-a como lida; botão "Marcar todas como lidas"
- Notificações lidas apagadas automaticamente após 30 dias; não lidas mantidas indefinidamente

### Routing por role

**Notificações de owner (owner fixo + owner temporário):**
- Pedidos de recursos de colaboradores e escalações internas
- Decisões sobre recursos (quando aplicável)

**Notificações exclusivas do owner fixo:**
- Pedido de eliminação da empresa (só o owner fixo inicia e só o super user recebe)

**Notificações gerais de administrador (owner fixo + owner temporário + sócios):**
- Colaborador aceitou convite
- Convite expirou

**Notificações pessoais:**
- Confirmação de alteração de email
- Decisões sobre pedidos feitos pelo próprio
- Elevação concedida / expirada / revogada

**Regras:**
- Colaboradores só recebem notificações directamente relevantes para si
- Colaboradores nunca recebem notificações administrativas
- Administradores nunca recebem notificações de nível super user (excepto owner fixo quando escala pedidos)

### Tipos de notificação e mensagens de exemplo

| Tipo | Para | Mensagem |
|------|------|----------|
| Pedido espaço | Owner | "João Silva solicita mais 5 GB de armazenamento" |
| Pedido slots | Owner | "Maria Santos solicita 3 slots adicionais de colaboradores" |
| Limite alterado | Requerente | "O seu pedido de 5 GB foi aprovado. Novo limite: 20 GB" |
| Convite aceite | Admins | "Carlos Mendes aceitou o convite e juntou-se à equipa" |
| Convite expirado | Criador | "O convite para ana@exemplo.pt expirou sem ser aceite" |
| Email confirmado | Convidador | "João Silva confirmou a alteração de email para joao.novo@exemplo.pt" |
| Backup falhado | Super user | "Backup automático de 'Empresa ABC' falhou (tentativa 3/3)" |
| Backup desactivado | Super user | "⚠️ URGENTE: Backups automáticos desactivados após 3 dias de falhas consecutivas" |
| Break-glass | Super user | "Lembrete: faça download das instruções de recuperação de emergência" |
| Elevação concedida | Sócio | "Foi elevado a owner temporário até 22/02/2026 às 14:30. Todas as acções são permanentes." |
| Elevação expirada | Sócio | "A elevação temporária a owner expirou. Privilégios revertidos para sócio." |
| Elevação revogada | Sócio | "A elevação temporária a owner foi revogada pelo administrador." |
| Pedido eliminação | Super user | "Ana Costa (Empresa XYZ) solicita eliminação permanente da empresa" |

### Escalação de recursos
1. Colaborador tenta acção que excede limite → erro com botão "Pedir ao administrador"
2. Notificação criada para administradores da empresa
3. Se administrador também não tem margem → botão "Pedir ao super user"
4. Super user altera limite → requerente original notificado com novo valor
5. Colaborador nunca contacta super user directamente

## 3.5 Perfil e imagens

Cada utilizador gere o seu próprio perfil: nome, apelido, email, telefone, website, foto de perfil. Todos opcionais excepto email. O convidador pode ver estes campos mas não pode alterá-los — pertencem ao utilizador.

### Foto de perfil
- Upload com conversão para WebP no browser
- Validação no servidor: magic bytes WebP, máximo 200 KB, máximo 512×512 pixels; se qualquer validação falhar: rejeitado
- Conta para a quota de armazenamento da empresa (super user isento)
- Remoção apaga ficheiro e liberta espaço no acumulador

### Logótipo da empresa
- Editável pelo owner fixo e owner temporário
- Mesmas regras de validação e armazenamento da foto de perfil
- Conta para a quota de armazenamento da empresa

## 3.6 Alteração de email

1. Utilizador confirma password actual e insere novo email
2. Sistema verifica que o email não está usado por outra conta, reservado por outra alteração em curso, ou bloqueado por convite pendente
3. Se livre: envia link de confirmação para o novo email (válido 24 horas)
4. Enquanto não confirmar: login funciona com email antigo
5. Após confirmação: email actualizado, sessão invalidada
6. Convidador notificado após confirmação:
   - Colaborador → administradores da empresa
   - Administrador → super user
   - Super user → sem convidador, sem notificação
7. Se não confirmar a tempo: reserva expira, email antigo mantém-se; pode pedir outra vez

## 3.7 Elevação temporária de sócio

- Super user eleva 1 sócio por empresa de cada vez — máximo 2 owners em simultâneo (1 fixo + 1 temporário)
- Duração configurável (defeito: 24 horas)
- Sócio recebe notificação com data e hora exacta de expiração
- Owner temporário recebe notificações de owner em simultâneo com o owner fixo (não em substituição)
- Acções realizadas são permanentes e registadas no activity log e audit log com indicação explícita: "executado por [Nome] com elevação temporária a owner"
- A interface reverte na próxima interacção após expiração (não em tempo real)
- Expiração automática processada pelo cron de manutenção, ou revogação manual pelo super user

## 3.8 Passwords

Política: mínimo 12 caracteres, 1 maiúscula, 1 minúscula, 1 especial. Checklist visual em tempo real no browser — botão de submissão só activo quando todos os critérios cumpridos. Validação também no servidor.

A checklist aparece em:
- Setup inicial (criação do super user)
- Aceitação de convite
- Recuperação de password
- Alteração voluntária de password

### Reset por email
- Token de uso único, expira em 1 hora
- Resposta sempre neutra: "se existir, receberá link" — nunca revela se o email existe
- Após reset: sessão invalidada, necessário novo login

### Alteração voluntária
- Pede password actual e nova; sessão mantém-se

## 3.9 Armazenamento

- Quota por empresa com acumulador de espaço usado
- Cada upload incrementa o acumulador; cada eliminação decrementa
- Cobre: fotos de perfil, logótipo da empresa, uploads de módulos, PDFs em cache de módulos
- Sistema verifica espaço disponível antes de cada upload; se insuficiente, recusa com mensagem diferenciada:
  - Para administrador: "atingiu o seu limite de armazenamento, apague ficheiros ou contacte o administrador para ter mais espaço"
  - Para colaborador: "não é possível completar esta acção, contacte o seu administrador"
- Super user isento (sem verificação de espaço)
- Super user não pode reduzir quota abaixo do espaço já usado

## 3.10 Histórico de actividade da empresa

Regista acções administrativas relevantes. Cada entrada contém: quem fez, o quê, sobre quem/o quê, quando.

**Acções registadas de núcleo:**
- Convidar colaborador ou sócio
- Reenviar ou cancelar convite
- Desactivar, reactivar ou eliminar colaborador
- Eliminar sócio
- Alterar permissões de módulos de um colaborador
- Acções durante elevação temporária (com indicação explícita)

Módulos podem registar acções adicionais seguindo o mesmo sistema.

**Permissões:**

| Acção | Owner fixo | Owner temporário | Sócio |
|-------|-----------|-----------------|-------|
| Consultar histórico | ✅ | ✅ | ✅ |
| Fazer backup do histórico | ✅ | ✅ | ❌ |
| Limpar histórico | ✅ | ✅ | ❌ |

**Limpar histórico:**
- Exige backup do histórico nos últimos 60 minutos; se não existe: recusa e pede para fazer backup primeiro
- Após limpeza: entrada adicionada à lista de limpezas anteriores com data e link de download do ficheiro correspondente; lista visível na página do histórico

**Retenção de backups do histórico:** 1 ano (configurável nas definições).

## 3.11 Log de auditoria da plataforma

Registo append-only de acções relevantes em toda a plataforma. Só o super user tem acesso. Nunca contém dados pessoais — apenas identificadores, contagens e bytes. Retenção de 365 dias (configurável). Módulos podem registar entradas adicionais seguindo o mesmo sistema.

**O que é registado:**
- Criação e eliminação de utilizadores
- Alterações de limites (núcleo e módulos)
- Desactivações e reactivações de empresas
- Backups (geração e importação)
- Hard deletes de empresas
- Exportações RGPD
- Alterações de integrações
- Elevações temporárias (concessão e revogação)
- Transferências de ownership
- Acções executivas durante elevação (com indicação explícita)
- Pedidos de eliminação de empresa

Registos cujo actor foi eliminado por hard delete ficam com identificador órfão — a aplicação tolera isto ao mostrar o log.

## 3.12 Exportação de dados pessoais (RGPD)

Qualquer utilizador exporta os seus dados em JSON a partir do perfil. Inclui dados de núcleo (nome, email, telefone, website, datas, role, status) e dados de módulos (via handler `onRgpdExport` de cada módulo — núcleo agrega automaticamente). Nunca inclui passwords, tokens, sessões ou dados de outros utilizadores. A exportação é registada no audit log.

## 3.13 Break-glass (super user)

Ficheiro descarregável nas definições com instruções de recuperação de acesso em caso de perda de credenciais. O ficheiro tem conteúdo dinâmico com a URL da app e o nome da base de dados. A recuperação é feita fora da aplicação seguindo as instruções — não existe mecanismo automático dentro da app. O token de emergência gerado por este processo é válido 15 minutos.

Se o ficheiro não for descarregado em 30 dias: lembrete por notificação ao super user.

## 3.14 Manutenção (cron + limpeza oportunista)

O cron corre na hora configurada pelo super user (defeito: meia-noite no timezone da app).

**O que faz numa passagem:**
- Apaga convites expirados (liberta emails e slots)
- Apaga reservas de email expiradas
- Apaga tokens expirados e não usados
- Apaga notificações lidas com mais de 30 dias
- Reverte elevações temporárias expiradas e notifica o sócio
- Apaga contadores de rate limiting obsoletos
- Apaga contadores diários de email antigos
- Dispara backup automático se activo e a frequência o exige
- Executa handler `onCronMaintenance` de cada módulo registado

**Limpeza oportunista (complementar):**
Executada em momentos de actividade administrativa: quando um administrador faz login, acede à equipa, ou quando o super user acede à lista de empresas ou abre a ficha de uma empresa. Faz limpeza rápida de convites expirados e recalcula contadores de slots. Limitada a um número máximo de registos por execução (configurável nas definições) para não impactar o tempo de resposta.

**Tolerância a falhas do cron:** se um handler `onCronMaintenance` de um módulo lançar excepção, o cron regista o erro no audit log e continua para o próximo módulo. O cron nunca para a meio por falha de um único handler.

---

# 4. LIMITES E QUOTAS

## 4.1 Limites de núcleo por empresa

### Admin seats
Ocupados = owner fixo (sempre 1) + sócios activos + sócios desactivados + convites de administrador pendentes.

Notas:
- Owner temporário continua a ser um sócio — não altera a contagem
- Soft delete de sócio liberta 1 admin seat (de acordo com a regra geral)
- Transferência de ownership mantém sempre 1 owner fixo (a ocupação total de seats segue a fórmula; apenas muda a pessoa)

Exemplos de contagem:
- `admin_seat_limit = 1` → só o owner fixo (sem sócios possíveis)
- `admin_seat_limit = 2` → owner fixo + 1 sócio
- `admin_seat_limit = 3` → owner fixo + 2 sócios

### Member seats
Ocupados = colaboradores activos + colaboradores desactivados + convites de colaborador pendentes. Soft delete de colaborador liberta slot. Se `member_seat_limit = 0` e não existem sócios: menu de equipa não aparece.

### Storage
Acumulador de espaço usado (núcleo + módulos + PDFs em cache). Ver secção 3.9.

### Email diário
Todos os emails transaccionais da empresa por dia (convites, reenvios, resets, confirmações, emails de módulos). Super user isento — os seus emails não contam para nenhum contador.

**Cálculo de "dia":** baseado no timezone configurado da app (defeito: Europe/Lisbon). Todos os tenants partilham o mesmo timezone. Muda à meia-noite desse timezone.

**Em rotas públicas:** quando o limite diário é atingido, a resposta é sempre neutra — não revela que o limite foi atingido.

## 4.2 Limites de módulos por empresa

Cada módulo declara os seus próprios limites configuráveis. Registados em `tenant_module_limits`. Criados automaticamente com valores default quando a empresa é criada. Editáveis pelo super user na ficha da empresa. Lógica de verificação e escalação é responsabilidade do módulo.

## 4.3 Regra de piso (todos os limites)

O super user não pode reduzir nenhum limite abaixo do valor já ocupado ou usado. Aplica-se a todos os limites de núcleo e de módulos.

---

# 5. BACKUPS

## 5.1 Tipos
- **Só base de dados:** SQL em ZIP com manifesto de metadados
- **Completo:** base de dados + ficheiros em ZIP com manifesto que lista módulos presentes e versão de cada um — útil para detectar incompatibilidades na restauração

## 5.2 Backup manual
- Qualquer administrador faz da própria empresa; super user faz de qualquer empresa
- Abaixo de 50 MB: download imediato (processamento síncrono)
- Acima de 50 MB: processamento em background, notificação quando pronto, link de download válido 24 horas

## 5.3 Backup automático
- Configurado pelo super user: frequência (diário ou semanal), dia da semana, retenção, empresas incluídas
- Requer integração `cloud_storage` activa
- Por execução: 3 tentativas com intervalo de 1 hora entre tentativas; super user notificado em cada falha
- Após 3 dias consecutivos de falhas: backup automático desactivado com notificação de urgência ao super user

## 5.4 Importação
- Só o super user pode importar
- Empresa importada começa inactiva — super user activa manualmente
- Permissões de módulos eliminadas após importação — administrador reconfigura
- Passwords continuam a funcionar (hashes mantidas); sessões não são restauradas

---

# 6. INTEGRAÇÕES EXTERNAS

## 6.1 Arquitectura

- Organizado por categorias (não por fornecedores)
- Uma integração activa por categoria (excepto `payments`: múltiplas activas possíveis em simultâneo)
- Alterar credenciais de integração activa desactiva-a automaticamente — tem de testar e reactivar
- Módulos pedem integrações por categoria, nunca por fornecedor — o núcleo resolve qual adaptador está activo

## 6.2 Categorias e fornecedores de raiz

### `email` — Envio de emails transaccionais
Resend — activo de raiz

### `sms` — Envio de SMS transaccionais
Twilio — inactivo de raiz

### `llm` — Modelos de linguagem
OpenAI, Anthropic, Google, Grok, Kimi, DeepSeek — inactivo de raiz. Após estabelecer ligação, o fornecedor devolve dinamicamente a lista de modelos disponíveis com custos por token (input/output por 1M tokens) — apresentados na interface para o super user escolher o modelo activo.

### `cloud_storage` — Armazenamento externo (backups automáticos)
Google Drive — inactivo de raiz. OAuth2 refresh token obtido externamente — a app não implementa flow OAuth2 interno.

### `calendar` — Integração com calendários
Google Calendar, Outlook — inactivo de raiz. OAuth2 refresh token obtido externamente — a app não implementa flow OAuth2 interno.

### `payments` — Processamento de pagamentos
Stripe (pagamentos internacionais, subscriptions) e Easypay (MBWay, Multibanco, mercado português) — inactivos de raiz. Complementares — podem estar ambos activos em simultâneo.

### `invoicing` — Facturação certificada AT
Moloni, InvoiceXpress — inactivo de raiz.

### `pdf` — Geração de PDFs a partir de HTML
Cloudflare Browser Rendering API — activo de raiz. Se credenciais não configuradas: funcionalidade de PDF indisponível; a app continua a funcionar normalmente. PDFs gerados ficam em cache no armazenamento da empresa e contam para a quota. Invalidação de cache disponível.

## 6.3 Emails de módulos

Emails enviados por módulos contam para o `daily_email_limit` da empresa. O núcleo verifica e debita o contador antes de entregar o adaptador de email ao módulo. Se o limite estiver atingido: devolve erro ao módulo.

Nota de arquitectura: o núcleo expõe um adaptador por categoria de integração. Módulos nunca chamam fornecedores directamente — pedem o adaptador ao núcleo e usam-no. O núcleo é responsável por verificar  limites (ex: daily_email_limit) antes de entregar o adaptador.

---

# 7. INTERNACIONALIZAÇÃO

- Idiomas de raiz: Português Europeu (`pt`) e Inglês (`en`)
- Toda a interface e emails usam chaves de tradução — nunca texto directo em componentes
- Paridade obrigatória entre idiomas — build falha se faltar chave em qualquer idioma
- Idiomas permitidos por empresa configurados pelo super user ao criar a empresa
- Administradores escolhem de entre os idiomas permitidos
- Colaboradores recebem o idioma definido no convite (defeito: idioma do administrador que convidou); podem mudar no perfil
- Módulos declaram as suas próprias chaves de tradução em ficheiros separados, fundidos em build sem alterar ficheiros de tradução do núcleo

**Idioma dos emails:**
- Convites: idioma escolhido para o destinatário no momento do convite
- Resets e confirmações de email: idioma do perfil do utilizador
- Se idioma indefinido: usa idioma defeito da app (`pt`)

---

# 8. TEMA VISUAL

- Ficheiro único de tokens CSS centraliza todas as decisões visuais — nenhum componente tem valores visuais directos
- 3 layouts: sidebar (defeito), topnav, compact — seleccionável por utilizador
- 6 paletas: indigo (defeito), emerald, rose, amber, slate, ocean — seleccionável por utilizador
- 2 temas: light (defeito), dark — seleccionável por utilizador
- Troca de layout, paleta e tema não requer re-render de componentes — apenas altera atributos no elemento raiz
- Módulos usam os mesmos tokens — não criam tokens próprios salvo extensão explicitamente necessária e documentada
- Ícones via `@lucide/svelte` exclusivamente
- Componentes de layout (Layout, Sidebar, Header) são isolados sem lógica de negócio

---

# 9. SISTEMA DE MÓDULOS

## 9.1 O que é

Módulo = backend + frontend + tabelas + traduções para uma funcionalidade de negócio. O núcleo não conhece os detalhes de nenhum módulo — apenas o seu registo. Adicionar um módulo = adicionar entrada no ficheiro de configuração central, sem alterar código do núcleo.

## 9.2 Registo

Cada módulo declara no ficheiro de configuração central:
- Identificador único, nome, ícone
- Integrações necessárias (por categoria)
- Permissões declaradas (binária por defeito; granular opcional)
- Limites configuráveis por empresa
- 6 handlers obrigatórios

## 9.3 Handlers obrigatórios

| Handler | Quando é chamado | O que deve fazer |
|---------|-----------------|------------------|
| `onUserDelete` | Soft delete de utilizador | Anonimizar ou apagar dados do utilizador nas tabelas do módulo; decrementar acumulador de storage se apagar ficheiros |
| `onTenantDelete` | Hard delete de empresa | Apagar todos os dados da empresa no módulo incluindo ficheiros e PDFs em cache |
| `onBackup` | Geração de backup | Devolver dados estruturados para inclusão no ZIP de backup |
| `onRestore` | Importação de backup | Restaurar dados a partir do payload |
| `onRgpdExport` | Exportação RGPD | Devolver dados pessoais do utilizador em JSON; núcleo agrega com dados de núcleo |
| `onCronMaintenance` | Cron de manutenção | Executar limpezas periódicas; pode ser no-op se não necessário |

Módulos podem registar entradas adicionais no activity log da empresa e no audit log da plataforma seguindo o mesmo sistema do núcleo.

## 9.4 Permissões de módulos

**Modelo binário (defeito):** cada colaborador tem ou não acesso a cada módulo (toggle). Sem acesso: colaborador não vê o módulo na navegação.

**Permissões granulares (opcional):** módulos que precisam de diferenciação interna declaram sub-permissões. O núcleo armazena os valores; o módulo interpreta e aplica. Se o módulo precisar de hierarquia entre colaboradores: implementa internamente via sub-permissões sem alterar a estrutura de roles do núcleo.

Administradores têm acesso total a todos os módulos — permissões só se aplicam a colaboradores.

## 9.5 Convenções obrigatórias

- **Tabelas:** `module_{module_id}_{table_name}` — primeiro campo é sempre `tenant_id` indexado, garantindo inclusão automática nos backups e no hard delete da empresa
- **Rotas e paths:** definidos pelo planeamento seguindo convenções do sistema
- **Traduções:** `locales/{lang}/module_{module_id}.json` — paridade obrigatória entre idiomas

## 9.6 Módulos na navegação

- Super user e administradores vêem todos os módulos registados
- Colaborador vê apenas os módulos para os quais tem permissão
- Módulos que exigem integração não activa aparecem como indisponíveis com indicação para configurar
- Super user pode clicar num módulo indisponível e é encaminhado directamente para a página de integrações

## 9.7 Checklist de implementação de módulo

- [ ] Registo no ficheiro de configuração central com id, nome, ícone, integrações, permissões, limites e handlers
- [ ] Tabelas com `tenant_id` como primeiro campo indexado; naming `module_{id}_{table}`
- [ ] Migrações forward-only
- [ ] Handler `onUserDelete` implementado
- [ ] Handler `onTenantDelete` implementado (inclui apagar PDFs em cache se aplicável)
- [ ] Handler `onBackup` implementado
- [ ] Handler `onRestore` implementado
- [ ] Handler `onRgpdExport` implementado
- [ ] Handler `onCronMaintenance` implementado (pode ser no-op)
- [ ] Ficheiros de tradução para todos os idiomas activos com paridade garantida
- [ ] Limites declarados criados automaticamente em `tenant_module_limits` para empresas existentes
- [ ] Sem tokens CSS próprios salvo extensão documentada
- [ ] Sem chamadas directas a fornecedores de integração — sempre via adaptador do núcleo
- [ ] Emails enviados via núcleo (contam para `daily_email_limit` da empresa)
- [ ] PDFs em cache: `onTenantDelete` apaga todos; `onCronMaintenance` limpa expirados

---

# 10. PÁGINAS DA APLICAÇÃO

## 10.1 Páginas públicas
- Setup inicial (indisponível após execução)
- Login
- Pedido de reset de password
- Confirmação de reset por token
- Aceitação de convite
- Confirmação de alteração de email

## 10.2 Super user
- Dashboard da plataforma
- Lista de empresas + criar nova empresa
- Detalhe de empresa:
  - dados da empresa (read-only)
  - dados de contacto do owner fixo (read-only)
  - limites de núcleo e módulos (editáveis)
  - árvore: ID owner fixo, IDs sócios com acções de elevação/transferência, contagem de colaboradores
  - acções: desactivar/reactivar empresa, hard delete, transferência de ownership
- Definições globais:
  - geral (nome da app, timezone, idiomas)
  - segurança (limites e durações)
  - integrações (por categoria)
  - backups automáticos
  - manutenção (hora do cron, limite da limpeza oportunista)
  - break-glass
- Backups (gerar/importar)
- Audit log
- Notificações
- Perfil pessoal

## 10.3 Administradores (owner fixo, owner temporário, sócios)
- Dashboard da empresa (indicadores: admin seats, member seats, storage, limites de módulos)
- Equipa (3 tabs):
  - Colaboradores: listar, desactivar/reactivar, eliminar
  - Convites: listar, criar, reenviar, cancelar
  - Permissões: matriz colaborador × módulos × permissões
- Backups da empresa
- Notificações
- Perfil:
  - Secção 1 — dados pessoais (todos os administradores): nome, apelido, email, telefone, website, foto, alterar email, alterar password, exportar RGPD
  - Secção 2 — dados da empresa (owner fixo e owner temporário): nome, morada, email, telefone, website, logótipo; acções exclusivas do owner fixo: pedir eliminação da empresa, pedir mais recursos
- Histórico de actividade (consultar para todos; backup e limpar apenas para owner fixo e owner temporário)

### Acções na tab Equipa por role

| Acção | Owner fixo | Owner temporário | Sócio |
|-------|-----------|-----------------|-------|
| Convidar sócio | ✅ | ✅ | ❌ |
| Convidar colaborador | ✅ | ✅ | ✅ |
| Eliminar sócio | ✅ | ✅ | ❌ |
| Eliminar colaborador | ✅ | ✅ | ✅ |
| Desactivar/reactivar colaborador | ✅ | ✅ | ✅ |

## 10.4 Colaborador
- Dashboard pessoal
- Módulos (apenas os que tem permissão)
- Notificações
- Perfil pessoal (inclui exportação RGPD e auto-eliminação)

## 10.5 Componentes globais autenticados
- Header: nome da app, sino de notificações com badge, acesso ao perfil, logout
- Navegação por role com módulos dinâmicos conforme role e permissões; módulos indisponíveis aparecem com indicação — super user pode clicar e ir directamente para integrações
- Sistema consistente de mensagens de sucesso, erro e aviso em toda a app

---

# 11. FLUXOS CRÍTICOS

## 11.1 Criar nova empresa
1. Super user preenche dados do owner, empresa, limites e idiomas
2. Sistema cria empresa e convite atomicamente (rollback se email falhar)
3. Owner aceita convite, cria conta, faz login
4. Owner completa dados da empresa em falta no perfil

## 11.2 Convites: ciclo completo
1. Administrador cria convite (ocupa slot e bloqueia email imediatamente)
2. Destinatário aceita: cria conta, permissões aplicadas, faz login
3. Se convite expirar: deixa de bloquear email e slot automaticamente; manutenção remove o registo
4. Reenvio: cancela anterior, novo token, link antigo inválido

## 11.3 Soft delete de utilizador
1. Utilizador eliminado por si próprio ou por alguém acima na hierarquia
2. Sistema anonimiza dados, apaga foto, elimina permissões, chama `onUserDelete` de módulos
3. Sessão invalidada, slot libertado
4. Irreversível

## 11.4 Elevação temporária de sócio
1. Super user verifica que não existe outro sócio elevado
2. Eleva sócio com duração configurável (defeito: 24h)
3. Sócio recebe notificação com data e hora exacta de expiração
4. Acções durante elevação são permanentes e registadas com indicação explícita
5. Expiração automática (cron) ou revogação manual pelo super user
6. Interface reverte na próxima interacção após expiração

## 11.5 Transferência atómica de ownership
1. Super user abre ficha da empresa e selecciona sócio para novo owner fixo
2. Se sócio está elevado como owner temporário: elevação revertida primeiro, dentro da mesma operação
3. Pop-up de confirmação explícita ("O owner actual será permanentemente removido. Esta acção é irreversível.")
4. Confirmação → transacção atómica:
   - sócio promovido a owner fixo
   - owner fixo anterior soft-deleted (anonimizado, sessão invalidada)
5. Se qualquer parte falhar: rollback completo
6. Empresa continua activa com novo owner fixo

## 11.6 Desactivar e reactivar empresa
1. Super user desactiva: invalida todas as sessões, cancela convites pendentes, revoga elevação
2. Reactivar: restaura acesso a utilizadores activos; convites cancelados não voltam

## 11.7 Hard delete de empresa
1. Super user inicia eliminação
2. Sistema verifica backup completo + download nos últimos 60 minutos
3. Confirmação forte (escrever nome da empresa)
4. Sistema apaga tudo e chama `onTenantDelete` de cada módulo
5. Registado no audit log sem dados pessoais

## 11.8 Escalação de pedido de recursos
1. Colaborador excede limite → erro com botão "Pedir ao administrador"
2. Se administrador não tem margem → botão "Pedir ao super user"
3. Super user altera limite → requerente original notificado

## 11.9 Limpar histórico de actividade
1. Owner fixo ou owner temporário inicia limpeza
2. Sistema verifica backup do histórico nos últimos 60 minutos
3. Histórico limpo; entrada adicionada à lista de limpezas com data e link de download

## 11.10 Exportação RGPD
1. Utilizador pede exportação no perfil
2. Sistema agrega dados de núcleo + dados de módulos (via `onRgpdExport`)
3. Download em JSON; exportação registada no audit log

---

## FORA DE ÂMBITO (PERMANENTE)

Nota para o Architect: estes itens nunca devem aparecer no BUILD_PLAN nem em nenhum milestone, mesmo que pareçam tecnicamente simples de adicionar.

O boilerplate não inclui e não deve incluir:
- Módulos de negócio específicos
- Auto-registo de qualquer tipo
- OAuth2 flow interno (tokens obtidos externamente pelo super user)
- Temas visuais por módulo
- Comunicação em tempo real (WebSockets)
- Analytics ou tracking de utilizadores
- Webhooks outbound
- Feature flags
- Push notifications
- Sub-roles de colaborador no núcleo

---

*Fim do PRODUCT BRIEF v6.5*