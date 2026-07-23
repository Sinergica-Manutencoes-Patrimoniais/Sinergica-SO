-- 0147_E09-S10_E02-S22_security_lint.sql — Sinérgica SO
-- Corrige os advisors pós-promoção sem alterar contratos públicos.
--
-- Reverso:
--   alter view financeiro.portal_faturas set (security_invoker = false);
--   alter view financeiro.portal_cobrancas set (security_invoker = false);
--   a versão anterior de atendimento.fn_definir_handoff difere apenas pela variável local morta.

alter view financeiro.portal_faturas
  set (security_invoker = true);

alter view financeiro.portal_cobrancas
  set (security_invoker = true);

create or replace function atendimento.fn_definir_handoff(
  p_conversa_id uuid,
  p_acao text,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = atendimento, public
as $$
declare
  v_actor uuid := auth.uid();
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_pode_escrever boolean := (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
  v_modo text;
begin
  if p_acao not in ('automatico', 'assumir', 'devolver', 'envio_humano') then
    raise exception 'ação de handoff inválida: %', p_acao using errcode = '22023';
  end if;
  if p_acao = 'automatico' and not v_service then
    raise exception 'handoff automático exige service_role' using errcode = '42501';
  end if;
  if p_acao <> 'automatico' and not v_pode_escrever then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;

  select modo into v_modo
  from atendimento.conversas
  where id = p_conversa_id
  for update;
  if not found then
    raise exception 'conversa não encontrada' using errcode = 'P0002';
  end if;

  if p_acao = 'devolver' then
    update atendimento.conversas
    set modo = 'auto', status = 'aberta', atribuido_a = null,
        handoff_motivo = null, handoff_em = null,
        updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  elsif p_acao = 'automatico' then
    update atendimento.conversas
    set modo = 'pausado', status = 'pendente', atribuido_a = null,
        handoff_motivo = nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), ''),
        handoff_em = coalesce(handoff_em, now()), updated_at = now()
    where id = p_conversa_id;
  else
    update atendimento.conversas
    set modo = 'pausado', status = 'aberta', atribuido_a = v_actor,
        handoff_motivo = coalesce(nullif(left(trim(coalesce(p_motivo, '')), 500), ''), handoff_motivo),
        handoff_em = coalesce(handoff_em, now()), updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  end if;

  -- Não duplica eventos de handoff automático para a mesma conversa já pausada pelo mesmo motivo.
  if p_acao <> 'automatico'
     or v_modo <> 'pausado'
     or not exists (
       select 1 from atendimento.handoff_eventos
       where conversa_id = p_conversa_id and acao = 'automatico'
         and motivo is not distinct from nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), '')
         and created_at >= now() - interval '1 minute'
     ) then
    insert into atendimento.handoff_eventos (conversa_id, acao, motivo, actor_id)
    values (p_conversa_id, p_acao, nullif(left(trim(coalesce(p_motivo, '')), 500), ''), v_actor);
  end if;
end;
$$;

revoke all on function atendimento.fn_definir_handoff(uuid, text, text) from public;
grant execute on function atendimento.fn_definir_handoff(uuid, text, text) to authenticated, service_role;
