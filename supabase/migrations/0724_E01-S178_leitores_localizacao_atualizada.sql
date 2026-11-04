-- ADR-0499: atualização e incorporação continuam fatos distintos.
create or replace function pcm.sso_consultar_decisao_linha_levantamento(p_lote_id uuid, p_chave text)
returns table(decisao text, revisao integer, motivo text, tipo text, entidade_id uuid, ator_id uuid, ocorrido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id = p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', v_cliente) is not true then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from pcm.sso_levantamento_linhas l where l.lote_id = p_lote_id and l.chave = p_chave) then
    raise exception 'linha_nao_encontrada' using errcode = '23514';
  end if;
  return query
    select 'rejeitada'::text, r.revisao, r.motivo, null::text, null::uuid, r.ator_id, r.ocorrido_em
      from pcm.sso_levantamento_rejeicoes r where r.lote_id = p_lote_id and r.linha_chave = p_chave
    union all
    select 'incorporada'::text, i.revisao, null::text, i.tipo, i.entidade_id, i.ator_id, i.ocorrido_em
      from pcm.sso_levantamento_incorporacoes i where i.lote_id = p_lote_id and i.linha_chave = p_chave
    union all
    select 'atualizada'::text, a.revisao, cmd.payload->>'motivo', a.tipo, a.entidade_id, a.ator_id, a.criado_em
      from pcm.sso_atualizacoes_localizacao a join pcm.sso_levantamento_comandos cmd on cmd.request_id=a.request_id where a.lote_id=p_lote_id and a.linha_chave=p_chave;
end;
$$;

create or replace function pcm.sso_classificar_linhas_levantamento(p_lote_id uuid,p_apos text,p_limite integer)
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
      when exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=d.chave) then 'atualizada'
      when exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=d.chave) then 'decidida'
      when d.codigo is null or d.tipo not in ('sistema','equipamento','componente') or d.correspondentes>1 then 'conferencia_necessaria'
      when d.correspondentes=1 and not ('codigo_formato_invalido'=any(d.problemas)) then 'possivel_alteracao'
      when d.correspondentes=0 and d.possiveis_duplicatas=0 and not ('codigo_formato_invalido'=any(d.problemas)) and not ('codigo_ja_utilizado_no_cliente'=any(d.problemas)) then 'possivel_nova'
      else 'conferencia_necessaria' end
    from correspondencias d order by d.chave;
end;
$$;

create or replace function pcm.sso_listar_linhas_editadas_lote(p_lote_id uuid,p_apos text,p_limite integer)
returns table(linha_chave text,ultima_revisao integer,ciclo_atual integer,estado text)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_ciclo integer;
begin
  if not coalesce((select habilitado from pcm.sso_linhas_editadas_lote_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce((select c.ciclo from pcm.sso_conferencia_ciclos c where c.lote_id=p_lote_id),1) into v_ciclo;
  return query select l.chave,max(e.revisao),v_ciclo,
    case when exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=l.lote_id and a.linha_chave=l.chave) then 'atualizada'
      when exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave) then 'incorporada'
      when exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave) then 'rejeitada'
      when exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos) then 'conferida'
      else 'pendente' end
    from pcm.sso_levantamento_linhas l join pcm.sso_edicoes_linha_staging e on e.lote_id=l.lote_id and e.linha_chave=l.chave
    where l.lote_id=p_lote_id and (p_apos is null or l.chave>p_apos) group by l.lote_id,l.chave,l.atributos order by l.chave limit p_limite;
end;
$$;

