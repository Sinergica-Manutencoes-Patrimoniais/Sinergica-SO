-- ADR-1154: leitura individual sob gates; não executa reprogramação.
create function pcm.sso_consultar_origem_material_intencao(p_cliente_id uuid,p_intencao_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare i pcm.reprogramacao_os_intencoes%rowtype; r pcm.sso_intencao_material_origens%rowtype;
begin
 if auth.uid() is null or p_cliente_id is null or p_intencao_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_exigir_intencao_os_mediada();
 perform 1 from pcm.sso_intencao_material_gate where id and habilitado for share;
 if not found then raise exception 'intencao_material_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into i from pcm.reprogramacao_os_intencoes where id=p_intencao_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=i.os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into r from pcm.sso_intencao_material_origens where intencao_id=i.id and cliente_id=p_cliente_id and os_id=i.os_id;
 if not found then return jsonb_build_object('intencaoId',i.id,'osId',i.os_id,'origem',null); end if;
 return jsonb_build_object('intencaoId',i.id,'osId',i.os_id,'origem',jsonb_build_object('listaId',r.lista_id,'eventoRevisao',r.evento_revisao,'registradoEm',r.criado_em),'excecaoAtualComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_origem_material_intencao(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_origem_material_intencao(uuid,uuid) to authenticated;
