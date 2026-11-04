-- ADR-1311: mediação das correlações; gates permanecem fechados.
create table comercial.sso_correlacao_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_correlacao_mediada_gate(id,habilitado) values(true,false);
alter table comercial.sso_correlacao_mediada_gate enable row level security;
alter table comercial.sso_correlacao_mediada_gate force row level security;
revoke all on comercial.sso_correlacao_mediada_gate from public,anon,authenticated,service_role;

create function comercial.sso_exigir_mediacao_correlacao(p_ator_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from comercial.sso_correlacao_mediada_gate where id and habilitado for share;
 if not found then raise exception 'correlacao_mediada_desabilitada' using errcode='55000'; end if;
end; $$;
revoke all on function comercial.sso_exigir_mediacao_correlacao(uuid) from public,anon,authenticated,service_role;

create function comercial.sso_listar_correlacoes_gasto_mediado(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,fonte_id uuid,despesa_id uuid,vinculo_id uuid,despesa_revisao integer,rateio_revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform comercial.sso_exigir_mediacao_correlacao(p_ator_id);
 return query select * from comercial.sso_listar_correlacoes_gasto(p_ator_id,p_cliente_id,p_lista_id,p_apos,p_limite);
end; $$;
revoke all on function comercial.sso_listar_correlacoes_gasto_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_listar_correlacoes_gasto_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function comercial.sso_listar_correlacoes_gasto_v2_mediado(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,fonte_id uuid,despesa_id uuid,vinculo_id uuid,despesa_revisao integer,rateio_revisao integer,criado_em timestamptz,decisao_revisao integer,estado text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform comercial.sso_exigir_mediacao_correlacao(p_ator_id);
 return query select * from comercial.sso_listar_correlacoes_gasto_v2(p_ator_id,p_cliente_id,p_lista_id,p_apos,p_limite);
end; $$;
revoke all on function comercial.sso_listar_correlacoes_gasto_v2_mediado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_listar_correlacoes_gasto_v2_mediado(uuid,uuid,uuid,uuid,integer) to authenticated;

create function comercial.sso_declarar_correlacao_gasto_mediado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_fonte_id uuid,p_despesa_id uuid,p_vinculo_id uuid,p_despesa_revision integer,p_rateio_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform comercial.sso_exigir_mediacao_correlacao(p_ator_id);
 return comercial.sso_declarar_correlacao_gasto(p_ator_id,p_cliente_id,p_request_id,p_fonte_id,p_despesa_id,p_vinculo_id,p_despesa_revision,p_rateio_revision,p_motivo);
end; $$;
revoke all on function comercial.sso_declarar_correlacao_gasto_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_declarar_correlacao_gasto_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;

create function comercial.sso_decidir_correlacao_gasto_mediado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_correlacao_id uuid,p_expected_revision integer,p_acao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform comercial.sso_exigir_mediacao_correlacao(p_ator_id);
 return comercial.sso_decidir_correlacao_gasto(p_ator_id,p_cliente_id,p_request_id,p_correlacao_id,p_expected_revision,p_acao,p_motivo);
end; $$;
revoke all on function comercial.sso_decidir_correlacao_gasto_mediado(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_decidir_correlacao_gasto_mediado(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
