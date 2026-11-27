-- E01-S199 AC-11: retira o Chamado cancelado da fila Campo a conciliar.
-- A assinatura, a autorização e os grants de 1866 são preservados.
-- Reverso: restaurar o corpo de 1866 em nova migration.

create or replace function pcm.sso_listar_campo_a_conciliar(p_ator_id uuid, p_cliente_id uuid, p_limite integer)
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
       -- O cancelamento preservado (1430) deixa o vínculo histórico da OS e não preenche
       -- sso_encerrado_em. A tarefa deve sair da fila mesmo quando a OS segue em Planejamento.
       and c.sso_encerrado_em is null
       and c.status <> 'cancelado'
     order by p.criado_em, p.os_id
     limit p_limite;
end; $$;
