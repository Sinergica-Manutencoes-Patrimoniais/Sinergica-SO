-- ADR-0595: revisão explícita do Grupo para o registro 0815, sem execução.
create function pcm.sso_previa_registro_grupo(p_cliente_id uuid,p_tipo text,p_preparada_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_grupo pcm.grupos_quantitativos%rowtype;v_alvo uuid;
begin
 if not coalesce((select habilitado from pcm.sso_ocorrencia_grupo_gate where id),false) then raise exception 'ocorrencia_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_preparada_id is null or p_tipo is null or p_tipo not in ('calendario','visita') or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='calendario' then select o.alvo_id into v_alvo from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo';
 else select o.alvo_id into v_alvo from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo'; end if;
 select * into v_grupo from pcm.grupos_quantitativos where id=v_alvo and cliente_id=p_cliente_id and ativo and deleted_at is null;
 if not found then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
 return jsonb_build_object('grupoId',v_grupo.id,'revisao',v_grupo.revisao,'quantidade',v_grupo.quantidade::text,'filaIntegrada',false,'osCriada',false);
end; $$;
revoke all on function pcm.sso_previa_registro_grupo(uuid,text,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_registrar_ocorrencia_grupo_revisada(p_request_id uuid,p_cliente_id uuid,p_tipo text,p_preparada_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_previa jsonb;v_grupo pcm.grupos_quantitativos%rowtype;
begin
 if p_expected_revision is null or p_expected_revision<1 then raise exception 'revisao_invalida' using errcode='22023'; end if;
 v_previa:=pcm.sso_previa_registro_grupo(p_cliente_id,p_tipo,p_preparada_id);
 select * into v_grupo from pcm.grupos_quantitativos where id=(v_previa->>'grupoId')::uuid and cliente_id=p_cliente_id and ativo and deleted_at is null for share;
 if not found or v_grupo.revisao is distinct from p_expected_revision then raise exception 'revisao_grupo_obsoleta' using errcode='40001'; end if;
 return pcm.sso_registrar_ocorrencia_grupo(p_request_id,p_cliente_id,p_tipo,p_preparada_id);
end; $$;
revoke all on function pcm.sso_registrar_ocorrencia_grupo_revisada(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
