-- ADR-0191: consultas e auditoria permanecem revogadas.
create function pcm.sso_historico_realizacao_despesa(p_despesa_id uuid, p_apos integer default 0)
returns table(revisao integer, valor_centavos bigint, ator_id uuid, registrado_em timestamptz, tipo text)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if auth.uid() is null or p_despesa_id is null or p_apos is null or p_apos < 0 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  select d.cliente_id into v_cliente from pcm.despesas_visita d where d.id = p_despesa_id;
  if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir', v_cliente) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select h.revisao, h.valor_centavos, h.ator_id, h.registrado_em, h.tipo from (
    select r.revisao, r.valor_centavos, r.ator_id, r.criado_em as registrado_em, 'realizacao'::text as tipo
      from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id
    union all
    select c.revisao, c.valor_novo, c.ator_id, c.criado_em, 'correcao'::text
      from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id = p_despesa_id
  ) h where h.revisao > p_apos order by h.revisao limit 20;
end;
$$;
revoke all on function pcm.sso_historico_realizacao_despesa(uuid, integer) from public, anon, authenticated, service_role;

create function pcm.sso_comprovante_despesa_revisao_autorizado(p_despesa_id uuid, p_revisao integer)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_objeto uuid; v_caminho text;
begin
  if auth.uid() is null or p_despesa_id is null or p_revisao is null or p_revisao < 1 then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select d.cliente_id into v_cliente from pcm.despesas_visita d where d.id = p_despesa_id;
  if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir', v_cliente) is not true then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select h.objeto_id, h.caminho into v_objeto, v_caminho from (
    select r.comprovante_objeto_id as objeto_id, r.comprovante_caminho as caminho
      from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id and r.revisao = p_revisao
    union all
    select c.objeto_novo, c.caminho_novo from pcm.despesa_visita_correcoes_realizacao c
      where c.despesa_id = p_despesa_id and c.revisao = p_revisao
  ) h;
  if v_objeto is null or not exists (select 1 from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.id = v_objeto and o.name = v_caminho and o.bucket_id = 'sso-despesas-visita' and b.public is false) then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_comprovante_despesa_revisao_autorizado(uuid, integer) from public, anon, authenticated, service_role;

create function pcm.sso_auditar_download_despesa(p_request_id uuid, p_despesa_id uuid, p_revisao integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_caminho text;
begin
  if p_request_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  v_caminho := pcm.sso_comprovante_despesa_revisao_autorizado(p_despesa_id, p_revisao);
  select d.cliente_id into v_cliente from pcm.despesas_visita d where d.id = p_despesa_id;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.comprovante_acessado', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'revision', p_revisao));
  return true;
end;
$$;
revoke all on function pcm.sso_auditar_download_despesa(uuid, uuid, integer) from public, anon, authenticated, service_role;
