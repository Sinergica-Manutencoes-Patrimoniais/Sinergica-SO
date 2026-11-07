-- ADR-0548: decisão explícita por ocorrência preparada; não autoriza aprovação nem muda execução.
create table pcm.sso_decisao_impacto_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_decisao_impacto_revisao_gate enable row level security;alter table pcm.sso_decisao_impacto_revisao_gate force row level security;
revoke all on pcm.sso_decisao_impacto_revisao_gate from public,anon,authenticated,service_role;
insert into pcm.sso_decisao_impacto_revisao_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_impacto_ocorrencia (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),rascunho_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),revisao_plano integer not null,revisao integer not null check(revisao>0),
 decisao text not null check(decisao in ('manter_sem_alterar','exige_reconciliacao')),motivo text not null,fotografia jsonb not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(rascunho_id,preparada_id,revisao)
);
alter table pcm.sso_decisoes_impacto_ocorrencia enable row level security;alter table pcm.sso_decisoes_impacto_ocorrencia force row level security;
revoke all on pcm.sso_decisoes_impacto_ocorrencia from public,anon,authenticated,service_role;
create trigger sso_decisao_impacto_ocorrencia_imutavel before update or delete on pcm.sso_decisoes_impacto_ocorrencia for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_decidir_impacto_ocorrencia(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_ant pcm.sso_decisoes_impacto_ocorrencia%rowtype;v_previa jsonb;v_foto jsonb;v_rev integer;v_os jsonb;v_legada uuid;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_decisao_impacto_revisao_gate where id),false) then raise exception 'decisao_impacto_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_rascunho_id is null or p_preparada_id is null or p_expected_plano is null or p_expected_plano<1 or p_expected_decisao is null or p_expected_decisao<0 or p_decisao is null or p_decisao not in ('manter_sem_alterar','exige_reconciliacao') or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'rascunhoId',p_rascunho_id,'preparadaId',p_preparada_id,'revisaoPlano',p_expected_plano,'revisaoDecisao',p_expected_decisao,'decisao',p_decisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-impacto:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_decisoes_impacto_ocorrencia where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 if v_plano.revisao<>p_expected_plano then raise exception 'revisao_plano_obsoleta' using errcode='40001';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho_id::text then raise exception 'rascunho_nao_comprovado' using errcode='23514';end if;
 select * into v_prep from pcm.ocorrencias_rotina_preparadas where id=p_preparada_id and plano_id=p_plano_id and versao_id=(v_previa->>'versaoAnteriorId')::uuid for update;
 if not found then raise exception 'ocorrencia_origem_indisponivel' using errcode='23514';end if;
 select ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id=v_prep.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'updatedAt',updated_at) order by id),'[]'::jsonb) into v_os from (select id,status,updated_at from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada and client_id=p_cliente_id and deleted_at is null order by id limit 101) s;
 if jsonb_array_length(v_os)>100 then raise exception 'os_excedem_limite_reconciliacao' using errcode='23514';end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_impacto_ocorrencia where rascunho_id=p_rascunho_id and preparada_id=p_preparada_id;
 if v_rev<>p_expected_decisao then raise exception 'revisao_decisao_obsoleta' using errcode='40001';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_foto:=jsonb_build_object('preparada',to_jsonb(v_prep),'legadaId',v_legada,'os',v_os,'fontesIncompletas',true);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'revisao',v_rev+1,'revisaoPlano',v_plano.revisao,'decisao',p_decisao,'osObservadas',jsonb_array_length(v_os),'impactoIntegralComprovado',false,'aprovacaoAutorizada',false,'ocorrenciaAlterada',false,'osAlteradas',false);
 insert into pcm.sso_decisoes_impacto_ocorrencia(request_id,cliente_id,plano_id,rascunho_id,preparada_id,revisao_plano,revisao,decisao,motivo,fotografia,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,v_rev+1,p_decisao,v_motivo,v_foto,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.impacto_ocorrencia_decidido','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_impacto_ocorrencia(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_decisoes_impacto_ocorrencia(p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_apos uuid default null,p_limite integer default 20)
returns table(preparada_id uuid,rascunho_id uuid,rotina_id uuid,ciclo integer,vencimento_original date,revisao_decisao integer,ultima_decisao text,ultima_revisao_plano integer,ultimo_motivo text)
language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_rascunho uuid;
begin
 if not coalesce((select habilitado from pcm.sso_decisao_impacto_revisao_gate where id),false) then raise exception 'decisao_impacto_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 return query select o.id,v_rascunho,o.rotina_id,o.ciclo,o.vencimento_original,coalesce(d.revisao,0),d.decisao,d.revisao_plano,d.motivo from pcm.ocorrencias_rotina_preparadas o left join lateral (select x.* from pcm.sso_decisoes_impacto_ocorrencia x where x.rascunho_id=v_rascunho and x.preparada_id=o.id order by x.revisao desc limit 1) d on true where o.plano_id=p_plano_id and o.versao_id=v_origem and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_decisoes_impacto_ocorrencia(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
