-- MANUAL; NÃO EXECUTAR SEM DRENAR PRODUTORES, REVISÃO E AUTORIZAÇÃO OPERACIONAL.
-- Não apaga nem renumera OS. Com mais de uma OS ativa por Chamado, a reversão falha integralmente.
begin;
lock table pcm.chamados, pcm.ordens_servico in access exclusive mode nowait;
do $validacao$
declare v_criacao boolean; v_guarda boolean;
begin
  select habilitado into v_criacao from pcm.chamado_os_gate where id for update;
  select habilitado into v_guarda from pcm.sso_guarda_multiplas_os_gate where id for update;
  if v_criacao is distinct from false or v_guarda is distinct from true then raise exception 'gates_incompativeis'; end if;
  if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null
    or exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass and t.tgname = 'trg_ordens_servico_numero_chamado' and not t.tgisinternal)
    or not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'pcm.ordens_servico'::regclass and t.tgname = 'sso_numero_os_chamado' and not t.tgisinternal
      and t.tgfoid = 'pcm.sso_numero_os_chamado_compativel()'::regprocedure) then
    raise exception 'estado_da_transicao_incompativel'; end if;
  if exists(select 1 from pcm.ordens_servico where chamado_id is not null and deleted_at is null
      group by chamado_id having count(*) > 1) then raise exception 'multiplas_os_impedem_reversao'; end if;
end;
$validacao$;
create unique index uq_ordens_servico_chamado on pcm.ordens_servico(chamado_id)
  where chamado_id is not null and deleted_at is null;
create trigger trg_ordens_servico_numero_chamado before insert on pcm.ordens_servico
  for each row execute function pcm.fn_ordens_servico_sync_numero_chamado();
drop trigger sso_numero_os_chamado on pcm.ordens_servico;
update pcm.sso_guarda_multiplas_os_gate set habilitado = false where id;
commit;
