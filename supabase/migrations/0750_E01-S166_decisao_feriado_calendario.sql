-- ADR-0525: registro PCM sem alterar calendário ou estado operacional.
create table pcm.sso_decisao_feriado_calendario_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_decisao_feriado_calendario_gate enable row level security;alter table pcm.sso_decisao_feriado_calendario_gate force row level security;
revoke all on pcm.sso_decisao_feriado_calendario_gate from public,anon,authenticated,service_role;
insert into pcm.sso_decisao_feriado_calendario_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_feriado_calendario (
 request_id uuid primary key,cliente_id uuid not null,preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),feriado_id uuid not null references pcm.feriados_declarados(id),feriado_revisao integer not null,revisao integer not null check(revisao>0),
 decisao text not null check(decisao='manter_para_pcm'),motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(preparada_id,revisao)
);
alter table pcm.sso_decisoes_feriado_calendario enable row level security;alter table pcm.sso_decisoes_feriado_calendario force row level security;
revoke all on pcm.sso_decisoes_feriado_calendario from public,anon,authenticated,service_role;
create trigger sso_decisao_feriado_calendario_imutavel before update or delete on pcm.sso_decisoes_feriado_calendario for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_decidir_feriado_calendario(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_feriado_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_feriado pcm.feriados_declarados%rowtype;v_ant pcm.sso_decisoes_feriado_calendario%rowtype;v_rev integer;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_decisao_feriado_calendario_gate where id),false) or not coalesce((select habilitado from pcm.feriado_declarado_gate where id),false) then raise exception 'decisao_feriado_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_feriado_id is null or p_expected_revision is null or p_expected_revision<0 or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'feriadoId',p_feriado_id,'revisaoEsperada',p_expected_revision,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-feriado-calendario:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_decisoes_feriado_calendario where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select * into v_feriado from pcm.feriados_declarados where id=p_feriado_id and cliente_id=p_cliente_id and contrato_id is null and ativo and data=v_prep.vencimento_original for share;
 if not found then raise exception 'feriado_geral_nao_comprovado' using errcode='23514';end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_feriado_calendario where preparada_id=p_preparada_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'revisao',v_rev+1,'vencimentoOriginal',v_prep.vencimento_original,'feriadoRevisao',v_feriado.revisao,'decisao','manter_para_pcm','estadoOperacionalAlterado',false,'dataBaseAlterada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_decisoes_feriado_calendario(request_id,cliente_id,preparada_id,feriado_id,feriado_revisao,revisao,decisao,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,p_feriado_id,v_feriado.revisao,v_rev+1,'manter_para_pcm',v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.feriado_mantido_para_pcm','planos_manutencao',v_prep.plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_feriado_calendario(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_feriados_ciclo(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_indice integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_feriados jsonb;v_rev integer;
begin
 if not coalesce((select habilitado from pcm.sso_decisao_feriado_calendario_gate where id),false) then raise exception 'decisao_feriado_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_prep from pcm.ocorrencias_rotina_preparadas where plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and ciclo=p_indice;
 if not found then return jsonb_build_object('preparadaExiste',false,'feriados','[]'::jsonb,'fonteCompleta',false);end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_feriado_calendario where preparada_id=v_prep.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'fonte',fonte,'revisao',revisao) order by id),'[]'::jsonb) into v_feriados from pcm.feriados_declarados where cliente_id=p_cliente_id and contrato_id is null and ativo and data=v_prep.vencimento_original;
 return jsonb_build_object('preparadaExiste',true,'preparadaId',v_prep.id,'vencimentoOriginal',v_prep.vencimento_original,'revisao',v_rev,'feriados',v_feriados,'fonteCompleta',false);
end; $$;
revoke all on function pcm.sso_listar_feriados_ciclo(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
