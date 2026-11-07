-- ADR-0888: leitura de fotografia aprovada, gate desligado; não gera artefato.
create table pcm.sso_snapshot_exportacao_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_snapshot_exportacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_snapshot_exportacao_gate enable row level security;
alter table pcm.sso_snapshot_exportacao_gate force row level security;
revoke all on pcm.sso_snapshot_exportacao_gate from public,anon,authenticated,service_role;

create function pcm.sso_snapshot_exportacao_plano(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_posicao integer,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_plano pcm.planos_manutencao%rowtype;
  v_versao pcm.plano_versoes%rowtype;
  v_total integer;
  v_itens jsonb;
begin
  if p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_posicao is null or p_posicao < 0 or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'paginacao_invalida' using errcode='22023';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_snapshot_exportacao_gate where id for share;
  if not coalesce((select habilitado from pcm.sso_snapshot_exportacao_gate where id),false) then
    raise exception 'consulta_bloqueada' using errcode='55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado' for share;
  if not found then raise exception 'versao_aprovada_indisponivel' using errcode='23514'; end if;
  if jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array'
    or v_versao.snapshot->'plano'->>'id' is distinct from p_plano_id::text
    or v_versao.snapshot->'plano'->>'cliente_id' is distinct from p_cliente_id::text
    or jsonb_typeof(v_versao.snapshot->'plano'->'nome') is distinct from 'string' then
    raise exception 'snapshot_invalido' using errcode='23514';
  end if;
  v_total:=jsonb_array_length(v_versao.snapshot->'rotinas');
  if exists (select 1 from jsonb_array_elements(v_versao.snapshot->'rotinas') as x(item)
      where jsonb_typeof(x.item) is distinct from 'object'
         or coalesce(x.item->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or x.item->>'plano_id' is distinct from p_plano_id::text
         or x.item->>'versao_id' is distinct from p_versao_id::text
         or jsonb_typeof(x.item->'nome') is distinct from 'string'
         or coalesce(x.item->>'alvo_tipo','') not in ('sistema','componente','grupo')
         or jsonb_typeof(x.item->'alvo') is distinct from 'object'
         or x.item->'alvo'->>'tipo' is distinct from x.item->>'alvo_tipo'
         or coalesce(x.item->'alvo'->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or jsonb_typeof(x.item->'alvo'->'nome') is distinct from 'string'
         or jsonb_typeof(x.item->'modo') is distinct from 'string')
    or (select count(distinct x.item->>'id') from jsonb_array_elements(v_versao.snapshot->'rotinas') as x(item)) <> v_total then
    raise exception 'rotinas_snapshot_invalidas' using errcode='23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',item->'id','planoId',item->'plano_id','versaoId',item->'versao_id',
    'nome',item->'nome','alvoTipo',item->'alvo_tipo','alvoId',item->'alvo'->'id','alvoNome',item->'alvo'->'nome',
    'modo',item->'modo','intervalo',item->'intervalo_n','unidade',item->'intervalo_unidade',
    'dataBase',item->'data_base','tempoMinutos',item->'tempo_minutos','tipoTempo',item->'tipo_tempo',
    'toleranciaAntes',item->'tolerancia_antes','toleranciaDepois',item->'tolerancia_depois') order by ordinal),'[]'::jsonb)
    into v_itens from (select x.item,x.ordinal from jsonb_array_elements(v_versao.snapshot->'rotinas') with ordinality x(item,ordinal)
      order by x.ordinal offset p_posicao limit p_limite) pagina;
  return jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'planoNome',v_versao.snapshot->'plano'->>'nome',
    'versaoId',p_versao_id,'versaoNumero',v_versao.numero,'vigenciaInicio',v_versao.vigencia_inicio,'vigenciaFim',v_versao.vigencia_fim,
    'snapshotHash',pg_catalog.md5(v_versao.snapshot::text),'total',v_total,'posicao',p_posicao,
    'proximaPosicao',case when p_posicao::bigint+p_limite < v_total then p_posicao+p_limite else null end,
    'rotinas',v_itens,'capacidadeIncluida',false,'cronogramaOperacionalIncluido',false);
end; $$;
revoke all on function pcm.sso_snapshot_exportacao_plano(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_exportacao_plano(uuid,uuid,uuid,integer,integer) to authenticated;
