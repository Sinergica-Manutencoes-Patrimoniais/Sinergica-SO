-- ADR-1356: declaração humana, sem geração de faturável ou efeito financeiro.
create table financeiro.sso_atestacao_servico_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into financeiro.sso_atestacao_servico_gate(id, habilitado) values(true, false);
alter table financeiro.sso_atestacao_servico_gate enable row level security;
alter table financeiro.sso_atestacao_servico_gate force row level security;
revoke all on financeiro.sso_atestacao_servico_gate from public, anon, authenticated, service_role;

create table financeiro.sso_atestacoes_servico(
  fato_id uuid primary key references financeiro.sso_fatos_execucao_declarados(id),
  cliente_id uuid not null references pcm.clientes(id), revisao integer not null check(revisao > 0),
  estado text not null check(estado in ('confirmada','retirada')), revisao_pcm_id uuid not null references pcm.sso_revisoes_validacao_os(id),
  atualizado_em timestamptz not null default now()
);
create table financeiro.sso_atestacoes_servico_eventos(
  request_id uuid primary key, fato_id uuid not null references financeiro.sso_fatos_execucao_declarados(id),
  cliente_id uuid not null references pcm.clientes(id), ator_id uuid not null references auth.users(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table financeiro.sso_atestacoes_servico enable row level security;
alter table financeiro.sso_atestacoes_servico force row level security;
alter table financeiro.sso_atestacoes_servico_eventos enable row level security;
alter table financeiro.sso_atestacoes_servico_eventos force row level security;
revoke all on financeiro.sso_atestacoes_servico, financeiro.sso_atestacoes_servico_eventos from public, anon, authenticated, service_role;
create trigger sso_atestacoes_servico_eventos_imutaveis before update or delete on financeiro.sso_atestacoes_servico_eventos
  for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function financeiro.sso_alterar_atestacao_servico(p_request_id uuid,p_cliente_id uuid,p_fato_id uuid,
  p_expected_revision integer,p_acao text,p_motivo text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_fato financeiro.sso_fatos_execucao_declarados%rowtype;
  v_atual financeiro.sso_atestacoes_servico%rowtype; v_evento financeiro.sso_atestacoes_servico_eventos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_ultima integer; v_total bigint; v_versionadas bigint;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_atestacao_servico_gate where id and habilitado for share;
  if not found then raise exception 'atestacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_fato_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_acao is null or p_acao not in ('confirmar','retirar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  v_payload := jsonb_build_object('clienteId',p_cliente_id,'fatoId',p_fato_id,'expectedRevision',p_expected_revision,'acao',p_acao,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atestacao-servico-request:' || p_request_id::text,0));
  select * into v_evento from financeiro.sso_atestacoes_servico_eventos where request_id=p_request_id;
  if found then
    if v_evento.ator_id is distinct from v_ator or v_evento.cliente_id is distinct from p_cliente_id or v_evento.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
    return v_evento.resultado;
  end if;
  select * into v_fato from financeiro.sso_fatos_execucao_declarados where id=p_fato_id and cliente_id=p_cliente_id;
  if not found then raise exception 'fato_indisponivel' using errcode='42501'; end if;
  perform 1 from pcm.retorno_os_preparado where id=v_fato.retorno_id and cliente_id=p_cliente_id for update nowait;
  if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
  select * into v_atual from financeiro.sso_atestacoes_servico where fato_id=p_fato_id for update;
  if coalesce(v_atual.revisao,0) <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if p_acao='confirmar' then
    if v_atual.estado='confirmada' then raise exception 'atestacao_ja_confirmada' using errcode='23514'; end if;
    select count(*),coalesce(max(revisao),0) into v_versionadas,v_ultima from pcm.sso_revisoes_validacao_os where retorno_id=v_fato.retorno_id;
    select count(*) into v_total from pcm.decisoes_validacao_os where retorno_id=v_fato.retorno_id;
    if v_total<>v_versionadas or not exists(select 1 from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id and d.retorno_id=r.retorno_id
      where r.id=v_fato.revisao_id and r.retorno_id=v_fato.retorno_id and r.revisao=v_ultima and d.decisao='aprovar') then raise exception 'revisao_pcm_obsoleta' using errcode='40001'; end if;
  elsif v_atual.estado is distinct from 'confirmada' then raise exception 'atestacao_nao_confirmada' using errcode='23514'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into financeiro.sso_atestacoes_servico(fato_id,cliente_id,revisao,estado,revisao_pcm_id,atualizado_em)
    values(p_fato_id,p_cliente_id,p_expected_revision+1,case when p_acao='confirmar' then 'confirmada' else 'retirada' end,v_fato.revisao_id,now())
    on conflict(fato_id) do update set revisao=excluded.revisao,estado=excluded.estado,revisao_pcm_id=excluded.revisao_pcm_id,atualizado_em=excluded.atualizado_em
    returning * into v_atual;
  v_resultado := jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'fatoId',p_fato_id,'revision',v_atual.revisao,'estado',v_atual.estado,
    'revisaoPcmId',v_atual.revisao_pcm_id,'execucaoFisicaComprovada',false,'exclusividadeComprovada',false,'geraFaturavel',false);
  insert into financeiro.sso_atestacoes_servico_eventos(request_id,fato_id,cliente_id,ator_id,payload,resultado) values(p_request_id,p_fato_id,p_cliente_id,v_ator,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'servico.atestacao_'||p_acao,'sso_fatos_execucao_declarados',p_fato_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_alterar_atestacao_servico(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_alterar_atestacao_servico(uuid,uuid,uuid,integer,text,text) to authenticated;

create function financeiro.sso_consultar_atestacao_servico(p_cliente_id uuid,p_fato_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_fato financeiro.sso_fatos_execucao_declarados%rowtype; v_atual financeiro.sso_atestacoes_servico%rowtype;
  v_ultima integer; v_total bigint; v_versionadas bigint; v_valida boolean;
begin
  perform 1 from financeiro.sso_atestacao_servico_gate where id and habilitado for share;
  if not found then raise exception 'atestacao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_fato_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_fato from financeiro.sso_fatos_execucao_declarados where id=p_fato_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_atual from financeiro.sso_atestacoes_servico where fato_id=p_fato_id and cliente_id=p_cliente_id;
  select count(*),coalesce(max(revisao),0) into v_versionadas,v_ultima from pcm.sso_revisoes_validacao_os where retorno_id=v_fato.retorno_id;
  select count(*) into v_total from pcm.decisoes_validacao_os where retorno_id=v_fato.retorno_id;
  select v_total=v_versionadas and exists(select 1 from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id and d.retorno_id=r.retorno_id
    where r.id=v_fato.revisao_id and r.retorno_id=v_fato.retorno_id and r.revisao=v_ultima and d.decisao='aprovar') into v_valida;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'fatoId',p_fato_id,'revision',coalesce(v_atual.revisao,0),
    'estado',v_atual.estado,'revisaoPcmId',v_fato.revisao_id,'revisaoPcmAtual',v_valida,
    'execucaoFisicaComprovada',false,'exclusividadeComprovada',false,'geraFaturavel',false);
end; $$;
revoke all on function financeiro.sso_consultar_atestacao_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_consultar_atestacao_servico(uuid,uuid) to authenticated;
