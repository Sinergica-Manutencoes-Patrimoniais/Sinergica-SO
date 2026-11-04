-- ADR-0321: associação declarada com revisão, sem presumir conteúdo.
create table pcm.sso_fotos_por_resposta (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 resposta_id uuid not null references pcm.respostas_os_preparadas(id),anexo_id uuid not null references pcm.sso_anexos_retorno_privados(id),
 revisao integer not null check(revisao>0),justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(retorno_id,revisao),unique(retorno_id,resposta_id,anexo_id)
);
alter table pcm.sso_fotos_por_resposta enable row level security;
alter table pcm.sso_fotos_por_resposta force row level security;
revoke all on pcm.sso_fotos_por_resposta from public,anon,authenticated,service_role;
create trigger sso_foto_por_resposta_imutavel before update or delete on pcm.sso_fotos_por_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_associar_foto_resposta(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_resposta_id uuid,p_anexo_id uuid,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_fotos_por_resposta%rowtype;v_payload jsonb;v_revisao integer;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'foto_resposta_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_revision is null or p_expected_revision<0 or p_resposta_id is null or p_anexo_id is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'associacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'expectedRevision',p_expected_revision,'respostaId',p_resposta_id,'anexoId',p_anexo_id,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_fotos_por_resposta where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('associacaoId',v_ant.id,'revision',v_ant.revisao,'requestId',p_request_id,'conteudoComprovado',false); end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.sso_fotos_por_resposta where retorno_id=p_retorno_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.respostas_os_preparadas where id=p_resposta_id and retorno_id=p_retorno_id) or not exists(select 1 from pcm.sso_anexos_retorno_privados a join pcm.os_notas n on n.id=a.nota_id and n.ordem_servico_id=v_retorno.os_id and n.cliente_id=p_cliente_id and n.anexo_path=a.caminho
  join pcm.ordens_servico os on os.id=n.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null join storage.objects o on o.id=a.objeto_id and o.name=a.caminho and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=p_cliente_id::text and o.metadata->>'mimetype'=a.mime_declarado
  join storage.buckets b on b.id=o.bucket_id and b.public is false where a.id=p_anexo_id and a.retorno_id=p_retorno_id) then raise exception 'referencia_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_fotos_por_resposta(request_id,retorno_id,resposta_id,anexo_id,revisao,justificativa,payload,ator_id) values(p_request_id,p_retorno_id,p_resposta_id,p_anexo_id,v_revisao+1,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.foto_resposta_declarada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'associacaoId',v_id,'respostaId',p_resposta_id,'anexoId',p_anexo_id,'revision',v_revisao+1));
 return jsonb_build_object('associacaoId',v_id,'revision',v_revisao+1,'requestId',p_request_id,'conteudoComprovado',false);
end; $$;
revoke all on function pcm.sso_associar_foto_resposta(uuid,uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fotos_por_resposta(p_cliente_id uuid,p_retorno_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,resposta_id uuid,anexo_id uuid,revisao integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_retorno_gate where id),false) then raise exception 'foto_resposta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select a.id,a.resposta_id,a.anexo_id,a.revisao,a.justificativa,a.ator_id,a.criado_em from pcm.sso_fotos_por_resposta a where a.retorno_id=p_retorno_id and (p_antes is null or a.revisao<p_antes) order by a.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_por_resposta(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
