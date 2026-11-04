-- ADR-0382: referências existentes, nenhuma alegação de revisão completa.
create function pcm.sso_diagnostico_conteudo_os(p_cliente_id uuid,p_visita_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o pcm.ordens_servico%rowtype; v pcm.visitas%rowtype; v_escopo text:='indisponivel'; v_atribuicoes integer:=null;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_os_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null;
  if v.id is null or o.id is null or not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v.id and vo.os_id=o.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null)
    then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  if coalesce((select habilitado from pcm.sso_atribuicao_parcela_gate where id),false)
    and config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is true then
    select count(*)::integer into v_atribuicoes from pcm.sso_atribuicoes_parcela a where a.os_id=o.id and a.cliente_id=p_cliente_id;
    v_escopo:=case when v_atribuicoes=0 then 'sem_atribuicao_conhecida' else 'atribuicoes_parciais' end;
  end if;
  return jsonb_build_object('visitaId',v.id,'osId',o.id,'revision',v.revisao,
    'alvo',case when o.sistema_id is null then 'desconhecido' else 'referencia_sistema_nao_comprovada' end,
    'questionario',case when o.questionario_id is null then 'aplicabilidade_desconhecida' else 'referencia_nao_comprovada' end,
    'escopo',v_escopo,'atribuicoes',v_atribuicoes,'revisaoCompleta',false,'autorizaEnvio',false);
end $$;
revoke all on function pcm.sso_diagnostico_conteudo_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;
