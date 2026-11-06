-- ADR-0587: diagnóstico local; não reconhece candidato financeiro.
create function financeiro.sso_diagnostico_origem_os_faturavel(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; retornos bigint; propostas bigint;
begin
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false)
    or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into retornos from pcm.retorno_os_preparado r join lateral (
    select dv.decisao from pcm.sso_revisoes_validacao_os v join pcm.decisoes_validacao_os dv on dv.id=v.decisao_id
      where v.retorno_id=r.id order by v.revisao desc limit 1) ultima on true where r.os_id=o.id and r.cliente_id=p_cliente_id and ultima.decisao='aprovar';
  select count(*) into propostas from comercial.proposta_origens_operacionais x join comercial.propostas p on p.id=x.proposta_id and p.deleted_at is null and p.status='aceita'
    join pcm.listas_materiais lm on lm.id=x.lista_materiais_id and lm.cliente_id=p_cliente_id and lm.ordem_servico_id=o.id
    where x.ordem_servico_id=o.id;
  return jsonb_build_object('osId',o.id,'statusLocal',o.status,'categoriaLocal',o.categoria,'retornosComUltimaDecisaoAprovada',retornos,
    'propostasAceitasLocais',propostas,'servicoExtra','nao_comprovado','valorFaturavel','nao_comprovado','permiteCriarCandidato',false);
end $$;
revoke all on function financeiro.sso_diagnostico_origem_os_faturavel(uuid,uuid) from public,anon,authenticated,service_role;
