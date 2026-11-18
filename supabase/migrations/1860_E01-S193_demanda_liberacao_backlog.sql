-- E01-S193 AC-4/AC-5 — Backlog aprovado libera escopo pro Chamado, que nasce em 'demanda', não
-- 'aberto' (decisão do PCM, ADR-1689, 17/11/2026). "Demanda" só admite OS depois de uma transição
-- própria (RPC de E01-S194) — até lá é dead-end por construção: os 44 pontos que leem
-- `pcm.chamados.status` em todo o repo são whitelist positiva (`status in (...)`/`status not in
-- (...)`), nenhum aceita 'demanda' sem ser explicitamente adicionado, e nenhum precisou mudar
-- (auditoria em ADR-1689, seção "Decisão", item 4).
--
-- Reverso: update pcm.chamados set status='aberto' where status='demanda'; -- nunca sem decisão do PCM
--          revoke execute on function pcm.sso_liberar_escopo_backlog(uuid,uuid,uuid,integer,uuid,text,text) from authenticated;
--          drop function pcm.sso_liberar_escopo_backlog(uuid,uuid,uuid,integer,uuid,text,text);
--          alter table pcm.chamados drop constraint chamados_status_check;
--          alter table pcm.chamados add constraint chamados_status_check
--            check (status in ('aberto','convertido_os','backlog','cancelado'));
--
-- O QUE ISTO FAZ (e o que NÃO faz)
-- `ALTER ... DROP/ADD CONSTRAINT` aditivo: amplia o conjunto permitido de `status`, nunca restringe.
-- `pcm.sso_liberar_escopo_backlog` é um wrapper FINO: chama `pcm.sso_promover_backlog_chamado`
-- (0890, ADR-0665) sem reescrever locks, idempotência, parcelas ou vínculo — reusa tudo — e só
-- depois, na MESMA transação, transiciona o Chamado recém-criado de 'aberto' para 'demanda'.
-- Atômico: se a transição falhar, a promoção inteira (0890) desfaz junto.
-- Idempotente por construção: `0890` já devolve o mesmo resultado em retry por `request_id`; o
-- UPDATE de status aqui só casa linha quando `status='aberto'` — na segunda chamada já está
-- 'demanda', o UPDATE não casa nada, e o resultado final é lido de volta do banco (não do cache
-- de `0890`), então retry é seguro mesmo que a transição tenha corrido na primeira chamada e
-- falhado em outra etapa depois.
-- NÃO cria tabela nova, NÃO duplica autorização (0890 já checa `backlog.promover`,
-- `execucao.validar`, `chamado.escopo.gerir` e os 3 gates aninhados antes de qualquer escrita).
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'pcm.chamados'::regclass and conname = 'chamados_status_check'
      and pg_get_constraintdef(oid) ilike '%demanda%'
  ) then
    return; -- já aplicada (idempotência de reaplicação/db reset)
  end if;
  alter table pcm.chamados drop constraint chamados_status_check;
  alter table pcm.chamados add constraint chamados_status_check
    check (status in ('aberto', 'convertido_os', 'backlog', 'cancelado', 'demanda'));
end $$;

create function pcm.sso_liberar_escopo_backlog(
  p_request_id uuid, p_cliente_id uuid, p_composicao_id uuid, p_expected_revision integer,
  p_chamado_id uuid, p_titulo text, p_descricao text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resultado jsonb;
  v_status text;
begin
  v_resultado := pcm.sso_promover_backlog_chamado(
    p_request_id, p_cliente_id, p_composicao_id, p_expected_revision, p_chamado_id, p_titulo, p_descricao
  );
  update pcm.chamados set status = 'demanda'
    where id = p_chamado_id and cliente_id = p_cliente_id and status = 'aberto';
  select status into v_status from pcm.chamados where id = p_chamado_id and cliente_id = p_cliente_id;
  if v_status is distinct from 'demanda' then
    raise exception 'chamado_nao_transicionou_demanda' using errcode = '55000';
  end if;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'backlog.liberado_demanda', 'chamados', p_chamado_id, v_resultado || jsonb_build_object('status', v_status));
  return v_resultado || jsonb_build_object('status', v_status);
end;
$$;
revoke all on function pcm.sso_liberar_escopo_backlog(uuid, uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_liberar_escopo_backlog(uuid, uuid, uuid, integer, uuid, text, text)
  to authenticated;
