-- ADR-1171: consulta privada, sem efeito externo.
create table pcm.sso_t24_consulta_tardia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_consulta_tardia_gate(id,habilitado) values(true,false);
alter table pcm.sso_t24_consulta_tardia_gate enable row level security;alter table pcm.sso_t24_consulta_tardia_gate force row level security;
revoke all on pcm.sso_t24_consulta_tardia_gate from public,anon,authenticated,service_role;
create function pcm.sso_t24_listar_respostas_tardias(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_tentativa_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,fence bigint,tarefa_observada text,motivo text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_tentativa_id is null or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_consulta_tardia_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_t24_tentativas t join pcm.visitas v on v.id=t.visita_id and v.cliente_id=p_cliente_id
  join pcm.ordens_servico o on o.id=t.os_id and o.client_id=p_cliente_id and o.deleted_at is null
  where t.id=p_tentativa_id and t.cliente_id=p_cliente_id and t.visita_id=p_visita_id and t.os_id=p_os_id for share of v,o nowait;
 if not found or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 return query select r.request_id,r.fence,r.tarefa_observada,r.motivo,r.criado_em from pcm.sso_t24_respostas_tardias r
  where r.tentativa_id=p_tentativa_id and (p_apos is null or r.request_id>p_apos) order by r.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_t24_listar_respostas_tardias(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_listar_respostas_tardias(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
