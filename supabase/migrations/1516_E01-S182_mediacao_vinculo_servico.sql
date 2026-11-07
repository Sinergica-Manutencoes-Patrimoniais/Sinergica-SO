-- ADR-1369: leitura mediada e declaração com gate de escrita próprio.
create table financeiro.sso_vinculo_servico_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_vinculo_servico_mediado_gate(id,habilitado) values(true,false);
alter table financeiro.sso_vinculo_servico_mediado_gate enable row level security;
alter table financeiro.sso_vinculo_servico_mediado_gate force row level security;
revoke all on financeiro.sso_vinculo_servico_mediado_gate from public,anon,authenticated,service_role;

create function financeiro.sso_listar_servicos_extra_mediado(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,proposta_id uuid,versao integer,linha_id uuid,quantidade integer,preco_unitario_centavos text,chave_evento text,justificativa text,ator_id uuid,decisao text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.* from financeiro.sso_listar_servicos_extra(p_cliente_id,p_apos,p_limite) x;
end; $$;
revoke all on function financeiro.sso_listar_servicos_extra_mediado(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_listar_servicos_extra_mediado(uuid,uuid,integer) to authenticated;

create function financeiro.sso_paginar_opcoes_vinculo_servico_mediado(p_cliente_id uuid,p_declaracao_id uuid,p_apos uuid,p_limite integer)
returns table(snapshot_id uuid,vinculo_evidencia_id uuid,resposta_id uuid,evidencia_id uuid,retorno_id uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_declaracao_id is null or p_limite is null or p_limite not between 1 and 50
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.* from financeiro.sso_paginar_opcoes_vinculo_resposta_servico(p_cliente_id,p_declaracao_id,p_apos,p_limite) x;
end; $$;
revoke all on function financeiro.sso_paginar_opcoes_vinculo_servico_mediado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_paginar_opcoes_vinculo_servico_mediado(uuid,uuid,uuid,integer) to authenticated;

create function financeiro.sso_declarar_vinculo_servico_mediado(p_request_id uuid,p_cliente_id uuid,p_snapshot_id uuid,p_vinculo_evidencia_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from financeiro.sso_vinculo_servico_mediado_gate where id and habilitado for share;
  if not found then raise exception 'declaracao_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_snapshot_id is null or p_vinculo_evidencia_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=financeiro.sso_declarar_vinculo_resposta_servico(p_request_id,p_cliente_id,p_snapshot_id,p_vinculo_evidencia_id,p_motivo);
  if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end; $$;
revoke all on function financeiro.sso_declarar_vinculo_servico_mediado(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_declarar_vinculo_servico_mediado(uuid,uuid,uuid,uuid,text) to authenticated;
