create or replace function pcm.sso_decisao_linha_autorizada(p_lote_id uuid,p_chave text)
returns table(decisao text,revisao integer,motivo text,tipo text,entidade_id uuid,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
 return query
 select case when d.decisao='incorporada' and exists(
   select 1 from pcm.sso_levantamento_incorporacoes i
   join pcm.sso_levantamento_comandos c on c.request_id=i.request_id
   where i.lote_id=p_lote_id and i.linha_chave=p_chave and i.revisao=d.revisao
     and c.payload->>'operacao'='vincular_ativo'
 ) then 'vinculada'::text else d.decisao end,
 d.revisao,d.motivo,d.tipo,d.entidade_id,d.ator_id,d.ocorrido_em
 from pcm.sso_consultar_decisao_linha_levantamento(p_lote_id,p_chave) d;
end; $$;
revoke all on function pcm.sso_decisao_linha_autorizada(uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decisao_linha_autorizada(uuid,text) to authenticated;
