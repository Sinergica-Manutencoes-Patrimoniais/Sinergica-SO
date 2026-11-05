-- ADR-0630: avaliação humana da foto, sem autenticar conteúdo ou concluir execução.
create table pcm.sso_decisao_foto_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_decisao_foto_grupo_gate enable row level security;
alter table pcm.sso_decisao_foto_grupo_gate force row level security;
revoke all on pcm.sso_decisao_foto_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_decisao_foto_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_foto_grupo (
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),ocorrencia_id uuid not null references pcm.sso_ocorrencias_grupo(id),
 foto_id uuid not null references pcm.sso_fotos_atestado_grupo(id),revisao integer not null check(revisao>0),decisao text not null check(decisao in ('aceita_pcm','rejeitada_pcm')),
 motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(ocorrencia_id,revisao)
);
alter table pcm.sso_decisoes_foto_grupo enable row level security;
alter table pcm.sso_decisoes_foto_grupo force row level security;
revoke all on pcm.sso_decisoes_foto_grupo from public,anon,authenticated,service_role;
create trigger sso_decisao_foto_grupo_imutavel before update or delete on pcm.sso_decisoes_foto_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_decidir_foto_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_foto_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_decisoes_foto_grupo%rowtype;v_payload jsonb;v_rev integer;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_decisao_foto_grupo_gate where id),false) or not coalesce((select habilitado from pcm.sso_foto_grupo_gate where id),false) then raise exception 'decisao_foto_grupo_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_foto_id is null or p_expected_revision is null or p_expected_revision<0 or p_decisao is null or p_decisao not in ('aceita_pcm','rejeitada_pcm') or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'fotoId',p_foto_id,'expectedRevision',p_expected_revision,'decisao',p_decisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-foto-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_decisoes_foto_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'revisao',v_ant.revisao,'conteudoAutenticado',false,'ocorrenciaEncerrada',false); end if;
 perform 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 perform f.id from pcm.sso_fotos_atestado_grupo f join pcm.sso_atestados_declarados_grupo a on a.request_id=f.atestado_request_id and a.cliente_id=f.cliente_id and a.ocorrencia_id=f.ocorrencia_id and a.os_id=f.os_id
 join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=f.ocorrencia_id and v.cliente_id=f.cliente_id and v.os_id=f.os_id
 join pcm.ordens_servico os on os.id=f.os_id and os.client_id=f.cliente_id and os.deleted_at is null
 join pcm.os_notas n on n.id=f.nota_id and n.cliente_id=f.cliente_id and n.ordem_servico_id=f.os_id
 join storage.objects o on o.id=f.objeto_id and o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=f.cliente_id::text and o.metadata->>'mimetype'=f.mime_declarado
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where f.id=p_foto_id and f.cliente_id=p_cliente_id and f.ocorrencia_id=p_ocorrencia_id for share of os,n,o;
 if not found then raise exception 'foto_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_foto_grupo where ocorrencia_id=p_ocorrencia_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_decisoes_foto_grupo(request_id,cliente_id,ocorrencia_id,foto_id,revisao,decisao,motivo,ator_id,payload) values(p_request_id,p_cliente_id,p_ocorrencia_id,p_foto_id,v_rev+1,p_decisao,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'execucao.foto_grupo_decidida_pcm','planos_manutencao',p_ocorrencia_id,jsonb_build_object('requestId',p_request_id,'fotoId',p_foto_id,'revisao',v_rev+1,'decisao',p_decisao));
 return jsonb_build_object('requestId',p_request_id,'revisao',v_rev+1,'conteudoAutenticado',false,'ocorrenciaEncerrada',false);
end; $$;
revoke all on function pcm.sso_decidir_foto_grupo(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_decisoes_foto_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,foto_id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_decisao_foto_grupo_gate where id),false) then raise exception 'decisao_foto_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select d.request_id,d.foto_id,d.revisao,d.decisao,d.motivo,d.ator_id,d.criado_em from pcm.sso_decisoes_foto_grupo d where d.cliente_id=p_cliente_id and d.ocorrencia_id=p_ocorrencia_id and (p_antes is null or d.revisao<p_antes) order by d.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_decisoes_foto_grupo(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
