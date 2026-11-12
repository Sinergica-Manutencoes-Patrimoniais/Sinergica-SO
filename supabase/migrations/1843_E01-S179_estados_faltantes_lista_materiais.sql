-- E01-S179 (SSO-013, P1 do Caderno Técnico do Fabrício) — completa os 7 estados da lista de
-- materiais do §8.2.
--
-- O QUE FALTAVA
-- O §8.2 enumera 7 estados: levantada, aguardando aquisição, informada disponível, parcial,
-- indisponível, dispensada e concluída. O `check` do banco (posto pela 0328) só aceitava 4 —
-- `levantada, informada_disponivel, parcial, indisponivel`. Os outros três não tinham caminho
-- nenhum: nem estado válido, nem evento que levasse até eles. Não era "falta ativar", era
-- ausência de implementação.
--
-- POR QUE ESTENDER `sso_informar_material` EM VEZ DE CRIAR RPC NOVA
-- Toda a máquina que a lista precisa já está nela: idempotência por `request_id`, revisão
-- otimista (`expected_revision`), trilha append-only em `sso_lista_materiais_eventos`, auditoria
-- e a autorização por `material.gerir`. Um comando novo teria que reconstruir tudo isso — e o
-- gate `sso_eventos_materiais_mediados_gate` (1061), que é quem libera o caminho na UI, já cobre
-- exatamente esta função. Três tipos de evento novos reaproveitam o conjunto inteiro.
--
-- REGRAS DE TRANSIÇÃO — DECISÃO EXPLÍCITA
-- O Caderno enumera os estados mas NÃO diz como se anda entre eles. As regras abaixo foram
-- derivadas do §8.1 (fluxo levantamento -> lista -> responsável -> disponibilidade -> execução ->
-- exceção) e do §8.3 (aquisição é fornecimento PELA Sinérgica), e precisam de confirmação
-- operacional antes da homologação:
--   • `aquisicao` -> aguardando_aquisicao: só quando `responsavel = 'sinergica'`. Lista sob
--     responsabilidade do Cliente não gera aquisição pela Sinérgica (§8.3).
--   • `dispensa` -> dispensada: de qualquer estado não terminal, com motivo obrigatório (mesmo
--     princípio do "Dispensado" do §8.4: "registra motivo ou regra contratual").
--   • `conclusao` -> concluida: só de `informada_disponivel` ou `parcial` — concluir exige que
--     algum material tenha chegado. De `indisponivel` não se conclui: dispensa-se ou refaz-se.
--   • `concluida` é TERMINAL e imutável.
--   • `dispensada` só é revertida por `excecao` com motivo `novo_levantamento` (vocabulário que
--     o próprio §8.2 já define), voltando a `levantada`. Qualquer outro evento é recusado.

alter table pcm.listas_materiais drop constraint listas_materiais_estado_check;
-- Reverso: alter table pcm.listas_materiais drop constraint listas_materiais_estado_check;
--          alter table pcm.listas_materiais add constraint listas_materiais_estado_check
--            check (estado in ('levantada','informada_disponivel','parcial','indisponivel'));
alter table pcm.listas_materiais add constraint listas_materiais_estado_check
  check (estado in ('levantada', 'aguardando_aquisicao', 'informada_disponivel', 'parcial',
                    'indisponivel', 'dispensada', 'concluida'));

alter table pcm.sso_lista_materiais_eventos drop constraint sso_lista_materiais_eventos_tipo_check;
-- Reverso: alter table pcm.sso_lista_materiais_eventos drop constraint sso_lista_materiais_eventos_tipo_check;
--          alter table pcm.sso_lista_materiais_eventos add constraint sso_lista_materiais_eventos_tipo_check
--            check (tipo in ('disponibilidade','excecao'));
alter table pcm.sso_lista_materiais_eventos add constraint sso_lista_materiais_eventos_tipo_check
  check (tipo in ('disponibilidade', 'excecao', 'aquisicao', 'dispensa', 'conclusao'));

-- Defesa em profundidade: `sso_informar_material` não é o único escritor de
-- `pcm.listas_materiais` (0325 salva linhas, 0436 registra observação, 0568 informa pelo portal
-- do síndico). Nenhum deles conhece os estados terminais. A trigger fecha isso de uma vez, para
-- todos os escritores presentes e futuros, em vez de depender de cada função lembrar da regra.
create function pcm.sso_guardar_estado_terminal_lista_materiais() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if old.estado = 'concluida' then
    raise exception 'lista_materiais_concluida' using errcode = '23514';
  end if;
  -- Lista dispensada só sai da dispensa voltando ao levantamento (`excecao` com motivo
  -- `novo_levantamento`); qualquer outra escrita sobre ela é recusada.
  if old.estado = 'dispensada' and new.estado is distinct from 'levantada' then
    raise exception 'lista_materiais_dispensada' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_estado_terminal_lista_materiais()
  from public, anon, authenticated, service_role;
create trigger sso_guardar_estado_terminal_lista_materiais before update on pcm.listas_materiais
  for each row execute function pcm.sso_guardar_estado_terminal_lista_materiais();
-- Reverso: drop trigger sso_guardar_estado_terminal_lista_materiais on pcm.listas_materiais;
--          drop function pcm.sso_guardar_estado_terminal_lista_materiais();

