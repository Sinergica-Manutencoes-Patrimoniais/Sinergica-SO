-- ADR-0551: medidas separadas, sem soma entre custos e faturáveis.
create function financeiro.sso_relatorio_despesas_faturaveis(p_cliente_id uuid,p_inicio date,p_fim date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare despesas bigint; previsto numeric; realizado numeric; sem_previsto bigint; sem_realizado bigint; itens bigint; original numeric; conferido numeric; sem_conferencia bigint;
begin
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id),false) or not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_inicio>p_fim or p_fim-p_inicio>730
    or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_periodo_invalido' using errcode='42501'; end if;
  select count(*),coalesce(sum(previsto_centavos),0),coalesce(sum(realizado_centavos),0),count(*) filter(where previsto_centavos is null),count(*) filter(where realizado_centavos is null)
    into despesas,previsto,realizado,sem_previsto,sem_realizado from pcm.despesas_visita where cliente_id=p_cliente_id and status='ativa' and data between p_inicio and p_fim;
  select count(*),coalesce(sum(valor_original_centavos),0),coalesce(sum(valor_conferido_centavos),0),count(*) filter(where valor_conferido_centavos is null)
    into itens,original,conferido,sem_conferencia from financeiro.itens_faturaveis where cliente_id=p_cliente_id and status<>'cancelado' and competencia between p_inicio and p_fim;
  return jsonb_build_object('inicio',p_inicio,'fim',p_fim,'despesas',jsonb_build_object('quantidade',despesas,'previstoCentavos',previsto::text,'realizadoCentavos',realizado::text,'semPrevisto',sem_previsto,'semRealizado',sem_realizado),
    'faturaveis',jsonb_build_object('quantidade',itens,'originalCentavos',original::text,'conferidoCentavos',conferido::text,'semConferencia',sem_conferencia),
    'medidasSomaveisEntreSi',false,'criterioFaturavel','data_competencia');
end $$;
revoke all on function financeiro.sso_relatorio_despesas_faturaveis(uuid,date,date) from public,anon,authenticated,service_role;
