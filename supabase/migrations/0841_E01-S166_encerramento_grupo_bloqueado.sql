-- ADR-0616: não infere conclusão de OS a partir de vínculo declarado.
create table pcm.sso_encerramento_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_encerramento_grupo_gate enable row level security;
alter table pcm.sso_encerramento_grupo_gate force row level security;
revoke all on pcm.sso_encerramento_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_encerramento_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_prever_encerramento_grupo(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_os uuid;v_status text;
begin
 if not coalesce((select habilitado from pcm.sso_encerramento_grupo_gate where id),false) then raise exception 'encerramento_grupo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select v.os_id,o.status into v_os,v_status from pcm.sso_vinculos_os_grupo v join pcm.ordens_servico o on o.id=v.os_id and o.client_id=v.cliente_id and o.deleted_at is null where v.ocorrencia_grupo_id=v_ocorrencia.id and v.cliente_id=p_cliente_id;
 return jsonb_build_object('ocorrenciaId',v_ocorrencia.id,'vinculoDeclaradoOs',v_os is not null,'osId',v_os,'statusOsDeclarada',v_status,'conclusaoComprovada',false,'encerramentoDisponivel',false,'motivoBloqueio','origem_grupo_e_cobertura_nao_homologadas');
end; $$;
revoke all on function pcm.sso_prever_encerramento_grupo(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_encerrar_ocorrencia_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_request_id is null then raise exception 'pedido_invalido' using errcode='22023'; end if;
 perform pcm.sso_prever_encerramento_grupo(p_cliente_id,p_ocorrencia_id);
 raise exception 'encerramento_grupo_provas_nao_homologadas' using errcode='55000';
end; $$;
revoke all on function pcm.sso_encerrar_ocorrencia_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
