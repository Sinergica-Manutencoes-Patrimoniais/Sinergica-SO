-- ADR-1364: leitura direta; a escrita continua responsável por verificar o ciclo canônico.
create index if not exists sso_fila_preventiva_pcm_preparada_idx
  on pcm.sso_fila_preventiva_pcm(cliente_id,plano_id,preparada_id,ciclo_id);

create function pcm.sso_consultar_entrada_fila_preventiva(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_fila_preventiva_pcm_gate where id and habilitado for share;
  if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
      where o.id=p_preparada_id and o.plano_id=p_plano_id and p.cliente_id=p_cliente_id)
  then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,c.vencimento_original,f.atualizado_em
    from pcm.sso_fila_preventiva_pcm f join pcm.sso_ciclos_calendario_canonicos c on c.id=f.ciclo_id
    where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.preparada_id=p_preparada_id
    order by f.ciclo_id limit 2;
end; $$;
revoke all on function pcm.sso_consultar_entrada_fila_preventiva(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_entrada_fila_preventiva(uuid,uuid,uuid) to authenticated;
