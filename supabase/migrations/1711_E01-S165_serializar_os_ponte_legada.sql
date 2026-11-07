-- ADR-1567: serializa a escolha explícita por ciclo com a criação de OS legada.
-- A guarda 1045 e o comportamento dos ciclos sem ponte permanecem inalterados.
create function pcm.sso_travar_ocorrencia_legada_antes_os() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if new.ocorrencia_preventiva_id is not null then
    if current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'isolamento_nao_suportado' using errcode = '25001';
    end if;
    perform 1 from pcm.ocorrencias_preventivas
      where id = new.ocorrencia_preventiva_id for share;
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_travar_ocorrencia_legada_antes_os()
  from public, anon, authenticated, service_role;
-- PostgreSQL executa triggers do mesmo tipo em ordem alfabética: esta trava
-- precede sso_guardar_os_legada_chamado_preventivo.
create trigger a_sso_travar_ocorrencia_legada_antes_os
  before insert or update of ocorrencia_preventiva_id, chamado_id
  on pcm.ordens_servico for each row
  execute function pcm.sso_travar_ocorrencia_legada_antes_os();

-- A ponte precisa enxergar OS confirmada enquanto aguardava a mesma linha.
create function pcm.sso_exigir_isolamento_ponte_legada() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  if new.ocorrencia_legada_id is not null
     and current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001';
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_exigir_isolamento_ponte_legada()
  from public, anon, authenticated, service_role;
create trigger a_sso_isolamento_ponte_calendario
  before insert on pcm.ocorrencias_rotina_vinculos
  for each row execute function pcm.sso_exigir_isolamento_ponte_legada();
create trigger a_sso_isolamento_ponte_visita
  before insert on pcm.sso_vinculos_visita_legado
  for each row execute function pcm.sso_exigir_isolamento_ponte_legada();
