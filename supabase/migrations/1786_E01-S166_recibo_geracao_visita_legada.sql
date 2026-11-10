-- ADR-1644: somente replay comprovado; nunca cria Visita nem suprime semana.
create function pcm.sso_recibo_geracao_visita_legada(p_ator uuid,p_request uuid,p_cliente uuid,p_serie uuid,p_regra uuid,p_semana date,p_visita uuid,p_inicio timestamptz,p_responsavel uuid,p_cobertura text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_geracao_visita_contratual%rowtype; v_payload jsonb;
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_request is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 perform 1 from pcm.sso_acesso_geracao_visita_gate where id and habilitado for share;
 if not found then raise exception 'acesso_geracao_visita_bloqueado' using errcode='55000';end if;
 perform 1 from pcm.sso_gerar_visita_contratual_gate where id and habilitado for share;
 if not found then raise exception 'geracao_visita_bloqueada' using errcode='55000';end if;
 perform 1 from pcm.feriado_declarado_gate where id and habilitado for share;
 if not found then raise exception 'geracao_visita_bloqueada' using errcode='55000';end if;
 perform 1 from pcm.sso_origem_contratual_unica_gate where id and habilitado for share;
 if not found then raise exception 'geracao_visita_bloqueada' using errcode='55000';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('visita-contratual-request:'||p_request::text,0)) then raise exception 'pedido_em_alteracao' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente,'serieId',p_serie,'regraId',p_regra,'semana',p_semana,'visitaId',p_visita,'inicioEm',p_inicio,'responsavelId',p_responsavel,'coberturaDeclarada',nullif(btrim(p_cobertura),''));
 select * into v from pcm.sso_geracao_visita_contratual where request_id=p_request;
 if not found then raise exception 'recibo_legado_indisponivel' using errcode='55000';end if;
 if v.ator_id is distinct from p_ator or v.cliente_id is distinct from p_cliente or v.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
 return v.resultado;
end; $$;
revoke all on function pcm.sso_recibo_geracao_visita_legada(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_geracao_visita_legada(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) to authenticated;
