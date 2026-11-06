-- ADR-0387: wrapper fechado do comando canônico, sem gerar OS.
create table pcm.sso_atender_parcela_revisada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_atender_parcela_revisada_gate(id,habilitado) values(true,false);
create table pcm.sso_atendimentos_parcela_revisada(id uuid primary key default gen_random_uuid(),parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),os_id uuid not null references pcm.ordens_servico(id),cliente_id uuid not null references pcm.clientes(id),revisao_revisao integer not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_atender_parcela_revisada_gate enable row level security;alter table pcm.sso_atender_parcela_revisada_gate force row level security;
alter table pcm.sso_atendimentos_parcela_revisada enable row level security;alter table pcm.sso_atendimentos_parcela_revisada force row level security;
revoke all on pcm.sso_atender_parcela_revisada_gate,pcm.sso_atendimentos_parcela_revisada from public,anon,authenticated,service_role;
create function pcm.sso_atender_parcela_revisada(p_request_id uuid,p_parcela_id uuid,p_os_id uuid,p_chamado_revision bigint,p_escopo_revision bigint,p_revisao_humana integer,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_parcela pcm.chamado_escopo_parcelas%rowtype;v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;v_revisao pcm.sso_revisoes_parcela%rowtype;v_ant pcm.sso_atendimentos_parcela_revisada%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_atender_parcela_revisada_gate where id),false) then raise exception 'atendimento_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_parcela_id is null or p_os_id is null or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1 or p_revisao_humana is null or p_revisao_humana<1 or p_confirma is not true or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'chamadoRevision',p_chamado_revision,'escopoRevision',p_escopo_revision,'revisaoHumana',p_revisao_humana,'confirma',true,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:'||p_request_id::text,0));
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  if not found then raise exception 'parcela_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_parcela.chamado_id for update;
  if not found or v_chamado.deleted_at is not null or config.sso_autorizar_acao('execucao.validar',v_chamado.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_chamado.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_atendimentos_parcela_revisada where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;
  end if;
  if exists(select 1 from pcm.chamado_os_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  if v_chamado.sso_revisao<>p_chamado_revision or v_escopo.chamado_id is null or v_escopo.revisao<>p_escopo_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  select * into v_revisao from pcm.sso_revisoes_parcela where parcela_id=p_parcela_id and cliente_id=v_chamado.cliente_id order by revisao desc limit 1;
  if not found or v_revisao.revisao<>p_revisao_humana or v_revisao.atendida is not true or v_revisao.os_id is distinct from p_os_id then raise exception 'revisao_humana_invalida' using errcode='40001'; end if;
  if not exists(select 1 from pcm.sso_atribuicoes_parcela a join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null and o.status='finalizado' where a.parcela_id=p_parcela_id and a.os_id=p_os_id and a.chamado_id=v_chamado.id and a.cliente_id=v_chamado.cliente_id) then raise exception 'os_atribuida_nao_finalizada' using errcode='23514'; end if;
  v_resultado:=pcm.sso_comando_escopo_chamado(p_request_id,v_chamado.cliente_id,v_chamado.id,p_chamado_revision,'atender_parcela',p_parcela_id,null,p_os_id,null);
  insert into pcm.sso_atendimentos_parcela_revisada(parcela_id,os_id,cliente_id,revisao_revisao,ator_id,request_id,payload,resultado) values(p_parcela_id,p_os_id,v_chamado.cliente_id,p_revisao_humana,v_ator,p_request_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.parcela_atendida_revisada','chamados',v_chamado.id,v_resultado||jsonb_build_object('clienteId',v_chamado.cliente_id,'revisaoHumana',p_revisao_humana,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atender_parcela_revisada(uuid,uuid,uuid,bigint,bigint,integer,boolean,text) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_atendimento_parcela_revisada(p_parcela_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_parcela pcm.chamado_escopo_parcelas%rowtype;v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;v_revisao pcm.sso_revisoes_parcela%rowtype;v_finalizada boolean;
begin
  if not coalesce((select habilitado from pcm.sso_atender_parcela_revisada_gate where id),false) then raise exception 'atendimento_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_parcela_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  select * into v_chamado from pcm.chamados where id=v_parcela.chamado_id and deleted_at is null;
  if v_chamado.id is null or config.sso_autorizar_acao('execucao.validar',v_chamado.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_chamado.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id;
  select * into v_revisao from pcm.sso_revisoes_parcela where parcela_id=p_parcela_id and cliente_id=v_chamado.cliente_id order by revisao desc limit 1;
  select exists(select 1 from pcm.sso_atribuicoes_parcela a join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null and o.status='finalizado' where a.parcela_id=p_parcela_id and a.os_id=v_revisao.os_id and a.chamado_id=v_chamado.id and a.cliente_id=v_chamado.cliente_id) into v_finalizada;
  return jsonb_build_object('parcelaId',p_parcela_id,'situacao',v_parcela.situacao,'chamadoRevision',v_chamado.sso_revisao,'escopoRevision',v_escopo.revisao,'revisaoHumana',v_revisao.revisao,'osId',v_revisao.os_id,'condicao',v_revisao.condicao,'atendidaDeclarada',v_revisao.atendida,'osFinalizada',v_finalizada);
end;
$$;
revoke all on function pcm.sso_consultar_atendimento_parcela_revisada(uuid) from public,anon,authenticated,service_role;
