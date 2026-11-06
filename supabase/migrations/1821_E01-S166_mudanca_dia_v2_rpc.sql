-- ADR-1679: protocolo v2. A RPC 1233 e seu replay permanecem intocados.

do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
   then raise exception 'owner_requer_bypassrls' using errcode='42501'; end if;
 if not has_schema_privilege(current_user,'pcm','USAGE')
   or not has_schema_privilege(current_user,'auth','USAGE')
   or not has_schema_privilege(current_user,'config','USAGE')
   or not has_schema_privilege(current_user,'audit','USAGE')
   or not has_table_privilege(current_user,'pcm.sso_mudancas_dia_v2','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_mudancas_dia_v2','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_mudancas_dia_v2','UPDATE')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_itens','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_itens','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_itens','UPDATE')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_itens','DELETE')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_paginas','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_paginas','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_paginas','DELETE')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_v2_gate','SELECT')
   or not has_table_privilege(current_user,'pcm.calendario_contratual_series','SELECT')
   or not has_table_privilege(current_user,'pcm.calendario_contratual_series','UPDATE')
   or not has_table_privilege(current_user,'pcm.regras_visita_contratual','SELECT')
   or not has_table_privilege(current_user,'pcm.regras_visita_contratual','INSERT')
   or not has_table_privilege(current_user,'pcm.regras_visita_contratual','UPDATE')
   or not has_table_privilege(current_user,'pcm.visitas','SELECT')
   or not has_table_privilege(current_user,'pcm.visitas','UPDATE')
   or not has_table_privilege(current_user,'pcm.visita_origem_contratual','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_transicoes_historico','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_ordens_servico','SELECT')
   or not has_table_privilege(current_user,'pcm.ordens_servico','SELECT')
   or not has_table_privilege(current_user,'pcm.ocorrencias_visita_preparadas','SELECT')
   or not has_table_privilege(current_user,'pcm.ocorrencias_visita_preparadas','UPDATE')
   or not has_table_privilege(current_user,'pcm.feriados_declarados','SELECT')
   or not has_table_privilege(current_user,'pcm.calendario_contratual_comandos','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressoes_semana_feriado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressoes_semana_feriado','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_revogacoes_supressao_semana','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_visitas_suprimidas_feriado','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_visita_regra_transicoes','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_movimentos_ocorrencias_dia','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_ocorrencias_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_ocorrencias_grupo','INSERT')
   or not has_table_privilege(current_user,'pcm.sso_vinculos_os_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_intencoes_os_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_atestados_declarados_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_fotos_atestado_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_decisoes_foto_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_quantidades_declaradas_grupo','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_pendencias_tecnicas','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_ciclo_visita_versoes','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_ciclo_visita_usos_versao','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_materializacoes_visita_legado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_vinculos_visita_legado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_ocorrencia_visita_suprimivel_gate','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_mudanca_dia_ocorrencia_gate','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressao_visita_preexistente_gate','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressao_semana_gate','SELECT')
   or not has_table_privilege(current_user,'audit.events','INSERT')
   or not has_function_privilege(current_user,'auth.uid()','EXECUTE')
   or not has_function_privilege(current_user,'config.sso_autorizar_acao(text,uuid)','EXECUTE')
   or not has_function_privilege(current_user,'pcm.sso_regra_efetiva_visita(uuid)','EXECUTE')
   or not has_function_privilege(current_user,'pcm.sso_editar_visita(uuid,integer,uuid,uuid,uuid,timestamptz,timestamptz,text,uuid,integer)','EXECUTE')
   or not has_function_privilege(current_user,'pcm.sso_transicionar_visita_preparada(uuid,uuid,integer,text,timestamptz,timestamptz,text)','EXECUTE')
   or not has_function_privilege(current_user,'auth.role()','EXECUTE')
   then raise exception 'owner_sem_privilegios_mudanca_dia_v2' using errcode='42501'; end if;
end $$;

do $$ begin
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
   and exists (
     select 1 from (values
       ('pcm.sso_ocorrencias_grupo'),('pcm.sso_vinculos_os_grupo'),('pcm.sso_intencoes_os_grupo'),
       ('pcm.sso_atestados_declarados_grupo'),('pcm.sso_fotos_atestado_grupo'),
       ('pcm.sso_decisoes_foto_grupo'),('pcm.sso_quantidades_declaradas_grupo'),
       ('pcm.sso_pendencias_tecnicas')
     ) as alvo(nome)
     where not exists(
       select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
       where (n.nspname||'.'||c.relname)=alvo.nome and c.relowner=to_regrole(current_user)::oid
     )
   ) then raise exception 'owner_sem_privilegios_lock_grupos_mudanca_dia_v2' using errcode='42501'; end if;
