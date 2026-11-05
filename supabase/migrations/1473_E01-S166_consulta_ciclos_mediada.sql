-- ADR-1323: mediação aditiva; núcleo e seu gate continuam privados.
create table pcm.sso_ciclos_uniformes_mediados_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_ciclos_uniformes_mediados_gate(id, habilitado) values (true, false);
alter table pcm.sso_ciclos_uniformes_mediados_gate enable row level security;
alter table pcm.sso_ciclos_uniformes_mediados_gate force row level security;
revoke all on pcm.sso_ciclos_uniformes_mediados_gate from public, anon, authenticated, service_role;

create function pcm.sso_consultar_ciclos_uniformes_mediada(
  p_ator_esperado uuid, p_cliente_id uuid, p_plano_id uuid, p_versao_id uuid,
  p_rotina_id uuid, p_serie_id uuid, p_inicio date, p_fim date, p_apos text, p_limite integer
) returns table(origem text, chave text, vencimento date, tolerancia_antes integer,
  tolerancia_depois integer, semana_origem date, estado_visita text, feriado text,
  vigencia_declarada boolean, ocorrencia_preparada boolean, fonte_incompleta boolean)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_ciclos_uniformes_mediados_gate where id and habilitado for share;
  if not found then raise exception 'consulta_bloqueada' using errcode = '55000'; end if;
  perform 1 from pcm.sso_consulta_uniforme_ciclos_gate where id and habilitado for share;
  if not found then raise exception 'consulta_bloqueada' using errcode = '55000'; end if;
  if p_serie_id is not null then
    perform 1 from pcm.ocorrencia_rotina_gate where id and habilitado for share;
    if not found then raise exception 'consulta_bloqueada' using errcode = '55000'; end if;
  end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado or p_cliente_id is null or
    config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.planos_manutencao where id = p_plano_id and cliente_id = p_cliente_id for share;
  if not found then raise exception 'plano_indisponivel' using errcode = '42501'; end if;
  perform 1 from pcm.plano_versoes where id = p_versao_id and plano_id = p_plano_id and estado = 'aprovado' for share;
  if not found or config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then raise exception 'versao_indisponivel' using errcode = '42501'; end if;
  return query select c.origem, c.chave, c.vencimento, c.tolerancia_antes, c.tolerancia_depois,
    c.semana_origem, c.estado_visita, c.feriado, c.vigencia_declarada, c.ocorrencia_preparada, c.fonte_incompleta
    from pcm.sso_consultar_ciclos_uniformes(p_plano_id,p_versao_id,p_rotina_id,p_serie_id,p_inicio,p_fim,p_apos,p_limite) c;
end $$;
revoke all on function pcm.sso_consultar_ciclos_uniformes_mediada(uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,integer)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_consultar_ciclos_uniformes_mediada(uuid,uuid,uuid,uuid,uuid,uuid,date,date,text,integer) to authenticated;