-- Núcleo reescrito: mesma assinatura, mesmo contrato de retorno, mesmas garantias de
-- idempotência e revisão. Muda só o vocabulário de eventos e a matriz de transição.
create or replace function pcm.sso_informar_material(
  p_request_id uuid, p_lista_id uuid, p_expected_revision integer, p_tipo text, p_dados jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_ator uuid := auth.uid();
  v_comando pcm.sso_lista_materiais_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
  v_estado text; v_linhas jsonb; v_revisao_linhas integer; v_posicao integer; v_motivo text;
begin
  if p_request_id is null or p_lista_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_tipo is null or p_tipo not in ('disponibilidade', 'excecao', 'aquisicao', 'dispensa', 'conclusao')
    or jsonb_typeof(p_dados) is distinct from 'object' or octet_length(p_dados::text) > 16384 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if p_tipo = 'disponibilidade' then
    if (p_dados - 'situacao') <> '{}'::jsonb or p_dados->>'situacao' is null
      or p_dados->>'situacao' not in ('informada_disponivel', 'parcial', 'indisponivel') then
      raise exception 'disponibilidade_invalida' using errcode = '22023';
    end if;
    v_estado := p_dados->>'situacao';
  elsif p_tipo = 'excecao' then
    if (p_dados - 'motivo' - 'descricao' - 'revisaoLinhas' - 'posicao') <> '{}'::jsonb
      or p_dados->>'motivo' is null or p_dados->>'motivo' not in ('faltante', 'parcial', 'errado', 'novo_levantamento')
      or jsonb_typeof(p_dados->'descricao') is distinct from 'string'
      or length(btrim(p_dados->>'descricao')) not between 1 and 4000
      or (p_dados ? 'revisaoLinhas') <> (p_dados ? 'posicao') then
      raise exception 'excecao_invalida' using errcode = '22023';
    end if;
    if p_dados ? 'posicao' then
      if coalesce(p_dados->>'posicao','') !~ '^[0-9]{1,4}$'
        or coalesce(p_dados->>'revisaoLinhas','') !~ '^[0-9]{1,10}$' then
        raise exception 'linha_invalida' using errcode = '22023';
      end if;
      v_posicao := (p_dados->>'posicao')::integer;
      v_revisao_linhas := (p_dados->>'revisaoLinhas')::integer;
    end if;
    v_motivo := p_dados->>'motivo';
    v_estado := 'levantada';
  elsif p_tipo = 'aquisicao' then
    -- Aquisição é um registro operacional: só precisa dizer por quê se houver observação.
    if (p_dados - 'observacao') <> '{}'::jsonb
      or (p_dados ? 'observacao' and (jsonb_typeof(p_dados->'observacao') is distinct from 'string'
        or length(btrim(p_dados->>'observacao')) not between 1 and 4000)) then
      raise exception 'aquisicao_invalida' using errcode = '22023';
    end if;
    v_estado := 'aguardando_aquisicao';
  elsif p_tipo = 'dispensa' then
    -- Motivo obrigatório: dispensar é decisão, e decisão sem motivo não é auditável.
    if (p_dados - 'motivo') <> '{}'::jsonb
      or jsonb_typeof(p_dados->'motivo') is distinct from 'string'
      or length(btrim(p_dados->>'motivo')) not between 1 and 4000 then
      raise exception 'dispensa_invalida' using errcode = '22023';
    end if;
    v_estado := 'dispensada';
  else
    if (p_dados - 'observacao') <> '{}'::jsonb
      or (p_dados ? 'observacao' and (jsonb_typeof(p_dados->'observacao') is distinct from 'string'
        or length(btrim(p_dados->>'observacao')) not between 1 and 4000)) then
      raise exception 'conclusao_invalida' using errcode = '22023';
    end if;
    v_estado := 'concluida';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
    and o.client_id = v_lista.cliente_id and o.deleted_at is null for share;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('operacao', p_tipo, 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'dados', p_dados);
  select * into v_comando from pcm.sso_lista_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;

  -- Matriz de transição (ver cabeçalho). Checada DEPOIS do replay idempotente, para que repetir
  -- um comando já aplicado continue devolvendo o resultado original em vez de virar recusa.
  if v_lista.estado = 'concluida' then
    raise exception 'lista_materiais_concluida' using errcode = '23514';
  end if;
  if v_lista.estado = 'dispensada' and (p_tipo <> 'excecao' or v_motivo <> 'novo_levantamento') then
    raise exception 'lista_materiais_dispensada' using errcode = '23514';
  end if;
  if p_tipo = 'aquisicao' then
    if v_lista.responsavel <> 'sinergica' then
      raise exception 'aquisicao_exige_responsavel_sinergica' using errcode = '23514';
    end if;
    if v_lista.estado not in ('levantada', 'parcial', 'indisponivel') then
      raise exception 'transicao_de_estado_invalida' using errcode = '23514';
    end if;
  end if;
  if p_tipo = 'conclusao' and v_lista.estado not in ('informada_disponivel', 'parcial') then
    raise exception 'transicao_de_estado_invalida' using errcode = '23514';
  end if;

  if v_posicao is not null then
    if v_revisao_linhas < 2 or v_revisao_linhas > v_lista.revisao then raise exception 'linha_invalida' using errcode = '22023'; end if;
    select linhas into v_linhas from pcm.sso_lista_materiais_versoes where lista_id = p_lista_id and revisao = v_revisao_linhas;
    if not found or v_posicao < 0 or v_posicao >= jsonb_array_length(v_linhas) then raise exception 'linha_invalida' using errcode = '22023'; end if;
  end if;
  update pcm.listas_materiais set revisao = revisao + 1, estado = v_estado where id = p_lista_id returning * into v_lista;
  insert into pcm.sso_lista_materiais_eventos(lista_id, revisao, tipo, dados, ator_id)
    values (p_lista_id, v_lista.revisao, p_tipo, p_dados, v_ator);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'material.' || p_tipo, 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'revision', v_lista.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'created', false, 'linkedIds', '{}'::jsonb,
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_lista_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_informar_material(uuid, uuid, integer, text, jsonb)
  from public, anon, authenticated, service_role;