end $$;

alter table pcm.sso_mudancas_dia_v2
 add column max_itens_snapshot integer not null default 500 check(max_itens_snapshot>0),
 add column max_bytes_snapshot bigint not null default 1048576 check(max_bytes_snapshot>0),
 add column ttl_seconds_snapshot integer not null default 3600 check(ttl_seconds_snapshot>0);

create function pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id uuid)
returns table(
 visita_id uuid,revisao_visita integer,semana_origem date,inicio_original timestamptz,fim_original timestamptz,
 inicio_proposto timestamptz,data_proposta date,feriado_id uuid,feriado_revisao integer,ocorrencia_esperada boolean
)
language sql stable security definer set search_path='' as $$
 select v.id,v.revisao,o.semana_origem,v.inicio_em,v.fim_em,
   case when f.id is null then ((o.semana_origem+(h.dia_semana-1)+r.hora_inicio) at time zone r.fuso) else null end,
   o.semana_origem+(h.dia_semana-1),f.id,f.revisao,
   exists(select 1 from pcm.ocorrencias_visita_preparadas ov where ov.visita_id=v.id)
 from pcm.sso_mudancas_dia_v2 h
 join pcm.calendario_contratual_series s on s.id=h.serie_id and s.cliente_id=h.cliente_id
 join pcm.visita_origem_contratual o on o.serie_id=h.serie_id and o.cliente_id=h.cliente_id
 join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id
 join pcm.regras_visita_contratual r on r.id=pcm.sso_regra_efetiva_visita(v.id) and r.serie_id=h.serie_id
 left join lateral (
   select fd.id,fd.revisao from pcm.feriados_declarados fd
   where fd.cliente_id=h.cliente_id and fd.ativo
     and fd.data=o.semana_origem+(h.dia_semana-1)
     and (fd.contrato_id is null or fd.contrato_id=s.contrato_id)
   order by fd.id limit 1
 ) f on true
 where h.id=p_mudanca_id
   and v.estado in ('rascunho','planejada') and v.inicio_em>now()
   and r.id=h.regra_id and v.fuso=r.fuso
   and (v.inicio_em at time zone r.fuso)::date=o.semana_origem+(r.dia_semana-1)
   and (v.inicio_em at time zone r.fuso)::time=r.hora_inicio
   and not exists(select 1 from pcm.visita_transicoes_historico th where th.visita_id=v.id and th.acao='reprogramar')
   and greatest(o.semana_origem+(r.dia_semana-1),o.semana_origem+(h.dia_semana-1))>=h.vigencia
   and o.semana_origem+(h.dia_semana-1)>=h.vigencia
   and not exists(
     select 1 from pcm.visita_ordens_servico vo
     join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id
     where vo.visita_id=v.id and vo.cliente_id=h.cliente_id and vo.encerrado_em is null
       and (os.auvo_task_id is not null or os.auvo_sync_status is not null)
   )
