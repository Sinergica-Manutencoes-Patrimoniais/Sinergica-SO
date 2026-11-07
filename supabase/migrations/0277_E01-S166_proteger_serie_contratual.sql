-- ADR-0053: identidade e vínculo da série são históricos.
create function pcm.sso_proteger_serie_contratual() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'serie_historica_imutavel' using errcode = '23514';
end;
$$;
revoke all on function pcm.sso_proteger_serie_contratual() from public, anon, authenticated, service_role;
create trigger sso_proteger_serie before update or delete on pcm.calendario_contratual_series
for each row execute function pcm.sso_proteger_serie_contratual();
