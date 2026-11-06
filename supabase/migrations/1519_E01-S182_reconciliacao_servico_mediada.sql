-- ADR-1372: comparação declarativa; não habilita faturamento.
create table financeiro.sso_reconciliacao_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_reconciliacao_mediada_gate(id,habilitado) values(true,false);
alter table financeiro.sso_reconciliacao_mediada_gate enable row level security;
alter table financeiro.sso_reconciliacao_mediada_gate force row level security;
revoke all on financeiro.sso_reconciliacao_mediada_gate from public,anon,authenticated,service_role;

create function financeiro.sso_materiais_os_reconciliacao_mediado(p_cliente_id uuid,p_os_id uuid,p_apos uuid)
returns table(id uuid,os_id uuid,descricao text,estado text) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_material_declaracao_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_os_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
   or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select d.id,d.os_id,d.descricao,d.estado from financeiro.sso_material_declaracoes d
   where d.cliente_id=p_cliente_id and d.os_id=p_os_id and (p_apos is null or d.id>p_apos) order by d.id limit 20;
end; $$;
revoke all on function financeiro.sso_materiais_os_reconciliacao_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_materiais_os_reconciliacao_mediado(uuid,uuid,uuid) to authenticated;

create function financeiro.sso_listar_reconciliacoes_mediado(p_cliente_id uuid,p_servico_id uuid,p_material_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_servico_id is null or p_material_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select x.* from financeiro.sso_listar_reconciliacoes_servico_material(p_cliente_id,p_servico_id,p_material_id,p_antes,p_limite) x;
end; $$;
revoke all on function financeiro.sso_listar_reconciliacoes_mediado(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_listar_reconciliacoes_mediado(uuid,uuid,uuid,integer,integer) to authenticated;

create function financeiro.sso_diagnosticar_reconciliacao_mediado(p_cliente_id uuid,p_decisao_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_decisao_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=financeiro.sso_diagnosticar_revisao_reconciliacao(p_cliente_id,p_decisao_id);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_diagnosticar_reconciliacao_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_diagnosticar_reconciliacao_mediado(uuid,uuid) to authenticated;

create function financeiro.sso_decidir_reconciliacao_mediado(p_request_id uuid,p_cliente_id uuid,p_servico_id uuid,p_material_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_reconciliacao_mediada_gate where id and habilitado for share;
 if not found then raise exception 'comando_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_servico_id is null or p_material_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=financeiro.sso_decidir_reconciliacao_servico_material(p_request_id,p_cliente_id,p_servico_id,p_material_id,p_expected_revision,p_decisao,p_motivo);
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_decidir_reconciliacao_mediado(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_decidir_reconciliacao_mediado(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
