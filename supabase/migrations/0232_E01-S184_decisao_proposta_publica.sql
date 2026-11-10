-- E01-S184: a RPC anterior retornava a linha privada completa ao cliente.
-- Reverso: permitir execução da RPC anterior e retirar a nova (reabre exposição de custos).
revoke execute on function comercial.fn_decidir_proposta(uuid, text, text) from authenticated, public, anon;

create or replace function comercial.portal_decidir_proposta(
  p_proposta_id uuid, p_decisao text, p_motivo text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if not exists (
    select 1 from config.usuarios u
    join config.usuario_cliente uc on uc.user_id = u.user_id
    join comercial.oportunidades o on o.cliente_id = uc.cliente_id
    join comercial.propostas p on p.oportunidade_id = o.id
    where u.user_id = auth.uid() and u.ativo and u.papel = 'cliente-sindico'
      and auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and uc.cliente_id::text = auth.jwt() ->> 'cliente_id'
      and p.id = p_proposta_id
  ) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;

  select r.status into v_status
    from comercial.fn_decidir_proposta(p_proposta_id, p_decisao, p_motivo) r;
  return jsonb_build_object('status', v_status);
end;
$$;
revoke all on function comercial.portal_decidir_proposta(uuid, text, text) from public, anon;
grant execute on function comercial.portal_decidir_proposta(uuid, text, text) to authenticated;
