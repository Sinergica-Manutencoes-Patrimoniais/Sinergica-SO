-- E01-S201 — Monitor consolidado de exceções do Auvo (T−24). Fecha o critério de BL 004 do
-- Pacote Consolidado do Fabrício (13/11/2026) que ficou aberto em E01-S196: "Módulo e tela:
-- Integrações, Planejamento e monitor de exceções" / "registrar ID externo, tentativas e erro".
--
-- ACHADO QUE DEFINE O ESCOPO (inventário completo em specs/E01-S201-monitor-excecoes-auvo/plan.md):
-- as TRÊS famílias de exceção já existem no banco, separadas, e NADA as reúne. Hoje, para saber
-- se uma Visita ficou sem tarefa, alguém precisa abrir três lugares e cruzar na cabeça:
--
--   1. FALHA DE ENVIO      -> pcm.sso_t24_tentativas.estado in ('bloqueado','incerto',
--                             'reconciliacao') (livro de 1309/1310/1311), com o motivo no último
--                             pcm.sso_t24_tentativa_eventos e a fila em pcm.auvo_sync_outbox
--                             (1316 liga as duas por `outbox_id`). Nenhuma consulta legível.
--   2. VISITA NÃO CONFIRMADA -> pcm.visitas.estado + pcm.visita_ordens_servico. O produtor T−24
--                             (1325/1330) exige `estado='confirmada'`; Visita com OS vinculada
--                             cuja janela T−24 já abriu e que não foi confirmada simplesmente
--                             NÃO produz tentativa — ou seja, a exceção é a AUSÊNCIA de linha no
--                             livro. É a única das três que não tinha onde ser lida.
--   3. TAREFA ÓRFÃ         -> pcm.sso_origem_campo_processamentos.provisorio (1420): OS que
--                             chegou do Auvo sem ID de Chamado, ainda sem decisão de triagem
--                             (1428). Esse recorte JÁ está escrito em
--                             pcm.sso_listar_campo_a_conciliar (1866) e é REUSADO aqui por
--                             chamada de função — a regra de "órfã" continua tendo UMA definição.
--
-- SÓ LEITURA. Não escreve, não reprocessa, não toca o planejamento local (BL 004: "falhas de
-- integração ... nunca apagam o planejamento local"). Reprocessar é ação e fica para a fatia
-- seguinte (registrado em tasks.md).
--
-- Reusa deliberadamente, sem criar nada novo (mesmo raciocínio de 1866 sobre 1427):
--   gate       pcm.sso_consulta_estado_campo_gate            (de 1427, fechado por padrão)
--   capacidade config.sso_autorizar_acao('execucao.validar', cliente)
-- Criar um gate próprio aumentaria a superfície de ativação sem necessidade: quem abre a leitura
-- do estado de campo abre a mesma jornada de integração Auvo, vista de outro ângulo. O gate de
-- EXECUÇÃO do T−24 (pcm.sso_t24_execucao_gate) seria a escolha errada — o monitor precisa
-- funcionar justamente quando o despacho está travado.
--
-- Recorte por Cliente, como 1427/1428/1866: a capacidade é por Cliente, então uma consolidação
-- multi-Cliente exigiria decidir o que fazer com Cliente sem capacidade. Fora de escopo aqui.
--
-- Reverso:
--   drop function if exists pcm.sso_listar_excecoes_auvo_t24(uuid,uuid,integer);

create function pcm.sso_listar_excecoes_auvo_t24(p_ator_id uuid, p_cliente_id uuid, p_limite integer)
returns table(
  tipo text, cliente_id uuid, cliente_nome text,
  visita_id uuid, visita_inicio_em timestamptz,
  os_id uuid, os_numero text,
  task_id bigint, tentativas integer, ultimo_erro text, ocorrido_em timestamptz
)
language plpgsql volatile security definer set search_path = '' as $$
declare v_agora timestamptz := now(); v_cliente_nome text;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id
     or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  -- Mesma trava compartilhada de 1427/1428/1866: não lê o monitor no meio de uma alteração de
  -- autorização em curso. Shared e por transação — a chamada a 1866, mais abaixo, a repete sem
  -- conflito.
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
       pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_consulta_estado_campo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501'; end if;

  select c.nome into v_cliente_nome from pcm.clientes c where c.id = p_cliente_id;
  if v_cliente_nome is null then raise exception 'cliente_indisponivel' using errcode = '42501'; end if;

  return query
  with falha as (
    -- "Falha de envio": a tentativa parou e NÃO virou tarefa confirmada. 'confirmado' (1343),
    -- 'cancelado' (1332) e as fases em andamento ficam de fora — exceção é o que parou.
    -- `tentativas` vem do `fence` do livro, não de `auvo_sync_outbox.attempts`: o drain genérico
    -- (fn_claim_auvo_outbox_batch, reescrito em 1316) EXCLUI a entidade 'ordens_servico_t24', de
    -- modo que `attempts` dessas linhas nunca sai de 0. O `fence` é incrementado a cada reserva.
    -- `last_error` da outbox entra só como último recurso de texto.
    select 'falha_envio'::text as tipo, t.cliente_id, v_cliente_nome as cliente_nome,
           t.visita_id, v.inicio_em as visita_inicio_em, t.os_id, o.numero as os_numero,
           -- Só o id externo realmente gravado na OS. `sso_t24_tentativas.tarefa_id` é text com
           -- validação frouxa no CHECK da tabela; não vira bigint aqui para não falhar a leitura
           -- inteira por causa de uma linha malformada. Tentativa de 'criar' que falhou tem id
           -- nulo — e esse nulo é a informação.
           o.auvo_task_id as task_id,
           least(t.fence, 2147483647)::integer as tentativas,
           coalesce(ev.motivo, q.last_error, 'sem_motivo_registrado') as ultimo_erro,
           t.atualizado_em as ocorrido_em
      from pcm.sso_t24_tentativas t
      join pcm.visitas v on v.id = t.visita_id and v.cliente_id = t.cliente_id
      join pcm.ordens_servico o
        on o.id = t.os_id and o.client_id = t.cliente_id and o.deleted_at is null
      left join pcm.auvo_sync_outbox q on q.id = t.outbox_id
      left join lateral (
        select e.motivo from pcm.sso_t24_tentativa_eventos e
         where e.tentativa_id = t.id order by e.sequencia desc limit 1) ev on true
     where t.cliente_id = p_cliente_id
       and t.estado in ('bloqueado', 'incerto', 'reconciliacao')
     order by t.atualizado_em desc, t.id
     limit p_limite
  ), visita_nao_confirmada as (
    -- "Visita não confirmada não gera tarefas e aparece como exceção" (BL 004). Uma linha por OS
    -- vinculada vigente, porque é uma tarefa Auvo por OS que deixou de existir — não uma só.
    -- A janela já abriu (`inicio_em - 24h <= agora`, a mesma conta de `elegivel_em` em 1325/1330)
    -- e a Visita continua em 'rascunho'/'planejada'. Os demais estados ou já passaram pela
    -- confirmação ou saíram do fluxo (cancelada/reprogramada).
    -- Corte de 72h após o fim: exceção de janela é operacional, não histórico. Passado esse
    -- prazo a Visita não tem mais conserto por T−24 e some do monitor (anotado em tasks.md como
    -- limite consciente desta fatia).
    select 'visita_nao_confirmada'::text, v.cliente_id, v_cliente_nome,
           v.id, v.inicio_em, o.id, o.numero,
           o.auvo_task_id,
           0 as tentativas,  -- zero é o achado: nenhuma tentativa de envio chegou a existir.
           'visita_' || v.estado as ultimo_erro,
           v.inicio_em - interval '24 hours' as ocorrido_em
      from pcm.visitas v
      join pcm.visita_ordens_servico vo
        on vo.visita_id = v.id and vo.cliente_id = v.cliente_id and vo.encerrado_em is null
      join pcm.ordens_servico o
        on o.id = vo.os_id and o.client_id = v.cliente_id and o.deleted_at is null
     where v.cliente_id = p_cliente_id
       and v.estado in ('rascunho', 'planejada')
       and v.inicio_em - interval '24 hours' <= v_agora
       and v.fim_em > v_agora - interval '72 hours'
       -- Visita que já produziu tentativa (e depois voltou a 'planejada') não é esta exceção —
       -- ela aparece, se for o caso, pela família de falha de envio.
       and not exists (
         select 1 from pcm.sso_t24_tentativas t
          where t.os_id = o.id
            and t.estado in ('aguardando','reservado','iniciado','incerto','reconciliacao','confirmado'))
     order by v.inicio_em, o.id
     limit p_limite
  ), orfa as (
    -- "Tarefa órfã" NESTA base = OS criada pelo Auvo sem ID de Chamado (par provisório de 1420)
    -- que o PCM ainda não conciliou. O recorte não é reescrito: chama 1866, que já é a definição
    -- canônica e checa o MESMO gate e a MESMA capacidade. `tentativas` = 0 porque a família é de
    -- entrada (o Auvo criou a tarefa), não de envio: não existe tentativa T−24 a contar.
    select 'tarefa_orfa'::text, p_cliente_id, v_cliente_nome,
           null::uuid, null::timestamptz, f.os_id, f.os_numero,
           f.task_id, 0, f.motivo, f.criado_em
      from pcm.sso_listar_campo_a_conciliar(p_ator_id, p_cliente_id, p_limite) f
  )
  select u.* from (
    select * from falha
    union all select * from visita_nao_confirmada
    union all select * from orfa
  ) u
  order by u.ocorrido_em desc, u.tipo, u.os_id
  limit p_limite;
end; $$;

revoke all on function pcm.sso_listar_excecoes_auvo_t24(uuid,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_excecoes_auvo_t24(uuid,uuid,integer) to authenticated;
