-- ADR-1144: diagnóstico privado, não é autorização de execução.
create table pcm.sso_t24_diagnostico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_diagnostico_gate(id,habilitado) values(true,false);
alter table pcm.sso_t24_diagnostico_gate enable row level security;
alter table pcm.sso_t24_diagnostico_gate force row level security;
revoke all on pcm.sso_t24_diagnostico_gate from public,anon,authenticated,service_role;
create function pcm.sso_t24_diagnosticar_candidata(p_ator_id uuid,p_cliente_id uuid,p_tentativa_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;v pcm.visitas%rowtype;o pcm.ordens_servico%rowtype;
 bloqueios jsonb:=jsonb_build_array('contrato_auvo_nao_comprovado','executor_nao_integrado','ciencia_e_vinculo_nao_comprovados');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_tentativa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_diagnostico_gate where id and habilitado for share;
 if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v from pcm.visitas where id=t.visita_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into o from pcm.ordens_servico where id=t.os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if v.estado<>'confirmada' then bloqueios:=bloqueios||jsonb_build_array('visita_nao_confirmada'); end if;
 if v.revisao<>t.revisao_visita then bloqueios:=bloqueios||jsonb_build_array('revisao_visita_alterada'); end if;
 if statement_timestamp()<v.inicio_em-interval '24 hours' then bloqueios:=bloqueios||jsonb_build_array('fora_janela_t24'); end if;
 if t.elegivel_em is distinct from v.inicio_em-interval '24 hours' then bloqueios:=bloqueios||jsonb_build_array('janela_alterada'); end if;
 if o.status in ('finalizado','cancelado') then bloqueios:=bloqueios||jsonb_build_array('os_encerrada'); end if;
 if not exists(select 1 from pcm.visita_ordens_servico x where x.visita_id=v.id and x.os_id=o.id and x.cliente_id=p_cliente_id and x.encerrado_em is null) then bloqueios:=bloqueios||jsonb_build_array('vinculo_os_inativo'); end if;
 if not exists(select 1 from pcm.visita_confirmacoes c where c.visita_id=v.id and c.cliente_id=p_cliente_id and c.revisao=v.revisao) then bloqueios:=bloqueios||jsonb_build_array('confirmacao_pcm_ausente'); end if;
 if not pcm.sso_conteudo_basico_conferido(v.id,o.id) then bloqueios:=bloqueios||jsonb_build_array('conteudo_basico_nao_comprovado'); end if;
 if (t.operacao='criar' and o.auvo_task_id is not null) or (t.operacao='atualizar' and o.auvo_task_id::text is distinct from t.tarefa_id) then bloqueios:=bloqueios||jsonb_build_array('identidade_remota_divergente'); end if;
 if t.estado in ('iniciado','incerto','reconciliacao') then bloqueios:=bloqueios||jsonb_build_array('reconciliacao_necessaria'); end if;
 return jsonb_build_object('tentativaId',t.id,'visitaId',v.id,'osId',o.id,'revisaoObservada',v.revisao,
  'revisaoTentativa',t.revisao_visita,'estado',t.estado,'elegivelEm',t.elegivel_em,'bloqueios',bloqueios,'autorizaEnvio',false);
end; $$;
revoke all on function pcm.sso_t24_diagnosticar_candidata(uuid,uuid,uuid) from public,anon,authenticated,service_role;
