-- ADR-1493: classificação auditada de todos os agendamentos PMOC do Cliente.
create table pcm.sso_classificacoes_pmoc_revisao(
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),rascunho_id uuid not null references pcm.plano_versoes(id),
 agendamento_id uuid not null references pcm.pmoc_schedules(id),revisao_plano integer not null,revisao integer not null check(revisao>0),
 classificacao text not null check(classificacao in ('relacionado','nao_relacionado','historico_preservado')),evidencia text not null,motivo text not null,fotografia jsonb not null,
 ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(rascunho_id,agendamento_id,revisao)
);
create index sso_classificacoes_pmoc_busca_idx on pcm.sso_classificacoes_pmoc_revisao(rascunho_id,agendamento_id,revisao desc);
alter table pcm.sso_classificacoes_pmoc_revisao enable row level security;alter table pcm.sso_classificacoes_pmoc_revisao force row level security;
revoke all on pcm.sso_classificacoes_pmoc_revisao from public,anon,authenticated,service_role;
create trigger sso_classificacoes_pmoc_imutaveis before update or delete on pcm.sso_classificacoes_pmoc_revisao for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_foto_inventario_pmoc(p_cliente uuid,p_agendamento uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'imovelId',s.property_id,'contratoId',s.contract_id,'data',s.scheduled_date,'tipo',s.maintenance_type,'estado',s.status,'registroId',s.record_id,'auvoOsId',s.auvo_os_id,
  'clienteId',p.client_id,'imovelNome',p.name,'imovelExcluidoEm',p.deleted_at,'imovelAtualizadoEm',p.updated_at,'contratoConferidoId',c.id,'contratoInicio',c.start_date,'contratoFim',c.end_date,'contratoEstado',c.status,'contratoExcluidoEm',c.deleted_at,'contratoAtualizadoEm',c.updated_at)
 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente left join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=p.id where s.id=p_agendamento;
$$;
revoke all on function pcm.sso_foto_inventario_pmoc(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_inventario_pmoc_revisao(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_apos uuid,p_limite integer)
returns table(agendamento_id uuid,rascunho_id uuid,vencimento date,estado text,tipo text,revisao_decisao integer,classificacao text,revisao_plano integer,fotografia_atual boolean,fotografia jsonb,evidencia text,motivo text)
language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_rascunho uuid;
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 return query select s.id,v_rascunho,s.scheduled_date,s.status,s.maintenance_type,coalesce(d.revisao,0),d.classificacao,d.revisao_plano,
  coalesce(d.fotografia=pcm.sso_foto_inventario_pmoc(p_cliente_id,s.id),false),pcm.sso_foto_inventario_pmoc(p_cliente_id,s.id),d.evidencia,d.motivo
 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id
 left join lateral (select x.* from pcm.sso_classificacoes_pmoc_revisao x where x.rascunho_id=v_rascunho and x.agendamento_id=s.id order by x.revisao desc limit 1) d on true
 where p_apos is null or s.id>p_apos order by s.id limit p_limite;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_inventario_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_inventario_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer) to authenticated;

