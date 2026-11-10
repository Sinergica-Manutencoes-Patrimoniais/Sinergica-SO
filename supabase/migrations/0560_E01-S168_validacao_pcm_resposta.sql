-- ADR-0334: decisão humana por resposta, sem aprovação ou encerramento da OS.
create table pcm.sso_validacao_resposta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_validacao_resposta_gate enable row level security;
alter table pcm.sso_validacao_resposta_gate force row level security;
revoke all on pcm.sso_validacao_resposta_gate from public,anon,authenticated,service_role;
insert into pcm.sso_validacao_resposta_gate(id,habilitado) values(true,false);
create table pcm.sso_validacoes_resposta (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 resposta_id uuid not null references pcm.respostas_os_preparadas(id),evidencia_id uuid not null references pcm.sso_uploads_evidencia_resposta(id),
 revisao integer not null check(revisao>0),revisao_uploads integer not null,decisao text not null check(decisao in ('aceita_pcm','rejeitada_pcm')),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(resposta_id,revisao)
);
alter table pcm.sso_validacoes_resposta enable row level security;
alter table pcm.sso_validacoes_resposta force row level security;
revoke all on pcm.sso_validacoes_resposta from public,anon,authenticated,service_role;
create trigger sso_validacao_resposta_imutavel before update or delete on pcm.sso_validacoes_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_validar_resposta_evidencia(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_evidencia_id uuid,p_expected_decisao integer,p_expected_uploads integer,p_decisao text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_validacoes_resposta%rowtype;v_payload jsonb;v_revision integer;v_uploads integer;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'validacao_resposta_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_resposta_id is null or p_evidencia_id is null or p_expected_decisao is null or p_expected_decisao<0 or p_expected_uploads is null or p_expected_uploads<1 or p_decisao is null or p_decisao not in ('aceita_pcm','rejeitada_pcm') or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'validacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'respostaId',p_resposta_id,'evidenciaId',p_evidencia_id,'expectedDecisao',p_expected_decisao,'expectedUploads',p_expected_uploads,'decisao',p_decisao,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_validacoes_resposta where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('validacaoId',v_ant.id,'revision',v_ant.revisao,'requestId',p_request_id,'conteudoAutenticado',false); end if;
 select coalesce(max(revisao),0) into v_revision from pcm.sso_validacoes_resposta where resposta_id=p_resposta_id;
 select coalesce(max(revisao),0) into v_uploads from pcm.sso_uploads_evidencia_resposta where retorno_id=p_retorno_id;
 if v_revision<>p_expected_decisao or v_uploads<>p_expected_uploads then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.respostas_os_preparadas r join pcm.sso_uploads_evidencia_resposta e on e.resposta_id=r.id and e.retorno_id=r.retorno_id
 join pcm.ordens_servico os on os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null
 join storage.objects o on o.id=e.objeto_id and o.name=e.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=p_cliente_id::text and split_part(o.name,'/',2)=p_retorno_id::text and o.metadata->>'mimetype'=e.mime_declarado
 join storage.buckets b on b.id=o.bucket_id and b.public is false where r.id=p_resposta_id and r.retorno_id=p_retorno_id and e.id=p_evidencia_id) then raise exception 'evidencia_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_validacoes_resposta(request_id,retorno_id,resposta_id,evidencia_id,revisao,revisao_uploads,decisao,justificativa,payload,ator_id)
 values(p_request_id,p_retorno_id,p_resposta_id,p_evidencia_id,v_revision+1,v_uploads,p_decisao,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.resposta_evidencia_decidida','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'validacaoId',v_id,'respostaId',p_resposta_id,'evidenciaId',p_evidencia_id,'revision',v_revision+1,'decisao',p_decisao));
 return jsonb_build_object('validacaoId',v_id,'revision',v_revision+1,'requestId',p_request_id,'conteudoAutenticado',false);
end; $$;
revoke all on function pcm.sso_validar_resposta_evidencia(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_validacoes_resposta(p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,evidencia_id uuid,revisao integer,revisao_uploads integer,decisao text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'validacao_resposta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.respostas_os_preparadas r join pcm.retorno_os_preparado ret on ret.id=r.retorno_id where r.id=p_resposta_id and r.retorno_id=p_retorno_id and ret.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select v.id,v.evidencia_id,v.revisao,v.revisao_uploads,v.decisao,v.justificativa,v.ator_id,v.criado_em from pcm.sso_validacoes_resposta v where v.resposta_id=p_resposta_id and v.retorno_id=p_retorno_id and (p_antes is null or v.revisao<p_antes) order by v.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_validacoes_resposta(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
