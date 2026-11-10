-- ADR-1252: gate fechado; cópia explícita do núcleo 0721 renomeado na 0892.
create table pcm.sso_incorporacao_codigo_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_incorporacao_codigo_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_incorporacao_codigo_grupo_gate enable row level security;
alter table pcm.sso_incorporacao_codigo_grupo_gate force row level security;
revoke all on pcm.sso_incorporacao_codigo_grupo_gate from public, anon, authenticated, service_role;

create or replace function pcm.sso_incorporar_ativo_levantamento_base_0892(
  p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_chave text,
  p_local_id uuid, p_categoria_id uuid, p_sistema_id uuid, p_parent_id uuid,
  p_codigo text, p_quantidade bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_lote pcm.sso_levantamentos%rowtype;
  v_linha pcm.sso_levantamento_linhas%rowtype;
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_nome text; v_codigo text; v_informado text; v_area uuid; v_id uuid := gen_random_uuid();
  v_referencia text; v_pai pcm.sso_levantamento_incorporacoes%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_levantamento_ativos_gate where chave), false) then
    raise exception 'incorporacao_ativos_desabilitada' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('operacao', 'incorporar_ativo', 'loteId', p_lote_id,
    'expectedRevision', p_expected_revision, 'chave', p_chave, 'localId', p_local_id,
    'categoriaId', p_categoria_id, 'sistemaId', p_sistema_id, 'parentId', p_parent_id,
    'codigo', p_codigo, 'quantidade', p_quantidade);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_lote from pcm.sso_levantamentos where id = p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', v_lote.cliente_id) is not true then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id = p_lote_id and chave = p_chave;
  if not found or v_linha.tipo not in ('sistema', 'equipamento', 'componente', 'grupo_quantitativo') then
    raise exception 'linha_nao_encontrada_ou_tipo_invalido' using errcode = '23514';
  end if;
  if exists (select 1 from pcm.sso_levantamento_rejeicoes where lote_id = p_lote_id and linha_chave = p_chave)
    or exists (select 1 from pcm.sso_levantamento_incorporacoes where lote_id = p_lote_id and linha_chave = p_chave) then
    raise exception 'linha_ja_decidida' using errcode = '23505';
  end if;
  if jsonb_typeof(v_linha.atributos->'nome') is distinct from 'string' then
    raise exception 'nome_invalido' using errcode = '22023';
  end if;
  v_nome := btrim(v_linha.atributos->>'nome');
  if length(v_nome) not between 1 and 200 then raise exception 'nome_invalido' using errcode = '22023'; end if;
  v_informado := nullif(btrim(v_linha.atributos->>'codigoInformado'), '');
  v_codigo := nullif(btrim(p_codigo), '');
  if v_informado is not null and v_informado is distinct from v_codigo then
    raise exception 'codigo_informado_divergente' using errcode = '23514';
  end if;
  if v_linha.tipo <> 'grupo_quantitativo' and (v_codigo is null or length(v_codigo) > 200
    or v_codigo <> upper(v_codigo) or v_codigo ~ '[[:space:]]') then
    raise exception 'codigo_definitivo_invalido' using errcode = '22023';
  end if;
  if v_linha.tipo = 'grupo_quantitativo' and v_codigo is not null then
    perform 1 from pcm.sso_incorporacao_codigo_grupo_gate where id and habilitado for share;
    if not found then raise exception 'codigo_grupo_nao_suportado' using errcode = '55000'; end if;
  end if;
  select l.area_id into v_area from pcm.locais l join pcm.areas a on a.id = l.area_id
    where l.id = p_local_id and a.cliente_id = v_lote.cliente_id and a.ativo and a.deleted_at is null
      and l.ativo and l.deleted_at is null for key share of l, a;
  if v_area is null then raise exception 'local_indisponivel_ou_outro_cliente' using errcode = '23514'; end if;
  v_referencia := nullif(btrim(v_linha.atributos->>'referenciaPai'), '');
  if v_referencia is not null then
    select * into v_pai from pcm.sso_levantamento_incorporacoes
      where lote_id = p_lote_id and linha_chave = v_referencia;
    if not found then select a.tipo,a.entidade_id into v_pai.tipo,v_pai.entidade_id from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=v_referencia; end if;
    if not found or (
      (v_pai.tipo = 'area' and v_linha.tipo = 'sistema' and v_pai.entidade_id = v_area)
      or (v_pai.tipo in ('local', 'sublocal') and v_pai.entidade_id = p_local_id)
      or (v_pai.tipo = 'equipamento' and v_linha.tipo = 'componente' and v_pai.entidade_id = p_parent_id)
    ) is not true then raise exception 'pai_pendente_rejeitado_ou_incompativel' using errcode = '23514'; end if;
  end if;
  if p_sistema_id is not null and not exists (select 1 from pcm.sistemas s
    where s.id = p_sistema_id and s.cliente_id = v_lote.cliente_id and s.ativo and s.deleted_at is null) then
    raise exception 'sistema_indisponivel_ou_outro_cliente' using errcode = '23514';
  end if;
  if p_parent_id is not null and (v_linha.tipo <> 'componente' or not exists (
    select 1 from pcm.equipamentos e where e.id = p_parent_id and e.client_id = v_lote.cliente_id
      and e.local_id = p_local_id and e.tipo = 'equipamento' and e.ativo and e.deleted_at is null)) then
    raise exception 'equipamento_pai_invalido' using errcode = '23514';
  end if;
  if v_linha.tipo = 'sistema' and (p_sistema_id is not null or p_parent_id is not null) then
    raise exception 'vinculo_invalido' using errcode = '22023';
  end if;
  if v_linha.tipo = 'grupo_quantitativo' then
    if p_categoria_id is null or p_quantidade is null or p_quantidade not between 1 and 9007199254740991
      or not exists (select 1 from pcm.equipamento_categorias c where c.id = p_categoria_id and c.deleted_at is null) then
      raise exception 'classificacao_ou_quantidade_invalida' using errcode = '22023';
    end if;
  elsif p_categoria_id is not null or p_quantidade is not null then
    raise exception 'atributos_nao_suportados' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array('levantamento_ativo', v_lote.cliente_id, v_linha.tipo, p_local_id, lower(v_nome))::text, 0));
  if v_linha.tipo = 'sistema' then
    if exists (select 1 from pcm.sistemas where cliente_id = v_lote.cliente_id and area_id = v_area
      and lower(nome) = lower(v_nome) and deleted_at is null) then raise exception 'possivel_duplicidade' using errcode = '23505'; end if;
    insert into pcm.sistemas(id, cliente_id, area_id, nome, codigo, created_by, updated_by)
      values (v_id, v_lote.cliente_id, v_area, v_nome, v_codigo, v_ator, v_ator);
  elsif v_linha.tipo = 'grupo_quantitativo' then
    if exists (select 1 from pcm.grupos_quantitativos where cliente_id = v_lote.cliente_id and local_id = p_local_id
      and lower(nome) = lower(v_nome) and deleted_at is null) then raise exception 'possivel_duplicidade' using errcode = '23505'; end if;
    insert into pcm.grupos_quantitativos(id, cliente_id, local_id, categoria_id, sistema_id, nome, quantidade, created_by, updated_by)
      values (v_id, v_lote.cliente_id, p_local_id, p_categoria_id, p_sistema_id, v_nome, p_quantidade, v_ator, v_ator);
    if v_codigo is not null then
      perform pcm.sso_atribuir_codigo_inicial_grupo_privado(p_request_id, v_id, v_codigo);
    end if;
  else
    if exists (select 1 from pcm.equipamentos where client_id = v_lote.cliente_id and local_id = p_local_id
      and lower(nome) = lower(v_nome) and deleted_at is null) then raise exception 'possivel_duplicidade' using errcode = '23505'; end if;
    insert into pcm.equipamentos(id, client_id, local_id, parent_item_id, tipo, nome, identificador, created_by, updated_by)
      values (v_id, v_lote.cliente_id, p_local_id, p_parent_id, v_linha.tipo, v_nome, v_codigo, v_ator, v_ator);
    if p_sistema_id is not null then
      insert into pcm.sistema_itens(sistema_id, item_id, created_by) values (p_sistema_id, v_id, v_ator);
    end if;
  end if;
  update pcm.sso_levantamentos set revisao = revisao + 1 where id = p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_incorporacoes(lote_id, linha_chave, tipo, entidade_id, revisao, ator_id, request_id)
    values (p_lote_id, p_chave, v_linha.tipo, v_id, v_lote.revisao, v_ator, p_request_id);
  v_resultado := jsonb_build_object('aggregateId', p_lote_id, 'revision', v_lote.revisao, 'state', 'pendente',
    'created', true, 'linkedIds', jsonb_build_object('entidadeId', v_id, 'tipo', v_linha.tipo),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'levantamento.ativo_incorporado', 'sso_levantamentos', p_lote_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lote.cliente_id,
        'revision', v_lote.revisao, 'linhaChave', p_chave, 'tipo', v_linha.tipo, 'entidadeId', v_id));
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
