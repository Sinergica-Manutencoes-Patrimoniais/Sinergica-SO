-- comercial_leads_aposentado.test.sql — pgTAP (E03-S10)
-- Confirma o estado FINAL pós-drop (a suíte roda com todas as migrations já aplicadas, então
-- `comercial.leads` já não existe neste banco de teste — não há como testar o "durante", só o
-- "depois"): tabela ausente, coluna ausente, check sem o valor legado, e a timeline (que lia de
-- `comercial.leads`) reescrita pra ler de `comercial.oportunidades` sem quebrar. Cenários já
-- confirmados manualmente em produção antes desta suíte ser escrita. Rodar com `supabase test db`
-- (requer Docker).

begin;
select plan(5);

-- AC-6: a tabela não existe mais
select is(
  (select to_regclass('comercial.leads')::text),
  null,
  'comercial.leads foi dropada (to_regclass retorna null pra tabela inexistente)'
);

-- AC-4: a coluna lead_id foi removida de atendimento.conversas
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'atendimento' and table_name = 'conversas' and column_name = 'lead_id'),
  0,
  'atendimento.conversas.lead_id foi removida'
);

-- AC-5: o check de vinculos não aceita mais 'comercial_lead'
select is(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'vinculos_entidade_tipo_check'),
  $$CHECK ((entidade_tipo = ANY (ARRAY['pcm_cliente'::text])))$$,
  'check de relacionamento.vinculos.entidade_tipo nao aceita mais comercial_lead'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"service_role"}';

-- AC-7: get_timeline_contato continua executável (não referencia mais tabela dropada) — 0 linhas
-- é o resultado esperado pra um contato aleatório sem histórico, o que importa é NÃO LANÇAR ERRO.
select lives_ok(
  $$ select * from relacionamento.get_timeline_contato('00000000-0000-0000-0000-000000000000'::uuid, 5) $$,
  'get_timeline_contato executa sem erro apos a S10 (nao referencia mais comercial.leads)'
);

-- Regressão positiva: oportunidade com origem=whatsapp aparece na timeline como 'lead' (mesma
-- categoria de antes, fonte de dado diferente).
insert into relacionamento.contatos (id, nome, telefone_principal, origem)
values ('00000000-0000-0000-0000-000000000fa1', 'Contato Teste S10', '5511977770000', 'whatsapp')
on conflict (id) do nothing;
insert into pcm.clientes (id, nome, ativo)
values ('00000000-0000-0000-0000-000000000fa2', 'Conta Teste S10', true)
on conflict (id) do nothing;
insert into comercial.etapas_funil (id, nome, ordem, cor, tipo)
values ('00000000-0000-0000-0000-000000000fa3', 'Etapa Teste S10', 999, '#000000', 'aberta')
on conflict (id) do nothing;
set local request.jwt.claims = '{"role":"service_role","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}';
insert into comercial.oportunidades (cliente_id, etapa_id, titulo, origem, contato_id)
values ('00000000-0000-0000-0000-000000000fa2', '00000000-0000-0000-0000-000000000fa3', 'Lead WhatsApp — Teste S10', 'whatsapp', '00000000-0000-0000-0000-000000000fa1');

select is(
  (select count(*)::int from relacionamento.get_timeline_contato('00000000-0000-0000-0000-000000000fa1'::uuid, 50)
    where evento_tipo = 'lead'),
  1,
  'oportunidade whatsapp aparece na timeline do contato como evento tipo lead'
);

select * from finish();
rollback;