$$;
revoke all on function pcm.sso_mudanca_dia_v2_conjunto(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_iniciar_mudanca_dia_v2(
 p_ator uuid,p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_nova_id uuid,
 p_expected_revision integer,p_dia_semana integer,p_vigencia date
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_gate pcm.sso_mudanca_dia_v2_gate%rowtype;
 v_old pcm.regras_visita_contratual%rowtype;v_serie pcm.calendario_contratual_series%rowtype;
 v_existing pcm.sso_mudancas_dia_v2%rowtype;v_id uuid;v_payload jsonb;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_request_id is null or p_cliente_id is null
   or p_serie_id is null or p_regra_nova_id is null or p_expected_revision is null or p_expected_revision<1
   or p_dia_semana is null or p_dia_semana not between 1 and 7 or p_vigencia is null or not isfinite(p_vigencia)
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 select * into v_existing from pcm.sso_mudancas_dia_v2 where request_id=p_request_id;
 if found then
   if v_existing.actor_id is distinct from v_actor or v_existing.cliente_id is distinct from p_cliente_id
     or v_existing.serie_id is distinct from p_serie_id or v_existing.regra_nova_id is distinct from p_regra_nova_id
     or v_existing.revisao_esperada is distinct from p_expected_revision or v_existing.dia_semana is distinct from p_dia_semana
     or v_existing.vigencia is distinct from p_vigencia then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
   if not found or (not v_gate.habilitado and v_existing.estado<>'aplicada') then
     raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000';
   end if;
   return jsonb_build_object('mudancaId',v_existing.id,'requestId',v_existing.request_id,'estado',v_existing.estado,
     'expiraEm',v_existing.expira_em,'paginaSeguinte',v_existing.pagina_seguinte,'paginaFinal',v_existing.pagina_final,
     'totalItens',v_existing.total_itens,'digest',v_existing.digest_fotografia,'recibo',v_existing.recibo);
 end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if exists(select 1 from pcm.calendario_contratual_comandos c where c.request_id=p_request_id) then
   raise exception 'request_id_conflitante' using errcode='23505'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||p_serie_id::text,0))
   then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
 select * into v_serie from pcm.calendario_contratual_series s where s.id=p_serie_id and s.cliente_id=p_cliente_id for share;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_old from pcm.regras_visita_contratual r where r.serie_id=p_serie_id order by r.numero desc limit 1 for share;
 if not found or v_old.numero is distinct from p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_dia_semana=v_old.dia_semana or p_vigencia<=v_old.vigencia_inicio
   or p_vigencia<=(now() at time zone v_old.fuso)::date
   or (v_old.vigencia_fim is not null and p_vigencia>v_old.vigencia_fim)
   or exists(select 1 from pcm.regras_visita_contratual where id=p_regra_nova_id)
   then raise exception 'vigencia_ou_dia_invalido' using errcode='22023'; end if;
 v_id:=p_request_id;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'serieId',p_serie_id,'regra',v_old.id,
   'expectedRevision',p_expected_revision,'diaSemana',p_dia_semana,'vigencia',p_vigencia);
 insert into pcm.sso_mudancas_dia_v2(id,request_id,actor_id,cliente_id,serie_id,regra_id,regra_nova_id,
   revisao_esperada,dia_semana,vigencia,max_itens_snapshot,max_bytes_snapshot,ttl_seconds_snapshot,expira_em)
 values(v_id,p_request_id,v_actor,p_cliente_id,p_serie_id,v_old.id,p_regra_nova_id,p_expected_revision,p_dia_semana,p_vigencia,
   v_gate.max_itens,v_gate.max_bytes,v_gate.ttl_seconds,now()+make_interval(secs=>v_gate.ttl_seconds));
 return jsonb_build_object('mudancaId',v_id,'requestId',p_request_id,'estado','montando',
   'expiraEm',now()+make_interval(secs=>v_gate.ttl_seconds),'paginaSeguinte',0,'paginaFinal',false,'totalItens',0);
end $$;
revoke all on function pcm.sso_iniciar_mudanca_dia_v2(uuid,uuid,uuid,uuid,uuid,integer,integer,date) from public,anon,service_role;
grant execute on function pcm.sso_iniciar_mudanca_dia_v2(uuid,uuid,uuid,uuid,uuid,integer,integer,date) to authenticated;

