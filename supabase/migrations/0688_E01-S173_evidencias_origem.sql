-- ADR-0462: somente metadados de objeto privado vinculado à resposta de origem.
create table pcm.sso_evidencia_origem_pendencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_evidencia_origem_pendencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_evidencia_origem_pendencia_gate enable row level security;
alter table pcm.sso_evidencia_origem_pendencia_gate force row level security;
revoke all on pcm.sso_evidencia_origem_pendencia_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_evidencias_origem_pendencia(p_pendencia_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_evidencia_origem_pendencia_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) then raise exception 'evidencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_pendencia_id is null or p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
 if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select e.id,e.revisao,e.mime_declarado,e.justificativa,e.ator_id,e.criado_em
 from pcm.sso_uploads_evidencia_resposta e join pcm.respostas_os_preparadas resp on resp.id=e.resposta_id and resp.retorno_id=e.retorno_id
 join pcm.retorno_os_preparado r on r.id=e.retorno_id and r.cliente_id=v_p.cliente_id and r.os_id=v_p.os_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
 join storage.objects o on o.id=e.objeto_id and o.name=e.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=r.cliente_id::text and split_part(o.name,'/',2)=r.id::text and o.metadata->>'mimetype'=e.mime_declarado
 join storage.buckets bucket on bucket.id=o.bucket_id and bucket.public is false
 where e.resposta_id=v_p.resposta_id and e.retorno_id=v_p.retorno_id and (p_antes is null or e.revisao<p_antes) order by e.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_evidencias_origem_pendencia(uuid,integer,integer) from public,anon,authenticated,service_role;
