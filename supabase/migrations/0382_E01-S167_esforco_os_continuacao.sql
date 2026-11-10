-- ADR-0156: proposta executada é fonte congelada de esforço, sem sobrescrever OS/Visita legada.
create unique index chamado_continuacoes_os_unica_idx on pcm.chamado_continuacoes_propostas(os_continuacao_id)
  where os_continuacao_id is not null;

create function pcm.sso_proteger_continuacao_executada() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.situacao='executada' then raise exception 'continuacao_executada_imutavel' using errcode='23514'; end if;
  if tg_op='DELETE' then return old; end if;
  if new.situacao='executada' and (new.os_continuacao_id is null or new.os_continuacao_id=old.os_anterior_id) then
    raise exception 'os_continuacao_invalida' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_continuacao_executada() from public,anon,authenticated,service_role;
create trigger chamado_continuacao_executada_imutavel before update or delete on pcm.chamado_continuacoes_propostas
  for each row execute function pcm.sso_proteger_continuacao_executada();

create function pcm.sso_consultar_esforco_continuacao(p_cliente_id uuid,p_os_id uuid)
returns table(proposta_id uuid,chamado_id uuid,os_anterior_id uuid,os_continuacao_id uuid,
  descricao_restante text,minutos_restantes integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then
    raise exception 'comando_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not (
    config.sso_autorizar_acao('execucao.validar',p_cliente_id) is true or
    config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is true) then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then
    raise exception 'os_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.chamado_id,p.os_anterior_id,p.os_continuacao_id,p.descricao_restante,p.minutos_restantes
    from pcm.chamado_continuacoes_propostas p
    join pcm.chamados c on c.id=p.chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null
    join pcm.ordens_servico o on o.id=p.os_continuacao_id and o.chamado_id=c.id and o.client_id=p_cliente_id and o.deleted_at is null
    join pcm.ordens_servico anterior on anterior.id=p.os_anterior_id and anterior.chamado_id=c.id and anterior.client_id=p_cliente_id and anterior.deleted_at is null
    where p.os_continuacao_id=p_os_id and p.situacao='executada';
end;
$$;
revoke all on function pcm.sso_consultar_esforco_continuacao(uuid,uuid) from public,anon,authenticated,service_role;