create function pcm.sso_pagina_mudanca_dia_v2(p_ator uuid,p_mudanca_id uuid,p_numero integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_head pcm.sso_mudancas_dia_v2%rowtype;v_page pcm.sso_mudanca_dia_v2_paginas%rowtype;
 v_gate pcm.sso_mudanca_dia_v2_gate%rowtype;v_item record;v_before uuid;v_after uuid;v_count integer:=0;v_bytes bigint:=0;
 v_more boolean:=false;v_payload jsonb:='[]'::jsonb;v_item_json jsonb;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_mudanca_id is null or p_numero is null or p_numero<0
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id;
 if not found or v_head.actor_id is distinct from v_actor
   or config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true
   then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||v_head.serie_id::text,0))
   then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id for update;
 select * into v_page from pcm.sso_mudanca_dia_v2_paginas where mudanca_id=p_mudanca_id and numero=p_numero;
 if found then
   select coalesce(jsonb_agg(jsonb_build_object('visitaId',i.visita_id,'revisao',i.revisao_visita,
     'semanaOrigem',i.semana_origem,'inicioOriginal',i.inicio_original,'dataProposta',i.data_proposta,
     'inicioProposto',i.inicio_proposto,'feriadoId',i.feriado_id,'feriadoRevision',i.feriado_revisao,
     'ocorrenciaEsperada',i.ocorrencia_esperada) order by i.visita_id),'[]'::jsonb)
   into v_payload from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id
     and (v_page.cursor_antes is null or i.visita_id>v_page.cursor_antes)
     and (v_page.cursor_depois is null or i.visita_id<=v_page.cursor_depois);
   return jsonb_build_object('mudancaId',p_mudanca_id,'numero',p_numero,'itens',v_payload,
     'temMais',v_page.tem_mais,'proximoNumero',p_numero+1,'totalItens',v_head.total_itens);
 end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if v_head.estado<>'montando' or v_head.expira_em<=now() or v_head.pagina_final
   or p_numero<>v_head.pagina_seguinte then raise exception 'fotografia_indisponivel' using errcode='55000'; end if;
 v_before:=v_head.cursor_ultimo;
 for v_item in select c.* from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c
   where v_before is null or c.visita_id>v_before order by c.visita_id limit 100 loop
   if v_item.inicio_proposto is not null
     and ((v_item.inicio_proposto at time zone (select r.fuso from pcm.regras_visita_contratual r where r.id=v_head.regra_id))
       <> (v_item.data_proposta+(select r.hora_inicio from pcm.regras_visita_contratual r where r.id=v_head.regra_id)))
     then raise exception 'horario_civil_inexistente' using errcode='23514'; end if;
   v_item_json:=jsonb_build_object('visitaId',v_item.visita_id,'revisao',v_item.revisao_visita,
     'semanaOrigem',v_item.semana_origem,'inicioOriginal',v_item.inicio_original,
     'dataProposta',v_item.data_proposta,'inicioProposto',v_item.inicio_proposto,
     'feriadoId',v_item.feriado_id,'feriadoRevision',v_item.feriado_revisao,
     'ocorrenciaEsperada',v_item.ocorrencia_esperada);
   v_bytes:=v_bytes+pg_catalog.octet_length(v_item_json::text);
   if v_head.total_itens+v_count+1>least(v_head.max_itens_snapshot,v_gate.max_itens)
     or v_head.total_bytes+v_bytes>least(v_head.max_bytes_snapshot,v_gate.max_bytes)
     then raise exception 'fotografia_excede_orcamento' using errcode='22023'; end if;
   insert into pcm.sso_mudanca_dia_v2_itens(mudanca_id,visita_id,revisao_visita,semana_origem,
     inicio_original,fim_original,inicio_proposto,data_proposta,feriado_id,feriado_revisao,ocorrencia_esperada)
   values(p_mudanca_id,v_item.visita_id,v_item.revisao_visita,v_item.semana_origem,v_item.inicio_original,
     v_item.fim_original,v_item.inicio_proposto,v_item.data_proposta,v_item.feriado_id,v_item.feriado_revisao,v_item.ocorrencia_esperada);
   v_payload:=v_payload||jsonb_build_array(v_item_json);v_after:=v_item.visita_id;v_count:=v_count+1;
 end loop;
 if v_after is null then v_after:=v_before; end if;
 select exists(select 1 from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c where v_after is null or c.visita_id>v_after) into v_more;
 insert into pcm.sso_mudanca_dia_v2_paginas(mudanca_id,numero,cursor_antes,cursor_depois,tem_mais,total_itens,total_bytes)
 values(p_mudanca_id,p_numero,v_before,v_after,v_more,v_count,v_bytes);
 update pcm.sso_mudancas_dia_v2 set cursor_ultimo=v_after,pagina_seguinte=pagina_seguinte+1,
   pagina_final=not v_more,total_itens=total_itens+v_count,total_bytes=total_bytes+v_bytes,atualizado_em=now()
 where id=p_mudanca_id;
 return jsonb_build_object('mudancaId',p_mudanca_id,'numero',p_numero,'itens',v_payload,
   'temMais',v_more,'proximoNumero',p_numero+1,'totalItens',v_head.total_itens+v_count);
