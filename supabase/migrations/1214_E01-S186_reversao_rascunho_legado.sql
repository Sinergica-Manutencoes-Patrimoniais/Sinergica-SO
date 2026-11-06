-- ADR-1066: reversão lógica restrita; não apaga dados ou abre gates.
create table pcm.sso_reversao_rascunho_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reversao_rascunho_legado_gate(id,habilitado) values(true,false);
-- Separado do gate da interface: sem prova de todas as fontes, somente pendência.
create table pcm.sso_reversao_cobertura_completa_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_reversao_cobertura_completa_gate(id,habilitado) values(true,false);
create table pcm.sso_reversoes_rascunho_legado (
  request_id uuid primary key, origem_request_id uuid not null references pcm.sso_rascunhos_planos_legados(request_id),
  cliente_id uuid not null references pcm.clientes(id),plano_id uuid not null references pcm.planos_manutencao(id),
  ator_id uuid not null references auth.users(id),revisao_esperada integer not null check(revisao_esperada>0),
  decisao text not null check(decisao in ('revertido_logicamente','pendente_reconciliacao')),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_reversao_rascunho_legado_gate enable row level security;
alter table pcm.sso_reversao_rascunho_legado_gate force row level security;
alter table pcm.sso_reversao_cobertura_completa_gate enable row level security;
alter table pcm.sso_reversao_cobertura_completa_gate force row level security;
alter table pcm.sso_reversoes_rascunho_legado enable row level security;
alter table pcm.sso_reversoes_rascunho_legado force row level security;
revoke all on pcm.sso_reversao_rascunho_legado_gate,pcm.sso_reversao_cobertura_completa_gate,pcm.sso_reversoes_rascunho_legado from public,anon,authenticated,service_role;
create trigger sso_reversoes_rascunho_legado_imutaveis before update or delete on pcm.sso_reversoes_rascunho_legado
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_reverter_rascunho_plano_legado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_origem_request_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_origem pcm.sso_rascunhos_planos_legados%rowtype;v_anterior pcm.sso_reversoes_rascunho_legado%rowtype;
  v_plano pcm.planos_manutencao%rowtype;v_fk record;v_referencia uuid;v_existe boolean;v_dependencias integer:=0;
  v_decisao text;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_origem_request_id is null
    or p_expected_revision is null or p_expected_revision<1 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'inventario_rls_indisponivel' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_reversao_rascunho_legado_gate where id and habilitado for share;
  if not found then raise exception 'reversao_desabilitada' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reversao-rascunho:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_reversoes_rascunho_legado where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from p_ator_id or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.origem_request_id is distinct from p_origem_request_id
      or v_anterior.revisao_esperada is distinct from p_expected_revision or v_anterior.motivo is distinct from v_motivo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_anterior.resultado;
  end if;
  select * into v_origem from pcm.sso_rascunhos_planos_legados where request_id=p_origem_request_id and cliente_id=p_cliente_id;
  if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into v_plano from pcm.planos_manutencao where id=v_origem.plano_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  perform id from pcm.plano_versoes where plano_id=v_plano.id order by id for update;
  perform id from pcm.rotinas_manutencao where plano_id=v_plano.id order by id for update;
  if v_plano.estado<>'rascunho' or v_plano.revisao is distinct from (v_origem.resultado->>'revision')::integer
    or (select count(*) from pcm.plano_versoes where plano_id=v_plano.id)<>1
    or not exists(select 1 from pcm.plano_versoes where id=v_origem.versao_id and plano_id=v_plano.id and estado='rascunho')
    or (select count(*) from pcm.rotinas_manutencao where plano_id=v_plano.id)<>1
    or not exists(select 1 from pcm.rotinas_manutencao where id=v_origem.rotina_id and versao_id=v_origem.versao_id) then
    v_dependencias:=v_dependencias+1;
  end if;
  -- Verifica cada coluna de FK cujo alvo seja um dos três registros.
  for v_fk in select n.nspname,c.relname,a.attname,con.confrelid
    from pg_catalog.pg_constraint con join pg_catalog.pg_class c on c.oid=con.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join lateral unnest(con.conkey,con.confkey) k(origem,destino) on true
    join pg_catalog.pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.origem
    join pg_catalog.pg_attribute b on b.attrelid=con.confrelid and b.attnum=k.destino
    where con.contype='f' and b.attname='id' and con.confrelid in ('pcm.planos_manutencao'::regclass,'pcm.plano_versoes'::regclass,'pcm.rotinas_manutencao'::regclass)
      and con.conrelid not in ('pcm.plano_versoes'::regclass,'pcm.rotinas_manutencao'::regclass,'pcm.sso_rascunhos_planos_legados'::regclass,'pcm.sso_reversoes_rascunho_legado'::regclass)
  loop
    v_referencia:=case v_fk.confrelid when 'pcm.planos_manutencao'::regclass then v_origem.plano_id
      when 'pcm.plano_versoes'::regclass then v_origem.versao_id else v_origem.rotina_id end;
    execute pg_catalog.format('select exists(select 1 from %I.%I where %I=$1)',v_fk.nspname,v_fk.relname,v_fk.attname) into v_existe using v_referencia;
    if v_existe then v_dependencias:=v_dependencias+1; end if;
  end loop;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  -- A varredura de FKs não comprova fontes sem FK, nem todos os escritores.
  perform 1 from pcm.sso_reversao_cobertura_completa_gate where id and habilitado for share;
  if not found then v_dependencias:=v_dependencias+1; end if;
  if v_dependencias=0 then
    update pcm.planos_manutencao set estado='encerrado',revisao=revisao+1,updated_at=now(),updated_by=p_ator_id where id=v_plano.id returning * into v_plano;
    v_decisao:='revertido_logicamente';
  else v_decisao:='pendente_reconciliacao'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'aggregateId',v_plano.id,'revision',v_plano.revisao,'state',v_decisao,
    'created',false,'linkedIds',jsonb_build_object('clienteId',p_cliente_id,'origemRequestId',p_origem_request_id),
    'warnings',case when v_dependencias>0 then jsonb_build_array('uso_posterior_ou_estado_alterado','dependencias_sem_fk_nao_comprovadas') else jsonb_build_array('dependencias_sem_fk_nao_comprovadas') end);
  insert into pcm.sso_reversoes_rascunho_legado(request_id,origem_request_id,cliente_id,plano_id,ator_id,revisao_esperada,decisao,motivo,resultado)
    values(p_request_id,p_origem_request_id,p_cliente_id,v_plano.id,p_ator_id,p_expected_revision,v_decisao,v_motivo,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.reversao_rascunho','planos_manutencao',v_plano.id,
    jsonb_build_object('requestId',p_request_id,'origemRequestId',p_origem_request_id,'decisao',v_decisao,'motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_reverter_rascunho_plano_legado(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
