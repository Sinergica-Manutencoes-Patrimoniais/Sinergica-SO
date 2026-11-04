-- ADR-0614: fronteira fail-closed; nenhum INSERT em OS ou fila.
create table pcm.sso_criacao_os_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_criacao_os_grupo_gate enable row level security;
alter table pcm.sso_criacao_os_grupo_gate force row level security;
revoke all on pcm.sso_criacao_os_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_criacao_os_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_prever_criacao_os_grupo(p_cliente_id uuid,p_intencao_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_intencao pcm.sso_intencoes_os_grupo%rowtype;v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_vinculo boolean;v_decisao boolean;
begin
 if not coalesce((select habilitado from pcm.sso_criacao_os_grupo_gate where id),false) then raise exception 'criacao_os_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_intencao_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_intencao from pcm.sso_intencoes_os_grupo where id=p_intencao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'intencao_indisponivel' using errcode='42501'; end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=v_intencao.ocorrencia_grupo_id and cliente_id=p_cliente_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 select exists(select 1 from pcm.sso_vinculos_os_grupo where ocorrencia_grupo_id=v_ocorrencia.id) into v_vinculo;
 select exists(select 1 from pcm.sso_decisoes_intencao_grupo where intencao_id=v_intencao.id) into v_decisao;
 return jsonb_build_object('intencaoId',v_intencao.id,'ocorrenciaId',v_ocorrencia.id,'planoId',v_ocorrencia.plano_id,'versaoId',v_ocorrencia.versao_id,'rotinaId',v_ocorrencia.rotina_id,'grupoId',v_ocorrencia.grupo_id,'quantidadeHistorica',v_intencao.quantidade_snapshot::text,'vinculoDeclarado',v_vinculo,'decisaoExistente',v_decisao,'criacaoDisponivel',false,'bloqueios',jsonb_build_array('gatilhos_os_nao_homologados','consumidores_grupo_nao_integrados','concorrencia_nao_homologada'),'osCriada',false,'tarefaCriada',false);
end; $$;
revoke all on function pcm.sso_prever_criacao_os_grupo(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_criar_os_grupo(p_request_id uuid,p_cliente_id uuid,p_intencao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_request_id is null then raise exception 'pedido_invalido' using errcode='22023'; end if;
 perform pcm.sso_prever_criacao_os_grupo(p_cliente_id,p_intencao_id);
 raise exception 'criacao_os_grupo_dependencias_nao_homologadas' using errcode='55000';
end; $$;
revoke all on function pcm.sso_criar_os_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
