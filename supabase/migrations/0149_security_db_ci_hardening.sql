-- 0149_security_db_ci_hardening.sql — Sinérgica SO
-- Fecha guardas NULL em SECURITY DEFINER, restaura portal financeiro sem expor tabelas-base,
-- corrige a provisão tributária e completa privilégio coerente com RLS de sistema_itens.
-- Reverso: reaplicar definições 0115/0116/0123/0146/0147 e revogar DELETE de authenticated.

create or replace function financeiro.fn_rentabilidade_cliente_mes(p_meses int default 12)
returns table (
  cliente_id uuid,
  mes date,
  receita_centavos bigint,
  custo_mo_centavos bigint,
  custo_despesas_centavos bigint,
  horas_totais numeric,
  horas_valoradas numeric,
  margem_centavos bigint,
  margem_percentual numeric
)
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
declare
  v_desde date := (date_trunc('month', current_date) - (greatest(p_meses, 1) - 1 || ' month')::interval)::date;
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_rentabilidade_cliente_mes' using errcode = '42501';
  end if;

  return query
  with despesas_por_task as (
    select auvo_task_id, sum(valor_centavos) as total_despesa_centavos
    from pcm.despesas
    where auvo_task_id is not null
    group by auvo_task_id
  ),
  os_custo as (
    select
      os.client_id,
      date_trunc('month', coalesce(os.check_out_at::date, os.data_agendada::date))::date as mes,
      coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0) as horas,
      financeiro._fn_custo_hora_funcionario(
        os.tecnico_funcionario_id,
        coalesce(os.check_out_at::date, os.data_agendada::date)
      ) as custo_hora_reais,
      coalesce(desp.total_despesa_centavos, 0) as despesa_centavos
    from pcm.ordens_servico os
    left join despesas_por_task desp on desp.auvo_task_id = os.auvo_task_id
    where os.status = 'finalizado'
      and os.deleted_at is null
      and coalesce(os.check_out_at::date, os.data_agendada::date) >= v_desde
      and os.client_id is not null
  ),
  custo_agregado as (
    select
      oc.client_id,
      oc.mes,
      sum(oc.horas) as horas_totais,
      sum(oc.horas) filter (where oc.custo_hora_reais is not null) as horas_valoradas,
      round(sum(oc.horas * coalesce(oc.custo_hora_reais, 0)) * 100)::bigint as custo_mo_centavos,
      sum(oc.despesa_centavos)::bigint as custo_despesas_centavos
    from os_custo oc
    group by oc.client_id, oc.mes
  ),
  receita_agregada as (
    select
      l.cliente_id as client_id,
      date_trunc('month', l.data_competencia)::date as mes,
      sum(l.valor_centavos) as receita_centavos
    from financeiro.lancamentos l
    where l.tipo = 'entrada' and l.status = 'realizado' and l.cliente_id is not null
      and l.data_competencia >= v_desde
    group by l.cliente_id, date_trunc('month', l.data_competencia)
  )
  select
    coalesce(ca.client_id, ra.client_id) as cliente_id,
    coalesce(ca.mes, ra.mes) as mes,
    coalesce(ra.receita_centavos, 0) as receita_centavos,
    coalesce(ca.custo_mo_centavos, 0) as custo_mo_centavos,
    coalesce(ca.custo_despesas_centavos, 0) as custo_despesas_centavos,
    coalesce(ca.horas_totais, 0) as horas_totais,
    coalesce(ca.horas_valoradas, 0) as horas_valoradas,
    coalesce(ra.receita_centavos, 0) - coalesce(ca.custo_mo_centavos, 0) - coalesce(ca.custo_despesas_centavos, 0) as margem_centavos,
    case
      when coalesce(ra.receita_centavos, 0) > 0
        then round(
          ((coalesce(ra.receita_centavos, 0) - coalesce(ca.custo_mo_centavos, 0) - coalesce(ca.custo_despesas_centavos, 0))::numeric
            / ra.receita_centavos) * 100, 1)
      else null
    end as margem_percentual
  from custo_agregado ca
  full outer join receita_agregada ra on ra.client_id = ca.client_id and ra.mes = ca.mes
  order by 1, 2;
