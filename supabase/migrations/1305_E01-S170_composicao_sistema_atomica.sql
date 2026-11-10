-- ADR-1137: comando fechado, sem alteração dos vínculos existentes ao aplicar.
create table pcm.sso_composicao_sistema_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_composicao_sistema_gate(id,habilitado) values(true,false);
create table pcm.sso_composicao_sistema_recibos(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 sistema_id uuid not null references pcm.sistemas(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_composicao_sistema_gate enable row level security;
alter table pcm.sso_composicao_sistema_gate force row level security;
alter table pcm.sso_composicao_sistema_recibos enable row level security;
alter table pcm.sso_composicao_sistema_recibos force row level security;
revoke all on pcm.sso_composicao_sistema_gate,pcm.sso_composicao_sistema_recibos from public,anon,authenticated,service_role;
create trigger sso_composicao_sistema_recibos_imutaveis before update or delete on pcm.sso_composicao_sistema_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_salvar_composicao_sistema(p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_sistema_id uuid,p_observados uuid[],p_desejados uuid[])
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_composicao_sistema_recibos%rowtype;v_observados uuid[];v_desejados uuid[];v_atuais uuid[];
 v_item uuid;v_cliente uuid;v_excluido timestamptz;v_payload jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_sistema_id is null
  or p_observados is null or p_desejados is null or cardinality(p_observados)>1000 or cardinality(p_desejados)>1000
  or array_position(p_observados,null) is not null or array_position(p_desejados,null) is not null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into v_observados from unnest(p_observados) x;
 select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into v_desejados from unnest(p_desejados) x;
 if cardinality(v_observados)<>cardinality(p_observados) or cardinality(v_desejados)<>cardinality(p_desejados) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_composicao_sistema_gate where id and habilitado for share;
 if not found then raise exception 'composicao_desabilitada' using errcode='55000'; end if;
 perform 1 from config.sso_capacidade_cadastros_legados_gate where id and habilitado for share;
 if not found then raise exception 'protecao_desabilitada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'sistemaId',p_sistema_id,'observados',v_observados,'desejados',v_desejados);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-composicao-sistema:'||p_request_id::text,0));
 perform 1 from pcm.sistemas where id=p_sistema_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_composicao_sistema_recibos where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
 end if;
 select coalesce(array_agg(item_id order by item_id),'{}'::uuid[]) into v_atuais from pcm.sistema_itens where sistema_id=p_sistema_id;
 if v_atuais is distinct from v_observados then raise exception 'composicao_alterada' using errcode='40001'; end if;
 for v_item in select distinct x from unnest(v_observados||v_desejados) x order by x loop
  select client_id,deleted_at into v_cliente,v_excluido from pcm.equipamentos where id=v_item for update;
  if not found or v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_item=any(v_desejados) and (v_cliente is distinct from p_cliente_id or v_excluido is not null) then raise exception 'vinculo_invalido' using errcode='23514'; end if;
 end loop;
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 delete from pcm.sistema_itens where sistema_id=p_sistema_id and not (item_id=any(v_desejados));
 insert into pcm.sistema_itens(sistema_id,item_id,created_by)
  select p_sistema_id,x,p_ator_id from unnest(v_desejados) x where not (x=any(v_observados));
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'sistemaId',p_sistema_id,'itens',v_desejados);
 insert into pcm.sso_composicao_sistema_recibos(request_id,ator_id,cliente_id,sistema_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_sistema_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'cadastro.composicao_sistema_alterada','sistemas',p_sistema_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'antes',v_observados,'depois',v_desejados));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_salvar_composicao_sistema(uuid,uuid,uuid,uuid,uuid[],uuid[]) from public,anon,authenticated,service_role;
