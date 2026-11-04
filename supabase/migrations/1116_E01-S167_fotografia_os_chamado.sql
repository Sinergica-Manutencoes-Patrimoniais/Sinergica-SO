-- ADR-0967: leitura privada por fotografia observável; nenhum EXECUTE concedido.
create function pcm.sso_listar_ordens_chamado_foto(p_cliente_id uuid,p_chamado_id uuid,p_limite integer,p_apos uuid,p_assinatura text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_invalido boolean;v_total bigint;v_assinatura text;v_itens jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_leitura_os_chamado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'leitura_os_chamado_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null or p_limite is null or p_limite not between 1 and 100
    or (p_apos is null and p_assinatura is not null) or (p_apos is not null and (p_assinatura is null or p_assinatura !~ '^[a-f0-9]{64}$')) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  with base as materialized (
    select c.id,c.ordem_servico_id from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null
  ), dados as materialized (
    select o.id,o.numero,o.titulo,o.status,o.client_id,o.chamado_id
    from base b join pcm.ordens_servico o on (o.chamado_id=b.id or (o.id=b.ordem_servico_id and o.chamado_id is null))
    where o.deleted_at is null order by o.id limit 10001
  ), verificacao as (
    select not exists(select 1 from base) or exists(select 1 from dados d where d.client_id is distinct from p_cliente_id
      or d.numero is null or d.titulo is null or d.status is null or length(d.numero)>1000 or length(d.titulo)>10000 or length(d.status)>200
      or exists(select 1 from pcm.chamados outro where outro.ordem_servico_id=d.id and outro.id<>p_chamado_id and outro.deleted_at is null))
      or exists(select 1 from base b where b.ordem_servico_id is not null and not exists(select 1 from pcm.ordens_servico o
        where o.id=b.ordem_servico_id and o.client_id=p_cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=b.id))) as invalido
  )
  select (select invalido from verificacao),(select count(*) from dados),
    encode(sha256(convert_to(coalesce((select coalesce(b.ordem_servico_id::text,'-') from base b),'ausente')||'|'||
      coalesce((select string_agg(encode(sha256(convert_to(jsonb_build_array(d.id,d.numero,d.titulo,d.status)::text,'UTF8')),'hex'),'' order by d.id) from dados d),''),'UTF8')),'hex'),
    coalesce((select jsonb_agg(jsonb_build_object('id',pagina.id,'numero',pagina.numero,'titulo',pagina.titulo,'status',pagina.status) order by pagina.id)
      from (select d.id,d.numero,d.titulo,d.status from dados d where p_apos is null or d.id>p_apos order by d.id limit p_limite) pagina),'[]'::jsonb)
  into v_invalido,v_total,v_assinatura,v_itens;
  if v_invalido then raise exception 'vinculo_legado_inconsistente' using errcode='23514'; end if;
  if v_total>10000 then raise exception 'fotografia_extensa' using errcode='54000'; end if;
  if p_assinatura is not null and p_assinatura is distinct from v_assinatura then raise exception 'fotografia_alterada' using errcode='40001'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'total',v_total,'assinatura',v_assinatura,'itens',v_itens);
end; $$;
revoke all on function pcm.sso_listar_ordens_chamado_foto(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
