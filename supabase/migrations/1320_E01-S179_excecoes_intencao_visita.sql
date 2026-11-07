-- ADR-1153: concessões mediadas permanecem dependentes de gates fechados.
create function pcm.sso_listar_excecoes_para_intencao(p_cliente_id uuid,p_os_id uuid,p_apos_lista uuid,p_apos_revisao integer,p_limite integer)
returns table(lista_id uuid,revisao integer,motivo text,descricao text,revisao_linhas integer,posicao integer,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or p_cliente_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_exigir_intencao_os_mediada();
 perform 1 from pcm.sso_intencao_material_gate where id and habilitado for share;
 if not found then raise exception 'intencao_material_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or
    config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_excecoes_materiais_os(p_cliente_id,p_os_id,p_apos_lista,p_apos_revisao,p_limite);
end; $$;
revoke all on function pcm.sso_listar_excecoes_para_intencao(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_excecoes_para_intencao(uuid,uuid,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_propor_intencao_por_material(uuid,uuid,uuid,uuid,uuid,integer,integer,text,uuid,integer) to authenticated;
