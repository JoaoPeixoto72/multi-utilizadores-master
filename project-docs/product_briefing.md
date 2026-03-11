# Briefing Completo do Produto: Multi-Utilizadores Genspark

Este documento descreve as capacidades, funcionalidades e o estado atual da aplicação. Serve como o "Manual de Negócio" para qualquer nova IA.

## 1. O que é a aplicação?
É uma plataforma **SaaS Multi-Tenant** (Software as a Service) de alta performance, desenhada para gerir múltiplas empresas (Tenants) sob uma mesma infraestrutura. A aplicação é segura, rápida e extremamente personalizável sem necessidade de tocar no código (White-label ready).

## 2. Níveis de Acesso (Funções)
*   **Super Administrador (SuperUser)**:
    *   Gerente de toda a infraestrutura da plataforma.
    *   Controle total sobre Branding (Logos, Cores, Fontes, Bordas).
    *   Gestão de todas as empresas (Tenants), Backups e Auditoria Global.
*   **Administrador de Empresa (Owner/Admin)**:
    *   Gere a sua própria empresa.
    *   Convida membros da equipa, define permissões e vê logs de atividade da empresa.
*   **Utilizador de Equipa (User)**:
    *   Acede apenas aos recursos licenciados da sua empresa específica.

## 3. Principais Funcionalidades Implementadas

### A. Core Multi-Tenant
*   **Isolamento Total**: Uma empresa nunca vê os dados de outra.
*   **Sistema de Convites**: Fluxo robusto de convite de utilizadores com TTL (tempo de expiração) configurável.

### B. Gestão de Identidade Visual (Branding System)
*   **Motor de Temas Reativo**: Permite alterar Cores Primárias/Secundárias, Fundos, Fontes (Google Fonts) e Border-radius em tempo real.
*   **Preview Interativo**: O SuperAdmin tem uma ferramenta de "Live Mockup" onde vê como a app ficará antes de aplicar as cores globalmente.
*   **Presets Rápidos**: Inclui temas pré-definidos como `Moderno`, `Vibrante`, `Midnight` (Escuro Profundo) e `Natureza`.
*   **Controlo de Layout**: Suporta `Sidebar`, `Compact Sidebar` e `TopBar` (horizontal).

### C. Infraestrutura e Segurança
*   **Auditoria (Audit Log)**: Registo detalhado de quem fez o quê e quando, essencial para conformidade.
*   **Backups**: Rota dedicada para gestão de cópias de segurança da base de dados.
*   **Notificações**: Sistema de alertas e notificações para utilizadores.
*   **Proteção CSRF e Rate Limiting**: Segurança de nível empresarial implementada no core.

## 4. Estado Atual e Fluxos de Trabalho
A fundação está 100% sólida. Os fluxos de:
1.  Login e Gestão de Perfil.
2.  Configuração de Branding Global.
3.  Criação e Gestão de Tenants.
4.  Gestão de Equipa e Convites.

...estão totalmente operacionais.

## 5. Próximos Passos (Product Roadmap)
*   Integração profunda com APIs externas (ex: Pagamentos/Stripe).
*   Expansão dos módulos de Dashboard por Tenant.
*   Sistema de permissões granulares (RBAC) mais complexo.

---
**Nota para a nova IA:** Esta aplicação não usa Tailwind. Tudo o que vês na UI é controlado por um sistema de tokens em CSS Puro que reage ao `src/lib/stores/theme.svelte.ts` e às configurações salvas na base de dados.
