-- E01-S199 — "Campo a conciliar" como fila de entrada do Kanban (BL 007 AC-5 do Pacote
-- Consolidado do Fabrício, 13/11/2026).
--
-- ACHADO QUE DEFINE O ESCOPO DESTA MIGRATION: a máquina de conciliação já existe inteira.
-- `1420` cria `pcm.sso_origem_campo_processamentos` com `provisorio` (OS que chegou do Auvo sem
-- ID de Chamado ganha OS + Chamado provisórios); `1428` registra a decisão de triagem em
-- `pcm.sso_triagem_chamado_campo_decisoes`; `1427` já lista o estado de campo por Cliente. O que
-- NÃO existia é a regra do pacote: "Solicitação, Preventiva e Campo a conciliar são filas de
-- ENTRADA" do Kanban. Hoje a fila só aparece dentro de Visão 360 → Estrutura, atrás de outra
-- flag — quem opera o Kanban não a enxerga.
--
-- Por isso esta migration NÃO cria entidade, gate nem capacidade nova: só acrescenta a consulta
-- que faltava, com o recorte que a coluna precisa (provisório E ainda sem decisão de triagem).
-- `1427` devolve todo o estado de campo, inclusive o já conciliado — serve a outra tela, não a
-- esta fila.
--
-- Reusa deliberadamente:
--   gate       pcm.sso_consulta_estado_campo_gate   (de 1427, fechado por padrão)
--   capacidade config.sso_autorizar_acao('execucao.validar', cliente)   (mesma de 1427/1428)
-- Reaproveitar o gate mantém a superfície de ativação do mesmo tamanho: quem abrir a consulta de
-- estado de campo abre as duas leituras, que são a mesma jornada vista de dois lugares.
--
-- Reverso:
--   drop function if exists pcm.sso_listar_campo_a_conciliar(uuid,uuid,integer);

create function pcm.sso_listar_campo_a_conciliar(p_ator_id uuid, p_cliente_id uuid, p_limite integer)
returns table(
  os_id uuid, chamado_id uuid, os_numero text, chamado_numero text,
  titulo text, motivo text, task_id bigint, status_os text, criado_em timestamptz
)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id
     or p_cliente_id is null or p_limite is null or p_limite not between 1 and 50 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  -- Mesma trava compartilhada de 1427/1428: impede ler a fila no meio de uma alteração de
  -- autorização em curso.
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
       pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_consulta_estado_campo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501'; end if;

  return query
    select p.os_id, c.id as chamado_id, o.numero as os_numero, c.numero as chamado_numero,
           coalesce(nullif(btrim(c.titulo), ''), nullif(btrim(o.titulo), ''), 'Sem título') as titulo,
           p.motivo, o.auvo_task_id as task_id, o.status as status_os, p.criado_em
      from pcm.sso_origem_campo_processamentos p
      join pcm.ordens_servico o
        on o.id = p.os_id and o.client_id = p.cliente_id and o.deleted_at is null
      join pcm.chamados c
        on c.id = p.chamado_id and c.cliente_id = p.cliente_id and c.deleted_at is null
     where p.cliente_id = p_cliente_id
       -- Mesmo recorte de "provisório de verdade" usado em 1427: o vínculo tem de continuar
       -- apontando para o Chamado provisório que o processamento criou. Se o PCM já uniu a OS a
       -- outro Chamado (1429), ela saiu da fila mesmo sem decisão registrada.
       and p.provisorio
       and o.chamado_id = p.chamado_id
       -- Ainda sem decisão de triagem (1428): decidida, confirmada ou corrigida, sai da fila.
       and not exists (
         select 1 from pcm.sso_triagem_chamado_campo_decisoes d where d.chamado_id = c.id)
       -- Chamado encerrado não é fila de entrada de ninguém.
       and c.sso_encerrado_em is null
     order by p.criado_em, p.os_id
     limit p_limite;
end; $$;

revoke all on function pcm.sso_listar_campo_a_conciliar(uuid,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_campo_a_conciliar(uuid,uuid,integer) to authenticated;
