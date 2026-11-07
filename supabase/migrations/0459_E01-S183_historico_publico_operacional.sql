-- ADR-0233: somente snapshots públicos, nenhuma concessão.
create function comercial.sso_portal_origem_operacional_autorizada(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null
    or not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico') then return false; end if;
  if not coalesce((select g.habilitado from comercial.sso_exportacao_operacional_gate g where g.id), false) then return false; end if;
  return exists (select 1 from comercial.propostas p
    join comercial.proposta_origens_operacionais origem on origem.proposta_id = p.id
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = p_cliente_id and os.deleted_at is null
    left join comercial.oportunidades op on op.id = p.oportunidade_id and op.cliente_id = p_cliente_id and op.deleted_at is null
    where p.id = p_proposta_id and p.deleted_at is null and p.status in ('enviada', 'aceita', 'recusada')
      and ((p.oportunidade_id is not null and op.id is not null)
        or (p.oportunidade_id is null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false))));
end;
$$;
revoke all on function comercial.sso_portal_origem_operacional_autorizada(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function comercial.sso_portal_historico_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_apos integer default 0)
returns table(versao integer, publicado_em timestamptz) language plpgsql stable security definer set search_path = '' as $$
begin
  if p_apos is null or p_apos < 0 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if comercial.sso_portal_origem_operacional_autorizada(p_cliente_id, p_os_id, p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select pub.versao, pub.publicado_em from comercial.sso_orcamento_publicacoes pub
    where pub.proposta_id = p_proposta_id and pub.versao > p_apos order by pub.versao limit 20;
end;
$$;
revoke all on function comercial.sso_portal_historico_operacional(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;

create function comercial.sso_portal_versao_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  if p_versao is null or p_versao < 1 or comercial.sso_portal_origem_operacional_autorizada(p_cliente_id, p_os_id, p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select comercial.projecao_proposta_publica(pub.payload_publico) into v_payload
    from comercial.sso_orcamento_publicacoes pub where pub.proposta_id = p_proposta_id and pub.versao = p_versao;
  if v_payload is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao, 'ordemServicoId', p_os_id, 'payload', v_payload);
end;
$$;
revoke all on function comercial.sso_portal_versao_operacional(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