end;
$$;

revoke all on function financeiro.fn_rentabilidade_cliente_mes(int) from public;
grant execute on function financeiro.fn_rentabilidade_cliente_mes(int) to authenticated;

create or replace function financeiro.fn_custo_os_por_cliente_mes(p_cliente_id uuid, p_mes date)
returns table (
  os_id uuid,
  numero text,
  data date,
  tecnico_funcionario_id uuid,
  horas numeric,
  custo_hora_reais numeric,
  custo_mo_centavos bigint,
  despesa_centavos bigint,
  valorado boolean
)
language plpgsql
stable
security definer
set search_path = financeiro, pcm, pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'financeiro') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_custo_os_por_cliente_mes' using errcode = '42501';
  end if;

  return query
  with despesas_por_task as (
    select auvo_task_id, sum(valor_centavos) as total_despesa_centavos
    from pcm.despesas
    where auvo_task_id is not null
    group by auvo_task_id
  )
  select
    os.id as os_id,
    os.numero,
    coalesce(os.check_out_at::date, os.data_agendada::date) as data,
    os.tecnico_funcionario_id,
    coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0) as horas,
    financeiro._fn_custo_hora_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) as custo_hora_reais,
    round(
      coalesce((os.auvo_detalhes ->> 'duracaoHoras')::numeric, 0)
      * coalesce(financeiro._fn_custo_hora_funcionario(
          os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
        ), 0) * 100
    )::bigint as custo_mo_centavos,
    coalesce(desp.total_despesa_centavos, 0) as despesa_centavos,
    financeiro._fn_custo_hora_funcionario(
      os.tecnico_funcionario_id, coalesce(os.check_out_at::date, os.data_agendada::date)
    ) is not null as valorado
  from pcm.ordens_servico os
  left join despesas_por_task desp on desp.auvo_task_id = os.auvo_task_id
  where os.status = 'finalizado'
    and os.deleted_at is null
    and os.client_id = p_cliente_id
    and date_trunc('month', coalesce(os.check_out_at::date, os.data_agendada::date))::date = date_trunc('month', p_mes)::date
  order by data;
end;
$$;

revoke all on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) from public;
grant execute on function financeiro.fn_custo_os_por_cliente_mes(uuid, date) to authenticated;

create or replace function atendimento.fn_definir_handoff(
  p_conversa_id uuid,
  p_acao text,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = atendimento, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_pode_escrever boolean := coalesce(
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita',
    false
  );
  v_modo text;
begin
  if p_acao not in ('automatico', 'assumir', 'devolver', 'envio_humano') then
    raise exception 'ação de handoff inválida: %', p_acao using errcode = '22023';
  end if;
  if p_acao = 'automatico' and not v_service then
    raise exception 'handoff automático exige service_role' using errcode = '42501';
  end if;
  if p_acao <> 'automatico' and (v_actor is null or not v_pode_escrever) then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;

  select modo into v_modo
  from atendimento.conversas
  where id = p_conversa_id
  for update;
  if not found then
    raise exception 'conversa não encontrada' using errcode = 'P0002';
  end if;

  if p_acao = 'devolver' then
    update atendimento.conversas
    set modo = 'auto', status = 'aberta', atribuido_a = null,
        handoff_motivo = null, handoff_em = null,
        updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  elsif p_acao = 'automatico' then
    update atendimento.conversas
    set modo = 'pausado', status = 'pendente', atribuido_a = null,
        handoff_motivo = nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), ''),
        handoff_em = coalesce(handoff_em, now()), updated_at = now()
    where id = p_conversa_id;
  else
    update atendimento.conversas
    set modo = 'pausado', status = 'aberta', atribuido_a = v_actor,
        handoff_motivo = coalesce(nullif(left(trim(coalesce(p_motivo, '')), 500), ''), handoff_motivo),
        handoff_em = coalesce(handoff_em, now()), updated_at = now(), updated_by = v_actor
    where id = p_conversa_id;
  end if;

  if p_acao <> 'automatico'
     or v_modo <> 'pausado'
     or not exists (
       select 1 from atendimento.handoff_eventos
       where conversa_id = p_conversa_id and acao = 'automatico'
         and motivo is not distinct from nullif(left(trim(coalesce(p_motivo, 'regra automática')), 500), '')
         and created_at >= now() - interval '1 minute'
     ) then
    insert into atendimento.handoff_eventos (conversa_id, acao, motivo, actor_id)
    values (p_conversa_id, p_acao, nullif(left(trim(coalesce(p_motivo, '')), 500), ''), v_actor);
  end if;
