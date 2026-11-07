-- ADR-1563: histórico de escolhas não reserva candidato para sempre; 1045 intacta.
do $migracao$
declare v_nome name;
begin
 select conname into v_nome from pg_catalog.pg_constraint where conrelid='pcm.sso_escolhas_nova_data_visita'::regclass and contype='u' and pg_catalog.pg_get_constraintdef(oid)='UNIQUE (rascunho_id, rotina_id, visita_id)';
 if v_nome is null then raise exception 'unicidade_escolha_visita_incompativel' using errcode='55000';end if;
 execute format('alter table pcm.sso_escolhas_nova_data_visita drop constraint %I',v_nome);
end; $migracao$;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_escolher_nova_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,uuid,date,text,text,jsonb)'::regprocedure);
 a text:=$antes$ v_candidata:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,p_preparada,p_visita,null);$antes$;
 b text:=$depois$ -- O bloqueio do Plano serializa escolhas para a mesma revisão, inclusive novas candidatas.
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao_plano for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 -- Somente decisão ainda última e da revisão atual reserva a candidata.
 if exists(select 1 from pcm.sso_escolhas_nova_data_visita e
  join lateral (select x.request_id from pcm.sso_decisoes_impacto_visita x where x.cliente_id=e.cliente_id and x.plano_id=e.plano_id and x.rascunho_id=e.rascunho_id and x.preparada_id=e.preparada_id order by x.revisao desc limit 1) ultima on ultima.request_id=e.request_id
  where e.cliente_id=p_cliente and e.plano_id=p_plano and e.rascunho_id=p_rascunho and e.revisao_plano=p_revisao_plano and e.rotina_id=v_rotina and e.visita_id=p_visita and e.preparada_id<>p_preparada) then raise exception 'candidata_ja_escolhida' using errcode='23505';end if;
 v_candidata:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,p_preparada,p_visita,null);$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'escolha_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- Não permitir uso sem vínculo caso a versão ainda não esteja vigente.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_nova_visita()'::regprocedure);
 a text:=$antes$   and s.vigencia<=pcm.sso_data_civil_transicao_plano(v.plano_id,v.id,s.vigencia)$antes$;
 b text:=$antes$  if v_item.preparada_id=new.preparada_id then raise exception 'substituicao_reutilizou_ocorrencia' using errcode='23514';end if;$antes$;
 c text:=$depois$  if v_item.vigencia>pcm.sso_data_civil_transicao_plano(v_item.plano_id,v_item.versao_id,v_item.vigencia) then raise exception 'substituicao_ainda_nao_vigente' using errcode='23514';end if;
  if v_item.preparada_id=new.preparada_id then raise exception 'substituicao_reutilizou_ocorrencia' using errcode='23514';end if;$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,b,'')))/length(b)<>1 then raise exception 'vinculo_visita_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,''),b,c);
end; $migracao$;
