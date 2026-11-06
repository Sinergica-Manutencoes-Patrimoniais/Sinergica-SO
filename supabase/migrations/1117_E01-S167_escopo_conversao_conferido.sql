-- ADR-0968: preparação privada; não altera gates da conversão existente.
create table pcm.sso_conversao_escopo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conversao_escopo_gate(id,habilitado) values(true,false);
create table pcm.sso_conversao_escopo_recibos(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id),escopo_sha256 text not null check(escopo_sha256 ~ '^[a-f0-9]{64}$'),criado_em timestamptz not null default now()
);
alter table pcm.sso_conversao_escopo_gate enable row level security;alter table pcm.sso_conversao_escopo_gate force row level security;
alter table pcm.sso_conversao_escopo_recibos enable row level security;alter table pcm.sso_conversao_escopo_recibos force row level security;
revoke all on pcm.sso_conversao_escopo_gate,pcm.sso_conversao_escopo_recibos from public,anon,authenticated,service_role;
create trigger sso_conversao_escopo_recibos_imutaveis before update or delete on pcm.sso_conversao_escopo_recibos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Deve ser chamado com a linha do Chamado já travada; não expor diretamente.
create function pcm.sso_hash_escopo_chamado(p_chamado uuid) returns text
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_composicao jsonb;v_parcelas text;v_continuacoes text;v_qtd_parcelas bigint;v_qtd_continuacoes bigint;
begin
  perform 1 from pcm.chamado_escopo_composicoes c where c.chamado_id=p_chamado for share;
  perform p.id from pcm.chamado_escopo_parcelas p where p.chamado_id=p_chamado order by p.id for share;
  perform p.id from pcm.chamado_continuacoes_propostas p where p.chamado_id=p_chamado order by p.id for share;
  select to_jsonb(c) into v_composicao from pcm.chamado_escopo_composicoes c where c.chamado_id=p_chamado;
  select count(*),string_agg(encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex'),'' order by p.id)
    into v_qtd_parcelas,v_parcelas from pcm.chamado_escopo_parcelas p where p.chamado_id=p_chamado;
  select count(*),string_agg(encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex'),'' order by p.id)
    into v_qtd_continuacoes,v_continuacoes from pcm.chamado_continuacoes_propostas p where p.chamado_id=p_chamado;
  if v_qtd_parcelas>1000 or v_qtd_continuacoes>1000 then raise exception 'escopo_extenso' using errcode='54000'; end if;
  return encode(sha256(convert_to(jsonb_build_array(p_chamado,v_composicao,v_qtd_parcelas,coalesce(v_parcelas,''),v_qtd_continuacoes,coalesce(v_continuacoes,''))::text,'UTF8')),'hex');
end; $$;
revoke all on function pcm.sso_hash_escopo_chamado(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_fotografia_escopo_conversao(p_cliente_id uuid,p_chamado_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_revisao bigint;v_hash text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conversao_escopo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'conversao_escopo_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select c.sso_revisao into v_revisao from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null for share;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  v_hash:=pcm.sso_hash_escopo_chamado(p_chamado_id);
  return jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'revision',v_revisao,'escopoSha256',v_hash);
end; $$;
revoke all on function pcm.sso_fotografia_escopo_conversao(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_converter_chamado_escopo_conferido(p_request_id uuid,p_expected_revision bigint,p_chamado_id uuid,p_cliente_id uuid,p_os_id uuid,p_campos jsonb,p_destino text,p_status_hub text,p_escopo_sha256 text,p_ator_esperado uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_conversao_escopo_recibos%rowtype;v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conversao_escopo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'conversao_escopo_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_ator_esperado is distinct from v_ator or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_escopo_sha256 is null or p_escopo_sha256 !~ '^[a-f0-9]{64}$'
    or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('escopo-conversao:'||p_request_id::text,0));
  -- Compartilha a trava do núcleo antes de inspecionar recibos legados.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_conversao_escopo_recibos where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.chamado_id is distinct from p_chamado_id or v_ant.escopo_sha256 is distinct from p_escopo_sha256 then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pcm.sso_converter_chamado_integral_autorizado(p_request_id,p_expected_revision,p_chamado_id,p_cliente_id,p_os_id,p_campos,p_destino,p_status_hub);
  end if;
  if exists(select 1 from pcm.chamado_os_comandos c where c.request_id=p_request_id) then
    raise exception 'pedido_sem_recibo_de_escopo' using errcode='23505'; end if;
  perform 1 from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  if pcm.sso_hash_escopo_chamado(p_chamado_id) is distinct from p_escopo_sha256 then raise exception 'escopo_alterado' using errcode='40001'; end if;
  v_resultado:=pcm.sso_converter_chamado_integral_autorizado(p_request_id,p_expected_revision,p_chamado_id,p_cliente_id,p_os_id,p_campos,p_destino,p_status_hub);
  insert into pcm.sso_conversao_escopo_recibos(request_id,ator_id,cliente_id,chamado_id,escopo_sha256) values(p_request_id,v_ator,p_cliente_id,p_chamado_id,p_escopo_sha256);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_converter_chamado_escopo_conferido(uuid,bigint,uuid,uuid,uuid,jsonb,text,text,text,uuid) from public,anon,authenticated,service_role;