end;
$$;

revoke all on function atendimento.fn_definir_handoff(uuid, text, text) from public;
grant execute on function atendimento.fn_definir_handoff(uuid, text, text) to authenticated, service_role;

create or replace function atendimento.fn_vincular_conversa_cliente(
  p_conversa_id uuid,
  p_cliente_id uuid
) returns void
language plpgsql
security definer
set search_path = atendimento, relacionamento, pcm, public
as $$
declare
  v_actor uuid := auth.uid();
  v_pode_escrever boolean := coalesce(
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita',
    false
  );
  v_contato_id uuid;
  v_cliente_anterior uuid;
  v_remote_jid text;
begin
  if v_actor is null or not v_pode_escrever then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pcm.clientes where id = p_cliente_id and ativo = true and deleted_at is null
  ) then
    raise exception 'cliente PCM ativo não encontrado' using errcode = 'P0002';
  end if;

  select contato_id, client_id, remote_jid
  into v_contato_id, v_cliente_anterior, v_remote_jid
  from atendimento.conversas
  where id = p_conversa_id
  for update;
  if not found then
    raise exception 'conversa não encontrada' using errcode = 'P0002';
  end if;

  if v_contato_id is null then
    v_contato_id := relacionamento.fn_upsert_contato_whatsapp(v_remote_jid, null);
  end if;

  update atendimento.conversas
  set client_id = p_cliente_id, contato_id = v_contato_id,
      updated_at = now(), updated_by = v_actor
  where id = p_conversa_id;

  update relacionamento.vinculos
  set principal = false, updated_at = now(), updated_by = v_actor
  where contato_id = v_contato_id
    and entidade_tipo = 'pcm_cliente'
    and entidade_id <> p_cliente_id
    and principal = true;

  insert into relacionamento.vinculos (
    contato_id, entidade_tipo, entidade_id, papel, principal, created_by, updated_by
  ) values (
    v_contato_id, 'pcm_cliente', p_cliente_id, 'contato', true, v_actor, v_actor
  )
  on conflict (contato_id, entidade_tipo, entidade_id) do update
  set principal = true, updated_at = now(), updated_by = excluded.updated_by;

  if v_cliente_anterior is distinct from p_cliente_id then
    insert into atendimento.conversa_cliente_eventos (
      conversa_id, contato_id, cliente_anterior, cliente_novo, actor_id
    ) values (
      p_conversa_id, v_contato_id, v_cliente_anterior, p_cliente_id, v_actor
    );
  end if;
end;
$$;

revoke all on function atendimento.fn_vincular_conversa_cliente(uuid, uuid) from public;
grant execute on function atendimento.fn_vincular_conversa_cliente(uuid, uuid) to authenticated;

create or replace function atendimento.fn_listar_clientes_para_vinculo()
returns table (id uuid, nome text)
language plpgsql
stable
security definer
set search_path = atendimento, pcm, public
as $$
begin
  if auth.uid() is null or coalesce(
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita',
    false
  ) is not true then
    raise exception 'atendimento:escrita obrigatório' using errcode = '42501';
  end if;

  return query
  select c.id, c.nome
  from pcm.clientes c
  where c.ativo = true and c.deleted_at is null
  order by c.nome;
