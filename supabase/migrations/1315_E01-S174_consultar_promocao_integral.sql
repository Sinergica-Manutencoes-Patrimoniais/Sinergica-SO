-- ADR-1146: leitura privada; não executa promoção nem altera OS.
create table pcm.sso_consulta_promocao_integral_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_promocao_integral_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_promocao_integral_gate enable row level security;
alter table pcm.sso_consulta_promocao_integral_gate force row level security;
revoke all on pcm.sso_consulta_promocao_integral_gate from public,anon,authenticated,service_role;
create function pcm.sso_consultar_promocao_retorno_integral(p_ator_id uuid,p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_promocoes_retorno%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_retorno_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_consulta_promocao_integral_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_retornos_ciclo_backlog where id=p_retorno_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v from pcm.sso_promocoes_retorno where retorno_id=p_retorno_id and cliente_id=p_cliente_id;
 if not found then return null; end if;
 perform 1 from pcm.chamados where id=v.chamado_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.chamados where id::text=v.resultado->>'chamadoAnteriorId' and cliente_id=p_cliente_id for share;
 if not found or config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 return v.resultado;
end; $$;
revoke all on function pcm.sso_consultar_promocao_retorno_integral(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_promocao_retorno_integral(uuid,uuid,uuid) to authenticated;
