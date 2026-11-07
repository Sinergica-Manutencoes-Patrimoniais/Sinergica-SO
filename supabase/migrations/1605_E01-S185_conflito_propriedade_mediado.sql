-- ADR-1463: entradas autenticadas sem expor os núcleos privados.
create function pcm.sso_listar_conflitos_propriedade_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,revisao integer,situacao text,observado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_conflitos_propriedade_os(p_ator_id,p_cliente_id,p_apos,p_limite);
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_conflitos_propriedade_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_propriedade_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_conflitos_propriedade_v2_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,revisao integer,situacao text,observado_em timestamptz,observacao_revisao integer)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_listar_conflitos_propriedade_os_v2(p_ator_id,p_cliente_id,p_apos,p_limite);
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_conflitos_propriedade_v2_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_conflitos_propriedade_v2_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_iniciar_observacao_cliente_mediada(p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_conflito_revisao integer,p_observacao_revisao integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_iniciar_observacao_novo_cliente(p_request_id,p_ator_id,p_cliente_id,p_os_id,p_conflito_revisao,p_observacao_revisao,p_motivo);
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_iniciar_observacao_cliente_mediada(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_iniciar_observacao_cliente_mediada(uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
