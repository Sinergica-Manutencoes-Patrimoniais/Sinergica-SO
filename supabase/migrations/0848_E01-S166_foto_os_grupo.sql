-- ADR-0623: referência de foto privada da OS, não prova conteúdo ou conclusão.
create table pcm.sso_foto_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_foto_grupo_gate enable row level security;
alter table pcm.sso_foto_grupo_gate force row level security;
revoke all on pcm.sso_foto_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_foto_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_fotos_atestado_grupo (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,cliente_id uuid not null references pcm.clientes(id),
 ocorrencia_id uuid not null references pcm.sso_ocorrencias_grupo(id),atestado_request_id uuid not null references pcm.sso_atestados_declarados_grupo(request_id),
 os_id uuid not null references pcm.ordens_servico(id),nota_id uuid not null references pcm.os_notas(id),objeto_id uuid not null,mime_declarado text not null,
 revisao integer not null check(revisao>0),justificativa text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),
 unique(ocorrencia_id,revisao),unique(atestado_request_id,objeto_id)
);
alter table pcm.sso_fotos_atestado_grupo enable row level security;
alter table pcm.sso_fotos_atestado_grupo force row level security;
revoke all on pcm.sso_fotos_atestado_grupo from public,anon,authenticated,service_role;
create trigger sso_foto_atestado_grupo_imutavel before update or delete on pcm.sso_fotos_atestado_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_registrar_foto_atestado_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_atestado_id uuid,p_nota_id uuid,p_expected_revision integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_fotos_atestado_grupo%rowtype;v_atestado pcm.sso_atestados_declarados_grupo%rowtype;v_payload jsonb;v_revisao integer;v_objeto uuid;v_mime text;v_id uuid;v_motivo text:=nullif(btrim(p_justificativa),'');
begin
 if not coalesce((select habilitado from pcm.sso_foto_grupo_gate where id),false) then raise exception 'foto_grupo_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_atestado_id is null or p_nota_id is null or p_expected_revision is null or p_expected_revision<0 or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'atestadoId',p_atestado_id,'notaId',p_nota_id,'expectedRevision',p_expected_revision,'justificativa',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_fotos_atestado_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'fotoId',v_ant.id,'revisao',v_ant.revisao,'conteudoAutenticado',false,'ocorrenciaEncerrada',false); end if;
 perform 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_atestado from pcm.sso_atestados_declarados_grupo where request_id=p_atestado_id and ocorrencia_id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found or not exists(select 1 from pcm.sso_vinculos_os_grupo v where v.ocorrencia_grupo_id=p_ocorrencia_id and v.cliente_id=p_cliente_id and v.os_id=v_atestado.os_id) then raise exception 'atestado_ou_vinculo_indisponivel' using errcode='23514'; end if;
 select o.id,o.metadata->>'mimetype' into v_objeto,v_mime from pcm.os_notas n join pcm.ordens_servico os on os.id=n.ordem_servico_id and os.client_id=n.cliente_id and os.deleted_at is null
 join storage.objects o on o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=p_cliente_id::text
 join storage.buckets b on b.id=o.bucket_id and b.public is false where n.id=p_nota_id and n.cliente_id=p_cliente_id and n.ordem_servico_id=v_atestado.os_id and o.metadata->>'mimetype' in ('image/jpeg','image/png') for share of n,o;
 if v_objeto is null then raise exception 'foto_privada_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.sso_fotos_atestado_grupo where ocorrencia_id=p_ocorrencia_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_fotos_atestado_grupo(request_id,cliente_id,ocorrencia_id,atestado_request_id,os_id,nota_id,objeto_id,mime_declarado,revisao,justificativa,ator_id,payload) values(p_request_id,p_cliente_id,p_ocorrencia_id,p_atestado_id,v_atestado.os_id,p_nota_id,v_objeto,v_mime,v_revisao+1,v_motivo,v_actor,v_payload) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.foto_atestado_grupo_registrada','ordens_servico',v_atestado.os_id,jsonb_build_object('requestId',p_request_id,'fotoId',v_id,'ocorrenciaId',p_ocorrencia_id,'revisao',v_revisao+1));
 return jsonb_build_object('requestId',p_request_id,'fotoId',v_id,'revisao',v_revisao+1,'conteudoAutenticado',false,'ocorrenciaEncerrada',false);
end; $$;
revoke all on function pcm.sso_registrar_foto_atestado_grupo(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
