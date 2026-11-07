-- ADR-0330: upload privado preparado, sem comprovar autoria ou conteúdo.
create table pcm.sso_upload_evidencia_resposta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_upload_evidencia_resposta_gate enable row level security;
alter table pcm.sso_upload_evidencia_resposta_gate force row level security;
revoke all on pcm.sso_upload_evidencia_resposta_gate from public,anon,authenticated,service_role;
insert into pcm.sso_upload_evidencia_resposta_gate(id,habilitado) values(true,false);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sso-retorno-evidencias','sso-retorno-evidencias',false,10485760,array['image/jpeg','image/png']) on conflict(id) do nothing;
create function pcm.sso_autorizar_upload_evidencia_resposta(p_nome text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_partes text[];
begin
 if auth.uid() is null or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not exists(select 1 from storage.buckets b where b.id='sso-retorno-evidencias' and b.public is false and b.file_size_limit=10485760 and b.allowed_mime_types=array['image/jpeg','image/png']) then return false; end if;
 v_partes:=string_to_array(p_nome,'/');
 if array_length(v_partes,1) is distinct from 3 or exists(select 1 from unnest(v_partes) p where p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then return false; end if;
 return exists(select 1 from pcm.retorno_os_preparado r join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null where r.id=v_partes[2]::uuid and r.cliente_id=v_partes[1]::uuid and config.sso_autorizar_acao('execucao.validar',r.cliente_id) is true);
end; $$;
revoke all on function pcm.sso_autorizar_upload_evidencia_resposta(text) from public,anon,authenticated,service_role;
create policy s168_evidencia_upload on storage.objects for insert to authenticated with check(bucket_id='sso-retorno-evidencias' and owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_resposta(name));
create policy s168_evidencia_upload_restrito on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'sso-retorno-evidencias' or (owner_id=auth.uid()::text and pcm.sso_autorizar_upload_evidencia_resposta(name)));
create policy s168_evidencia_sem_leitura on storage.objects as restrictive for select to authenticated using(bucket_id<>'sso-retorno-evidencias');
create policy s168_evidencia_sem_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'sso-retorno-evidencias') with check(bucket_id<>'sso-retorno-evidencias');
create policy s168_evidencia_sem_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'sso-retorno-evidencias');

create table pcm.sso_uploads_evidencia_resposta (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 resposta_id uuid not null references pcm.respostas_os_preparadas(id),objeto_id uuid not null,caminho text not null,mime_declarado text not null,
 revisao integer not null check(revisao>0),justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(retorno_id,revisao),unique(objeto_id)
);
alter table pcm.sso_uploads_evidencia_resposta enable row level security;
alter table pcm.sso_uploads_evidencia_resposta force row level security;
revoke all on pcm.sso_uploads_evidencia_resposta from public,anon,authenticated,service_role;
create trigger sso_upload_evidencia_resposta_imutavel before update or delete on pcm.sso_uploads_evidencia_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_upload_evidencia_resposta(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_resposta_id uuid,p_caminho text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_uploads_evidencia_resposta%rowtype;v_payload jsonb;v_revisao integer;v_objeto uuid;v_mime text;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) then raise exception 'upload_evidencia_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_revision is null or p_expected_revision<0 or p_resposta_id is null or p_caminho is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'upload_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'expectedRevision',p_expected_revision,'respostaId',p_resposta_id,'caminho',p_caminho,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_uploads_evidencia_resposta where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('evidenciaId',v_ant.id,'revision',v_ant.revisao,'requestId',p_request_id,'autenticidadeConteudoComprovada',false); end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.sso_uploads_evidencia_resposta where retorno_id=p_retorno_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if pcm.sso_autorizar_upload_evidencia_resposta(p_caminho) is distinct from true or split_part(p_caminho,'/',1)<>p_cliente_id::text or split_part(p_caminho,'/',2)<>p_retorno_id::text or not exists(select 1 from pcm.respostas_os_preparadas where id=p_resposta_id and retorno_id=p_retorno_id) then raise exception 'referencia_indisponivel' using errcode='23514'; end if;
 select o.id,o.metadata->>'mimetype' into v_objeto,v_mime from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.bucket_id='sso-retorno-evidencias' and o.name=p_caminho and o.owner_id=v_actor::text and o.metadata->>'mimetype' in ('image/jpeg','image/png') for share of o;
 if v_objeto is null then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_uploads_evidencia_resposta(request_id,retorno_id,resposta_id,objeto_id,caminho,mime_declarado,revisao,justificativa,payload,ator_id) values(p_request_id,p_retorno_id,p_resposta_id,v_objeto,p_caminho,v_mime,v_revisao+1,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.upload_evidencia_resposta','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'evidenciaId',v_id,'respostaId',p_resposta_id,'revision',v_revisao+1));
 return jsonb_build_object('evidenciaId',v_id,'revision',v_revisao+1,'requestId',p_request_id,'autenticidadeConteudoComprovada',false);
end; $$;
revoke all on function pcm.sso_registrar_upload_evidencia_resposta(uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_resolver_upload_evidencia_resposta(p_caminho text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if pcm.sso_autorizar_upload_evidencia_resposta(p_caminho) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.bucket_id='sso-retorno-evidencias' and o.name=p_caminho and o.owner_id=auth.uid()::text and o.metadata->>'mimetype' in ('image/jpeg','image/png'));
end; $$;
revoke all on function pcm.sso_resolver_upload_evidencia_resposta(text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_uploads_evidencia_resposta(p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,resposta_id uuid,revisao integer,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) then raise exception 'upload_evidencia_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select e.id,e.resposta_id,e.revisao,e.mime_declarado,e.justificativa,e.ator_id,e.criado_em from pcm.sso_uploads_evidencia_resposta e where e.retorno_id=p_retorno_id and (p_antes is null or e.revisao<p_antes) order by e.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_uploads_evidencia_resposta(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_upload_evidencia_caminho_servico(p_evidencia_id uuid,p_usuario_id uuid,p_user_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_claims text;v_sub text;v_nome text;
begin
 if p_evidencia_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select o.name into v_nome from pcm.sso_uploads_evidencia_resposta e join pcm.retorno_os_preparado r on r.id=e.retorno_id
 join pcm.respostas_os_preparadas resposta on resposta.id=e.resposta_id and resposta.retorno_id=r.id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
 join storage.objects o on o.id=e.objeto_id and o.name=e.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=r.cliente_id::text and split_part(o.name,'/',2)=r.id::text and o.metadata->>'mimetype'=e.mime_declarado
 join storage.buckets b on b.id=o.bucket_id and b.public is false where e.id=p_evidencia_id and config.sso_autorizar_acao('execucao.validar',r.cliente_id) is true;
 if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);return v_nome;
end; $$;
revoke all on function pcm.sso_upload_evidencia_caminho_servico(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_upload_evidencia_caminho_servico(uuid,uuid,text) to service_role;
