-- ADR-0852: conferir a união dos vínculos, sem alterar as OS.
create or replace function pcm.sso_cancelar_chamado_conservador(p_request_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_expected_revision bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_chamado pcm.chamados%rowtype;v_ant pcm.sso_cancelamentos_chamado%rowtype;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_cancelamento_chamado_gate where id),false) then raise exception 'cancelamento_chamado_bloqueado' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'cancelamento_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_cancelamentos_chamado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_chamado.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_chamado.status='cancelado' or v_chamado.sso_encerrado_em is not null then raise exception 'chamado_nao_cancelavel' using errcode='23514'; end if;
 perform p.id from pcm.chamado_escopo_parcelas p where p.chamado_id=p_chamado_id order by p.id for update;
 perform c.id from pcm.chamado_continuacoes_propostas c where c.chamado_id=p_chamado_id order by c.id for update;
 perform o.id from pcm.ordens_servico o where (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.deleted_at is null order by o.id for update;
 perform pcm.sso_exigir_vinculo_chamado_consistente(p_cliente_id,p_chamado_id);
 if not exists(select 1 from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id and declarada_completa) or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id=p_chamado_id)
 or exists(select 1 from pcm.chamado_escopo_parcelas p left join pcm.ordens_servico o on o.id=p.os_atendimento_id and (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where p.chamado_id=p_chamado_id and (p.situacao<>'atendida' or o.id is null))
 or exists(select 1 from pcm.chamado_continuacoes_propostas c left join pcm.ordens_servico o on o.id=c.os_continuacao_id and (o.chamado_id=p_chamado_id or (o.id=v_chamado.ordem_servico_id and o.chamado_id is null)) and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where c.chamado_id=p_chamado_id and (c.situacao='pendente' or (c.situacao='executada' and o.id is null)))
 or exists(select 1 from pcm.ordens_servico where (chamado_id=p_chamado_id or (id=v_chamado.ordem_servico_id and chamado_id is null)) and deleted_at is null and (client_id is distinct from p_cliente_id or status is null or status not in ('finalizado','cancelado'))) then raise exception 'escopo_ou_os_pendente' using errcode='23514'; end if;
 if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.chamados set status='cancelado',cancelamento_justificativa=btrim(p_motivo),updated_at=now(),updated_by=v_actor where id=p_chamado_id returning * into v_chamado;
 insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(p_chamado_id,'cancelado',jsonb_build_object('justificativa',btrim(p_motivo),'requestId',p_request_id,'origem','sso_conservador'),v_actor);
 v_resultado:=jsonb_build_object('chamadoId',p_chamado_id,'revision',v_chamado.sso_revisao,'state','cancelado','osAlteradas',false,'requestId',p_request_id);
 insert into pcm.sso_cancelamentos_chamado(request_id,chamado_id,revisao_anterior,revisao_resultante,motivo,payload,resultado,ator_id) values(p_request_id,p_chamado_id,p_expected_revision,v_chamado.sso_revisao,btrim(p_motivo),v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.cancelamento_conservador','chamados',p_chamado_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_cancelar_chamado_conservador(uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
