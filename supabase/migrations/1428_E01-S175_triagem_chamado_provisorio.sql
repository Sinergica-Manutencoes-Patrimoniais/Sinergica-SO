-- ADR-1281: confirmação/correção privada e auditável, gate fechado.
create table pcm.sso_triagem_chamado_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_triagem_chamado_campo_gate(id,habilitado) values(true,false);
create table pcm.sso_triagem_chamado_campo_decisoes(
  request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),chamado_id uuid not null references pcm.chamados(id),
  os_id uuid not null references pcm.ordens_servico(id),revisao bigint not null check(revisao>0),ator_id uuid not null references auth.users(id),
  acao text not null check(acao in ('confirmar','corrigir')),motivo text not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
  unique(chamado_id,revisao)
);
alter table pcm.sso_triagem_chamado_campo_gate enable row level security;
alter table pcm.sso_triagem_chamado_campo_gate force row level security;
alter table pcm.sso_triagem_chamado_campo_decisoes enable row level security;
alter table pcm.sso_triagem_chamado_campo_decisoes force row level security;
revoke all on pcm.sso_triagem_chamado_campo_gate,pcm.sso_triagem_chamado_campo_decisoes from public,anon,authenticated,service_role;
create trigger sso_triagem_chamado_campo_decisoes_imutaveis before update or delete on pcm.sso_triagem_chamado_campo_decisoes
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_consultar_triagem_chamado_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p pcm.sso_origem_campo_processamentos%rowtype;c pcm.chamados%rowtype;o pcm.ordens_servico%rowtype;v_revisao bigint;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_triagem_chamado_campo_gate where id and habilitado for share;
  if not found then raise exception 'triagem_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into p from pcm.sso_origem_campo_processamentos where os_id=p_os_id and cliente_id=p_cliente_id and provisorio;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into c from pcm.chamados where id=p.chamado_id and cliente_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p.os_id and client_id=p_cliente_id and chamado_id=c.id and deleted_at is null;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select coalesce(max(revisao),0) into v_revisao from pcm.sso_triagem_chamado_campo_decisoes where chamado_id=c.id;
  return jsonb_build_object('clienteId',p_cliente_id,'chamadoId',c.id,'osId',p.os_id,'titulo',c.titulo,'descricao',c.descricao,
    'chamadoRevision',c.sso_revisao,'triagemRevision',v_revisao,'triagemPendente',v_revisao=0,'statusChamado',c.status,
    'encerrado',c.sso_encerrado_em is not null,'taskId',o.auvo_task_id::text,'osUpdatedAt',o.updated_at,'osAlterada',false,'validacaoPcmComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_triagem_chamado_campo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_triagem_chamado_campo(uuid,uuid,uuid) to authenticated;

create function pcm.sso_decidir_triagem_chamado_campo(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,p_expected_chamado bigint,p_expected_triagem bigint,
  p_acao text,p_titulo text,p_descricao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p pcm.sso_origem_campo_processamentos%rowtype;c pcm.chamados%rowtype;ant pcm.sso_triagem_chamado_campo_decisoes%rowtype;
  v_revisao bigint;v_payload jsonb;v_resultado jsonb;v_titulo text;v_descricao text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_request_id is null
    or p_expected_chamado is null or p_expected_chamado<1 or p_expected_triagem is null or p_expected_triagem<0
    or p_acao is null or p_acao not in ('confirmar','corrigir') or length(btrim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_titulo:=nullif(btrim(p_titulo),'');v_descricao:=nullif(btrim(p_descricao),'');
  if (p_acao='confirmar' and (p_titulo is not null or p_descricao is not null)) or
    (p_acao='corrigir' and (v_titulo is null or length(v_titulo)>200 or length(coalesce(v_descricao,''))>10000)) then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_triagem_chamado_campo_gate where id and habilitado for share;
  if not found then raise exception 'triagem_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'chamadoRevision',p_expected_chamado,'triagemRevision',p_expected_triagem,'acao',p_acao,'titulo',v_titulo,'descricao',v_descricao,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-triagem-chamado-request:'||p_request_id::text,0));
  select * into ant from pcm.sso_triagem_chamado_campo_decisoes where request_id=p_request_id;
  if found then
    if ant.ator_id is distinct from p_ator_id or ant.cliente_id is distinct from p_cliente_id or ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.ordens_servico o where o.id=ant.os_id and o.client_id=p_cliente_id and o.chamado_id=ant.chamado_id and o.deleted_at is null) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    return ant.resultado;
  end if;
  select * into p from pcm.sso_origem_campo_processamentos where os_id=p_os_id and cliente_id=p_cliente_id and provisorio for share;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into c from pcm.chamados where id=p.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found or c.status='cancelado' or c.sso_encerrado_em is not null then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.ordens_servico where id=p.os_id and client_id=p_cliente_id and chamado_id=c.id and deleted_at is null for share;
  if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
  select coalesce(max(revisao),0) into v_revisao from pcm.sso_triagem_chamado_campo_decisoes where chamado_id=c.id;
  if c.sso_revisao<>p_expected_chamado or v_revisao<>p_expected_triagem then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if p_acao='corrigir' then update pcm.chamados set titulo=v_titulo,descricao=v_descricao,updated_at=now(),updated_by=p_ator_id where id=c.id returning * into c; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,'chamadoId',c.id,'acao',p_acao,
    'chamadoRevision',c.sso_revisao,'triagemRevision',v_revisao+1,'osAlterada',false,'tarefaAlterada',false,'validacaoPcmComprovada',false);
  insert into pcm.sso_triagem_chamado_campo_decisoes(request_id,cliente_id,chamado_id,os_id,revisao,ator_id,acao,motivo,payload,resultado)
    values(p_request_id,p_cliente_id,c.id,p_os_id,v_revisao+1,p_ator_id,p_acao,btrim(p_motivo),v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.triagem_chamado_'||p_acao,'chamados',c.id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_triagem_chamado_campo(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_triagem_chamado_campo(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text) to authenticated;
