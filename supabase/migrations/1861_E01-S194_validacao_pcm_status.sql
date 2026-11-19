-- E01-S194 AC-7/AC-8/AC-10 — "Kanban operacional aprovado".
--
-- Achado (ver plan.md): `pcm.fn_operacao_alterar_status_lote` (0178) só valida que o status é um
-- dos conhecidos — não valida a TRANSIÇÃO nem exige capacidade nenhuma. Qualquer usuário com
-- escrita em 'pcm' podia mover qualquer OS direto pra 'finalizado' por este caminho (dropdown do
-- detalhe, ação em lote, drag do Kanban), sem nunca passar pela decisão do PCM. É o mesmo padrão
-- de achado da E00-S26/E00-S27: capacidade sensível sem gate.
--
-- SPEC_DEVIATION (registrado em tasks.md/plan.md): a spec pede uma matriz de transição completa
-- (AC-7, "transição não permitida é recusada"). Não implementada por inteiro nesta migration —
-- o dropdown de status hoje permite qualquer salto entre os 7 status antigos e isso já é
-- explorado por fluxos existentes (lote, automação) que não foram todos inventariados. Fechar
-- TODOS os saltos sem esse inventário arrisca quebrar caminho legítimo em produção. Em vez disso,
-- fecha-se o salto de maior risco e já provado (achado acima): entrar em 'finalizado' agora exige
-- `execucao.validar` — a mesma capacidade que já guarda toda a família de validação/finalização
-- (0348/0375/0560/0607). Matriz completa fica para story dedicada após inventário dos chamadores.
--
-- 'validacao_pcm' (novo, aditivo): parada obrigatória entre 'em_execucao' e 'finalizado' — o Auvo
-- finalizar a tarefa no campo não finaliza mais a OS direto (ver `pcm-auvo-webhook`/
-- `pcm-auvo-tasks-import`, mesma story). `campo_a_conciliar`/`demanda` são colunas do Kanban, não
-- status persistido nesta coluna — ver plan.md (SPEC_DEVIATION: "Campo a conciliar" é virtual,
-- mesmo padrão já usado por "preventiva" desde E01-S84, não uma 8ª string em `ordens_servico.status`).
create or replace function pcm.fn_operacao_alterar_status_lote(
  p_ids uuid[],
  p_status text
)
returns table (
  id uuid,
  sucesso boolean,
  erro text
)
language plpgsql
security invoker
set search_path = pcm, public
as $$
declare
  v_id uuid;
  v_cliente_id uuid;
begin
  -- Achado de revisão (0178 original): `p_status is null` faz `p_status not in (...)` avaliar
  -- NULL, não true — o `if` nunca dispara e o UPDATE abaixo gravaria status NULL na OS. Pré
  -- existente, corrigido junto por tocar esta função na mesma story.
  if p_status is null or p_status not in (
    'solicitacao', 'corretiva', 'backlog', 'planejamento',
    'em_execucao', 'validacao_pcm', 'finalizado', 'cancelado'
  ) then
    raise exception 'Status de OS inválido: %', p_status using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_ids, array[]::uuid[])
  loop
    begin
      if p_status = 'finalizado' then
        select os.client_id into v_cliente_id from pcm.ordens_servico os
          where os.id = v_id and os.deleted_at is null;
        if v_cliente_id is null then
          id := v_id;
          sucesso := false;
          erro := 'OS não encontrada ou sem permissão';
          return next;
          continue;
        end if;
        if config.sso_autorizar_acao('execucao.validar', v_cliente_id) is distinct from true then
          id := v_id;
          sucesso := false;
          erro := 'sem_acesso';
          return next;
          continue;
        end if;
      end if;

      update pcm.ordens_servico os
      set status = p_status,
          updated_at = now(),
          updated_by = auth.uid()
      where os.id = v_id
        and os.deleted_at is null;

      id := v_id;
      sucesso := found;
      erro := case when found then null else 'OS não encontrada ou sem permissão' end;
      return next;
    exception when others then
      id := v_id;
      sucesso := false;
      erro := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

