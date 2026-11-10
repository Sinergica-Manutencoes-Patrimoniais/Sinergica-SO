-- ADR-1258: consulta de recibo sem escrita; gate fechado.
create table pcm.sso_recibo_correcao_mediada_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_recibo_correcao_mediada_gate(id, habilitado) values(true, false);
alter table pcm.sso_recibo_correcao_mediada_gate enable row level security;
alter table pcm.sso_recibo_correcao_mediada_gate force row level security;
revoke all on pcm.sso_recibo_correcao_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_recibo_correcao_mediada(p_cliente_id uuid, p_visita_id uuid, p_request_id uuid, p_despesa_id uuid,
  p_revisao integer, p_valor bigint, p_objeto_id uuid, p_motivo text, p_conferencia text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_cmd pcm.despesa_visita_comandos%rowtype; v_payload jsonb;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null or p_request_id is null or p_despesa_id is null
    or p_revisao is null or p_revisao < 1 or p_valor is null or p_valor not between 0 and 9007199254740991
    or p_objeto_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or p_conferencia is null or length(btrim(p_conferencia)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_recibo_correcao_mediada_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text,0)) then raise exception 'pedido_em_andamento' using errcode = '55P03'; end if;
  perform 1 from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id and visita_id=p_visita_id;
  if not found then raise exception 'sem_acesso' using errcode = '42501'; end if;
  select * into v_cmd from pcm.despesa_visita_comandos where request_id=p_request_id;
  if not found then return null; end if;
  v_payload := jsonb_build_object('operacao','corrigir_realizacao','despesaId',p_despesa_id,'expectedRevision',p_revisao,
    'valorCentavos',p_valor,'comprovanteObjetoId',p_objeto_id,'motivo',btrim(p_motivo),'conferenciaFinanceira',btrim(p_conferencia));
  if v_cmd.actor_id is distinct from auth.uid() or v_cmd.cliente_id is distinct from p_cliente_id or v_cmd.payload is distinct from v_payload
    or v_cmd.resultado->>'aggregateId' is distinct from p_despesa_id::text or v_cmd.resultado->>'requestId' is distinct from p_request_id::text
    or v_cmd.resultado->'linkedIds'->>'visitaId' is distinct from p_visita_id::text then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  if not exists(select 1 from pcm.sso_ingestao_comprovante_reservas r join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id
    join pcm.despesa_visita_correcoes_realizacao x on x.request_id=r.request_id and x.despesa_id=r.despesa_id and x.objeto_novo=c.objeto_id and x.caminho_novo=r.caminho
    where r.request_id=p_request_id and r.ator_id=auth.uid() and r.cliente_id=p_cliente_id and r.despesa_id=p_despesa_id and c.objeto_id=p_objeto_id and x.revisao=p_revisao+1) then
    raise exception 'recibo_indisponivel' using errcode = '42501';
  end if;
  return jsonb_build_object('requestId',p_request_id,'despesaId',p_despesa_id,'visitaId',p_visita_id,'clienteId',p_cliente_id,
    'revisao',p_revisao+1,'confirmada',true,'integridadeBytesComprovada',false);
end $$;
revoke all on function pcm.sso_recibo_correcao_mediada(uuid,uuid,uuid,uuid,integer,bigint,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_correcao_mediada(uuid,uuid,uuid,uuid,integer,bigint,uuid,text,text) to authenticated;
