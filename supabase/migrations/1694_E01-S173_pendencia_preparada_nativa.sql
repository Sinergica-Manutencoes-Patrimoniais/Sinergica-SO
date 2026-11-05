-- ADR-1550: pendência de OS nativa usa a preparada real, não identidade legada fictícia.
alter table pcm.sso_pendencias_tecnicas add column ocorrencia_calendario_preparada_id uuid references pcm.ocorrencias_rotina_preparadas(id);
alter table pcm.sso_pendencias_tecnicas add column ocorrencia_visita_preparada_id uuid references pcm.ocorrencias_visita_preparadas(id);
alter table pcm.sso_pendencias_tecnicas drop constraint sso_pendencia_origem_exclusiva;
alter table pcm.sso_pendencias_tecnicas add constraint sso_pendencia_origem_exclusiva check (num_nonnulls(ocorrencia_id,ocorrencia_grupo_id,ocorrencia_calendario_preparada_id,ocorrencia_visita_preparada_id)=1);
create index sso_pendencias_calendario_preparada_idx on pcm.sso_pendencias_tecnicas(ocorrencia_calendario_preparada_id) where ocorrencia_calendario_preparada_id is not null;
create index sso_pendencias_visita_preparada_idx on pcm.sso_pendencias_tecnicas(ocorrencia_visita_preparada_id) where ocorrencia_visita_preparada_id is not null;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure);
 decl text:='  v_ocorrencia_grupo uuid; v_origem jsonb; v_payload jsonb;';
 velho text:=$antes$  if exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=v_retorno.cliente_id) then$antes$;
 novo text:=$depois$  if exists(select 1 from pcm.sso_origens_os_preventiva f join pcm.ordens_servico os on os.id=f.os_id where f.os_id=v_retorno.os_id and os.ocorrencia_preventiva_id is null) and v_rotina.alvo_tipo in ('sistema','componente') then
   select case when f.tipo='calendario' then f.preparada_id end,case when f.tipo='visita' then f.preparada_id end
    into v_preparada_calendario,v_preparada_visita
   from pcm.sso_origens_os_preventiva f join pcm.ordens_servico os on os.id=f.os_id and os.client_id=f.cliente_id and os.deleted_at is null
   where f.os_id=v_retorno.os_id and f.cliente_id=v_retorno.cliente_id and f.versao_id=v_retorno.versao_id and f.rotina_id=v_retorno.rotina_id
    and os.ocorrencia_preventiva_id is null and v_rotina.alvo_tipo in ('sistema','componente')
    and ((f.tipo='calendario' and exists(select 1 from pcm.ocorrencias_rotina_preparadas p where p.id=f.preparada_id and p.plano_id=f.plano_id and p.alvo_tipo=v_rotina.alvo_tipo and p.alvo_id=coalesce(v_rotina.sistema_id,v_rotina.equipamento_id)))
      or (f.tipo='visita' and exists(select 1 from pcm.ocorrencias_visita_preparadas p where p.id=f.preparada_id and p.plano_id=f.plano_id and p.alvo_tipo=v_rotina.alvo_tipo and p.alvo_id=coalesce(v_rotina.sistema_id,v_rotina.equipamento_id))))
    and (select count(*) from jsonb_array_elements(case when jsonb_typeof(f.snapshot->'rotinas')='array' then f.snapshot->'rotinas' else '[]'::jsonb end) r(item)
      where r.item->>'id'=f.rotina_id::text and r.item->>'modo'=f.tipo and r.item->>'alvo_tipo'=v_rotina.alvo_tipo
       and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id')=coalesce(v_rotina.sistema_id,v_rotina.equipamento_id)::text)=1;
   if not found then raise exception 'origem_os_preventiva_divergente' using errcode='23514';end if;
   v_ocorrencia:=null;v_ocorrencia_grupo:=null;
  elsif exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=v_retorno.cliente_id) then$depois$;
 guarda text:=$antes$  if (v_ocorrencia is null) = (v_ocorrencia_grupo is null) or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;$antes$;
 guarda_nova text:=$depois$  if num_nonnulls(v_ocorrencia,v_ocorrencia_grupo,v_preparada_calendario,v_preparada_visita)<>1 or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;$depois$;
 ins text:=$antes$insert into pcm.sso_pendencias_tecnicas(cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,ocorrencia_grupo_id,rotina_id,alvo_tipo,alvo_id,pergunta,observacao)
    values(v_retorno.cliente_id,v_resposta.id,v_retorno.id,v_retorno.os_id,v_ocorrencia,v_ocorrencia_grupo,v_rotina.id,v_rotina.alvo_tipo,$antes$;
 ins_novo text:=$depois$insert into pcm.sso_pendencias_tecnicas(cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,ocorrencia_grupo_id,ocorrencia_calendario_preparada_id,ocorrencia_visita_preparada_id,rotina_id,alvo_tipo,alvo_id,pergunta,observacao)
    values(v_retorno.cliente_id,v_resposta.id,v_retorno.id,v_retorno.os_id,v_ocorrencia,v_ocorrencia_grupo,v_preparada_calendario,v_preparada_visita,v_rotina.id,v_rotina.alvo_tipo,$depois$;
begin
 if (length(d)-length(replace(d,decl,'')))/length(decl)<>1 or (length(d)-length(replace(d,velho,'')))/length(velho)<>1
  or (length(d)-length(replace(d,guarda,'')))/length(guarda)<>1 or (length(d)-length(replace(d,ins,'')))/length(ins)<>1 then raise exception 'pendencia_definicao_incompativel' using errcode='55000';end if;
 d:=replace(d,decl,'  v_ocorrencia_grupo uuid; v_preparada_calendario uuid; v_preparada_visita uuid; v_origem jsonb; v_payload jsonb;');
 execute replace(replace(replace(d,velho,novo),guarda,guarda_nova),ins,ins_novo);
end; $migracao$;

-- A fotografia de impactos inclui pendências nativas, sem alterar a representação existente.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_fotografar_efeitos_impacto_grupo(uuid,uuid,uuid,text)'::regprocedure);
 a text:=$antes$'pendencias',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_pendencias_tecnicas x join grupo g on g.id=x.ocorrencia_grupo_id),'[]'::jsonb)$antes$;
 b text:=$depois$'pendencias',coalesce((select jsonb_agg(y.foto order by y.foto::text) from (select (to_jsonb(x)-'ocorrencia_calendario_preparada_id'-'ocorrencia_visita_preparada_id') || case when x.ocorrencia_calendario_preparada_id is not null then jsonb_build_object('ocorrencia_calendario_preparada_id',x.ocorrencia_calendario_preparada_id) when x.ocorrencia_visita_preparada_id is not null then jsonb_build_object('ocorrencia_visita_preparada_id',x.ocorrencia_visita_preparada_id) else '{}'::jsonb end foto from pcm.sso_pendencias_tecnicas x where x.cliente_id=p_cliente and (x.ocorrencia_grupo_id in (select g.id from grupo g) or (p_tipo='calendario' and x.ocorrencia_calendario_preparada_id in (select id from preparadas)) or (p_tipo='visita' and x.ocorrencia_visita_preparada_id in (select id from preparadas)))) y),'[]'::jsonb)$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'fotografia_impacto_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
