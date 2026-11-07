-- ADR-0383: revisão auditada, sem modificar parcela ou OS.
create table pcm.sso_revisao_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_revisao_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_revisoes_parcela(id uuid primary key default gen_random_uuid(),parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),os_id uuid not null references pcm.ordens_servico(id),cliente_id uuid not null references pcm.clientes(id),evidencia_id uuid not null references pcm.retorno_evidencias_declaradas(id),revisao integer not null check(revisao>0),condicao text not null check(length(btrim(condicao)) between 1 and 2000),atendida boolean not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(parcela_id,revisao));
alter table pcm.sso_revisao_parcela_gate enable row level security;alter table pcm.sso_revisao_parcela_gate force row level security;
alter table pcm.sso_revisoes_parcela enable row level security;alter table pcm.sso_revisoes_parcela force row level security;
revoke all on pcm.sso_revisao_parcela_gate,pcm.sso_revisoes_parcela from public,anon,authenticated,service_role;
create function pcm.sso_revisoes_parcela_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_revisoes_parcela_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_revisoes_parcela_imutaveis before update or delete on pcm.sso_revisoes_parcela for each row execute function pcm.sso_revisoes_parcela_imutaveis();
create function pcm.sso_revisar_condicao_parcela(p_request_id uuid,p_parcela_id uuid,p_os_id uuid,p_evidencia_id uuid,p_expected_revision integer,p_condicao text,p_atendida boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_parcela pcm.chamado_escopo_parcelas%rowtype;v_chamado pcm.chamados%rowtype;v_ant pcm.sso_revisoes_parcela%rowtype;v_rev integer;
begin
  if not coalesce((select habilitado from pcm.sso_revisao_parcela_gate where id),false) then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_parcela_id is null or p_os_id is null or p_evidencia_id is null or p_expected_revision is null or p_expected_revision<0 or p_condicao is null or length(btrim(p_condicao)) not between 1 and 2000 or p_atendida is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revisao-parcela:'||p_request_id::text,0));
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  if not found then raise exception 'parcela_indisponivel' using errcode='42501'; end if;
  select * into v_chamado from pcm.chamados where id=v_parcela.chamado_id for update;
  if not found or v_chamado.deleted_at is not null or config.sso_autorizar_acao('execucao.validar',v_chamado.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_chamado.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_ant from pcm.sso_revisoes_parcela where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.parcela_id is distinct from p_parcela_id or v_ant.os_id is distinct from p_os_id or v_ant.evidencia_id is distinct from p_evidencia_id or v_ant.revisao<>p_expected_revision+1 or v_ant.condicao is distinct from btrim(p_condicao) or v_ant.atendida is distinct from p_atendida or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',p_parcela_id,'revision',v_ant.revisao,'atendidaDeclarada',v_ant.atendida,'requestId',p_request_id);
  end if;
  select coalesce(max(revisao),0) into v_rev from pcm.sso_revisoes_parcela where parcela_id=p_parcela_id;
  if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.sso_atribuicoes_parcela a join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null join pcm.retorno_os_preparado r on r.os_id=o.id and r.cliente_id=a.cliente_id join pcm.retorno_evidencias_declaradas e on e.retorno_id=r.id where a.parcela_id=p_parcela_id and a.os_id=p_os_id and a.chamado_id=v_chamado.id and a.cliente_id=v_chamado.cliente_id and e.id=p_evidencia_id) then raise exception 'evidencia_ou_atribuicao_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_revisoes_parcela(parcela_id,os_id,cliente_id,evidencia_id,revisao,condicao,atendida,motivo,ator_id,request_id) values(p_parcela_id,p_os_id,v_chamado.cliente_id,p_evidencia_id,v_rev+1,btrim(p_condicao),p_atendida,btrim(p_motivo),v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.parcela_revisada','chamados',v_chamado.id,jsonb_build_object('clienteId',v_chamado.cliente_id,'parcelaId',p_parcela_id,'osId',p_os_id,'evidenciaId',p_evidencia_id,'revision',v_rev+1,'condicao',btrim(p_condicao),'atendidaDeclarada',p_atendida,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('parcelaId',p_parcela_id,'revision',v_rev+1,'atendidaDeclarada',p_atendida,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_revisar_condicao_parcela(uuid,uuid,uuid,uuid,integer,text,boolean,text) from public,anon,authenticated,service_role;
create function pcm.sso_cliente_revisao_parcela(p_parcela_id uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_revisao_parcela_gate where id),false) then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_parcela_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.cliente_id into v_cliente from pcm.chamado_escopo_parcelas p join pcm.chamados c on c.id=p.chamado_id and c.deleted_at is null where p.id=p_parcela_id;
  if v_cliente is null or config.sso_autorizar_acao('execucao.validar',v_cliente) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;return v_cliente;
end;
$$;
revoke all on function pcm.sso_cliente_revisao_parcela(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_revisoes_parcela(p_parcela_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,os_id uuid,evidencia_id uuid,condicao text,atendida boolean,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_cliente:=pcm.sso_cliente_revisao_parcela(p_parcela_id);
  return query select r.revisao,r.os_id,r.evidencia_id,r.condicao,r.atendida,r.motivo,r.ator_id,r.criado_em from pcm.sso_revisoes_parcela r where r.parcela_id=p_parcela_id and r.cliente_id=v_cliente and (p_apos is null or r.revisao>p_apos) order by r.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_revisoes_parcela(uuid,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_listar_evidencias_revisao_parcela(p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(evidencia_id uuid,os_id uuid,tipo text,referencia text,descricao text) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_cliente:=pcm.sso_cliente_revisao_parcela(p_parcela_id);
  return query select e.id,o.id,e.tipo,e.referencia,e.descricao from pcm.sso_atribuicoes_parcela a join pcm.ordens_servico o on o.id=a.os_id and o.chamado_id=a.chamado_id and o.client_id=a.cliente_id and o.deleted_at is null join pcm.retorno_os_preparado r on r.os_id=o.id and r.cliente_id=v_cliente join pcm.retorno_evidencias_declaradas e on e.retorno_id=r.id where a.parcela_id=p_parcela_id and a.cliente_id=v_cliente and (p_apos is null or e.id>p_apos) order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_evidencias_revisao_parcela(uuid,uuid,integer) from public,anon,authenticated,service_role;
