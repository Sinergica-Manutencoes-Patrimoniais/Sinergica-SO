-- Smoke transacional remoto E09 + E02-S22, sem dependência de pgTAP.
-- Uso: supabase db query --linked --file supabase/tests/remote_promotion_smoke.sql

begin;
select '1..1';

do $$
begin
  if not coalesce((
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'financeiro.portal_faturas'::regclass
  ), false) then
    raise exception 'portal_faturas não usa security_invoker';
  end if;
  if not coalesce((
    select reloptions @> array['security_invoker=true']
    from pg_class
    where oid = 'financeiro.portal_cobrancas'::regclass
  ), false) then
    raise exception 'portal_cobrancas não usa security_invoker';
  end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('d1470000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-write@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into config.usuarios (user_id, papel, nome) values
  ('d1470000-0000-0000-0000-000000000001', 'colaborador', 'Smoke remoto')
on conflict (user_id) do nothing;

insert into pcm.clientes (id, nome, created_by) values
  ('d1470000-0000-0000-0000-0000000000a1', '[SMOKE] Cliente A', 'd1470000-0000-0000-0000-000000000001'),
  ('d1470000-0000-0000-0000-0000000000b1', '[SMOKE] Cliente B', 'd1470000-0000-0000-0000-000000000001');

insert into config.usuario_cliente (user_id, cliente_id) values
  ('d1470000-0000-0000-0000-000000000001', 'd1470000-0000-0000-0000-0000000000a1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1470000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"d1470000-0000-0000-0000-0000000000a1","user_modulos":{"area-cliente":"leitura"}}';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from pcm.clientes;
  if v_count <> 1 then
    raise exception 'isolamento E09 falhou: esperado 1 cliente, obtido %', v_count;
  end if;
  if not exists (
    select 1 from pcm.clientes
    where id = 'd1470000-0000-0000-0000-0000000000a1'
  ) then
    raise exception 'isolamento E09 falhou: cliente próprio não visível';
  end if;
  perform count(*) from financeiro.portal_faturas;
  perform count(*) from financeiro.portal_cobrancas;
end;
$$;

reset role;

insert into atendimento.canais_externos (
  id, tipo, label, identificador_externo, created_by
) values
  ('d1470000-0000-0000-0000-000000000011', 'evolution', 'Smoke Chamados', 'smoke-evo-chamados', 'd1470000-0000-0000-0000-000000000001'),
  ('d1470000-0000-0000-0000-000000000012', 'evolution', 'Smoke Comercial', 'smoke-evo-comercial', 'd1470000-0000-0000-0000-000000000001');

insert into atendimento.personas (
  id, nome, tipo, prompt_sistema, base_conhecimento, created_by
) values
  ('d1470000-0000-0000-0000-000000000021', 'Smoke Chamados', 'chamados', 'prompt A', 'base A', 'd1470000-0000-0000-0000-000000000001'),
  ('d1470000-0000-0000-0000-000000000022', 'Smoke Comercial', 'comercial', 'prompt B', 'base B', 'd1470000-0000-0000-0000-000000000001');

insert into atendimento.conversas (id, instance_id, remote_jid, contato_nome) values
  ('d1470000-0000-0000-0000-000000000031', 'smoke-evo-chamados', '5511999990147@s.whatsapp.net', 'Smoke Contato');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1470000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"atendimento":"escrita"}}';

insert into atendimento.instancias_agente (instance_id, persona_id, created_by) values
  ('smoke-evo-chamados', 'd1470000-0000-0000-0000-000000000021', 'd1470000-0000-0000-0000-000000000001'),
  ('smoke-evo-comercial', 'd1470000-0000-0000-0000-000000000022', 'd1470000-0000-0000-0000-000000000001');

select atendimento.fn_vincular_conversa_cliente(
  'd1470000-0000-0000-0000-000000000031',
  'd1470000-0000-0000-0000-0000000000a1'
);

do $$
begin
  if (select count(distinct persona_id) from atendimento.instancias_agente
      where instance_id in ('smoke-evo-chamados', 'smoke-evo-comercial')) <> 2 then
    raise exception 'roteamento multi-instância E02 falhou';
  end if;
  if (select client_id from atendimento.conversas
      where id = 'd1470000-0000-0000-0000-000000000031')
      <> 'd1470000-0000-0000-0000-0000000000a1'::uuid then
    raise exception 'vínculo CRM E02 falhou';
  end if;
  if (select count(*) from atendimento.conversa_cliente_eventos
      where conversa_id = 'd1470000-0000-0000-0000-000000000031') <> 1 then
    raise exception 'auditoria de vínculo CRM E02 falhou';
  end if;
end;
$$;

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select atendimento.fn_definir_handoff(
  'd1470000-0000-0000-0000-000000000031',
  'automatico',
  'smoke remoto'
);

do $$
begin
  if (select modo || ':' || status from atendimento.conversas
      where id = 'd1470000-0000-0000-0000-000000000031') <> 'pausado:pendente' then
    raise exception 'handoff automático E02 falhou';
  end if;
  if not atendimento.fn_consumir_rate_limit_webhook('smoke:0147', 1, 60) then
    raise exception 'primeiro consumo do rate limit E02 falhou';
  end if;
  if atendimento.fn_consumir_rate_limit_webhook('smoke:0147', 1, 60) then
    raise exception 'rate limit E02 não bloqueou excesso';
  end if;
end;
$$;

reset role;
select 'ok 1 - remote_promotion_smoke_ok';
rollback;
