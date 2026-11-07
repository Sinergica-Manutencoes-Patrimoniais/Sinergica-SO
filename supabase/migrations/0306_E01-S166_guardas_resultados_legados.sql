-- ADR-0082: serviço legado não escreve avaliações/resultados de outra origem.
create function pcm.sso_proteger_avaliacao_legada() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_origem text;
begin
  select o.origem into v_origem from pcm.ocorrencias_preventivas o
    where o.id = new.ocorrencia_id for share;
  if found and v_origem is distinct from 'legado' then
    raise exception 'origem_preventiva_incompativel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_avaliacao_legada() from public, anon, authenticated, service_role;
create trigger sso_proteger_avaliacao_legada before insert or update on pcm.avaliacoes_preventivas
  for each row execute function pcm.sso_proteger_avaliacao_legada();

create function pcm.sso_proteger_resultado_legado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.origem is distinct from 'legado' then
    raise exception 'origem_preventiva_incompativel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_resultado_legado() from public, anon, authenticated, service_role;
create trigger sso_proteger_resultado_legado before update of resultado_estado, resultado_atualizado_em on pcm.ocorrencias_preventivas
  for each row execute function pcm.sso_proteger_resultado_legado();