end;
$$;

revoke all on function atendimento.fn_listar_clientes_para_vinculo() from public;
grant execute on function atendimento.fn_listar_clientes_para_vinculo() to authenticated;

create or replace function pcm.portal_decidir_orcamento(
  p_orcamento_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orc pcm.orcamentos_servico%rowtype;
  v_req pcm.requisicoes_servico%rowtype;
  v_os_id uuid;
  v_actor uuid := auth.uid();
  v_cliente_id uuid;
begin
  if v_actor is null
     or auth.jwt() ->> 'user_role' is distinct from 'cliente-sindico'
     or nullif(auth.jwt() ->> 'cliente_id', '') is null then
    raise exception 'somente_cliente_sindico' using errcode = '42501';
  end if;
  v_cliente_id := (auth.jwt() ->> 'cliente_id')::uuid;

  if p_decisao not in ('aprovado','recusado') then
    raise exception 'decisao_invalida' using errcode = '23514';
  end if;
  if p_decisao = 'recusado' and nullif(btrim(p_motivo), '') is null then
    raise exception 'motivo_recusa_obrigatorio' using errcode = '23514';
  end if;

  select * into v_orc
  from pcm.orcamentos_servico
  where id = p_orcamento_id
  for update;
  if not found or v_orc.cliente_id is distinct from v_cliente_id then
    raise exception 'orcamento_nao_encontrado' using errcode = '42501';
  end if;
  if v_orc.status <> 'pendente' or (v_orc.valido_ate is not null and v_orc.valido_ate < current_date) then
    raise exception 'orcamento_nao_decidivel' using errcode = '23514';
  end if;

  insert into pcm.orcamento_decisoes (orcamento_id, cliente_id, decisao, motivo, autor_user_id)
  values (v_orc.id, v_orc.cliente_id, p_decisao, nullif(btrim(p_motivo), ''), v_actor);

  update pcm.orcamentos_servico
  set status = p_decisao, updated_at = now(), updated_by = v_actor
  where id = v_orc.id;

  update pcm.requisicoes_servico
  set status = case p_decisao when 'aprovado' then 'aceita' else 'recusada' end
  where id = v_orc.requisicao_id
  returning * into v_req;

  if p_decisao = 'aprovado' then
    insert into pcm.ordens_servico (
      client_id, numero, titulo, descricao, categoria, status, prioridade,
      origem, origem_ref_id, created_by
    ) values (
      v_orc.cliente_id, pcm.fn_proximo_numero_os(), v_orc.titulo,
      coalesce(v_orc.descricao, v_req.descricao), 'corretiva', 'solicitacao', 'normal',
      'portal', v_orc.id::text, v_actor
    ) returning id into v_os_id;
    update pcm.orcamentos_servico set ordem_servico_id = v_os_id where id = v_orc.id;
  end if;

  return v_os_id;
end;
$$;

revoke all on function pcm.portal_decidir_orcamento(uuid, text, text) from public;
grant execute on function pcm.portal_decidir_orcamento(uuid, text, text) to authenticated;

-- Debounce atômico: serializa por queue_key para impedir dois webhooks concorrentes de criarem
-- duas linhas pending. O chamador só informa a chave e o novo prazo; status sempre nasce pending.
create or replace function atendimento.fn_debounce_wa_queue(
  p_queue_key text,
  p_wait_until timestamptz
) returns uuid
language plpgsql
security definer
set search_path = atendimento, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role obrigatório' using errcode = '42501';
  end if;
  if nullif(trim(p_queue_key), '') is null or p_wait_until is null then
    raise exception 'queue_key e wait_until são obrigatórios' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_queue_key, 0));

  select q.id into v_id
  from atendimento.wa_queue q
  where q.queue_key = p_queue_key and q.status = 'pending'
  order by q.created_at desc, q.id
  limit 1
  for update;

  if v_id is null then
    insert into atendimento.wa_queue (queue_key, wait_until, status)
    values (p_queue_key, p_wait_until, 'pending')
    returning id into v_id;
  else
    update atendimento.wa_queue q
    set wait_until = p_wait_until, error_message = null
    where q.id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function atendimento.fn_debounce_wa_queue(text, timestamptz) from public, authenticated;
