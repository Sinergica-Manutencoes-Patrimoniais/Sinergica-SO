-- ADR-0101. Não aplicar até ser resolvida a janela de concessão da 0315.
-- Recepção manual nunca prova a origem declarada. Histórico permanece não verificado.
revoke all on function pcm.sso_receber_levantamento(uuid, uuid, text, text, jsonb) from public, anon, authenticated, service_role;
alter table pcm.sso_levantamentos add column meio_recepcao text not null default 'nao_verificado' check (meio_recepcao in ('nao_verificado', 'manual'));
alter table pcm.sso_levantamentos add column origem_declarada text check (origem_declarada is null or origem_declarada in ('planilha', 'auvo', 'campo'));
alter table pcm.sso_levantamentos drop constraint sso_levantamentos_origem_check;
alter table pcm.sso_levantamentos add constraint sso_levantamentos_origem_check check (origem in ('planilha', 'auvo', 'campo', 'manual'));

create or replace function pcm.sso_receber_levantamento_manual(
  p_request_id uuid, p_cliente_id uuid, p_origem_declarada text, p_chave_origem text, p_linhas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_origem text := 'manual';
  v_payload jsonb;
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_lote pcm.sso_levantamentos%rowtype;
  v_linha jsonb;
  v_resultado jsonb;
  v_novo boolean := false;
begin
  if not config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_request_id is null or p_cliente_id is null or (p_origem_declarada is not null and p_origem_declarada not in ('planilha', 'auvo', 'campo')) or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200
    or p_linhas is null then
    raise exception 'recepcao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'origem', v_origem,
    'origemDeclarada', p_origem_declarada, 'chaveOrigem', p_chave_origem, 'linhas', p_linhas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text) > 1048576 then
    raise exception 'linhas_invalidas' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'quantidade_linhas_invalida' using errcode = '22023';
  end if;
  for v_linha in select value from jsonb_array_elements(p_linhas) loop
    if jsonb_typeof(v_linha) is distinct from 'object'
       or (v_linha - 'chave' - 'tipo' - 'atributos') <> '{}'::jsonb
       or jsonb_typeof(v_linha->'chave') is distinct from 'string'
       or length(btrim(v_linha->>'chave')) not between 1 and 200
       or jsonb_typeof(v_linha->'tipo') is distinct from 'string'
       or v_linha->>'tipo' not in ('area','local','sublocal','sistema','equipamento','componente','grupo_quantitativo')
       or jsonb_typeof(v_linha->'atributos') is distinct from 'object'
       or octet_length(v_linha::text) > 32768 then
      raise exception 'linha_invalida' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_each(v_linha->'atributos') a
      where a.key not in ('nome','observacoes','quantidade','codigoInformado','referenciaPai','sistemaProvisorio','localProvisorio','classificacao')
        or jsonb_typeof(a.value) not in ('string','number','boolean','null')
        or (jsonb_typeof(a.value) = 'string' and length(a.value #>> '{}') > 4000)) then
      raise exception 'atributos_invalidos' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_linhas) l group by l->>'chave' having count(*) > 1) then
    raise exception 'chave_linha_duplicada' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array(p_cliente_id, v_origem, p_chave_origem)::text, 0));
  select * into v_lote from pcm.sso_levantamentos
    where cliente_id = p_cliente_id and origem = v_origem and chave_origem = p_chave_origem;
  if found then
    if v_lote.conteudo is distinct from p_linhas or v_lote.origem_declarada is distinct from p_origem_declarada then
      raise exception 'origem_conflitante' using errcode = '23505';
    end if;
  else
    insert into pcm.sso_levantamentos(cliente_id, origem, origem_declarada, meio_recepcao, chave_origem, conteudo, criado_por)
      values (p_cliente_id, v_origem, p_origem_declarada, 'manual', p_chave_origem, p_linhas, v_ator) returning * into v_lote;
    insert into pcm.sso_levantamento_linhas(lote_id, chave, tipo, atributos)
      select v_lote.id, l->>'chave', l->>'tipo', l->'atributos' from jsonb_array_elements(p_linhas) l;
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values (v_ator, 'levantamento.recebido', 'sso_levantamentos', v_lote.id,
        jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'origem', v_origem,
          'quantidadeLinhas', jsonb_array_length(p_linhas), 'revision', 1));
    v_novo := true;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_lote.id, 'revision', v_lote.revisao,
    'state', 'pendente', 'created', v_novo, 'linkedIds', '{}'::jsonb,
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_receber_levantamento_manual(uuid, uuid, text, text, jsonb) from public, anon, service_role;
grant execute on function pcm.sso_receber_levantamento_manual(uuid, uuid, text, text, jsonb) to authenticated;

