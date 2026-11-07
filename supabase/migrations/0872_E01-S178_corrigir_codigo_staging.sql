create table pcm.sso_corrigir_codigo_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_corrigir_codigo_staging_gate(id,habilitado) values(true,false);
alter table pcm.sso_corrigir_codigo_staging_gate enable row level security;alter table pcm.sso_corrigir_codigo_staging_gate force row level security;
revoke all on pcm.sso_corrigir_codigo_staging_gate from public,anon,authenticated,service_role;
create function pcm.sso_corrigir_codigo_staging(p_request_id uuid,p_request_edicao uuid,p_request_codigo uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_codigo_revision integer,p_codigo text,p_motivo text,p_confirmado boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_payload jsonb;v_edit jsonb;v_codigo jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_corrigir_codigo_staging_gate where id),false) then raise exception 'correcao_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_request_edicao is null or p_request_codigo is null or p_request_id=p_request_edicao or p_request_id=p_request_codigo or p_request_edicao=p_request_codigo or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_antes) is distinct from 'object' or p_codigo_revision is null or p_codigo_revision<0 or p_codigo is null or length(p_codigo) not between 1 and 200 or p_codigo<>upper(btrim(p_codigo)) or p_codigo~'[[:space:]]' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_confirmado is not true then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','corrigir_codigo_staging','requestEdicao',p_request_edicao,'requestCodigo',p_request_codigo,'loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'antes',p_antes,'codigoRevision',p_codigo_revision,'codigo',p_codigo,'motivo',btrim(p_motivo),'confirmado',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_edicoes_linha_staging where request_id=p_request_edicao) or exists(select 1 from pcm.sso_codigo_staging_comandos where request_id=p_request_codigo) then raise exception 'request_individual_ja_utilizado' using errcode='23505';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('sistema','equipamento','componente') or v_linha.atributos is distinct from p_antes then raise exception 'linha_indisponivel' using errcode='23514';end if;
 v_edit:=pcm.sso_editar_atributos_linha_staging(p_request_edicao,p_lote_id,p_expected_revision,p_chave,p_antes,jsonb_build_object('codigoInformado',p_codigo),p_motivo);
 v_codigo:=pcm.sso_salvar_codigo_staging(p_request_codigo,p_lote_id,p_chave,(v_edit->>'revision')::integer,p_codigo_revision,p_codigo);
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'codigoRevision',(v_codigo->>'revision')::integer,'requestId',p_request_id,'codigoOficialAlterado',false,'aliasCriado',false);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.codigo_staging_corrigido','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id,'motivo',btrim(p_motivo),'codigoAnterior',p_antes->'codigoInformado','codigoNovo',p_codigo));return v_resultado;
end;$$;
revoke all on function pcm.sso_corrigir_codigo_staging(uuid,uuid,uuid,uuid,integer,text,jsonb,integer,text,text,boolean) from public,anon,authenticated,service_role;
