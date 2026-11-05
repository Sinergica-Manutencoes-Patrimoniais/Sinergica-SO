-- ADR-1490: decisões de revisão para obrigações declaradas com origem PMOC.
create table pcm.sso_decisoes_impacto_pmoc(
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),rascunho_id uuid not null references pcm.plano_versoes(id),
 vinculo_id uuid not null references pcm.sso_vinculos_ciclo_pmoc(id),revisao_plano integer not null,revisao integer not null check(revisao>0),
 decisao text not null check(decisao in ('manter_pmoc','exige_reconciliacao')),motivo text not null,fotografia jsonb not null,
 ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(rascunho_id,vinculo_id,revisao)
);
create table pcm.sso_vinculo_pmoc_usos_versao(
 vinculo_id uuid not null references pcm.sso_vinculos_ciclo_pmoc(id),versao_id uuid not null references pcm.plano_versoes(id),
 decisao_request_id uuid not null references pcm.sso_decisoes_impacto_pmoc(request_id),vigencia date not null,criado_em timestamptz not null default now(),primary key(vinculo_id,versao_id)
);
create index sso_pmoc_usos_versao_idx on pcm.sso_vinculo_pmoc_usos_versao(versao_id,vinculo_id);
alter table pcm.sso_decisoes_impacto_pmoc enable row level security;alter table pcm.sso_decisoes_impacto_pmoc force row level security;
alter table pcm.sso_vinculo_pmoc_usos_versao enable row level security;alter table pcm.sso_vinculo_pmoc_usos_versao force row level security;
revoke all on pcm.sso_decisoes_impacto_pmoc,pcm.sso_vinculo_pmoc_usos_versao from public,anon,authenticated,service_role;
create trigger sso_decisao_impacto_pmoc_imutavel before update or delete on pcm.sso_decisoes_impacto_pmoc for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_uso_pmoc_versao_imutavel before update or delete on pcm.sso_vinculo_pmoc_usos_versao for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_foto_impacto_pmoc(p_cliente uuid,p_vinculo uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('vinculoId',v.id,'agendamentoId',v.agendamento_id,'vencimento',v.vencimento,
  'agendamento',case when s.id is null then null else jsonb_build_object('id',s.id,'contratoId',s.contract_id,'imovelId',s.property_id,'data',s.scheduled_date,'tipo',s.maintenance_type,'estado',s.status,'registroId',s.record_id,'auvoOsId',s.auvo_os_id) end,
  'imovelConferidoId',p.id,'contratoConferidoId',c.id,'imovelClienteId',p.client_id,'imovelExcluidoEm',p.deleted_at,'contratoExcluidoEm',c.deleted_at,
  'decisaoAtualId',(select d.id from pcm.sso_decisoes_proposta_pmoc d where d.proposta_id=v.proposta_id order by d.revisao desc limit 1),
  'origem',(select g.origem from pcm.rotina_origem_geracao g where g.rotina_logica_id=v.rotina_logica_id and g.alvo_tipo=v.alvo_tipo and g.alvo_id=v.alvo_id))
 from pcm.sso_vinculos_ciclo_pmoc v left join pcm.pmoc_schedules s on s.id=v.agendamento_id
 left join pcm.pmoc_properties p on p.id=s.property_id left join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=p.id
 where v.cliente_id=p_cliente and v.id=p_vinculo;
$$;
revoke all on function pcm.sso_foto_impacto_pmoc(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_impactos_pmoc_revisao(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_apos uuid,p_limite integer)
returns table(vinculo_id uuid,rascunho_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento date,agendamento_id uuid,revisao_decisao integer,ultima_decisao text,ultima_revisao_plano integer,fotografia jsonb)
language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_rascunho uuid;
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 return query select v.id,v_rascunho,v.rotina_id,v.alvo_tipo,v.alvo_id,v.vencimento,v.agendamento_id,coalesce(d.revisao,0),d.decisao,d.revisao_plano,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)
 from pcm.sso_vinculos_ciclo_pmoc v left join lateral (select x.* from pcm.sso_decisoes_impacto_pmoc x where x.rascunho_id=v_rascunho and x.vinculo_id=v.id order by x.revisao desc limit 1) d on true
 where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem)) and (p_apos is null or v.id>p_apos) order by v.id limit p_limite;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_impactos_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_impactos_pmoc_revisao(uuid,uuid,uuid,integer,uuid,integer) to authenticated;