create function pcm.sso_classificar_pmoc_revisao(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_agendamento_id uuid,p_expected_plano integer,p_expected_decisao integer,p_classificacao text,p_evidencia text,p_motivo text,p_expected_fotografia jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_ant pcm.sso_classificacoes_pmoc_revisao%rowtype;v_foto jsonb;v_rev integer;v_payload jsonb;v_resultado jsonb;v_evidencia text:=nullif(btrim(p_evidencia),'');v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_expected_fotografia is null or jsonb_typeof(p_expected_fotografia)<>'object' or p_request_id is null or p_rascunho_id is null or p_agendamento_id is null or p_expected_plano is null or p_expected_plano<1 or p_expected_decisao is null or p_expected_decisao<0 or p_classificacao is null or p_classificacao not in ('relacionado','nao_relacionado','historico_preservado') or v_evidencia is null or length(v_evidencia)>500 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true);
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-inventario-pmoc:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'rascunhoId',p_rascunho_id,'agendamentoId',p_agendamento_id,'revisaoPlano',p_expected_plano,'revisaoDecisao',p_expected_decisao,'classificacao',p_classificacao,'evidencia',v_evidencia,'motivo',v_motivo,'fotografiaEsperada',p_expected_fotografia);
 select * into v_ant from pcm.sso_classificacoes_pmoc_revisao where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho_id::text then raise exception 'rascunho_indisponivel' using errcode='23514'; end if;
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_vinculos_ciclo_pmoc,pcm.sso_decisoes_proposta_pmoc,pcm.rotina_origem_geracao in share mode nowait;
 v_foto:=pcm.sso_foto_inventario_pmoc(p_cliente_id,p_agendamento_id);
 if v_foto is null then raise exception 'agendamento_indisponivel' using errcode='42501'; end if;
 if v_foto is distinct from p_expected_fotografia then raise exception 'fotografia_pmoc_alterada' using errcode='40001'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_classificacoes_pmoc_revisao where rascunho_id=p_rascunho_id and agendamento_id=p_agendamento_id;
 if v_rev<>p_expected_decisao then raise exception 'revisao_decisao_obsoleta' using errcode='40001'; end if;
 if p_classificacao='relacionado' and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=p_agendamento_id and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true) then raise exception 'vinculo_pmoc_atual_necessario' using errcode='23514'; end if;
 if p_classificacao in ('nao_relacionado','historico_preservado') and exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=p_agendamento_id and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true) then raise exception 'classificacao_diverge_de_vinculo_atual' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'agendamentoId',p_agendamento_id,'revisaoPlano',p_expected_plano,'revisao',v_rev+1,'classificacao',p_classificacao,'aprovacaoAutorizada',false,'agendamentoAlterado',false,'osAlteradas',false);
 insert into pcm.sso_classificacoes_pmoc_revisao(request_id,cliente_id,plano_id,rascunho_id,agendamento_id,revisao_plano,revisao,classificacao,evidencia,motivo,fotografia,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_agendamento_id,p_expected_plano,v_rev+1,p_classificacao,v_evidencia,v_motivo,v_foto,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'plano.pmoc_classificado_revisao','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('evidencia',v_evidencia,'motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_classificar_pmoc_revisao(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificar_pmoc_revisao(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb) to authenticated;

create function pcm.sso_avaliar_inventario_pmoc_privado(p_cliente uuid,p_plano uuid,p_expected integer,p_vigencia date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_rascunho uuid;v_total bigint;v_ausentes bigint;v_obsoletas bigint;v_inconsistentes bigint;v_historicos_futuros bigint;v_relacoes_divergentes bigint;
begin
 if p_vigencia is null or not isfinite(p_vigencia) then raise exception 'vigencia_invalida' using errcode='22023'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano,p_expected,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 with itens as (
  select s.id,s.scheduled_date,s.status,d.request_id,d.revisao_plano,d.classificacao,d.fotografia,pcm.sso_foto_inventario_pmoc(p_cliente,s.id) atual,
   exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente and v.plano_id=p_plano and v.agendamento_id=s.id and pcm.sso_foto_pmoc_valida(p_cliente,v.id,pcm.sso_foto_impacto_pmoc(p_cliente,v.id)) is true) vinculo_atual
  from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente
  left join lateral (select x.* from pcm.sso_classificacoes_pmoc_revisao x where x.rascunho_id=v_rascunho and x.agendamento_id=s.id order by x.revisao desc limit 1) d on true
 ) select count(*),count(*) filter(where request_id is null),count(*) filter(where request_id is not null and (revisao_plano is distinct from p_expected or fotografia is distinct from atual)),
 count(*) filter(where atual->>'contratoConferidoId' is distinct from atual->>'contratoId' or (status<>'cancelado' and scheduled_date>=p_vigencia and (atual->>'imovelExcluidoEm' is not null or atual->>'contratoExcluidoEm' is not null))),
 count(*) filter(where classificacao='historico_preservado' and scheduled_date>=p_vigencia and status<>'cancelado'),
 count(*) filter(where (classificacao='relacionado' and not vinculo_atual) or (classificacao in ('nao_relacionado','historico_preservado') and vinculo_atual))
 into v_total,v_ausentes,v_obsoletas,v_inconsistentes,v_historicos_futuros,v_relacoes_divergentes from itens;
 return jsonb_build_object('revisaoPlano',p_expected,'vigencia',p_vigencia,'agendamentosObservados',v_total,'classificacoesAusentes',v_ausentes,'classificacoesObsoletas',v_obsoletas,'cadeiasInconsistentes',v_inconsistentes,'historicosFuturos',v_historicos_futuros,'relacoesDivergentes',v_relacoes_divergentes,'classificacaoHumana',true,'fontesExternasComprovadas',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_avaliar_inventario_pmoc_privado(uuid,uuid,integer,date) from public,anon,authenticated,service_role;
create function pcm.sso_avaliar_inventario_pmoc(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_vigencia date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 r:=pcm.sso_avaliar_inventario_pmoc_privado(p_cliente_id,p_plano_id,p_expected_plano,p_vigencia);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return r;
end; $$;
revoke all on function pcm.sso_avaliar_inventario_pmoc(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_avaliar_inventario_pmoc(uuid,uuid,uuid,integer,date) to authenticated;

create function pcm.sso_exigir_inventario_pmoc_aprovacao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_resumo jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new; end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_classificacoes_pmoc_revisao,pcm.sso_vinculos_ciclo_pmoc,pcm.sso_decisoes_proposta_pmoc,pcm.rotina_origem_geracao in share mode nowait;
 if not exists(select 1 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id where p.client_id=v_plano.cliente_id) then return new; end if;
 perform pcm.sso_conferir_pmoc_mediado(auth.uid(),v_plano.cliente_id,false);
 v_resumo:=pcm.sso_avaliar_inventario_pmoc_privado(v_plano.cliente_id,new.plano_id,v_plano.revisao,new.vigencia_inicio);
 if (v_resumo->>'classificacoesAusentes')::bigint is distinct from 0 or (v_resumo->>'classificacoesObsoletas')::bigint is distinct from 0 or (v_resumo->>'cadeiasInconsistentes')::bigint is distinct from 0 or (v_resumo->>'historicosFuturos')::bigint is distinct from 0 or (v_resumo->>'relacoesDivergentes')::bigint is distinct from 0 then raise exception 'inventario_pmoc_pendente' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_exigir_inventario_pmoc_aprovacao() from public,anon,authenticated,service_role;
create trigger sso_inventario_pmoc_na_aprovacao after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_exigir_inventario_pmoc_aprovacao();
