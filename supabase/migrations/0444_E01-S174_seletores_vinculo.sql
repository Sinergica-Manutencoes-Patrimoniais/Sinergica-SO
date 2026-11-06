-- ADR-0218: consultas privadas; sem concessão.
create function pcm.sso_chamados_para_backlog(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,revisao bigint) language plpgsql stable security definer set search_path='' as $$
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.numero,c.titulo,c.sso_revisao from pcm.chamados c where c.cliente_id=p_cliente_id and c.deleted_at is null and c.status in ('aberto','convertido_os') and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_chamados_para_backlog(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_contexto_vinculo_backlog(p_composicao_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_b pcm.sso_backlog_composicoes%rowtype;v_v pcm.sso_backlog_chamado_vinculos%rowtype;v_c pcm.chamados%rowtype;v_e pcm.chamado_escopo_composicoes%rowtype;
begin
  select * into v_b from pcm.sso_backlog_composicoes where id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_b.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_b.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_v from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id;
  if not found then return jsonb_build_object('vinculado',false,'composicaoRevision',v_b.revisao); end if;
  select * into v_c from pcm.chamados where id=v_v.chamado_id and cliente_id=v_b.cliente_id and deleted_at is null;
  if not found then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
  select * into v_e from pcm.chamado_escopo_composicoes where chamado_id=v_c.id;
  return jsonb_build_object('vinculado',true,'composicaoRevision',v_b.revisao,'chamadoId',v_c.id,'chamadoNumero',v_c.numero,'chamadoRevision',v_c.sso_revisao,'escopoRevision',v_e.revisao);
end;
$$;
revoke all on function pcm.sso_contexto_vinculo_backlog(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_itens_para_vinculo_backlog(p_composicao_id uuid,p_tipo text,p_apos uuid,p_limite integer)
returns table(id uuid,descricao text) language plpgsql stable security definer set search_path='' as $$
declare v_b pcm.sso_backlog_composicoes%rowtype;v_v pcm.sso_backlog_chamado_vinculos%rowtype;
begin
  if p_composicao_id is null or p_tipo is null or p_tipo not in ('pendencia','parcela') or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_b from pcm.sso_backlog_composicoes where id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_b.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_b.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_v from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id;
  if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  if p_tipo='pendencia' then
    return query select p.id,p.pergunta from pcm.sso_pendencias_tecnicas p join pcm.sso_backlog_pendencias b on b.pendencia_id=p.id
      where b.composicao_id=p_composicao_id and p.cliente_id=v_b.cliente_id and p.estado='aberta' and p.revisao=b.revisao_origem
        and not exists(select 1 from pcm.sso_backlog_parcelas x where x.pendencia_id=p.id) and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
  else
    return query select p.id,p.descricao from pcm.chamado_escopo_parcelas p where p.chamado_id=v_v.chamado_id and p.situacao='pendente'
      and not exists(select 1 from pcm.sso_backlog_parcelas x where x.parcela_id=p.id) and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
  end if;
end;
$$;
revoke all on function pcm.sso_itens_para_vinculo_backlog(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
