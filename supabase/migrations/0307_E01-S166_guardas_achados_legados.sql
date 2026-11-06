-- ADR-0083: rejeita alteração de origem anterior e de origem nova.
create or replace function pcm.sso_proteger_avaliacao_legada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_origem text; v_antiga uuid;
begin
  if tg_op = 'UPDATE' then v_antiga := old.ocorrencia_id; end if;
  for v_origem in
    select o.origem from pcm.ocorrencias_preventivas o
    where o.id = new.ocorrencia_id or o.id = v_antiga
    order by o.id for share
  loop
    if v_origem is distinct from 'legado' then
      raise exception 'origem_preventiva_incompativel' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_avaliacao_legada() from public, anon, authenticated, service_role;

create function pcm.sso_proteger_achado_legado() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_origem text; v_antiga uuid;
begin
  if tg_op = 'UPDATE' then v_antiga := old.avaliacao_id; end if;
  for v_origem in
    select o.origem from pcm.avaliacoes_preventivas a
    join pcm.ocorrencias_preventivas o on o.id = a.ocorrencia_id
    where a.id = new.avaliacao_id or a.id = v_antiga
    order by a.id, o.id for share of a, o
  loop
    if v_origem is distinct from 'legado' then
      raise exception 'origem_preventiva_incompativel' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_achado_legado() from public, anon, authenticated, service_role;
create trigger sso_proteger_achado_legado before insert or update on pcm.achados_preventivos
  for each row execute function pcm.sso_proteger_achado_legado();
