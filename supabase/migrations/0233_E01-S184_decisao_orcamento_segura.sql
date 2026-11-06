-- E01-S184: verificar vínculo ativo antes da decisão de orçamento.
-- Reverso: retornar ao endpoint legado e seu grant (revogação de acesso deixa de ser imediata).
revoke execute on function pcm.portal_decidir_orcamento(uuid, text, text) from authenticated, public, anon;

create or replace function pcm.portal_decidir_orcamento_seguro(
  p_orcamento_id uuid, p_decisao text, p_motivo text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from config.usuarios u
    join config.usuario_cliente uc on uc.user_id = u.user_id
    join pcm.orcamentos_servico o on o.cliente_id = uc.cliente_id
    where u.user_id = auth.uid() and u.ativo and u.papel = 'cliente-sindico'
      and auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and uc.cliente_id::text = auth.jwt() ->> 'cliente_id'
      and o.id = p_orcamento_id
  ) then
    raise exception 'orcamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return pcm.portal_decidir_orcamento(p_orcamento_id, p_decisao, p_motivo);
end;
$$;
revoke all on function pcm.portal_decidir_orcamento_seguro(uuid, text, text) from public, anon;
grant execute on function pcm.portal_decidir_orcamento_seguro(uuid, text, text) to authenticated;
