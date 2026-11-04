-- ADR-1127: não oferecer ocorrência suprimida para materialização legada.
create or replace function pcm.sso_listar_visitas_integracao_legado(p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_relacao_request_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(preparada_id uuid,visita_id uuid,serie_id uuid,semana_origem date,vencimento_original date,alvo_tipo text,alvo_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_materializar_visita_legado_gate where id),false) then raise exception 'materializacao_visita_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) or not exists(select 1 from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 if not exists(select 1 from pcm.sso_declaracoes_planos_legados d where d.request_id=p_relacao_request_id and d.plano_id=p_plano_id and d.plano_legado_id=p_legado_id and d.cliente_id=p_cliente_id and d.decisao='declarar' and d.revisao=(select max(e.revisao) from pcm.sso_declaracoes_planos_legados e where e.plano_id=p_plano_id and e.plano_legado_id=p_legado_id)) then raise exception 'relacao_nao_atual' using errcode='23514';end if;
 return query select o.id,o.visita_id,o.serie_id,o.semana_origem,o.vencimento_original,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado sv where sv.visita_id=o.visita_id and sv.cliente_id=p_cliente_id) and (p_apos is null or o.id>p_apos) and not exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_visita_id=o.id) order by o.id limit p_limite;
end; $$;

