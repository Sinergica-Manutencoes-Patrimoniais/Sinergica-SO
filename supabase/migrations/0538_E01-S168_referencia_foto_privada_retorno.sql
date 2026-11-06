-- ADR-0312: referência privada por retorno, sem associação automática a pergunta.
create table pcm.sso_anexo_retorno_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_anexo_retorno_gate enable row level security;
alter table pcm.sso_anexo_retorno_gate force row level security;
revoke all on pcm.sso_anexo_retorno_gate from public,anon,authenticated,service_role;
insert into pcm.sso_anexo_retorno_gate(id,habilitado) values(true,false);
create table pcm.sso_anexos_retorno_privados (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 nota_id uuid not null references pcm.os_notas(id),objeto_id uuid not null,caminho text not null,mime_declarado text not null check(mime_declarado in ('image/jpeg','image/png')),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(retorno_id,objeto_id)
);
alter table pcm.sso_anexos_retorno_privados enable row level security;
alter table pcm.sso_anexos_retorno_privados force row level security;
revoke all on pcm.sso_anexos_retorno_privados from public,anon,authenticated,service_role;
create trigger sso_anexo_retorno_imutavel before update or delete on pcm.sso_anexos_retorno_privados for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_referenciar_foto_retorno(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_nota_id uuid,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_anexos_retorno_privados%rowtype;v_objeto uuid;v_caminho text;v_mime text;v_payload jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'anexo_retorno_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_nota_id is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'referencia_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'notaId',p_nota_id,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_anexos_retorno_privados where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('anexoId',v_ant.id,'requestId',p_request_id,'autenticidadeConteudoComprovada',false); end if;
 select o.id,o.name,o.metadata->>'mimetype' into v_objeto,v_caminho,v_mime from pcm.os_notas n
 join pcm.ordens_servico os on os.id=n.ordem_servico_id and os.client_id=n.cliente_id and os.deleted_at is null
 join storage.objects o on o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=p_cliente_id::text
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where n.id=p_nota_id and n.cliente_id=p_cliente_id and n.ordem_servico_id=v_retorno.os_id and o.metadata->>'mimetype' in ('image/jpeg','image/png') for share of n,o;
 if v_objeto is null then raise exception 'foto_privada_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_anexos_retorno_privados(request_id,retorno_id,nota_id,objeto_id,caminho,mime_declarado,justificativa,payload,ator_id) values(p_request_id,p_retorno_id,p_nota_id,v_objeto,v_caminho,v_mime,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.foto_privada_referenciada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'anexoId',v_id,'notaId',p_nota_id));
 return jsonb_build_object('anexoId',v_id,'requestId',p_request_id,'autenticidadeConteudoComprovada',false);
end; $$;
revoke all on function pcm.sso_referenciar_foto_retorno(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_candidatas_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(nota_id uuid,criado_em timestamptz,mime_declarado text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'anexo_retorno_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select n.id,n.created_at,o.metadata->>'mimetype' from pcm.retorno_os_preparado r join pcm.os_notas n on n.ordem_servico_id=r.os_id and n.cliente_id=r.cliente_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null
 join storage.objects o on o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=p_cliente_id::text
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where r.id=p_retorno_id and r.cliente_id=p_cliente_id and o.metadata->>'mimetype' in ('image/jpeg','image/png') and (p_apos is null or n.id>p_apos) order by n.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_candidatas_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_referenciadas_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,nota_id uuid,mime_declarado text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'anexo_retorno_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select a.id,a.nota_id,a.mime_declarado,a.justificativa,a.ator_id,a.criado_em from pcm.sso_anexos_retorno_privados a where a.retorno_id=p_retorno_id and (p_apos is null or a.id>p_apos) order by a.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_referenciadas_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