end $$;
revoke all on function pcm.sso_pagina_mudanca_dia_v2(uuid,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_pagina_mudanca_dia_v2(uuid,uuid,integer) to authenticated;

create function pcm.sso_selar_mudanca_dia_v2(p_ator uuid,p_mudanca_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_head pcm.sso_mudancas_dia_v2%rowtype;v_gate pcm.sso_mudanca_dia_v2_gate%rowtype;
 v_count integer;v_digest text;v_diff boolean;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_mudanca_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id;
 if not found or v_head.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_head.estado='aplicada' then return v_head.recibo; end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||v_head.serie_id::text,0))
   then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-geracao-visita-feriados-v1',0))
   or not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_head.cliente_id::text,0))
   then raise exception 'feriado_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id for update;
 if v_head.estado in ('pronta','aplicada') then return jsonb_build_object('mudancaId',p_mudanca_id,'estado',v_head.estado,
   'totalItens',v_head.total_itens,'digest',v_head.digest_fotografia,'recibo',v_head.recibo); end if;
 if v_head.estado<>'montando' or not v_head.pagina_final or v_head.expira_em<=now() then raise exception 'fotografia_incompleta' using errcode='23514'; end if;
 select count(*) into v_count from pcm.sso_mudanca_dia_v2_itens where mudanca_id=p_mudanca_id;
 if v_count<>v_head.total_itens or v_count>least(v_head.max_itens_snapshot,v_gate.max_itens)
   or v_head.total_bytes>least(v_head.max_bytes_snapshot,v_gate.max_bytes) then raise exception 'fotografia_incompleta' using errcode='23514'; end if;
 select exists(
   (select c.visita_id,c.revisao_visita,c.semana_origem,c.inicio_original,c.fim_original,c.inicio_proposto,c.data_proposta,c.feriado_id,c.feriado_revisao,c.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c
    except select i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id)
   union all
   (select i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id
    except select c.visita_id,c.revisao_visita,c.semana_origem,c.inicio_original,c.fim_original,c.inicio_proposto,c.data_proposta,c.feriado_id,c.feriado_revisao,c.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c)
 ) into v_diff;
 if v_diff then
   update pcm.sso_mudancas_dia_v2 set estado='invalidada',selada_em=now(),atualizado_em=now() where id=p_mudanca_id;
   return jsonb_build_object('mudancaId',p_mudanca_id,'estado','invalidada','motivo','fotografia_alterada');
 end if;
 select md5(coalesce(string_agg(concat_ws('|',i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,
   i.fim_original,i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada),E'\n' order by i.visita_id),''))
 into v_digest from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id;
 update pcm.sso_mudancas_dia_v2 set estado='pronta',digest_fotografia=v_digest,selada_em=now(),atualizado_em=now()
 where id=p_mudanca_id;
 return jsonb_build_object('mudancaId',p_mudanca_id,'estado','pronta','totalItens',v_count,'digest',v_digest);
