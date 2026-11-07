-- ADR-1341: aprovação não escolhe o Grupo; atualização exige correspondência explícita.
create or replace function pcm.sso_reservar_codigo_na_aprovacao_parcial() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_informado text;v_candidato text;v_codigo text;v_existentes bigint;v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then raise exception 'reserva_codigo_desabilitada' using errcode='55000';end if;
 select l.tipo,nullif(btrim(l.atributos->>'codigoInformado'),'') into v_tipo,v_informado from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave;
 if v_tipo not in ('sistema','equipamento','componente','grupo_quantitativo') then return new;end if;
 select nullif(btrim(s.codigo),'') into v_candidato from pcm.sso_codigo_staging s where s.lote_id=new.lote_id and s.linha_chave=new.linha_chave;
 if v_informado is not null and v_candidato is not null and v_informado is distinct from v_candidato then raise exception 'codigos_divergentes' using errcode='23514';end if;
 v_codigo:=coalesce(v_candidato,v_informado);if v_codigo is null then return new;end if;
 if length(v_codigo)>200 or v_codigo<>upper(v_codigo) or v_codigo~'[[:space:]]' then raise exception 'codigo_invalido' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_codigos_grupo_quantitativo g where upper(btrim(g.codigo))=v_codigo) then
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=new.lote_id;
  if v_tipo='grupo_quantitativo' and v_cliente is not null and
    (select count(*) from pcm.sso_codigos_grupo_quantitativo c join pcm.grupos_quantitativos g on g.id=c.grupo_id and g.cliente_id=c.cliente_id
      where upper(btrim(c.codigo))=v_codigo and c.cliente_id=v_cliente and g.ativo and g.deleted_at is null)=1
    and not exists(select 1 from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)
    and not exists(select 1 from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo)
    and not exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo)
    and not exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.consumida_em is null and r.liberada_em is null and upper(btrim(r.codigo))=v_codigo)
    then return new; end if;
  raise exception 'codigo_indisponivel' using errcode='23505';
 end if;
 if exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo) then raise exception 'codigo_indisponivel' using errcode='23505';end if;
 select (select count(*) from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)+(select count(*) from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo) into v_existentes;
 if v_existentes>1 then raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
 if v_existentes=1 then if v_tipo='grupo_quantitativo' then raise exception 'codigo_indisponivel' using errcode='23505';end if;return new;end if;
 insert into pcm.sso_reservas_codigo_parcial(lote_id,linha_chave,ciclo,codigo,ator_id,request_id) values(new.lote_id,new.linha_chave,new.ciclo,v_codigo,new.ator_id,new.request_id);
 return new;
end;$$;

do $migration$
declare
 v_def text;
 v_declaracao text := 'v_nome text;v_payload jsonb;';
 v_nova_declaracao text := 'v_nome text;v_codigo text;v_codigo_staging text;v_payload jsonb;';
 v_campos text := $$a.key not in ('nome','quantidade')$$;
 v_novos_campos text := $$a.key not in ('nome','quantidade','codigoInformado')$$;
 v_busca text := $$select * into v_g from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=v_lote.cliente_id and local_id=p_local_id and ativo and deleted_at is null for update;$$;
 v_nova_busca text := $corpo$
  v_codigo:=nullif(btrim(v_linha.atributos->>'codigoInformado'),'');
  if v_linha.atributos ? 'codigoInformado' and v_linha.atributos->'codigoInformado'<>'null'::jsonb
    and jsonb_typeof(v_linha.atributos->'codigoInformado') is distinct from 'string' then raise exception 'codigo_invalido' using errcode='22023';end if;
  select nullif(btrim(s.codigo),'') into v_codigo_staging from pcm.sso_codigo_staging s where s.lote_id=p_lote_id and s.linha_chave=p_chave for share nowait;
  if v_codigo is not null and v_codigo_staging is not null and v_codigo is distinct from v_codigo_staging then raise exception 'codigos_divergentes' using errcode='23514';end if;
  v_codigo:=coalesce(v_codigo_staging,v_codigo);
  if v_codigo is not null then
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
    if not exists(select 1 from pcm.sso_codigos_grupo_quantitativo c where c.grupo_id=p_grupo_id and c.cliente_id=v_lote.cliente_id and c.codigo=v_codigo) then
      raise exception 'codigo_grupo_divergente' using errcode='23514';end if;
    if exists(select 1 from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)
      or exists(select 1 from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo)
      or exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo)
      or exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.consumida_em is null and r.liberada_em is null and upper(btrim(r.codigo))=v_codigo) then
      raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
  end if;
  select * into v_g from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=v_lote.cliente_id and local_id=p_local_id and ativo and deleted_at is null for update;$corpo$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_atualizar_grupo_levantamento(uuid,uuid,integer,text,uuid,integer,uuid,jsonb)'::regprocedure) into v_def;
 if position(v_declaracao in v_def)=0 or position(v_campos in v_def)=0 or position(v_busca in v_def)=0 then
  raise exception 'definicao_atualizacao_grupo_incompativel' using errcode='55000';end if;
 v_def:=replace(replace(replace(v_def,v_declaracao,v_nova_declaracao),v_campos,v_novos_campos),v_busca,v_nova_busca);
 execute v_def;
