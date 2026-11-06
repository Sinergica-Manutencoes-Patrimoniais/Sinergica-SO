-- ADR-0465: somente leitura da última decisão humana da evidência.
create table pcm.sso_decisao_foto_origem_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_foto_origem_gate(id,habilitado) values(true,false);
alter table pcm.sso_decisao_foto_origem_gate enable row level security;
alter table pcm.sso_decisao_foto_origem_gate force row level security;
revoke all on pcm.sso_decisao_foto_origem_gate from public,anon,authenticated,service_role;
create function pcm.sso_decisao_foto_origem_pendencia(p_pendencia_id uuid,p_evidencia_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;v_d pcm.sso_validacoes_resposta%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_decisao_foto_origem_gate where id),false) or not coalesce((select habilitado from pcm.sso_evidencia_origem_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'decisao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_pendencia_id is null or p_evidencia_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
 if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from pcm.sso_uploads_evidencia_resposta e join pcm.respostas_os_preparadas resposta on resposta.id=e.resposta_id and resposta.retorno_id=e.retorno_id join pcm.retorno_os_preparado r on r.id=e.retorno_id and r.cliente_id=v_p.cliente_id and r.os_id=v_p.os_id join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null join storage.objects o on o.id=e.objeto_id and o.name=e.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=r.cliente_id::text and split_part(o.name,'/',2)=r.id::text and o.metadata->>'mimetype'=e.mime_declarado join storage.buckets b on b.id=o.bucket_id and b.public is false where e.id=p_evidencia_id and e.resposta_id=v_p.resposta_id and e.retorno_id=v_p.retorno_id) then raise exception 'evidencia_indisponivel' using errcode='42501'; end if;
 select * into v_d from pcm.sso_validacoes_resposta where evidencia_id=p_evidencia_id and resposta_id=v_p.resposta_id and retorno_id=v_p.retorno_id order by revisao desc limit 1;
 if not found then return jsonb_build_object('evidenciaId',p_evidencia_id,'decisao',null); end if;
 return jsonb_build_object('evidenciaId',p_evidencia_id,'decisao',v_d.decisao,'revisao',v_d.revisao,'justificativa',v_d.justificativa,'atorId',v_d.ator_id,'criadoEm',v_d.criado_em);
end; $$;
revoke all on function pcm.sso_decisao_foto_origem_pendencia(uuid,uuid) from public,anon,authenticated,service_role;
