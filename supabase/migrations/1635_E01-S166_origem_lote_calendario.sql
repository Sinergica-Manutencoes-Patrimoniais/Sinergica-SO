-- ADR-1492: classificação e guarda transacional de origem do lote.
create table pcm.sso_origem_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origem_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_lote_gate enable row level security;alter table pcm.sso_origem_lote_gate force row level security;
revoke all on pcm.sso_origem_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_origens_lote_calendario(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_inicio date,p_fim date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_linha record;v_origem jsonb;v_itens jsonb:='[]'::jsonb;v_total integer:=0;
begin
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>30 then raise exception 'janela_invalida' using errcode='22023'; end if;
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,false);
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_revision for share;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 for v_linha in select * from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim) order by ciclo loop
  v_total:=v_total+1;if v_total>31 then raise exception 'lote_excede_limite' using errcode='23514'; end if;
  v_origem:=pcm.sso_consultar_origem_efetiva_ciclo(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,v_linha.vencimento);
  if (v_origem->>'ciclo')::integer is distinct from v_linha.ciclo then raise exception 'ciclo_divergente' using errcode='23514'; end if;
  v_itens:=v_itens||jsonb_build_array(jsonb_build_object('ciclo',v_linha.ciclo,'vencimento',v_linha.vencimento,'estado',v_origem->>'estado','agendamentoId',v_origem->'agendamentoId'));
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('revisao',p_expected_revision,'inicio',p_inicio,'fim',p_fim,'itens',v_itens,'fontesCompletas',false,'exclusividadeGlobalComprovada',false);
end; $$;
revoke all on function pcm.sso_origens_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_origens_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date) to authenticated;
create function pcm.sso_exigir_origem_plano_lote(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_revisao integer,p_vencimento date)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_origem jsonb;
begin
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then return; end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;if not found then raise exception 'protocolo_concorrencia_indisponivel' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
 v_origem:=pcm.sso_consultar_origem_efetiva_ciclo(auth.uid(),p_cliente,p_plano,p_versao,p_rotina,p_revisao,p_vencimento);
 if v_origem->>'estado' is distinct from 'plano' then raise exception 'origem_lote_exige_reconciliacao' using errcode='23514'; end if;
end; $$;
revoke all on function pcm.sso_exigir_origem_plano_lote(uuid,uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date)'::regprocedure);
 v_antes text:=$antes$  v_unico:=pcm.sso_materializar_ciclo_canonico(gen_random_uuid(),p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,v_linha.vencimento);$antes$;
 v_depois text:=$depois$  perform pcm.sso_exigir_origem_plano_lote(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,v_linha.vencimento);
  v_unico:=pcm.sso_materializar_ciclo_canonico(gen_random_uuid(),p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,v_linha.vencimento);$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_lote_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
