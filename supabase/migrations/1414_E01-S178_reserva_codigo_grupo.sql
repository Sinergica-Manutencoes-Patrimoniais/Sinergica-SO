-- ADR-1262: amplia reserva existente; gates permanecem fechados.
create or replace function pcm.sso_reservar_codigo_na_aprovacao_parcial() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_informado text;v_candidato text;v_codigo text;v_existentes bigint;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then raise exception 'reserva_codigo_desabilitada' using errcode='55000';end if;
 select l.tipo,nullif(btrim(l.atributos->>'codigoInformado'),'') into v_tipo,v_informado from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave;
 if v_tipo not in ('sistema','equipamento','componente','grupo_quantitativo') then return new;end if;
 select nullif(btrim(s.codigo),'') into v_candidato from pcm.sso_codigo_staging s where s.lote_id=new.lote_id and s.linha_chave=new.linha_chave;
 if v_informado is not null and v_candidato is not null and v_informado is distinct from v_candidato then raise exception 'codigos_divergentes' using errcode='23514';end if;
 v_codigo:=coalesce(v_candidato,v_informado);if v_codigo is null then return new;end if;
 if length(v_codigo)>200 or v_codigo<>upper(v_codigo) or v_codigo~'[[:space:]]' then raise exception 'codigo_invalido' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_codigos_grupo_quantitativo g where upper(btrim(g.codigo))=v_codigo) then raise exception 'codigo_indisponivel' using errcode='23505';end if;
 if exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo) then raise exception 'codigo_indisponivel' using errcode='23505';end if;
 select (select count(*) from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)+(select count(*) from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo) into v_existentes;
 if v_existentes>1 then raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
 if v_existentes=1 then if v_tipo='grupo_quantitativo' then raise exception 'codigo_indisponivel' using errcode='23505';end if;return new;end if;
 insert into pcm.sso_reservas_codigo_parcial(lote_id,linha_chave,ciclo,codigo,ator_id,request_id) values(new.lote_id,new.linha_chave,new.ciclo,v_codigo,new.ator_id,new.request_id);
 return new;
end;$$;

create or replace function pcm.sso_incorporar_ativo_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_local_id uuid,p_categoria_id uuid,p_sistema_id uuid,p_parent_id uuid,p_codigo text,p_quantidade bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_tipo text;v_ciclo integer;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then return pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_id) then return pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);end if;
 select tipo into v_tipo from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if v_tipo in ('sistema','equipamento','componente') or (v_tipo='grupo_quantitativo' and p_codigo is not null) then
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
  if p_codigo is null or not exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.lote_id=p_lote_id and r.linha_chave=p_chave and r.ciclo=v_ciclo and r.consumida_em is null and r.liberada_em is null and r.codigo=p_codigo) then raise exception 'reserva_codigo_ausente_ou_obsoleta' using errcode='23514';end if;
  insert into pcm.sso_reserva_codigo_permissao(txid,lote_id,linha_chave,ator_id,codigo) values(pg_catalog.txid_current(),p_lote_id,p_chave,auth.uid(),p_codigo);
 end if;
 v_resultado:=pcm.sso_incorporar_ativo_levantamento_base_0892(p_request_id,p_lote_id,p_expected_revision,p_chave,p_local_id,p_categoria_id,p_sistema_id,p_parent_id,p_codigo,p_quantidade);
 if v_tipo in ('sistema','equipamento','componente') or (v_tipo='grupo_quantitativo' and p_codigo is not null) then
  update pcm.sso_reservas_codigo_parcial set consumida_em=now(),entidade_id=(v_resultado->'linkedIds'->>'entidadeId')::uuid where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo and consumida_em is null and liberada_em is null;
  if not found then raise exception 'reserva_nao_consumida' using errcode='23514';end if;
  delete from pcm.sso_reserva_codigo_permissao where txid=pg_catalog.txid_current() and lote_id=p_lote_id and linha_chave=p_chave and ator_id=auth.uid();
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.reserva_codigo_consumida','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'requestId',p_request_id,'entidadeId',v_resultado->'linkedIds'->>'entidadeId'));
 end if;
 return v_resultado;
end;$$;
