-- ADR-0395: fotografia e páginas; encerramento revalida separadamente.
create function pcm.sso_diagnosticar_aptidao_chamado(p_cliente_id uuid,p_chamado_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_chamado pcm.chamados%rowtype;v_completa boolean;v_parcelas bigint;v_parcelas_invalidas bigint;v_propostas_pendentes bigint;v_propostas_invalidas bigint;v_ordens bigint;v_ordens_nao_finalizadas bigint;v_divergentes bigint;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) then raise exception 'diagnostico_chamado_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select coalesce((select declarada_completa from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id),false) into v_completa;
 select count(*),count(*) filter(where p.situacao<>'atendida' or o.id is null) into v_parcelas,v_parcelas_invalidas from pcm.chamado_escopo_parcelas p left join pcm.ordens_servico o on o.id=p.os_atendimento_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where p.chamado_id=p_chamado_id;
 select count(*) filter(where c.situacao='pendente'),count(*) filter(where c.situacao='executada' and o.id is null) into v_propostas_pendentes,v_propostas_invalidas from pcm.chamado_continuacoes_propostas c left join pcm.ordens_servico o on o.id=c.os_continuacao_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and o.status='finalizado' where c.chamado_id=p_chamado_id;
 select count(*) filter(where client_id=p_cliente_id),count(*) filter(where client_id=p_cliente_id and status is distinct from 'finalizado'),count(*) filter(where client_id is distinct from p_cliente_id) into v_ordens,v_ordens_nao_finalizadas,v_divergentes from pcm.ordens_servico where chamado_id=p_chamado_id and deleted_at is null;
 return jsonb_build_object('revision',v_chamado.sso_revisao,'encerrado',v_chamado.sso_encerrado_em is not null,'composicaoCompleta',v_completa,'parcelas',v_parcelas,'parcelasPendentesOuInconsistentes',v_parcelas_invalidas,'continuacoesPendentes',v_propostas_pendentes,'continuacoesInconsistentes',v_propostas_invalidas,'ordensCliente',v_ordens,'ordensNaoFinalizadas',v_ordens_nao_finalizadas,'ordensClienteDivergente',v_divergentes,
 'aptoIndicativo',v_chamado.sso_encerrado_em is null and v_chamado.status<>'cancelado' and v_completa and v_parcelas>0 and v_parcelas_invalidas=0 and v_propostas_pendentes=0 and v_propostas_invalidas=0 and v_ordens>0 and v_ordens_nao_finalizadas=0 and v_divergentes=0,'revalidacaoTransacionalObrigatoria',true);
end; $$;
revoke all on function pcm.sso_diagnosticar_aptidao_chamado(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_itens_aptidao_chamado(p_cliente_id uuid,p_chamado_id uuid,p_tipo text,p_apos uuid,p_limite integer)
returns table(id uuid,descricao text,situacao text,referencia_os uuid,diagnostico text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) then raise exception 'diagnostico_chamado_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo is null or p_tipo not in ('parcela','continuacao','os') or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 if p_tipo='parcela' then
  return query select p.id,p.descricao,p.situacao,o.id,case when p.situacao<>'atendida' then 'parcela_pendente' when o.id is null then 'os_ausente_ou_inconsistente' when o.status<>'finalizado' then 'os_nao_finalizada' else 'atendida_por_os_finalizada' end from pcm.chamado_escopo_parcelas p left join pcm.ordens_servico o on o.id=p.os_atendimento_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null where p.chamado_id=p_chamado_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
 elsif p_tipo='continuacao' then
  return query select c.id,c.descricao_restante,c.situacao,o.id,case when c.situacao='pendente' then 'decisao_pendente' when c.situacao='executada' and o.id is null then 'os_continuacao_ausente_ou_inconsistente' when c.situacao='executada' and o.status<>'finalizado' then 'os_continuacao_nao_finalizada' else 'decisao_registrada' end from pcm.chamado_continuacoes_propostas c left join pcm.ordens_servico o on o.id=c.os_continuacao_id and o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null where c.chamado_id=p_chamado_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
 else
  return query select o.id,null::text,o.status,o.id,case when o.status='finalizado' then 'finalizada' else 'nao_finalizada' end from pcm.ordens_servico o where o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
 end if;
end; $$;
revoke all on function pcm.sso_listar_itens_aptidao_chamado(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
