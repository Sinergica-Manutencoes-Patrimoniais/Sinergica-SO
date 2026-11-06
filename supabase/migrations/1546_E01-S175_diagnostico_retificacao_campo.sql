-- ADR-1401: diagnóstico não substitui a guarda transacional de retificação.
create table pcm.sso_diagnostico_retificacao_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_retificacao_campo_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_retificacao_campo_gate enable row level security;
alter table pcm.sso_diagnostico_retificacao_campo_gate force row level security;
revoke all on pcm.sso_diagnostico_retificacao_campo_gate from public,anon,authenticated,service_role;

create function pcm.sso_diagnosticar_retificacao_campo(p_cliente_id uuid,p_envelope_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_triagem pcm.sso_origem_campo_triagens%rowtype;v_env pcm.origem_campo_inbox%rowtype;v_recebido boolean;v_processado boolean;
begin
 perform pcm.sso_conferir_triagem_mediada(false);
 perform 1 from pcm.sso_diagnostico_retificacao_campo_gate where id and habilitado for share;
 if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if p_cliente_id is null or p_envelope_id is null or p_expected_revision is null or p_expected_revision<1
   or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_triagem from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_triagem.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_env from pcm.origem_campo_inbox where id=p_envelope_id;
 if not found then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
 select exists(select 1 from pcm.sso_recepcao_envelope_campo r join pcm.origem_campo_inbox i on i.id=r.envelope_id
   where r.envelope_id=p_envelope_id or (v_env.integracao='auvo' and i.integracao=v_env.integracao and i.task_id=v_env.task_id)) into v_recebido;
 select exists(select 1 from pcm.sso_origem_campo_processamentos p where p.integracao=v_env.integracao and p.task_id=v_env.task_id) into v_processado;
 if config.sso_autorizar_triagem_global() is distinct from true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('envelopeId',p_envelope_id,'clienteId',p_cliente_id,'revision',v_triagem.revisao,'recepcaoConhecida',v_recebido,'processamentoConhecido',v_processado,'coberturaCompleta',false);
end; $$;
revoke all on function pcm.sso_diagnosticar_retificacao_campo(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_retificacao_campo(uuid,uuid,integer) to authenticated;
