-- ADR-0257: leitura conservadora; não cria nem aprova dados oficiais.
create function pcm.sso_conferir_alvos_cronograma(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo_linha text,conferencia text,identidade text,mapeamento_id uuid,situacao text,pendencias text[],alvo_atual text)
language plpgsql stable security definer set search_path='' as $$
begin
 return query select c.chave,c.tipo_linha,c.conferencia,c.identidade,c.mapeamento_id,c.situacao,c.pendencias,
 case when m.id is null then 'nao_aplicavel'
 when m.alvo_tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=m.alvo_id and s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null) then 'valido'
 when m.alvo_tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=m.alvo_id and e.client_id=p_cliente_id and e.ativo and e.deleted_at is null) then 'valido'
 when m.alvo_tipo='grupo' and exists(select 1 from pcm.grupos_quantitativos g where g.id=m.alvo_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null) then 'valido'
 else 'indisponivel' end
 from pcm.sso_conferir_linhas_cronograma(p_cliente_id,p_lote_id,p_apos,p_limite) c
 left join pcm.sso_cronograma_mapeamentos m on m.id=c.mapeamento_id;
end; $$;
revoke all on function pcm.sso_conferir_alvos_cronograma(uuid,uuid,text,integer) from public,anon,authenticated,service_role;
