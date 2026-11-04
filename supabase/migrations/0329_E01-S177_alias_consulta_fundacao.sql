-- ADR-0110: fundação sem criar aliases nem alterar códigos. Não aplicar antes dos gates.
create table pcm.sso_codigo_aliases (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes(id),
  sistema_id uuid references pcm.sistemas(id),
  componente_id uuid references pcm.equipamentos(id),
  codigo text not null check (length(btrim(codigo)) between 1 and 200),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  check ((sistema_id is null) <> (componente_id is null))
);
create index idx_sso_codigo_aliases_exato on pcm.sso_codigo_aliases(codigo);
alter table pcm.sso_codigo_aliases enable row level security;
alter table pcm.sso_codigo_aliases force row level security;
revoke all on pcm.sso_codigo_aliases from public, anon, authenticated, service_role;

-- Consulta exata respeita legado, sem normalizar ou transformar código atual.
create function pcm.sso_localizar_codigo_publico(p_cliente_id uuid, p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_quantidade integer; v_tipo text; v_id uuid;
begin
  if not config.sso_autorizar_acao('cadastro.ler', p_cliente_id) then
    raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_codigo is null or length(btrim(p_codigo)) not between 1 and 200 then
    raise exception 'codigo_invalido' using errcode = '22023';
  end if;
  with encontrados as (
    select 'sistema'::text tipo, s.id from pcm.sistemas s where s.cliente_id = p_cliente_id and s.deleted_at is null and s.codigo = p_codigo
    union
    select 'componente'::text, e.id from pcm.equipamentos e where e.client_id = p_cliente_id and e.deleted_at is null and e.identificador = p_codigo
    union
    select 'sistema'::text, s.id from pcm.sso_codigo_aliases a join pcm.sistemas s on s.id = a.sistema_id and s.cliente_id = a.cliente_id
      where a.cliente_id = p_cliente_id and s.deleted_at is null and a.codigo = p_codigo
    union
    select 'componente'::text, e.id from pcm.sso_codigo_aliases a join pcm.equipamentos e on e.id = a.componente_id and e.client_id = a.cliente_id
      where a.cliente_id = p_cliente_id and e.deleted_at is null and a.codigo = p_codigo
  ) select count(*), min(tipo), min(id::text)::uuid into v_quantidade, v_tipo, v_id from encontrados;
  if v_quantidade = 0 then return jsonb_build_object('situacao', 'nao_encontrado'); end if;
  if v_quantidade > 1 then return jsonb_build_object('situacao', 'ambiguo'); end if;
  return jsonb_build_object('situacao', 'encontrado', 'tipo', v_tipo, 'ativoId', v_id);
end;
$$;
revoke all on function pcm.sso_localizar_codigo_publico(uuid,text) from public, anon, service_role;
grant execute on function pcm.sso_localizar_codigo_publico(uuid,text) to authenticated;
