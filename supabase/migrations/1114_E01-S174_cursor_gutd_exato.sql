-- ADR-0965: wrapper privado preserva score decimal sem passar por float.
create function pcm.sso_ranking_backlog_unificado_exato(p_cliente_id uuid,p_limite integer,p_apos_tipo text,p_apos_id uuid,p_apos_score text,p_assinatura text)
returns table(tipo text,id uuid,composicao_id uuid,pendencia_id uuid,alvo_tipo text,alvo_id uuid,score text,revisao integer,assinatura text)
language plpgsql volatile security definer set search_path='' as $$
declare v_score numeric;
begin
  if p_apos_score is not null and (length(p_apos_score)>42 or p_apos_score !~ '^[0-5](\.[0-9]{1,40})?$') then raise exception 'cursor_invalido' using errcode='22023'; end if;
  if p_apos_score is not null then v_score:=p_apos_score::numeric; end if;
  return query select q.tipo,q.id,q.composicao_id,q.pendencia_id,q.alvo_tipo,q.alvo_id,q.score::text,q.revisao,q.assinatura
    from pcm.sso_ranking_backlog_unificado(p_cliente_id,p_limite,p_apos_tipo,p_apos_id,v_score,p_assinatura) q
    order by q.score desc nulls last,q.tipo,q.id;
end; $$;
revoke all on function pcm.sso_ranking_backlog_unificado_exato(uuid,integer,text,uuid,text,text) from public,anon,authenticated,service_role;
