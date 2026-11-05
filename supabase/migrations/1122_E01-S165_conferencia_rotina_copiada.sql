-- ADR-0972: declaração imutável e guarda conservadora para cópias preparadas.
create table pcm.sso_conferencia_copia_rotina_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_copia_rotina_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencias_copia_rotina(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  plano_id uuid not null references pcm.planos_manutencao(id),versao_id uuid not null references pcm.plano_versoes(id),
  rotina_id uuid not null,plano_revision integer not null check(plano_revision>0),
  conteudo_sha256 text not null check(conteudo_sha256 ~ '^[a-f0-9]{64}$'), justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
  payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_conferencia_copia_rotina_gate enable row level security;
alter table pcm.sso_conferencia_copia_rotina_gate force row level security;
alter table pcm.sso_conferencias_copia_rotina enable row level security;
alter table pcm.sso_conferencias_copia_rotina force row level security;
revoke all on pcm.sso_conferencia_copia_rotina_gate,pcm.sso_conferencias_copia_rotina from public,anon,authenticated,service_role;
create trigger sso_conferencia_copia_rotina_imutavel before update or delete on pcm.sso_conferencias_copia_rotina
for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_hash_rotina_copia(p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select encode(sha256(convert_to(jsonb_build_object('rotina',to_jsonb(r),'questionario',case when q.id is null then null else to_jsonb(q) end)::text,'UTF8')),'hex')
  from pcm.rotinas_manutencao r left join pcm.questionarios q on q.id=r.questionario_id
  where r.plano_id=p_plano_id and r.versao_id=p_versao_id and r.id=p_rotina_id
$$;
revoke all on function pcm.sso_hash_rotina_copia(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_conferir_rotina_copiada(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_plano_id uuid,
  p_versao_id uuid,p_rotina_id uuid,p_plano_revision integer,p_conteudo_sha256 text,p_justificativa text) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ator uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;
  v_ant pcm.sso_conferencias_copia_rotina%rowtype;v_payload jsonb;v_resultado jsonb;v_hash text;v_justificativa text:=nullif(btrim(p_justificativa),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conferencia_copia_rotina_gate where id and habilitado for share;
  if not found then raise exception 'conferencia_copia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_cliente_id is null or p_plano_id is null
    or p_versao_id is null or p_rotina_id is null or p_plano_revision is null or p_plano_revision<1
    or p_conteudo_sha256 is null or p_conteudo_sha256 !~ '^[a-f0-9]{64}$'
    or v_justificativa is null or length(v_justificativa)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,
    'planoRevision',p_plano_revision,'conteudoSha256',p_conteudo_sha256,'justificativa',v_justificativa);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferencia-copia-rotina:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_conferencias_copia_rotina where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_plano.revisao<>p_plano_revision or v_plano.estado not in ('rascunho','em_revisao') then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='rascunho' for share;
  if not found then raise exception 'versao_indisponivel' using errcode='23514'; end if;
  select * into v_rotina from pcm.rotinas_manutencao where id=p_rotina_id and plano_id=p_plano_id and versao_id=p_versao_id for share;
  if not found then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
  if not exists(select 1 from pcm.sso_copias_rotina_modelo c where c.destino_cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_rotina_id=p_rotina_id)
    and not exists(select 1 from pcm.sso_copias_plano c cross join lateral jsonb_array_elements(c.resultado->'rotinas') x(item)
      where c.cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_versao_id=p_versao_id and x.item->>'rotinaId'=p_rotina_id::text) then
    raise exception 'origem_copia_indisponivel' using errcode='23514'; end if;
  if v_rotina.questionario_id is not null then
    perform 1 from pcm.questionarios where id=v_rotina.questionario_id and ativo for share;
    if not found then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
  end if;
  v_hash:=pcm.sso_hash_rotina_copia(p_plano_id,p_versao_id,p_rotina_id);
  if v_hash is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_hash<>p_conteudo_sha256 then raise exception 'conteudo_alterado' using errcode='40001'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,
    'rotinaId',p_rotina_id,'planoRevision',p_plano_revision,'conteudoSha256',v_hash,'declaracaoRegistrada',true,'aprovacaoRealizada',false);
  insert into pcm.sso_conferencias_copia_rotina(request_id,ator_id,cliente_id,plano_id,versao_id,rotina_id,plano_revision,conteudo_sha256,justificativa,payload,resultado)
  values(p_request_id,v_ator,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_plano_revision,v_hash,v_justificativa,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'rotina.copia_conferida','rotinas_manutencao',p_rotina_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'planoRevision',p_plano_revision,'conteudoSha256',v_hash,'justificativa',v_justificativa));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_conferir_rotina_copiada(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_guardar_conferencia_rotina_copiada() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rotina record;v_hash text;v_tem_copia boolean;
begin
  if old.estado is distinct from 'rascunho' or new.estado is distinct from 'aprovado' then return new; end if;
  select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update;
  if not found then raise exception 'plano_indisponivel' using errcode='23514'; end if;
  for v_rotina in select r.id,r.questionario_id from pcm.rotinas_manutencao r where r.plano_id=new.plano_id and r.versao_id=new.id order by r.id for share loop
    select exists(select 1 from pcm.sso_copias_rotina_modelo c where c.destino_plano_id=new.plano_id and c.destino_rotina_id=v_rotina.id)
      or exists(select 1 from pcm.sso_copias_plano c cross join lateral jsonb_array_elements(c.resultado->'rotinas') x(item)
        where c.destino_plano_id=new.plano_id and c.destino_versao_id=new.id and x.item->>'rotinaId'=v_rotina.id::text) into v_tem_copia;
    if not v_tem_copia then continue; end if;
    perform 1 from pcm.sso_conferencia_copia_rotina_gate where id and habilitado for share;
    if not found then raise exception 'conferencia_copia_desabilitada' using errcode='55000'; end if;
    if v_rotina.questionario_id is not null then
      perform 1 from pcm.questionarios where id=v_rotina.questionario_id and ativo for share;
      if not found then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
    end if;
    v_hash:=pcm.sso_hash_rotina_copia(new.plano_id,new.id,v_rotina.id);
    if v_hash is null or not exists(select 1 from pcm.sso_conferencias_copia_rotina c where c.cliente_id=v_plano.cliente_id
      and c.plano_id=new.plano_id and c.versao_id=new.id and c.rotina_id=v_rotina.id and c.plano_revision=v_plano.revisao and c.conteudo_sha256=v_hash) then
      raise exception 'rotina_copiada_sem_conferencia_atual' using errcode='23514'; end if;
  end loop;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_conferencia_rotina_copiada() from public,anon,authenticated,service_role;
create trigger sso_guardar_conferencia_rotina_copiada before update of estado on pcm.plano_versoes
for each row execute function pcm.sso_guardar_conferencia_rotina_copiada();
