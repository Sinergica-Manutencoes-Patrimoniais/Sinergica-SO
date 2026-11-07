-- ADR-1302: mediação autenticada; os gates dos núcleos continuam fechados.
create function pcm.sso_continuacoes_para_parcela_mediado(
  p_ator_id uuid,p_cliente_id uuid,p_ciclo_id uuid,p_apos uuid,p_limite integer)
returns table(proposta_id uuid,parcela_id uuid,os_id uuid,chamado_id uuid,chamado_revision bigint,
  descricao_restante text,minutos_restantes integer,situacao text,proposta_sha256 text,vinculo_declarado_atual boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return query select * from pcm.sso_continuacoes_para_parcela(p_cliente_id,p_ciclo_id,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_continuacoes_para_parcela_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_continuacoes_para_parcela_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_vincular_continuacao_parcela_mediado(
  p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,p_parcela_id uuid,
  p_proposta_id uuid,p_chamado_revision bigint,p_proposta_sha256 text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return pcm.sso_vincular_continuacao_parcela(p_request_id,p_ator_esperado,p_cliente_id,p_ciclo_id,
    p_parcela_id,p_proposta_id,p_chamado_revision,p_proposta_sha256,p_motivo);
end; $$;
revoke all on function pcm.sso_vincular_continuacao_parcela_mediado(uuid,uuid,uuid,uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_continuacao_parcela_mediado(uuid,uuid,uuid,uuid,uuid,uuid,bigint,text,text) to authenticated;
