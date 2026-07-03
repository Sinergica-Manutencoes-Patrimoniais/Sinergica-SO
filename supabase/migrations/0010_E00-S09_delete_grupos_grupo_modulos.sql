-- 0010_E00-S09_delete_grupos_grupo_modulos.sql — Sinérgica SO
-- Story E00-S09. Corrige uma lacuna real achada durante a revisão de E00-S10 (UI consumindo
-- este schema): `config.grupos` e `config.grupo_modulos` nunca ganharam GRANT/policy de DELETE
-- em 0006_E00-S09_grupos_permissoes_modulo.sql.
--
-- Dois usos legítimos que precisam disso:
--   1. `criarGrupo()` no frontend faz rollback (apaga o grupo recém-criado) se a gravação das
--      permissões falhar no meio do fluxo — precisa apagar `config.grupos`.
--   2. `editarGrupo()` substitui as permissões de um grupo (apaga todas as linhas de
--      `grupo_modulos` do grupo e reinsere) — precisa apagar `config.grupo_modulos`.
-- `config.usuario_modulos` não precisa de DELETE direto do client: a troca de modo do usuário
-- passa por `config.definir_permissao_usuario` (SECURITY DEFINER, já bypassa RLS/GRANT).
-- `config.grupos` continua com `ativo` para desativação "normal" via UI (não é isso que este
-- DELETE cobre — é rollback de criação malsucedida, ação administrativa legítima de
-- superadmin/supervisor, não uma mudança na convenção de soft-delete do projeto).
--
-- Reverso:
--   revoke delete on config.grupos, config.grupo_modulos from authenticated;
--   drop policy if exists "grupos_delete" on config.grupos;
--   drop policy if exists "grupo_modulos_delete" on config.grupo_modulos;

grant delete on config.grupos, config.grupo_modulos to authenticated;

create policy "grupos_delete" on config.grupos
  for delete to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

create policy "grupo_modulos_delete" on config.grupo_modulos
  for delete to authenticated
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));
