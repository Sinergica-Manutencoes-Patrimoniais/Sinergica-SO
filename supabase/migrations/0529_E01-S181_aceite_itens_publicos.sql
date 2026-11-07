-- ADR-0303: leitura escopada e proteção do aceite em caminhos legados.
create function comercial.sso_portal_itens_publicos(p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if auth.uid() is null or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
      where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  select s.itens into v_itens from comercial.sso_itens_publicos_proposta s join comercial.propostas p on p.id=s.proposta_id and p.versao_atual=s.versao and p.deleted_at is null and p.status in ('enviada','aceita','recusada')
    join comercial.proposta_origens_operacionais origem on origem.proposta_id=p.id
    join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id
    join pcm.ordens_servico o on o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null
    where s.proposta_id=p_proposta_id and s.versao=p_versao;
  if v_itens is null then raise exception 'itens_indisponiveis' using errcode='42501'; end if;
  return v_itens;
end $$;
revoke all on function comercial.sso_portal_itens_publicos(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function comercial.sso_guardar_aceite_itens_publicos() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('aceita','recusada') and old.status is distinct from new.status
    and coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false)
    and exists(select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id=new.id)
    and not exists(select 1 from comercial.sso_itens_publicos_proposta s where s.proposta_id=new.id and s.versao=new.versao_atual)
    then raise exception 'snapshot_itens_publicos_ausente' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function comercial.sso_guardar_aceite_itens_publicos() from public,anon,authenticated,service_role;
create trigger sso_proposta_aceite_itens before update of status on comercial.propostas for each row execute function comercial.sso_guardar_aceite_itens_publicos();
