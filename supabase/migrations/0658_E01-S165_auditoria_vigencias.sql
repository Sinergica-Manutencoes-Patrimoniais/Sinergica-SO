-- ADR-0432: diagnóstico de vigências e auditoria, sem mutação de versões.
create function pcm.sso_diagnosticar_vigencias_revisao(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_revision integer; v_aprovadas integer; v_rascunhos integer; v_inicio_indeterminado integer; v_sobreposicoes integer; v_aprovacoes integer; v_fins integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select revisao into v_revision from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or v_revision<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select count(*) filter(where estado='aprovado'),count(*) filter(where estado='rascunho'),count(*) filter(where estado='aprovado' and (vigencia_inicio is null or not isfinite(vigencia_inicio))) into v_aprovadas,v_rascunhos,v_inicio_indeterminado from pcm.plano_versoes where plano_id=p_plano_id;
 select count(*) into v_sobreposicoes from pcm.plano_versoes a join pcm.plano_versoes b on a.plano_id=b.plano_id and a.id<b.id and a.estado='aprovado' and b.estado='aprovado' and a.vigencia_inicio is not null and b.vigencia_inicio is not null and daterange(a.vigencia_inicio,a.vigencia_fim,'[]') && daterange(b.vigencia_inicio,b.vigencia_fim,'[]') where a.plano_id=p_plano_id;
 select count(*) filter(where action='plano.aprovado'),count(*) filter(where action='plano.vigencia_anterior_encerrada') into v_aprovacoes,v_fins from audit.events where entity='planos_manutencao' and entity_id=p_plano_id;
 return jsonb_build_object('revisao',v_revision,'versoesAprovadas',v_aprovadas,'rascunhos',v_rascunhos,'iniciosIndeterminados',v_inicio_indeterminado,'paresSobrepostos',v_sobreposicoes,'eventosAprovacaoEncontrados',v_aprovacoes,'eventosFimVigenciaEncontrados',v_fins,'auditoriaIntegralComprovada',false,'impactoCalculado',false,'aprovacaoAutorizada',false,'rascunhoAlterado',false);
end; $$;
revoke all on function pcm.sso_diagnosticar_vigencias_revisao(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_vigencias_revisao(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_apos integer default 0,p_limite integer default 20)
returns table(versao_id uuid,numero integer,estado text,vigencia_inicio date,vigencia_fim date,aprovada_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_revisao integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 select revisao into v_revisao from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<>v_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 return query select v.id,v.numero,v.estado,v.vigencia_inicio,v.vigencia_fim,v.aprovada_em from pcm.plano_versoes v where v.plano_id=p_plano_id and v.numero>p_apos order by v.numero limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_vigencias_revisao(uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
