-- ADR-0180: consulta de prévia, sem gravação.
create function pcm.sso_classificar_linhas_levantamento(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo text,problemas text[],possiveis_duplicatas bigint,classificacao text)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query with dados as (
    select d.*,l.atributos,nullif(btrim(l.atributos->>'codigoInformado'),'') codigo
    from pcm.sso_diagnosticar_linhas_levantamento(p_lote_id,p_apos,p_limite) d
    join pcm.sso_levantamento_linhas l on l.lote_id=p_lote_id and l.chave=d.chave
  ), correspondencias as (
    select d.*,
      case d.tipo when 'sistema' then (select count(*) from pcm.sistemas s where s.cliente_id=v_cliente and s.deleted_at is null and upper(btrim(s.codigo))=upper(d.codigo))
        when 'equipamento' then (select count(*) from pcm.equipamentos e where e.client_id=v_cliente and e.deleted_at is null and e.tipo='equipamento' and upper(btrim(e.identificador))=upper(d.codigo))
        when 'componente' then (select count(*) from pcm.equipamentos e where e.client_id=v_cliente and e.deleted_at is null and e.tipo='componente' and upper(btrim(e.identificador))=upper(d.codigo))
        else 0 end correspondentes
    from dados d
  ) select d.chave,d.tipo,d.problemas,d.possiveis_duplicatas,
    case when exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=p_lote_id and r.linha_chave=d.chave) then 'rejeitada'
      when exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=d.chave) then 'decidida'
      when d.codigo is null or d.tipo not in ('sistema','equipamento','componente') or d.correspondentes>1 then 'conferencia_necessaria'
      when d.correspondentes=1 and not ('codigo_formato_invalido'=any(d.problemas)) then 'possivel_alteracao'
      when d.correspondentes=0 and d.possiveis_duplicatas=0 and not ('codigo_formato_invalido'=any(d.problemas)) and not ('codigo_ja_utilizado_no_cliente'=any(d.problemas)) then 'possivel_nova'
      else 'conferencia_necessaria' end
    from correspondencias d order by d.chave;
end;
$$;
revoke all on function pcm.sso_classificar_linhas_levantamento(uuid,text,integer) from public,anon,authenticated,service_role;
