-- ADR-0155: publicação explícita de cobrança já existente, sem qualquer efeito financeiro.
create table financeiro.sso_portal_cobranca_publicacoes (
  id uuid primary key default gen_random_uuid(), lancamento_id uuid not null references financeiro.lancamentos(id),
  cliente_id uuid not null references pcm.clientes(id), os_id uuid not null references pcm.ordens_servico(id),
  descricao_publica text not null check (length(btrim(descricao_publica)) between 1 and 1000),
  valor_centavos integer not null check (valor_centavos > 0), competencia date not null, vencimento date,
  autor_id uuid not null references config.usuarios(user_id), request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
create index sso_portal_cobranca_publicacoes_os_idx on financeiro.sso_portal_cobranca_publicacoes(os_id, lancamento_id, criado_em desc, id);
alter table financeiro.sso_portal_cobranca_publicacoes enable row level security;
alter table financeiro.sso_portal_cobranca_publicacoes force row level security;
revoke all on financeiro.sso_portal_cobranca_publicacoes from public, anon, authenticated, service_role;

create function financeiro.sso_publicar_cobranca_os(p_request_id uuid, p_lancamento_id uuid,
  p_os_id uuid, p_descricao_publica text, p_valor_esperado integer, p_competencia_esperada date,
  p_vencimento_esperado date) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lancamento financeiro.lancamentos%rowtype; v_anterior financeiro.sso_portal_cobranca_publicacoes%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_lancamento_id is null or p_os_id is null
    or p_valor_esperado is null or p_competencia_esperada is null or p_descricao_publica is null
    or length(btrim(p_descricao_publica)) not between 1 and 1000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-cobranca:' || p_request_id::text, 0));
  select * into v_lancamento from financeiro.lancamentos where id = p_lancamento_id for share;
  if not found or v_lancamento.cliente_id is null or v_lancamento.tipo <> 'entrada'
    or v_lancamento.os_id is distinct from p_os_id
    or config.sso_autorizar_acao('faturavel.efetivar', v_lancamento.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id
      and os.client_id = v_lancamento.cliente_id and os.deleted_at is null) then
    raise exception 'lancamento_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from financeiro.sso_portal_cobranca_publicacoes where request_id = p_request_id;
  if found then
    if v_anterior.autor_id is distinct from auth.uid() or v_anterior.lancamento_id is distinct from p_lancamento_id
      or v_anterior.os_id is distinct from p_os_id or v_anterior.descricao_publica is distinct from btrim(p_descricao_publica)
      or v_anterior.valor_centavos is distinct from p_valor_esperado or v_anterior.competencia is distinct from p_competencia_esperada
      or v_anterior.vencimento is distinct from p_vencimento_esperado then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('publicacaoId', v_anterior.id, 'lancamentoId', p_lancamento_id, 'requestId', p_request_id);
  end if;
  if v_lancamento.valor_centavos is distinct from p_valor_esperado
    or v_lancamento.data_competencia is distinct from p_competencia_esperada
    or v_lancamento.data_vencimento is distinct from p_vencimento_esperado then
    raise exception 'lancamento_alterado' using errcode = '40001'; end if;
  insert into financeiro.sso_portal_cobranca_publicacoes(lancamento_id, cliente_id, os_id, descricao_publica,
    valor_centavos, competencia, vencimento, autor_id, request_id)
    values (p_lancamento_id, v_lancamento.cliente_id, p_os_id, btrim(p_descricao_publica),
      p_valor_esperado, p_competencia_esperada, p_vencimento_esperado, auth.uid(), p_request_id)
    returning * into v_anterior;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'cobranca.publicada_portal', 'lancamentos', p_lancamento_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lancamento.cliente_id, 'osId', p_os_id, 'publicacaoId', v_anterior.id));
  return jsonb_build_object('publicacaoId', v_anterior.id, 'lancamentoId', p_lancamento_id, 'requestId', p_request_id);
end;
$$;
revoke all on function financeiro.sso_publicar_cobranca_os(uuid, uuid, uuid, text, integer, date, date)
  from public, anon, authenticated, service_role;

create function financeiro.sso_portal_cobrancas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(lancamento_id uuid, descricao text, valor_centavos integer, competencia date, vencimento date, situacao text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select l.id, pub.descricao_publica, pub.valor_centavos, pub.competencia, pub.vencimento,
    case when l.status = 'realizado' then 'paga' when l.data_vencimento < current_date then 'vencida' else 'em_aberto' end
    from financeiro.lancamentos l join lateral (select p.* from financeiro.sso_portal_cobranca_publicacoes p
      where p.lancamento_id = l.id order by p.criado_em desc, p.id desc limit 1) pub on true
    where l.tipo = 'entrada' and l.cliente_id = p_cliente_id and l.os_id = p_os_id
      and pub.cliente_id = p_cliente_id and pub.os_id = p_os_id
      and pub.valor_centavos = l.valor_centavos and pub.competencia = l.data_competencia
      and pub.vencimento is not distinct from l.data_vencimento and (p_apos is null or l.id > p_apos)
    order by l.id limit 20;
end;
$$;
revoke all on function financeiro.sso_portal_cobrancas_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;