create function pcm.sso_decidir_impacto_pmoc(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_vinculo_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text,p_expected_fotografia jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_decisoes_impacto_pmoc%rowtype;v_vinculo pcm.sso_vinculos_ciclo_pmoc%rowtype;v_previa jsonb;v_origem uuid;v_rev integer;v_foto jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_expected_fotografia is null or jsonb_typeof(p_expected_fotografia)<>'object' or p_request_id is null or p_rascunho_id is null or p_vinculo_id is null or p_expected_plano is null or p_expected_plano<1 or p_expected_decisao is null or p_expected_decisao<0 or p_decisao is null or p_decisao not in ('manter_pmoc','exige_reconciliacao') or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-pmoc:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'rascunhoId',p_rascunho_id,'vinculoId',p_vinculo_id,'revisaoPlano',p_expected_plano,'revisaoDecisao',p_expected_decisao,'decisao',p_decisao,'motivo',v_motivo,'fotografiaEsperada',p_expected_fotografia);
 select * into v_ant from pcm.sso_decisoes_impacto_pmoc where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho_id::text then raise exception 'rascunho_indisponivel' using errcode='23514'; end if;
 select * into v_vinculo from pcm.sso_vinculos_ciclo_pmoc v where v.id=p_vinculo_id and v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem));
 if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_decisoes_proposta_pmoc,pcm.rotina_origem_geracao in share mode nowait;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_decisoes_impacto_pmoc where rascunho_id=p_rascunho_id and vinculo_id=p_vinculo_id;
 if v_rev<>p_expected_decisao then raise exception 'revisao_decisao_obsoleta' using errcode='40001'; end if;
 v_foto:=pcm.sso_foto_impacto_pmoc(p_cliente_id,p_vinculo_id);
 if v_foto is null then raise exception 'fotografia_indisponivel' using errcode='23514'; end if;
 if v_foto is distinct from p_expected_fotografia then raise exception 'fotografia_pmoc_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'vinculoId',p_vinculo_id,'revisaoPlano',p_expected_plano,'revisao',v_rev+1,'decisao',p_decisao,'aprovacaoAutorizada',false,'agendamentoAlterado',false,'osAlteradas',false);
 insert into pcm.sso_decisoes_impacto_pmoc(request_id,cliente_id,plano_id,rascunho_id,vinculo_id,revisao_plano,revisao,decisao,motivo,fotografia,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_vinculo_id,p_expected_plano,v_rev+1,p_decisao,v_motivo,v_foto,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'plano.impacto_pmoc_decidido','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_impacto_pmoc(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_impacto_pmoc(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,jsonb) to authenticated;

create function pcm.sso_foto_pmoc_valida(p_cliente uuid,p_vinculo uuid,p_foto jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(p_foto->>'vinculoId'=v.id::text and p_foto->>'agendamentoId'=v.agendamento_id::text
  and p_foto->'agendamento'->>'contratoId'=v.contrato_pmoc_id::text and p_foto->'agendamento'->>'data'=v.vencimento::text
  and p_foto->'agendamento'->>'estado'<>'cancelado' and p_foto->>'imovelConferidoId'=p_foto->'agendamento'->>'imovelId' and p_foto->>'contratoConferidoId'=v.contrato_pmoc_id::text and p_foto->>'imovelClienteId'=p_cliente::text
  and p_foto->'imovelExcluidoEm'='null'::jsonb and p_foto->'contratoExcluidoEm'='null'::jsonb
  and p_foto->>'decisaoAtualId'=v.decisao_id::text and p_foto->>'origem'='pmoc'
  and exists(select 1 from pcm.sso_decisoes_proposta_pmoc d where d.id=v.decisao_id and d.decisao='validada_pcm'),false)
 from pcm.sso_vinculos_ciclo_pmoc v where v.id=p_vinculo and v.cliente_id=p_cliente;
$$;
revoke all on function pcm.sso_foto_pmoc_valida(uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function pcm.sso_avaliar_impacto_pmoc_privado(p_cliente uuid,p_plano uuid,p_expected integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_rascunho uuid;v_total bigint;v_ausentes bigint;v_obsoletas bigint;v_reconciliar bigint;v_invalidos bigint;
begin
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano,p_expected,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 with itens as (
  select v.id,d.request_id,d.revisao_plano,d.decisao,d.fotografia,pcm.sso_foto_impacto_pmoc(p_cliente,v.id) atual
  from pcm.sso_vinculos_ciclo_pmoc v left join lateral (select x.* from pcm.sso_decisoes_impacto_pmoc x where x.rascunho_id=v_rascunho and x.vinculo_id=v.id order by x.revisao desc limit 1) d on true
  where v.cliente_id=p_cliente and v.plano_id=p_plano and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem))
 ) select count(*),count(*) filter(where request_id is null),count(*) filter(where request_id is not null and (revisao_plano is distinct from p_expected or fotografia is distinct from atual)),count(*) filter(where decisao='exige_reconciliacao'),count(*) filter(where pcm.sso_foto_pmoc_valida(p_cliente,id,atual) is distinct from true)
 into v_total,v_ausentes,v_obsoletas,v_reconciliar,v_invalidos from itens;
 return jsonb_build_object('revisaoPlano',p_expected,'vinculosObservados',v_total,'decisoesAusentes',v_ausentes,'decisoesObsoletas',v_obsoletas,'exigemReconciliacao',v_reconciliar,'vinculosInvalidos',v_invalidos,'fontesCompletas',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_avaliar_impacto_pmoc_privado(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_avaliar_impacto_pmoc(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 r:=pcm.sso_avaliar_impacto_pmoc_privado(p_cliente_id,p_plano_id,p_expected_plano);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;return r;
end; $$;
revoke all on function pcm.sso_avaliar_impacto_pmoc(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_avaliar_impacto_pmoc(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_registrar_usos_pmoc_aprovados() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_origem uuid;v_rascunho uuid;v_avaliacao jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new; end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_origem is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514'; end if;
 lock table pcm.sso_vinculos_ciclo_pmoc,pcm.sso_vinculo_pmoc_usos_versao,pcm.sso_decisoes_impacto_pmoc,pcm.sso_decisoes_proposta_pmoc,pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.rotina_origem_geracao in share mode nowait;
 if not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=v_plano.cliente_id and v.plano_id=new.plano_id and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem))) then return new; end if;
 perform pcm.sso_conferir_pmoc_mediado(auth.uid(),v_plano.cliente_id,false);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'protocolo_impacto_indisponivel' using errcode='55P03'; end if;
 v_avaliacao:=pcm.sso_avaliar_impacto_pmoc_privado(v_plano.cliente_id,new.plano_id,v_plano.revisao);
 if (v_avaliacao->>'decisoesAusentes')::bigint is distinct from 0 or (v_avaliacao->>'decisoesObsoletas')::bigint is distinct from 0 or (v_avaliacao->>'exigemReconciliacao')::bigint is distinct from 0 or (v_avaliacao->>'vinculosInvalidos')::bigint is distinct from 0 then raise exception 'impacto_pmoc_pendente' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v join lateral (select x.* from pcm.sso_decisoes_impacto_pmoc x where x.rascunho_id=v_rascunho and x.vinculo_id=v.id order by x.revisao desc limit 1) d on true
  where v.cliente_id=v_plano.cliente_id and v.plano_id=new.plano_id and v.vencimento>=new.vigencia_inicio and d.decisao='manter_pmoc' and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem))
   and not exists(select 1 from pcm.rotinas_manutencao r where r.plano_id=new.plano_id and r.versao_id=v_rascunho and r.rotina_logica_id=v.rotina_logica_id and r.alvo_tipo=v.alvo_tipo and coalesce(r.sistema_id,r.equipamento_id,r.grupo_id)=v.alvo_id)) then raise exception 'escopo_pmoc_retirado_exige_reconciliacao' using errcode='23514'; end if;
 insert into pcm.sso_vinculo_pmoc_usos_versao(vinculo_id,versao_id,decisao_request_id,vigencia)
 select v.id,v_rascunho,d.request_id,new.vigencia_inicio from pcm.sso_vinculos_ciclo_pmoc v join lateral (select x.* from pcm.sso_decisoes_impacto_pmoc x where x.rascunho_id=v_rascunho and x.vinculo_id=v.id order by x.revisao desc limit 1) d on true
 where v.cliente_id=v_plano.cliente_id and v.plano_id=new.plano_id and v.vencimento>=new.vigencia_inicio and d.decisao='manter_pmoc' and (v.versao_id=v_origem or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=v_origem));
 return new;
end; $$;
revoke all on function pcm.sso_registrar_usos_pmoc_aprovados() from public,anon,authenticated,service_role;
create trigger sso_usos_pmoc_na_aprovacao after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_registrar_usos_pmoc_aprovados();
