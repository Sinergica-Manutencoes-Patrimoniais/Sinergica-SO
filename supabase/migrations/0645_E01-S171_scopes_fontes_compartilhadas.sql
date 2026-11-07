-- ADR-0419: aquisição preparatória privada; nenhum comando de alteração da fonte.
create function pcm.sso_bloquear_scopes_fonte_composicao(p_tipo text,p_fonte_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_ids uuid[]; v_atuais uuid[]; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false)
    or p_tipo not in ('os','funcionario') or p_fonte_id is null then
    raise exception 'protocolo_indisponivel' using errcode='55000';
  end if;
  if p_tipo='os' then
    select coalesce(array_agg(distinct visita_id order by visita_id),'{}'::uuid[]) into v_ids
      from pcm.visita_ordens_servico where os_id=p_fonte_id and encerrado_em is null;
  else
    select coalesce(array_agg(distinct visita_id order by visita_id),'{}'::uuid[]) into v_ids
      from pcm.visita_equipes where funcionario_id=p_fonte_id and encerrado_em is null;
  end if;
  if cardinality(v_ids)>1000 then raise exception 'escopos_excedem_limite' using errcode='54000'; end if;
  foreach v_id in array v_ids loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-composicao-scope:'||v_id::text,0));
  end loop;
  if p_tipo='os' then
    perform 1 from pcm.ordens_servico where id=p_fonte_id for update;
    if not found then raise exception 'fonte_nao_encontrada' using errcode='23503'; end if;
    select coalesce(array_agg(distinct visita_id order by visita_id),'{}'::uuid[]) into v_atuais
      from pcm.visita_ordens_servico where os_id=p_fonte_id and encerrado_em is null;
  else
    perform 1 from pcm.funcionarios where id=p_fonte_id for update;
    if not found then raise exception 'fonte_nao_encontrada' using errcode='23503'; end if;
    select coalesce(array_agg(distinct visita_id order by visita_id),'{}'::uuid[]) into v_atuais
      from pcm.visita_equipes where funcionario_id=p_fonte_id and encerrado_em is null;
  end if;
  if v_ids is distinct from v_atuais then raise exception 'escopos_alterados' using errcode='40001'; end if;
end $$;
revoke all on function pcm.sso_bloquear_scopes_fonte_composicao(text,uuid) from public,anon,authenticated,service_role;
