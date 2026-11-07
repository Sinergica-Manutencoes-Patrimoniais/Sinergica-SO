-- ADR-0471: decisão PCM explícita, sem OS corretiva automática.
create table pcm.sso_resolucao_manual_foto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_resolucao_manual_foto_gate(id,habilitado) values(true,false);
create table pcm.sso_resolucoes_manuais_foto(pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),revisao integer not null,evidencia_id uuid not null references pcm.sso_uploads_evidencia_resposta(id),contexto_revision integer not null,atestacao text not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(pendencia_id,revisao));
alter table pcm.sso_resolucao_manual_foto_gate enable row level security;alter table pcm.sso_resolucao_manual_foto_gate force row level security;
alter table pcm.sso_resolucoes_manuais_foto enable row level security;alter table pcm.sso_resolucoes_manuais_foto force row level security;
revoke all on pcm.sso_resolucao_manual_foto_gate,pcm.sso_resolucoes_manuais_foto from public,anon,authenticated,service_role;
create trigger sso_resolucoes_manuais_foto_imutaveis before update or delete on pcm.sso_resolucoes_manuais_foto for each row execute function pcm.sso_resolucao_pendencia_imutavel();
create function pcm.sso_resolver_pendencia_foto_manual(p_request_id uuid,p_pendencia_id uuid,p_revision integer,p_contexto_revision integer,p_evidencia_id uuid,p_confirma boolean,p_atestacao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;v_c pcm.sso_contexto_pendencia%rowtype;v_cmd pcm.sso_pendencias_comandos%rowtype;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_resolucao_manual_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_resolucao_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_contexto_revision is null or p_contexto_revision<1 or p_evidencia_id is null or p_confirma is not true or p_atestacao is null or length(btrim(p_atestacao)) not between 1 and 2000 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('operacao','resolver_foto_manual','pendenciaId',p_pendencia_id,'revision',p_revision,'contextoRevision',p_contexto_revision,'evidenciaId',p_evidencia_id,'confirma',true,'atestacao',btrim(p_atestacao),'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pendencias:'||p_request_id::text,0));
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_cmd from pcm.sso_pendencias_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.cliente_id is distinct from v_p.cliente_id or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado; end if;
 if v_p.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_p.estado<>'aberta' then raise exception 'transicao_invalida' using errcode='23514'; end if;
 select * into v_c from pcm.sso_contexto_pendencia where pendencia_id=p_pendencia_id order by revisao desc limit 1;
 if not found or v_c.revisao<>p_contexto_revision or v_c.condicao is null then raise exception 'condicao_indisponivel_ou_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_uploads_evidencia_resposta e join pcm.respostas_os_preparadas resposta on resposta.id=e.resposta_id and resposta.retorno_id=e.retorno_id join pcm.retorno_os_preparado r on r.id=e.retorno_id and r.cliente_id=v_p.cliente_id and r.os_id=v_p.os_id join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null join storage.objects o on o.id=e.objeto_id and o.name=e.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=r.cliente_id::text and split_part(o.name,'/',2)=r.id::text and o.metadata->>'mimetype'=e.mime_declarado join storage.buckets b on b.id=o.bucket_id and b.public is false where e.id=p_evidencia_id and e.resposta_id=v_p.resposta_id and e.retorno_id=v_p.retorno_id and e.criado_em>v_p.criado_em) then raise exception 'evidencia_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.sso_pendencias_tecnicas set estado='resolvida',revisao=revisao+1 where id=v_p.id returning * into v_p;
 insert into pcm.sso_pendencias_decisoes(pendencia_id,revisao,decisao,motivo,ator_id,request_id) values(v_p.id,v_p.revisao,'resolvida',btrim(p_motivo),auth.uid(),p_request_id);
 insert into pcm.sso_resolucoes_manuais_foto(pendencia_id,revisao,evidencia_id,contexto_revision,atestacao,ator_id,request_id) values(v_p.id,v_p.revisao,p_evidencia_id,p_contexto_revision,btrim(p_atestacao),auth.uid(),p_request_id);
 insert into pcm.sso_resolucao_condicao_pendencia(pendencia_id,resolucao_revision,contexto_revision,ator_id,request_id) values(v_p.id,v_p.revisao,p_contexto_revision,auth.uid(),p_request_id);
 v_resultado:=jsonb_build_object('pendenciaId',v_p.id,'revision',v_p.revisao,'estado',v_p.estado,'requestId',p_request_id);
 insert into pcm.sso_pendencias_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,auth.uid(),v_p.cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'pendencia.resolucao_manual_foto','pendencia_tecnica',v_p.id,v_payload||jsonb_build_object('clienteId',v_p.cliente_id,'resolucaoRevision',v_p.revisao));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_pendencia_foto_manual(uuid,uuid,integer,integer,uuid,boolean,text,text) from public,anon,authenticated,service_role;
