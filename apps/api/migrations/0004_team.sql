-- migrations/0004_team.sql — M3: Equipa + permissões de módulos
-- R: BUILD_PLAN.md §M3
-- R: LL-01 — migrations com ADD COLUMN incluem UPDATE para linhas existentes

-- Adicionar coluna module_permissions à tabela users
-- Guarda as permissões de módulos de cada colaborador como JSON
ALTER TABLE users ADD COLUMN module_permissions TEXT NOT NULL DEFAULT '{}';

-- Não é necessário UPDATE pois '{}' é o valor correcto para todos os existentes
-- (todos os utilizadores existentes têm acesso sem restrições específicas por módulo)
