-- ADR-0442: comando com vínculo explícito de Visita e revisão.
create table pcm.reconciliacao_funcionario_visita_notas(request_id uuid primary key references pcm.reconciliacao_outbox_notas(request_id),
  visita_id uuid not null references pcm.visitas(id),revisao_visita integer not null check(revisao_visita>0));
alter table pcm.reconciliacao_funcionario_visita_notas enable row level security;
alter table pcm.reconciliacao_funcionario_visita_notas force row level security;
revoke all on pcm.reconciliacao_funcionario_visita_notas from public,anon,authenticated,service_role;
create trigger sso_nota_funcionario_visita_imutavel before update or delete on pcm.reconciliacao_funcionario_visita_notas for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_anotar_sync_funcionario_visita(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_revisao_visita integer,p_outbox_id uuid,p_estado text,p_tentativas integer,p_observacao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; q pcm.auvo_sync_outbox%rowtype; n pcm.reconciliacao_funcionario_visita_notas%rowtype; resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_funcionario_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' or p_request_id is null or p_cliente_id is null or p_visita_id is null
    or p_revisao_visita is null or p_revisao_visita<1 or p_outbox_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-nota:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into q from pcm.auvo_sync_outbox where id=p_outbox_id and entity='funcionarios' for share;
  if not found or pcm.sso_acesso_triagem_funcionario(p_cliente_id,q.row_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.visita_equipes where visita_id=p_visita_id and cliente_id=p_cliente_id and funcionario_id=q.row_id and encerrado_em is null for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into n from pcm.reconciliacao_funcionario_visita_notas where request_id=p_request_id;
  if found then
    if n.visita_id is distinct from p_visita_id or n.revisao_visita is distinct from p_revisao_visita then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  elsif v.revisao<>p_revisao_visita then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  resultado:=pcm.sso_anotar_sync_funcionario(p_request_id,p_cliente_id,p_outbox_id,p_estado,p_tentativas,p_observacao);
  if n.request_id is null then insert into pcm.reconciliacao_funcionario_visita_notas(request_id,visita_id,revisao_visita) values(p_request_id,p_visita_id,p_revisao_visita); end if;
  return resultado || jsonb_build_object('visitaId',p_visita_id,'revisaoVisita',p_revisao_visita);
end $$;
revoke all on function pcm.sso_anotar_sync_funcionario_visita(uuid,uuid,uuid,integer,uuid,text,integer,text) from public,anon,authenticated,service_role;
