-- 0221_E01-S157_siglas_identificador_ativo.sql
-- Siglas de Cliente/Área/Local e reserva do sufixo de identificadores criados pelo SO.
-- Não há backfill: registros existentes permanecem com sigla nula e identificadores legados
-- permanecem fora dos índices parciais para preservar o inbound do Auvo.
--
-- Reverso:
--   revoke execute on function pcm.fn_proximo_sequencial_identificador(text) from authenticated, service_role;
--   drop function if exists pcm.fn_proximo_sequencial_identificador(text);
--   drop index if exists pcm.uq_sistemas_codigo_padrao;
--   drop index if exists pcm.uq_equipamentos_identificador_padrao;
--   drop index if exists pcm.uq_locais_sigla;
--   drop index if exists pcm.uq_areas_sigla;
--   drop index if exists pcm.uq_clientes_sigla;
--   alter table pcm.locais drop constraint if exists ck_locais_sigla, drop column if exists sigla;
--   alter table pcm.areas drop constraint if exists ck_areas_sigla, drop column if exists sigla;
--   alter table pcm.clientes drop constraint if exists ck_clientes_sigla, drop column if exists sigla;

alter table pcm.clientes add column if not exists sigla text;
alter table pcm.clientes
  add constraint ck_clientes_sigla check (sigla is null or sigla ~ '^[A-Z0-9]{3}$') not valid;
create unique index if not exists uq_clientes_sigla
  on pcm.clientes (sigla)
  where deleted_at is null and sigla is not null;

alter table pcm.areas add column if not exists sigla text;
alter table pcm.areas
  add constraint ck_areas_sigla check (sigla is null or sigla ~ '^[A-Z0-9]{3}$') not valid;
create unique index if not exists uq_areas_sigla
  on pcm.areas (cliente_id, sigla)
  where deleted_at is null and sigla is not null;

alter table pcm.locais add column if not exists sigla text;
alter table pcm.locais
  add constraint ck_locais_sigla check (sigla is null or sigla ~ '^[A-Z0-9]{3}$') not valid;
create unique index if not exists uq_locais_sigla
  on pcm.locais (area_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), sigla)
  where deleted_at is null and sigla is not null;

-- Só o formato novo é único: identifiers legados do Auvo podem ter duplicatas.
create unique index if not exists uq_equipamentos_identificador_padrao
  on pcm.equipamentos (identificador)
  where deleted_at is null
    and identificador ~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+-[0-9]{2,}$';
create unique index if not exists uq_sistemas_codigo_padrao
  on pcm.sistemas (codigo)
  where deleted_at is null
    and codigo ~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+-[0-9]{2,}$';

create or replace function pcm.fn_proximo_sequencial_identificador(p_prefixo text)
returns text
language plpgsql
stable
security invoker
set search_path = pcm, public
as $$
declare
  v_maior_sequencial integer;
begin
  if p_prefixo !~ '^[A-Z0-9]{3}(-[A-Z0-9]{3})+$' then
    raise exception using errcode = '22023', message = 'prefixo_invalido';
  end if;

  select max(sequencial)
    into v_maior_sequencial
    from (
      select substring(identificador from '^' || p_prefixo || '-([0-9]{2,})$')::integer as sequencial
        from pcm.equipamentos
       where deleted_at is null
         and identificador ~ ('^' || p_prefixo || '-[0-9]{2,}$')
      union all
      select substring(codigo from '^' || p_prefixo || '-([0-9]{2,})$')::integer as sequencial
        from pcm.sistemas
       where deleted_at is null
         and codigo ~ ('^' || p_prefixo || '-[0-9]{2,}$')
    ) candidatos;

  return lpad((coalesce(v_maior_sequencial, 0) + 1)::text, 2, '0');
end;
$$;

revoke execute on function pcm.fn_proximo_sequencial_identificador(text) from public;
grant execute on function pcm.fn_proximo_sequencial_identificador(text) to authenticated, service_role;
