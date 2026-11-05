-- ADR-0118: proteção para o comando privado 0342; gate e EXECUTE continuam fechados.
create table pcm.aprovacao_revisao_tokens (
  txid bigint not null, plano_id uuid not null references pcm.planos_manutencao(id),
  versao_anterior_id uuid not null references pcm.plano_versoes(id), vigencia_inicio date not null,
  primary key (txid, plano_id)
);
alter table pcm.aprovacao_revisao_tokens enable row level security;
alter table pcm.aprovacao_revisao_tokens force row level security;
revoke all on pcm.aprovacao_revisao_tokens from public, anon, authenticated, service_role;

-- A aplicação da constraint exige inventário e saneamento manual prévio de vigências sobrepostas.
alter table pcm.plano_versoes add constraint plano_versoes_vigencia_sem_sobreposicao
  exclude using gist (plano_id extensions.gist_uuid_ops with =,
    daterange(vigencia_inicio, vigencia_fim, '[]') with &&)
  where (estado = 'aprovado' and vigencia_inicio is not null);

create function pcm.sso_proteger_fim_vigencia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'aprovado' and new.vigencia_fim is distinct from old.vigencia_fim then
    if old.vigencia_fim is not null or not exists (
      select 1 from pcm.aprovacao_revisao_tokens t join pcm.aprovacao_revisao_gate g on g.id
      where t.txid = pg_catalog.txid_current() and t.plano_id = old.plano_id
        and t.versao_anterior_id = old.id and new.vigencia_fim = t.vigencia_inicio - 1
        and g.habilitado) then
      raise exception 'fim_vigencia_protegido' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_fim_vigencia() from public, anon, authenticated, service_role;
create trigger sso_proteger_fim_vigencia before update of vigencia_fim on pcm.plano_versoes
  for each row execute function pcm.sso_proteger_fim_vigencia();

-- Conserva bloqueio original para qualquer caminho que não possua token privado da transação.
create or replace function pcm.sso_bloquear_aprovacao_sem_vigencia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'rascunho' and new.estado = 'aprovado'
    and exists(select 1 from pcm.plano_versoes v where v.plano_id = old.plano_id and v.estado = 'aprovado' and v.id <> old.id)
    and not exists (select 1 from pcm.aprovacao_revisao_tokens t join pcm.aprovacao_revisao_gate g on g.id
      join pcm.plano_versoes anterior on anterior.id = t.versao_anterior_id and anterior.plano_id = t.plano_id
      where t.txid = pg_catalog.txid_current() and t.plano_id = old.plano_id
        and t.vigencia_inicio = new.vigencia_inicio and anterior.estado = 'aprovado'
        and anterior.vigencia_fim = new.vigencia_inicio - 1 and g.habilitado) then
    raise exception 'revisao_sem_vigencia_segura' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_bloquear_aprovacao_sem_vigencia() from public, anon, authenticated, service_role;