-- E01-S194 AC-4/AC-9 — fecha o dead-end que a própria E01-S193 deixou documentado (migration
-- 1854, comentário de topo): Chamado em 'demanda' não conseguia virar OS porque esta função só
-- aceitava 'aberto'/'convertido_os'. `sso_criar_os_chamado` já foi cirurgicamente remendada duas
-- vezes antes (1475: concorrência/escopo; 1499: token de guarda de múltiplas OS) — um
-- `create or replace` ingênuo aqui apagaria as duas (confirmado: quebra
-- `E01-S167_ensaio_multiplas_os.test.sql` com `novo_vinculo_exige_comando_chamado_os`). Segue o
-- MESMO padrão de cirurgia de texto sobre `pg_get_functiondef` — só dois trechos mudam: a
-- whitelist de status do Chamado, e o status inicial da OS (um Chamado que já passou por Demanda
-- — já triado no Backlog — nasce a OS direto em 'planejamento', não 'solicitacao'; o caminho
-- 'aberto' original continua indo pra 'solicitacao', sem mudar nada do comportamento existente).
do $alteracao_s194$
declare
  v_funcao regprocedure := 'pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_status_antes text := $t$if v_chamado.status not in ('aberto', 'convertido_os') then
    raise exception 'chamado_nao_editavel' using errcode = '23514';
  end if;$t$;
  v_status_depois text := $t$if v_chamado.status not in ('aberto', 'convertido_os', 'demanda') then
    raise exception 'chamado_nao_editavel' using errcode = '23514';
  end if;$t$;
  v_insert_antes text := $t$p_categoria, 'solicitacao', 'manual', v_actor);$t$;
  v_insert_depois text := $t$p_categoria, case when v_chamado.status = 'demanda' then 'planejamento' else 'solicitacao' end, 'manual', v_actor);$t$;
begin
  if strpos(v_definicao, v_status_antes) = 0
    or length(v_definicao) - length(replace(v_definicao, v_status_antes, '')) <> length(v_status_antes)
    or strpos(v_definicao, v_insert_antes) = 0
    or length(v_definicao) - length(replace(v_definicao, v_insert_antes, '')) <> length(v_insert_antes) then
    raise exception 'definicao_criacao_os_incompativel_s194' using errcode = '55000';
  end if;
  v_definicao := replace(v_definicao, v_status_antes, v_status_depois);
  v_definicao := replace(v_definicao, v_insert_antes, v_insert_depois);
  execute v_definicao;
end;
$alteracao_s194$;

revoke all on function pcm.fn_operacao_alterar_status_lote(uuid[], text) from public;
grant execute on function pcm.fn_operacao_alterar_status_lote(uuid[], text) to authenticated;

comment on function pcm.fn_operacao_alterar_status_lote(uuid[], text) is
  'E01-S145: altera status de várias OS em um round-trip, preservando sucesso/erro individual. E01-S194: entrar em finalizado exige execucao.validar; valida status novo validacao_pcm.';

