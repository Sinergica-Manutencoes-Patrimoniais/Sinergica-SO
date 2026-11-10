-- ADR-1433: vínculo histórico explícito; não altera OS ou Plano aprovado.
create table pcm.sso_referencia_tarefa_legada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_referencia_tarefa_legada_gate(id,habilitado) values(true,false);
create table pcm.sso_referencias_tarefa_legada(
 request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id), plano_legado_id uuid not null references pcm.planos_preventivos(id),
 rotina_id uuid not null references pcm.rotinas_manutencao(id), versao_id uuid not null references pcm.plano_versoes(id),
 tipo_tarefa_id uuid not null references pcm.tipos_tarefa(id), ator_id uuid not null references auth.users(id), payload jsonb not null, resultado jsonb not null,
 criado_em timestamptz not null default now(), unique(rotina_id)
);
alter table pcm.sso_referencia_tarefa_legada_gate enable row level security;alter table pcm.sso_referencia_tarefa_legada_gate force row level security;
alter table pcm.sso_referencias_tarefa_legada enable row level security;alter table pcm.sso_referencias_tarefa_legada force row level security;
revoke all on pcm.sso_referencia_tarefa_legada_gate,pcm.sso_referencias_tarefa_legada from public,anon,authenticated,service_role;
create trigger sso_referencias_tarefa_legada_imutavel before update or delete on pcm.sso_referencias_tarefa_legada for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_referencia_tarefa_legada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_plano_legado_id uuid,p_expected_revision integer,p_tipo_tarefa_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_referencias_tarefa_legada%rowtype;v_mapa pcm.sso_rascunhos_planos_legados%rowtype;v_origem pcm.planos_preventivos%rowtype;
 v_plano pcm.planos_manutencao%rowtype;v_payload jsonb;v_resultado jsonb;
begin
 perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);
 perform 1 from pcm.sso_referencia_tarefa_legada_gate where id and habilitado for share;
 if not found then raise exception 'referencia_desabilitada' using errcode='55000'; end if;
 if p_request_id is null or p_plano_legado_id is null or p_expected_revision is null or p_expected_revision<1 or p_tipo_tarefa_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoLegadoId',p_plano_legado_id,'expectedRevision',p_expected_revision,'tipoTarefaId',p_tipo_tarefa_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('referencia-tarefa-legada:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_referencias_tarefa_legada where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 select * into v_origem from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 select * into v_mapa from pcm.sso_rascunhos_planos_legados where plano_legado_id=p_plano_legado_id and cliente_id=p_cliente_id for share;
 if not found or to_jsonb(v_origem) is distinct from v_mapa.payload->'fotografia' or v_origem.tipo_tarefa_id is distinct from p_tipo_tarefa_id then raise exception 'origem_alterada' using errcode='40001'; end if;
 select * into v_plano from pcm.planos_manutencao where id=v_mapa.plano_id and cliente_id=p_cliente_id for update;
 if not found or v_plano.estado<>'rascunho' or v_plano.revisao<>p_expected_revision then raise exception 'rascunho_alterado' using errcode='40001'; end if;
 perform 1 from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id where r.id=v_mapa.rotina_id and r.plano_id=v_plano.id and v.id=v_mapa.versao_id and v.numero=1 and v.estado='rascunho' for share of r,v;
 if not found then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.tipos_tarefa where id=p_tipo_tarefa_id for share;
 if not found then raise exception 'tipo_tarefa_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_referencias_tarefa_legada where rotina_id=v_mapa.rotina_id) then raise exception 'referencia_existente' using errcode='23505'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_legado_id,'rotinaId',v_mapa.rotina_id,'versaoId',v_mapa.versao_id,'tipoTarefaId',p_tipo_tarefa_id,'osAlterada',false,'envioAuvo',false);
 insert into pcm.sso_referencias_tarefa_legada(request_id,cliente_id,plano_legado_id,rotina_id,versao_id,tipo_tarefa_id,ator_id,payload,resultado)
 values(p_request_id,p_cliente_id,p_plano_legado_id,v_mapa.rotina_id,v_mapa.versao_id,p_tipo_tarefa_id,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.tipo_tarefa_legado_registrado','planos_manutencao',v_plano.id,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_referencia_tarefa_legada(uuid,uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_referencia_tarefa_legada(uuid,uuid,uuid,uuid,integer,uuid) to authenticated;