end;
$migration$;

-- O vínculo sem alteração também precisa conferir código informado ou aprovado.
do $migration$
declare
 v_def text;
 v_declaracao text := 'v_codigo text; v_area uuid;';
 v_nova_declaracao text := 'v_codigo text; v_codigo_staging text; v_area uuid;';
 v_trecho text := $antes$elsif v_linha.tipo='grupo_quantitativo' then
    select true into v_existe from pcm.grupos_quantitativos g where g.id=p_entidade_id and g.cliente_id=v_lote.cliente_id and g.local_id=p_local_id and g.ativo and g.deleted_at is null for update;$antes$;
 v_novo text := $depois$elsif v_linha.tipo='grupo_quantitativo' then
    v_codigo:=nullif(btrim(v_linha.atributos->>'codigoInformado'),'');
    if v_linha.atributos ? 'codigoInformado' and v_linha.atributos->'codigoInformado'<>'null'::jsonb
      and jsonb_typeof(v_linha.atributos->'codigoInformado') is distinct from 'string' then raise exception 'codigo_invalido' using errcode='22023';end if;
    select nullif(btrim(s.codigo),'') into v_codigo_staging from pcm.sso_codigo_staging s where s.lote_id=p_lote_id and s.linha_chave=p_chave for share nowait;
    if v_codigo is not null and v_codigo_staging is not null and v_codigo is distinct from v_codigo_staging then raise exception 'codigos_divergentes' using errcode='23514';end if;
    v_codigo:=coalesce(v_codigo_staging,v_codigo);
    if v_codigo is not null then
      if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
      if not exists(select 1 from pcm.sso_codigos_grupo_quantitativo c where c.grupo_id=p_entidade_id and c.cliente_id=v_lote.cliente_id and c.codigo=v_codigo) then
        raise exception 'codigo_grupo_divergente' using errcode='23514';end if;
      if exists(select 1 from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)
        or exists(select 1 from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo)
        or exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo)
        or exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.consumida_em is null and r.liberada_em is null and upper(btrim(r.codigo))=v_codigo) then
        raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
    end if;
    select true into v_existe from pcm.grupos_quantitativos g where g.id=p_entidade_id and g.cliente_id=v_lote.cliente_id and g.local_id=p_local_id and g.ativo and g.deleted_at is null for update;$depois$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_vincular_ativo_levantamento(uuid,uuid,integer,text,uuid,uuid)'::regprocedure) into v_def;
 if position(v_declaracao in v_def)=0 or position(v_trecho in v_def)=0 then
  raise exception 'definicao_vinculo_grupo_incompativel' using errcode='55000';end if;
 execute replace(replace(v_def,v_declaracao,v_nova_declaracao),v_trecho,v_novo);
end;
$migration$;
