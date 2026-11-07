-- ADR-0999: consulta global privada; não realiza alterações.
create function pcm.sso_listar_politica_equipment(p_ator_id uuid, p_apos uuid, p_limite integer)
returns table(categoria_id uuid, nome text, controlado boolean, revisao integer)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_politica_equipment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'politica_equipment_desabilitada' using errcode='55000'; end if;
  if not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin' and auth.jwt()->>'user_role'='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select c.id,c.nome,p.equipamento_controlado,coalesce(p.revisao,0)
    from pcm.equipamento_categorias c left join pcm.sso_politica_equipment_categoria p on p.categoria_id=c.id
    where c.deleted_at is null and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_politica_equipment(uuid,uuid,integer) from public,anon,authenticated,service_role;
