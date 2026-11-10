-- ADR-1348: autorização excepcional de janela somente no comando explícito.
create table pcm.sso_preparar_ciclo_vencido_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_preparar_ciclo_vencido_gate(id, habilitado) values (true, false);
alter table pcm.sso_preparar_ciclo_vencido_gate enable row level security;
alter table pcm.sso_preparar_ciclo_vencido_gate force row level security;
revoke all on pcm.sso_preparar_ciclo_vencido_gate from public, anon, authenticated, service_role;

create table pcm.sso_preparar_ciclo_vencido_tokens (
  txid bigint not null, ator_id uuid not null, plano_id uuid not null, versao_id uuid not null,
  rotina_id uuid not null, vencimento date not null,
  primary key (txid, ator_id, plano_id, versao_id, rotina_id, vencimento)
);
alter table pcm.sso_preparar_ciclo_vencido_tokens enable row level security;
alter table pcm.sso_preparar_ciclo_vencido_tokens force row level security;
revoke all on pcm.sso_preparar_ciclo_vencido_tokens from public, anon, authenticated, service_role;

-- Falha fechada se a definição instalada não for exatamente a esperada no trecho alterado.
do $migration$
declare
  v_nome text;
  v_original text;
  v_novo text;
  v_definicao text;
begin
  for v_nome, v_original, v_novo in values
    ('pcm.sso_materializar_rotina_calendario(uuid,uuid,uuid,uuid,integer,date,date)',
     'if p_inicio<v_hoje or p_fim>v_hoje+30 then',
     'if (p_inicio<v_hoje and not (p_inicio=p_fim and exists(select 1 from pcm.sso_preparar_ciclo_vencido_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.plano_id=p_plano_id and t.versao_id=p_versao_id and t.rotina_id=p_rotina_id and t.vencimento=p_inicio))) or p_fim>v_hoje+30 then'),
    ('pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)',
     'if p_vencimento<v_hoje or p_vencimento>v_hoje+30 then',
     'if (p_vencimento<v_hoje and not exists(select 1 from pcm.sso_preparar_ciclo_vencido_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid() and t.plano_id=p_plano_id and t.versao_id=p_versao_id and t.rotina_id=p_rotina_id and t.vencimento=p_vencimento)) or p_vencimento>v_hoje+30 then')
  loop
    select pg_catalog.pg_get_functiondef(v_nome::regprocedure) into v_definicao;
    if (length(v_definicao) - length(replace(v_definicao, v_original, ''))) / length(v_original) <> 1 then
      raise exception 'definicao_incompativel: %', v_nome;
    end if;
    execute replace(v_definicao, v_original, v_novo);
  end loop;
end;
$migration$;

create function pcm.sso_preparar_ciclo_vencido(
  p_request_id uuid, p_cliente_id uuid, p_plano_id uuid, p_versao_id uuid,
  p_rotina_id uuid, p_expected_revision integer, p_vencimento date
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_hoje date; v_resultado jsonb;
begin
  perform 1 from pcm.sso_preparar_ciclo_vencido_gate where id and habilitado for share;
  if not found then raise exception 'preparacao_vencido_desabilitada' using errcode = '55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_plano_id is null
    or p_versao_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_vencimento is null or not isfinite(p_vencimento) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.planos_manutencao where id = p_plano_id and cliente_id = p_cliente_id) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  -- Repetição é validada pelo comando canônico, mesmo após mudança da data civil.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  if not exists(select 1 from pcm.calendario_contratual_comandos where request_id = p_request_id) then
    v_hoje := pcm.sso_data_civil_versao_geracao(p_plano_id, p_versao_id);
    if p_vencimento >= v_hoje or p_vencimento < v_hoje - 366 then
      raise exception 'vencimento_fora_da_janela' using errcode = '22023';
    end if;
  end if;
  insert into pcm.sso_preparar_ciclo_vencido_tokens(txid, ator_id, plano_id, versao_id, rotina_id, vencimento)
    values(pg_catalog.txid_current(), v_ator, p_plano_id, p_versao_id, p_rotina_id, p_vencimento);
  v_resultado := pcm.sso_materializar_ciclo_canonico(p_request_id, p_cliente_id, p_plano_id,
    p_versao_id, p_rotina_id, p_expected_revision, p_vencimento);
  delete from pcm.sso_preparar_ciclo_vencido_tokens where txid = pg_catalog.txid_current()
    and ator_id = v_ator and plano_id = p_plano_id and versao_id = p_versao_id
    and rotina_id = p_rotina_id and vencimento = p_vencimento;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_preparar_ciclo_vencido(uuid,uuid,uuid,uuid,uuid,integer,date) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_preparar_ciclo_vencido(uuid,uuid,uuid,uuid,uuid,integer,date) to authenticated;
