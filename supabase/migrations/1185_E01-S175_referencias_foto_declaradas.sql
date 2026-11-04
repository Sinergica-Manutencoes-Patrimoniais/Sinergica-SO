-- ADR-1034: referências opacas não são fotos nem links autenticados.
create table pcm.sso_referencias_campo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_referencias_campo_gate(id, habilitado) values(true, false);
alter table pcm.sso_referencias_campo_gate enable row level security;
alter table pcm.sso_referencias_campo_gate force row level security;
revoke all on pcm.sso_referencias_campo_gate from public, anon, authenticated, service_role;

create function pcm.sso_listar_referencias_foto_campo(
  p_ator_id uuid, p_cliente_id uuid, p_lote_id uuid, p_chave text, p_apos integer, p_limite integer
) returns table(posicao integer, referencia text)
language plpgsql volatile security definer set search_path = '' as $$
declare v_fotos jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200
    or (p_apos is not null and p_apos < 0) or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_referencias_campo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'referencias_desabilitadas' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.aprovar', p_cliente_id) is distinct from true
    and config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select r.fotos_declaradas into v_fotos from pcm.sso_recepcao_envelope_campo r
    join pcm.sso_levantamentos l on l.id=r.lote_id and l.cliente_id=r.cliente_id
    join pcm.sso_levantamento_linhas linha on linha.lote_id=l.id and linha.chave=p_chave
    where r.lote_id=p_lote_id and r.cliente_id=p_cliente_id;
  if not found then raise exception 'lote_ou_linha_indisponivel' using errcode='42501'; end if;
  return query select f.ordinalidade::integer, f.valor->>'referencia'
    from pg_catalog.jsonb_array_elements(v_fotos) with ordinality as f(valor, ordinalidade)
    where f.valor->>'chaveLinha'=p_chave and (p_apos is null or f.ordinalidade > p_apos)
    order by f.ordinalidade limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_referencias_foto_campo(uuid, uuid, uuid, text, integer, integer) from public, anon, authenticated, service_role;