end $$;
revoke all on function pcm.sso_selar_mudanca_dia_v2(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_selar_mudanca_dia_v2(uuid,uuid) to authenticated;

create function pcm.sso_confirmar_mudanca_dia_v2(p_ator uuid,p_mudanca_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_head pcm.sso_mudancas_dia_v2%rowtype;v_gate pcm.sso_mudanca_dia_v2_gate%rowtype;
 v_serie pcm.calendario_contratual_series%rowtype;v_regra pcm.regras_visita_contratual%rowtype;
 v_item record;v_recebido jsonb;v_result jsonb;v_diff boolean;v_data date;v_fim timestamptz;v_cancelar boolean;
 v_feriado pcm.feriados_declarados%rowtype;v_tem_ocorrencia boolean;v_supressao_id uuid;v_movidas integer:=0;v_suprimidas integer:=0;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_mudanca_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id;
 if not found or v_head.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||v_head.serie_id::text,0))
   then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id for update;
 if v_head.estado='aplicada' then return v_head.recibo; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||v_head.request_id::text,0));
 if exists(select 1 from pcm.calendario_contratual_comandos c where c.request_id=v_head.request_id) then
   raise exception 'request_id_conflitante' using errcode='23505'; end if;
 select * into v_gate from pcm.sso_mudanca_dia_v2_gate where id for share;
 if not found or not v_gate.habilitado then raise exception 'mudanca_dia_v2_desabilitada' using errcode='55000'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if v_head.estado<>'pronta' or v_head.expira_em<=now() then raise exception 'fotografia_indisponivel' using errcode='55000'; end if;
 if v_head.total_itens>least(v_head.max_itens_snapshot,v_gate.max_itens)
   or v_head.total_bytes>least(v_head.max_bytes_snapshot,v_gate.max_bytes) then raise exception 'fotografia_excede_orcamento' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-geracao-visita-feriados-v1',0))
   or not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_head.cliente_id::text,0))
   then raise exception 'feriado_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Match 1525's relation-lock order. NOWAIT means a writer already holding
 -- RowExclusive aborts this attempt before any source row or operational write.
 lock table pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_intencoes_os_grupo,
   pcm.sso_atestados_declarados_grupo,pcm.sso_fotos_atestado_grupo,pcm.sso_decisoes_foto_grupo,
   pcm.sso_quantidades_declaradas_grupo,pcm.sso_pendencias_tecnicas in share mode nowait;
 select * into v_serie from pcm.calendario_contratual_series s
   where s.id=v_head.serie_id and s.cliente_id=v_head.cliente_id for update;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_regra from pcm.regras_visita_contratual r where r.id=v_head.regra_id and r.serie_id=v_head.serie_id for update;
 if not found or v_regra.numero is distinct from v_head.revisao_esperada then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_head.dia_semana=v_regra.dia_semana or v_head.vigencia<=v_regra.vigencia_inicio
   or v_head.vigencia<=(now() at time zone v_regra.fuso)::date
   or (v_regra.vigencia_fim is not null and v_head.vigencia>v_regra.vigencia_fim)
   then raise exception 'vigencia_ou_dia_invalido' using errcode='22023'; end if;
 -- Lock the candidate aggregates before comparing the snapshot. Writers in
 -- 0723/0796/0742/0744 lock prepared rows FOR UPDATE; 0815 uses FOR SHARE.
 -- NOWAIT preserves fail-closed behavior and avoids lock-order deadlocks.
 perform v.id from pcm.visitas v join pcm.sso_mudanca_dia_v2_itens i on i.visita_id=v.id
   where i.mudanca_id=p_mudanca_id order by v.id for update of v nowait;
 perform o.id from pcm.ocorrencias_visita_preparadas o
   join pcm.sso_mudanca_dia_v2_itens i on i.visita_id=o.visita_id
   where i.mudanca_id=p_mudanca_id order by o.id for update of o nowait;
 select exists(
   (select c.visita_id,c.revisao_visita,c.semana_origem,c.inicio_original,c.fim_original,c.inicio_proposto,c.data_proposta,c.feriado_id,c.feriado_revisao,c.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c
    except select i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id)
   union all
   (select i.visita_id,i.revisao_visita,i.semana_origem,i.inicio_original,i.fim_original,i.inicio_proposto,i.data_proposta,i.feriado_id,i.feriado_revisao,i.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_itens i where i.mudanca_id=p_mudanca_id
    except select c.visita_id,c.revisao_visita,c.semana_origem,c.inicio_original,c.fim_original,c.inicio_proposto,c.data_proposta,c.feriado_id,c.feriado_revisao,c.ocorrencia_esperada
    from pcm.sso_mudanca_dia_v2_conjunto(p_mudanca_id) c)
 ) into v_diff;
 if v_diff then
   raise exception 'fotografia_visitas_alterada' using errcode='40001';
 end if;
 if config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.regras_visita_contratual set vigencia_fim=v_head.vigencia-1 where id=v_regra.id;
 insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,
   deslocamento_minutos,fuso,vigencia_inicio,vigencia_fim,created_by)
 values(v_head.regra_nova_id,v_head.serie_id,v_regra.numero+1,v_regra.ancora_semana,v_head.dia_semana,
   v_regra.intervalo_semanas,v_regra.hora_inicio,v_regra.duracao_minutos,v_regra.deslocamento_minutos,
   v_regra.fuso,v_head.vigencia,v_regra.vigencia_fim,v_actor);
 for v_item in select i.*,v.area_id,v.local_id,v.responsavel_id,v.deslocamento_minutos,v.fim_em,v.inicio_em,v.revisao
   from pcm.sso_mudanca_dia_v2_itens i join pcm.visitas v on v.id=i.visita_id
   where i.mudanca_id=p_mudanca_id order by v.id loop
   if v_item.revisao is distinct from v_item.revisao_visita then raise exception 'fotografia_visitas_alterada' using errcode='40001'; end if;
   v_cancelar:=v_item.feriado_id is not null;v_tem_ocorrencia:=v_item.ocorrencia_esperada;
   if v_tem_ocorrencia then
     perform 1 from pcm.sso_ocorrencia_visita_suprimivel_gate where id and habilitado for share;
     if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
     if not v_cancelar then
       perform 1 from pcm.sso_mudanca_dia_ocorrencia_gate where id and habilitado for share;
       if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
       if exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v_item.visita_id) then
         raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514'; end if;
     end if;
     if exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.visita_id=v_item.visita_id and (
       exists(select 1 from pcm.sso_vinculos_visita_legado l where l.ocorrencia_visita_id=o.id)
       or exists(select 1 from pcm.sso_materializacoes_visita_legado m where m.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_versoes c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ciclo_visita_usos_versao c where c.preparada_id=o.id)
       or exists(select 1 from pcm.sso_ocorrencias_grupo g where g.visita_preparada_id=o.id)))
       then raise exception 'ocorrencia_vinculada_exige_reconciliacao' using errcode='23514'; end if;
   end if;
   if v_cancelar then
     perform 1 from pcm.sso_supressao_visita_preexistente_gate where id and habilitado for share;
     if not found then raise exception 'ocorrencia_ou_feriado_exige_reconciliacao' using errcode='23514'; end if;
     perform 1 from pcm.sso_supressao_semana_gate where id and habilitado for share;
     if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
     if config.sso_autorizar_acao('visita.cancelar',v_head.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
     if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||v_head.serie_id::text||':'||v_item.semana_origem::text,0))
       then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
     if exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v_item.visita_id)
       or exists(select 1 from pcm.sso_supressoes_semana_feriado s where s.serie_id=v_head.serie_id and s.semana_origem=v_item.semana_origem
          and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id))
       then raise exception 'semana_exige_reconciliacao' using errcode='23514'; end if;
   end if;
   if v_cancelar then
     select * into v_feriado from pcm.feriados_declarados f where f.id=v_item.feriado_id and f.cliente_id=v_head.cliente_id
       and f.ativo and f.revisao=v_item.feriado_revisao;
     if not found then raise exception 'impactos_alterados' using errcode='40001'; end if;
     v_recebido:=pcm.sso_transicionar_visita_preparada(gen_random_uuid(),v_item.visita_id,v_item.revisao_visita,
       'cancelar',null,null,'Supressão por feriado na mudança de dia contratual');
     if v_recebido->>'aggregateId' is distinct from v_item.visita_id::text or v_recebido->>'state' is distinct from 'cancelada'
       or v_recebido->>'revision' is distinct from (v_item.revisao_visita+1)::text
       then raise exception 'cancelamento_divergente' using errcode='23514'; end if;
     insert into pcm.sso_supressoes_semana_feriado(request_id,cliente_id,serie_id,regra_id,semana_origem,data_contratual,feriado_id,feriado_revisao,ator_id)
       values(gen_random_uuid(),v_head.cliente_id,v_head.serie_id,v_head.regra_nova_id,v_item.semana_origem,v_item.data_proposta,
         v_item.feriado_id,v_item.feriado_revisao,v_actor) returning id into v_supressao_id;
     insert into pcm.sso_visitas_suprimidas_feriado(visita_id,supressao_id,cliente_id,ator_id)
       values(v_item.visita_id,v_supressao_id,v_head.cliente_id,v_actor);
     v_suprimidas:=v_suprimidas+1;continue;
   end if;
   v_fim:=v_item.inicio_proposto+(v_item.fim_original-v_item.inicio_original);
   v_recebido:=pcm.sso_editar_visita(gen_random_uuid(),v_item.revisao_visita,v_item.visita_id,v_item.area_id,v_item.local_id,
     v_item.inicio_proposto,v_fim,v_regra.fuso,v_item.responsavel_id,v_item.deslocamento_minutos);
   if v_recebido->>'aggregateId' is distinct from v_item.visita_id::text
     or v_recebido->>'revision' is distinct from (v_item.revisao_visita+1)::text then
     raise exception 'edicao_divergente' using errcode='23514'; end if;
   insert into pcm.sso_visita_regra_transicoes(visita_id,revisao_visita,serie_id,regra_anterior_id,regra_nova_id,
     inicio_anterior,fim_anterior,inicio_novo,fim_novo,request_id,ator_id)
   values(v_item.visita_id,v_item.revisao_visita+1,v_head.serie_id,v_regra.id,v_head.regra_nova_id,
     v_item.inicio_original,v_item.fim_original,v_item.inicio_proposto,v_fim,v_head.request_id,v_actor);
   insert into pcm.sso_movimentos_ocorrencias_dia(request_id,ocorrencia_id,visita_id,cliente_id,vencimento_original,
     inicio_anterior,inicio_novo,revisao_visita,ator_id)
   select v_head.request_id,o.id,v_item.visita_id,v_head.cliente_id,o.vencimento_original,
     v_item.inicio_original,v_item.inicio_proposto,v_item.revisao_visita+1,v_actor
   from pcm.ocorrencias_visita_preparadas o where o.visita_id=v_item.visita_id;
   v_movidas:=v_movidas+1;
 end loop;
 v_result:=jsonb_build_object('requestId',v_head.request_id,'mudancaId',v_head.id,'serieId',v_head.serie_id,
   'regraId',v_head.regra_nova_id,'revision',v_regra.numero+1,'visitasMovidas',v_movidas,
   'visitasSuprimidas',v_suprimidas,'efeitoRemoto',false,'digest',v_head.digest_fotografia);
 insert into audit.events(actor_id,action,entity,entity_id,payload)
 values(v_actor,'calendario.dia_alterado_com_visitas_v2','calendario_contratual_series',v_head.serie_id,v_result);
 update pcm.sso_mudancas_dia_v2 set estado='aplicada',recibo=v_result,aplicada_em=now(),atualizado_em=now()
 where id=v_head.id;
 return v_result;