-- Os três agregados abaixo (resumo de Chamado em lote, quadro gerencial v1 e v2) usam a MESMA
-- whitelist pra decidir se "todas as OS do Chamado têm status conhecido" antes de marcar
-- `etapas_mistas` — sem incluir 'validacao_pcm' aqui, um Chamado com alguma OS nessa etapa nunca
-- seria sinalizado como misto (falso negativo silencioso, não erro visível). Corpo idêntico ao
-- original (1010/1039/1510), só a whitelist muda.
create or replace function pcm.sso_resumir_chamados_lote(p_ids uuid[])
returns table(chamado_id uuid,total bigint,finalizadas bigint,etapas_mistas boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_resumo_chamado_lote_gate where id),false) then raise exception 'resumo_chamado_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_ids is null or cardinality(p_ids)>100 or array_position(p_ids,null) is not null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 return query
 with candidatos as (
   select c.id,c.cliente_id,c.ordem_servico_id from pcm.chamados c
   where c.id=any(p_ids) and c.deleted_at is null and config.sso_autorizar_acao('chamado.encerrar',c.cliente_id) is true
 ), validos as (
   select c.* from candidatos c where
     not exists(select 1 from pcm.ordens_servico o where o.chamado_id=c.id and o.deleted_at is null and o.client_id is distinct from c.cliente_id)
     and not exists(select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id where o.chamado_id=c.id and o.deleted_at is null and outro.id<>c.id and outro.deleted_at is null)
     and (c.ordem_servico_id is null or (
       exists(select 1 from pcm.ordens_servico o where o.id=c.ordem_servico_id and o.client_id=c.cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=c.id))
       and not exists(select 1 from pcm.chamados outro where outro.id<>c.id and outro.ordem_servico_id=c.ordem_servico_id and outro.deleted_at is null)))
 ), ordens as (
   select c.id chamado_id,o.id,o.status from validos c join pcm.ordens_servico o
     on (o.chamado_id=c.id or (o.id=c.ordem_servico_id and o.chamado_id is null))
     and o.client_id=c.cliente_id and o.deleted_at is null
 )
 select o.chamado_id,count(*),count(*) filter(where o.status='finalizado'),
   bool_and(o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','validacao_pcm','finalizado','cancelado')) and count(distinct o.status)>1
 from ordens o group by o.chamado_id;
end; $$;
revoke all on function pcm.sso_resumir_chamados_lote(uuid[]) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resumir_chamados_lote(uuid[]) to authenticated;

create or replace function pcm.sso_listar_chamados_gerenciais(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,status_chamado text,total_os bigint,finalizadas bigint,etapas_mistas boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.sso_quadro_chamados_gate g where g.id),false) then raise exception 'quadro_chamados_bloqueado' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quadro_chamados_gate g where g.id for share;
 if not coalesce((select g.habilitado from pcm.sso_quadro_chamados_gate g where g.id),false) then raise exception 'quadro_chamados_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query
 with candidatos as materialized (
   select c.id,c.numero,c.titulo,c.status,c.cliente_id,c.ordem_servico_id
   from pcm.chamados c where c.cliente_id=p_cliente_id and c.deleted_at is null and (p_apos is null or c.id>p_apos)
   order by c.id limit p_limite
 ), invalidos as (
   select c.id from candidatos c where
     exists(select 1 from pcm.ordens_servico o where o.chamado_id=c.id and o.deleted_at is null and o.client_id is distinct from c.cliente_id)
     or exists(select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id where o.chamado_id=c.id and o.deleted_at is null and outro.id<>c.id and outro.deleted_at is null)
     or (c.ordem_servico_id is not null and (
       not exists(select 1 from pcm.ordens_servico o where o.id=c.ordem_servico_id and o.client_id=c.cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=c.id))
       or exists(select 1 from pcm.chamados outro where outro.id<>c.id and outro.ordem_servico_id=c.ordem_servico_id and outro.deleted_at is null)))
 ), totais as (
   select c.id,count(o.id) total,count(o.id) filter(where o.status='finalizado') concluidas,
     coalesce(bool_and(o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','validacao_pcm','finalizado','cancelado')) filter(where o.id is not null),false) and count(distinct o.status)>1 mistas
   from candidatos c left join pcm.ordens_servico o on (o.chamado_id=c.id or (o.id=c.ordem_servico_id and o.chamado_id is null)) and o.client_id=c.cliente_id and o.deleted_at is null
   group by c.id
 )
 select c.id,c.numero::text,c.titulo::text,c.status::text,t.total,t.concluidas,t.mistas
 from candidatos c join totais t on t.id=c.id
 where case when exists(select 1 from invalidos) then pcm.sso_rejeitar_vinculo_quadro_chamados() else true end
 order by c.id;
end; $$;
revoke all on function pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_chamados_gerenciais(uuid,uuid,integer) to authenticated;

create or replace function pcm.sso_listar_chamados_gerenciais_v2(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,status_chamado text,total_os bigint,finalizadas bigint,etapas_mistas boolean,vinculo_inconsistente boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_quadro_chamados_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'quadro_chamados_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query
 with candidatos as materialized (
   select c.id,c.numero,c.titulo,c.status,c.cliente_id,c.ordem_servico_id
   from pcm.chamados c where c.cliente_id=p_cliente_id and c.deleted_at is null and (p_apos is null or c.id>p_apos)
   order by c.id limit p_limite
 ), avaliados as materialized (
   select c.*, (
     exists(select 1 from pcm.ordens_servico o where o.chamado_id=c.id and o.deleted_at is null and o.client_id is distinct from c.cliente_id)
     or exists(select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id where o.chamado_id=c.id and o.deleted_at is null and outro.id<>c.id and outro.deleted_at is null)
     or (c.ordem_servico_id is not null and (
       not exists(select 1 from pcm.ordens_servico o where o.id=c.ordem_servico_id and o.client_id=c.cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=c.id))
       or exists(select 1 from pcm.chamados outro where outro.id<>c.id and outro.ordem_servico_id=c.ordem_servico_id and outro.deleted_at is null)))
   ) as inconsistente from candidatos c
 ), totais as (
   select c.id,count(o.id) total,count(o.id) filter(where o.status='finalizado') concluidas,
     coalesce(bool_and(o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao','validacao_pcm','finalizado','cancelado')) filter(where o.id is not null),false) and count(distinct o.status)>1 mistas
   from avaliados c left join pcm.ordens_servico o on not c.inconsistente
     and (o.chamado_id=c.id or (o.id=c.ordem_servico_id and o.chamado_id is null)) and o.client_id=c.cliente_id and o.deleted_at is null
   group by c.id
 )
 select c.id,c.numero::text,c.titulo::text,c.status::text,
   case when c.inconsistente then null else t.total end,
   case when c.inconsistente then null else t.concluidas end,
   case when c.inconsistente then null else t.mistas end,c.inconsistente
 from avaliados c join totais t on t.id=c.id order by c.id;
end; $$;
revoke all on function pcm.sso_listar_chamados_gerenciais_v2(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_chamados_gerenciais_v2(uuid,uuid,integer) to authenticated;

-- E01-S194 AC-1/AC-4 — a coluna "Demanda" do Kanban aprovado precisa de cartão mesmo antes de
-- existir OS (um Chamado liberado do Backlog — E01-S193 — pode ficar em 'demanda' por tempo
-- indefinido até o PCM decidir "Gerar OS"). Mesmo padrão já usado pro card sintético
-- `chamado-aberto:` (1509/E01-S167) — em vez de duplicar o branch do UNION com um item_tipo
-- novo, só estende o WHERE pra incluir `status='demanda'` e troca o `status` fixo ('solicitacao')
-- por `ch.status` dinâmico. Frontend não muda: mesmo prefixo de id, mesmo item_tipo
-- `chamado_aberto`, o agrupamento por coluna já lê o campo `status` genericamente.
-- SPEC_DEVIATION (ver plan.md): "Campo a conciliar" (AC-5) não ganhou coluna virtual nesta
-- story — a fonte real (`pcm.sso_origem_campo_processamentos.provisorio`, E01-S175) não foi
-- mapeada a tempo; registrado como achado pra story de continuação, mesmo padrão de divergência
-- documentada já usado nesta story pra AC-7 (matriz de transição parcial).
create or replace view pcm.operacao_itens
with (security_invoker = on) as
select
  o.id::text as item_id, 'ordem_servico'::text as item_tipo,
  o.id as ordem_servico_id, o.chamado_id, o.client_id as cliente_id,
  c.nome as cliente_nome, o.numero, o.titulo, o.categoria, o.origem,
  o.status, o.prioridade, o.gravidade, o.urgencia, o.tendencia,
  o.dor_cliente, o.score_pcm, o.origem_inspecao_item_id, o.auvo_task_id,
  o.auvo_sync_status, o.auvo_sync_error, o.created_at,
  o.tecnico_funcionario_id, f.nome as tecnico_nome, o.data_agendada,
  o.check_in_at, o.check_out_at, o.tipo_os, o.pmoc_schedule_id,
  o.auvo_detalhes ->> 'orientacao' as orientacao,
  -- Coluna introduzida por 1858 (E01-S192). `create or replace view` NÃO pode remover coluna
  -- existente (42P16) — omiti-la aqui fazia esta migration falhar inteira no deploy.
  o.ocorrencia_preventiva_id
from pcm.ordens_servico o
join pcm.clientes c on c.id = o.client_id
left join pcm.funcionarios f on f.id = o.tecnico_funcionario_id
where o.deleted_at is null
  and translate(lower(trim(o.titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')
union all
select
  'chamado-aberto:' || ch.id::text as item_id, 'chamado_aberto'::text as item_tipo,
  null::uuid as ordem_servico_id, ch.id as chamado_id, ch.cliente_id,
  c.nome as cliente_nome, ch.numero, ch.titulo, 'corretiva'::text as categoria,
  ch.origem, ch.status as status, 'normal'::text as prioridade,
  null::int as gravidade, null::int as urgencia, null::int as tendencia,
  null::int as dor_cliente, 0::int as score_pcm, null::uuid as origem_inspecao_item_id,
  null::bigint as auvo_task_id, null::text as auvo_sync_status,
  null::text as auvo_sync_error, ch.created_at, null::uuid as tecnico_funcionario_id,
  null::text as tecnico_nome, null::timestamptz as data_agendada,
  null::timestamptz as check_in_at, null::timestamptz as check_out_at,
  null::text as tipo_os, null::uuid as pmoc_schedule_id, null::text as orientacao,
  null::uuid as ocorrencia_preventiva_id
from pcm.chamados ch
join pcm.clientes c on c.id = ch.cliente_id
where ch.deleted_at is null
  and ch.status in ('aberto', 'demanda')
  and not exists (
    select 1 from pcm.ordens_servico vinculada
    where vinculada.client_id = ch.cliente_id
      and vinculada.deleted_at is null
      and translate(lower(trim(vinculada.titulo)), 'áàâãéèêíìîóòôõúùûç', 'aaaaeeeiiioooouuuc') not in ('inicio visita', 'fim visita')
      and (
        vinculada.chamado_id = ch.id
        or (
          vinculada.id = ch.ordem_servico_id and vinculada.chamado_id is null
          and not exists (
            select 1 from pcm.chamados outro
            where outro.id <> ch.id and outro.cliente_id = ch.cliente_id
              and outro.deleted_at is null and outro.ordem_servico_id = vinculada.id
          )
        )
      )
  );
