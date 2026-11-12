-- SUPERADO por `supabase/migrations/1842_E01-S167_transicao_1n_chamado_os.sql`. NÃO EXECUTE.
-- Este script era MANUAL e, por isso, nunca rodou: a transição 1:1 -> 1:N ficou pronta e parada,
-- com toda a engenharia dependente recusando com `55000 transicao_legada_incompleta`. O conteúdo
-- virou migration versionada (mesmas pré-condições, mesma ordem de aplicação), testada em CI por
-- `supabase/tests/E01-S167_transicao_1n_invariantes.test.sql`. Mantido aqui só como registro
-- histórico do desenho do corte. A reversão segue em `s167-reverter-transicao-1n.sql`.
--
-- Cuidado operacional que a migration herda: `lock table ... in access exclusive mode nowait`
-- falha de imediato se houver escrita em voo em pcm.chamados/pcm.ordens_servico. Drenar os
-- produtores antes do deploy; a trava SQL não alcança efeitos externos.
begin;
lock table pcm.chamados, pcm.ordens_servico in access exclusive mode nowait;
do $validacao$
declare v_criacao boolean; v_guarda boolean;
begin
  select habilitado into v_criacao from pcm.chamado_os_gate where id for update;
  select habilitado into v_guarda from pcm.sso_guarda_multiplas_os_gate where id for update;
  if v_criacao is distinct from false or v_guarda is distinct from false then
    raise exception 'gates_devem_estar_fechados'; end if;
  if not exists(select 1 from pg_catalog.pg_index i where i.indexrelid = pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado')
      and i.indrelid = 'pcm.ordens_servico'::regclass and i.indisunique and i.indisvalid
      and pg_catalog.pg_get_indexdef(i.indexrelid) like '%(chamado_id)%'
      and pg_catalog.pg_get_expr(i.indpred, i.indrelid) = '((chamado_id IS NOT NULL) AND (deleted_at IS NULL))') then
    raise exception 'indice_legado_inesperado'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'trg_ordens_servico_numero_chamado' and not t.tgisinternal and t.tgenabled <> 'D'
      and t.tgfoid = 'pcm.fn_ordens_servico_sync_numero_chamado()'::regprocedure) then
    raise exception 'trigger_legada_inesperada'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass
      and t.tgname = 'sso_guardar_novo_vinculo_chamado_os' and not t.tgisinternal and t.tgenabled <> 'D'
      and t.tgfoid = 'pcm.sso_guardar_novo_vinculo_chamado_os()'::regprocedure)
    or exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass and t.tgname = 'sso_numero_os_chamado' and not t.tgisinternal) then
    raise exception 'guarda_ou_numeracao_inesperada'; end if;
  if exists(select 1 from pcm.ordens_servico o left join pcm.chamados c on c.id = o.chamado_id
      where o.deleted_at is null and o.chamado_id is not null and (c.id is null or c.deleted_at is not null or c.cliente_id is distinct from o.client_id)) then
    raise exception 'vinculo_legado_inconsistente'; end if;
  if exists(select 1 from pcm.chamados c left join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and c.ordem_servico_id is not null and
        (o.id is null or o.deleted_at is not null or o.client_id is distinct from c.cliente_id or o.chamado_id is distinct from c.id)) then
    raise exception 'referencia_singular_inconsistente'; end if;
end;
$validacao$;
create trigger sso_numero_os_chamado before insert on pcm.ordens_servico
  for each row execute function pcm.sso_numero_os_chamado_compativel();
update pcm.sso_guarda_multiplas_os_gate set habilitado = true where id;
drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico;
drop index pcm.uq_ordens_servico_chamado;
-- O gate de criação permanece fechado; habilitação requer decisão operacional separada.
commit;