end $$;
revoke all on function pcm.sso_confirmar_mudanca_dia_v2(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_confirmar_mudanca_dia_v2(uuid,uuid) to authenticated;

-- Erro de confirmação aborta a transação operacional. A interface pode, então,
-- registrar a fotografia obsoleta em uma chamada separada, sem efeito parcial.
create function pcm.sso_invalidar_mudanca_dia_v2(p_ator uuid,p_mudanca_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_head pcm.sso_mudancas_dia_v2%rowtype;
begin
 if v_actor is null or v_actor is distinct from p_ator or p_mudanca_id is null then
   raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
   then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id;
 if not found or v_head.actor_id is distinct from v_actor
   or config.sso_autorizar_acao('plano.gerir',v_head.cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',v_head.cliente_id) is distinct from true then
   raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||v_head.serie_id::text,0));
 select * into v_head from pcm.sso_mudancas_dia_v2 where id=p_mudanca_id for update;
 if v_head.estado='aplicada' then return jsonb_build_object('mudancaId',p_mudanca_id,'estado','aplicada'); end if;
 if v_head.estado not in ('invalidada','expirada') then
   update pcm.sso_mudancas_dia_v2 set estado='invalidada',selada_em=coalesce(selada_em,now()),atualizado_em=now()
   where id=p_mudanca_id;
 end if;
 return jsonb_build_object('mudancaId',p_mudanca_id,'estado','invalidada');
end $$;
revoke all on function pcm.sso_invalidar_mudanca_dia_v2(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_invalidar_mudanca_dia_v2(uuid,uuid) to authenticated;

-- Job/service role expires stale snapshots and prunes only their normalized detail.
-- Applied headers and receipts remain available for idempotent replay.
create function pcm.sso_limpar_mudancas_dia_v2(p_limite integer default 250)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_total integer:=0;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service_role_requerido' using errcode='42501'; end if;
 if p_limite is null or p_limite<1 then raise exception 'limite_invalido' using errcode='22023'; end if;
 for v_id in
   select m.id from pcm.sso_mudancas_dia_v2 m
   where m.estado in ('montando','pronta') and m.expira_em<=now()
   order by m.expira_em,m.id for update skip locked limit p_limite
 loop
   update pcm.sso_mudancas_dia_v2 set estado='expirada',atualizado_em=now() where id=v_id;
   delete from pcm.sso_mudanca_dia_v2_paginas where mudanca_id=v_id;
   delete from pcm.sso_mudanca_dia_v2_itens where mudanca_id=v_id;
   v_total:=v_total+1;
 end loop;
 return v_total;
end $$;
revoke all on function pcm.sso_limpar_mudancas_dia_v2(integer) from public,anon,authenticated;
grant execute on function pcm.sso_limpar_mudancas_dia_v2(integer) to service_role;