grant execute on function atendimento.fn_debounce_wa_queue(text, timestamptz) to service_role;

create or replace function financeiro.fn_portal_faturas()
returns table (
  id uuid,
  cliente_id uuid,
  contrato_id uuid,
  descricao text,
  valor_centavos integer,
  data_competencia date,
  data_vencimento date,
  data_pagamento date,
  status text
)
language sql
stable
security definer
set search_path = financeiro, pg_temp
as $$
  select
    l.id,
    l.cliente_id,
    l.contrato_id,
    l.descricao,
    l.valor_centavos,
    l.data_competencia,
    l.data_vencimento,
    l.data_pagamento,
    case
      when l.status = 'realizado' then 'paga'
      when l.data_vencimento < current_date then 'vencida'
      else 'em_aberto'
    end as status
  from financeiro.lancamentos l
  where auth.uid() is not null
    and auth.jwt() ->> 'user_role' = 'cliente-sindico'
    and nullif(auth.jwt() ->> 'cliente_id', '') is not null
    and l.tipo = 'entrada'
    and l.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
$$;

revoke all on function financeiro.fn_portal_faturas() from public;
grant execute on function financeiro.fn_portal_faturas() to authenticated;

create or replace function financeiro.fn_portal_cobrancas()
returns table (
  id uuid,
  cliente_id uuid,
  lancamento_id uuid,
  tipo text,
  status text,
  linha_digitavel text,
  qr_code text,
  link_pagamento text,
  valor_centavos integer,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = financeiro, pg_temp
as $$
  select
    c.id,
    l.cliente_id,
    c.lancamento_id,
    c.tipo,
    c.status,
    c.linha_digitavel,
    c.qr_code,
    c.link_pagamento,
    c.valor_centavos,
    c.criado_em
  from financeiro.cobrancas c
  join financeiro.lancamentos l on l.id = c.lancamento_id
  where auth.uid() is not null
    and auth.jwt() ->> 'user_role' = 'cliente-sindico'
    and nullif(auth.jwt() ->> 'cliente_id', '') is not null
    and l.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
$$;

revoke all on function financeiro.fn_portal_cobrancas() from public;
grant execute on function financeiro.fn_portal_cobrancas() to authenticated;

create or replace view financeiro.portal_faturas
with (security_barrier = true, security_invoker = true) as
select * from financeiro.fn_portal_faturas();

create or replace view financeiro.portal_cobrancas
with (security_barrier = true, security_invoker = true) as
select * from financeiro.fn_portal_cobrancas();

grant select on financeiro.portal_faturas, financeiro.portal_cobrancas to authenticated;

grant delete on pcm.sistema_itens to authenticated;

create or replace function financeiro.fn_provisionar_imposto(p_competencia date)
returns table (
  competencia date,
  receita_centavos bigint,
  rbt12_centavos bigint,
  aliquota_efetiva numeric,
  valor_centavos bigint,
  lancamento_id uuid
)
language plpgsql
security invoker
set search_path = financeiro, pg_temp
as $$
declare
  v_mes_inicio date := date_trunc('month', p_competencia)::date;
  v_mes_fim date := (date_trunc('month', p_competencia) + interval '1 month' - interval '1 day')::date;
  v_config financeiro.config_impostos%rowtype;
  v_receita bigint;
  v_rbt12 bigint;
  v_aliquota numeric(8, 6);
  v_valor bigint;
  v_categoria_id uuid;
  v_existente financeiro.provisoes_imposto%rowtype;
  v_lancamento_status text;
  v_lancamento_id uuid;
  v_faixa jsonb;
begin
  select * into v_config from financeiro.config_impostos where id = 1 and ativo;
  if not found then
    raise exception 'Configuração de impostos não definida ou inativa (Configurações > Impostos).' using errcode = '22023';
  end if;

  select coalesce(sum(l.valor_centavos), 0) into v_receita
  from financeiro.lancamentos l
  where l.tipo = 'entrada' and l.data_competencia between v_mes_inicio and v_mes_fim;

  select coalesce(sum(l.valor_centavos), 0) into v_rbt12
  from financeiro.lancamentos l
  where l.tipo = 'entrada'
    and l.data_competencia between (v_mes_inicio - interval '11 months')::date and v_mes_fim;

  if v_config.tipo = 'fixa' then
    v_aliquota := coalesce(v_config.aliquota_fixa, 0);
  elsif v_rbt12 <= 0 then
    v_aliquota := 0;
  else
    select f into v_faixa
    from jsonb_array_elements(v_config.faixas) as f
    where (f ->> 'ateRbt12Centavos') is null or v_rbt12 <= (f ->> 'ateRbt12Centavos')::bigint
    order by coalesce((f ->> 'ateRbt12Centavos')::bigint, 9223372036854775807) asc
    limit 1;

    if v_faixa is null then
      v_aliquota := 0;
    else
      v_aliquota := greatest(
        (v_rbt12 * (v_faixa ->> 'aliquotaNominal')::numeric - (v_faixa ->> 'parcelaDeduzirCentavos')::bigint) / v_rbt12,
        0
      );
    end if;
  end if;

  v_valor := round(v_receita * v_aliquota);

  select * into v_existente from financeiro.provisoes_imposto p where p.competencia = v_mes_inicio;

  if v_existente.competencia is not null then
    select l.status into v_lancamento_status from financeiro.lancamentos l where l.id = v_existente.lancamento_id;
  end if;

  if v_valor <= 0 then
    if v_existente.competencia is not null and v_lancamento_status = 'previsto' then
      delete from financeiro.lancamentos l where l.id = v_existente.lancamento_id;
      delete from financeiro.provisoes_imposto p where p.competencia = v_mes_inicio;
    end if;
    return query select v_mes_inicio, v_receita, v_rbt12, v_aliquota, 0::bigint, null::uuid;
    return;
  end if;

  select c.id into v_categoria_id
  from financeiro.categorias c
  where c.nome = 'Impostos e taxas' and c.parent_id is null
  limit 1;

  if v_existente.competencia is null then
    insert into financeiro.lancamentos (tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, origem, descricao)
    values ('saida', 'previsto', v_valor, v_mes_inicio,
            (v_mes_fim + 1) + (v_config.dia_vencimento - 1), v_categoria_id, 'recorrencia',
            'Provisão de imposto (Simples Nacional/DAS) — ' || to_char(v_mes_inicio, 'MM/YYYY'))
    returning id into v_lancamento_id;

    insert into financeiro.provisoes_imposto (competencia, lancamento_id, receita_centavos, rbt12_centavos, aliquota_efetiva, valor_centavos)
    values (v_mes_inicio, v_lancamento_id, v_receita, v_rbt12, v_aliquota, v_valor);
  else
    v_lancamento_id := v_existente.lancamento_id;
    if v_lancamento_status = 'previsto' then
      update financeiro.lancamentos l
      set valor_centavos = v_valor, updated_at = now()
      where l.id = v_lancamento_id;
    end if;
    update financeiro.provisoes_imposto p
    set receita_centavos = v_receita, rbt12_centavos = v_rbt12, aliquota_efetiva = v_aliquota,
        valor_centavos = v_valor, updated_at = now()
    where p.competencia = v_mes_inicio;
  end if;

  return query select v_mes_inicio, v_receita, v_rbt12, v_aliquota, v_valor, v_lancamento_id;
end;
$$;

revoke all on function financeiro.fn_provisionar_imposto(date) from public;
grant execute on function financeiro.fn_provisionar_imposto(date) to authenticated;
