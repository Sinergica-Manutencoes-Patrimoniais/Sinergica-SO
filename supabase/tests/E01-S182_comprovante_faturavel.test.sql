-- E01-S182 (Faturáveis por origem) — prova do vínculo de comprovante a item faturável.
-- `financeiro.sso_vincular_comprovante_faturavel` liga o item faturável ao comprovante real da
-- despesa de visita, guardado em bucket privado. Não tinha cobertura.
--
-- A guarda que mais importa: o vínculo só é aceito se o objeto referenciado existir de fato no
-- bucket privado `sso-despesas-visita`, no caminho declarado. E, uma vez vinculado, se o
-- comprovante daquela revisão mudar, uma nova tentativa é recusada em vez de apontar para outro
-- arquivo em silêncio.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18220000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-comprovante@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18220000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-comprovante-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18220000-0000-4000-8000-000000000001', 'superadmin', 'S182 Comprovante', true),
 ('18220000-0000-4000-8000-000000000002', 'colaborador', 'S182 Comprovante Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18220000-0000-4000-8000-00000000000a', 'Cliente S182 Comprovante', true, '18220000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18220000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18220000-0000-4000-8000-00000000000a');

insert into pcm.visitas (id, cliente_id, inicio_em, fim_em, fuso, natureza, estado, revisao, created_by) values
 ('18220000-0000-4000-8000-00000000001a', '18220000-0000-4000-8000-00000000000a', now(), now() + interval '2 hours', 'America/Sao_Paulo', 'regular', 'concluida', 1, '18220000-0000-4000-8000-000000000001');
-- despesas_visita.categoria_id referencia pcm.despesa_tipos (o catálogo espelhado do Auvo),
-- não financeiro.categorias.
insert into pcm.despesa_tipos (id, auvo_id, nome) values ('18220000-0000-4000-8000-00000000002a', 182201, 'Deslocamento');
insert into pcm.despesas_visita (id, visita_id, cliente_id, categoria_id, data, descricao, previsto_centavos, realizado_centavos, created_by) values
 ('18220000-0000-4000-8000-00000000003a', '18220000-0000-4000-8000-00000000001a', '18220000-0000-4000-8000-00000000000a', '18220000-0000-4000-8000-00000000002a',
  current_date, 'Pedágio e combustível', 8000, 8500, '18220000-0000-4000-8000-000000000001');

insert into storage.objects (id, bucket_id, name, metadata, updated_at) values
 ('18220000-0000-4000-8000-00000000004a', 'sso-despesas-visita', 'cliente/despesa/comprovante-v1.pdf', '{"size": 512}'::jsonb, now()),
 ('18220000-0000-4000-8000-00000000004b', 'sso-despesas-visita', 'cliente/despesa/comprovante-v2.pdf', '{"size": 777}'::jsonb, now());

-- Realizações começam na revisão 2 (a 1 é a declaração original da despesa). A revisão 2 tem
-- comprovante real; a 3 aponta para um objeto que não existe no bucket.
insert into pcm.despesa_visita_realizacoes (despesa_id, revisao, valor_centavos, comprovante_objeto_id, comprovante_caminho, ator_id, request_id) values
 ('18220000-0000-4000-8000-00000000003a', 2, 8500, '18220000-0000-4000-8000-00000000004a', 'cliente/despesa/comprovante-v1.pdf', '18220000-0000-4000-8000-000000000001', '18220000-0000-4000-8000-0000000000f1');
-- Há uma realização por despesa; as revisões seguintes do comprovante vivem nas correções.
insert into pcm.despesa_visita_correcoes_realizacao (despesa_id, revisao, valor_anterior, valor_novo, objeto_anterior, caminho_anterior, objeto_novo, caminho_novo, motivo, conferencia_financeira, ator_id, request_id) values
 ('18220000-0000-4000-8000-00000000003a', 3, 8500, 8500, '18220000-0000-4000-8000-00000000004a', 'cliente/despesa/comprovante-v1.pdf',
  '18220000-0000-4000-8000-0000000000dd', 'cliente/despesa/fantasma.pdf', 'Comprovante substituído', 'Conferido', '18220000-0000-4000-8000-000000000001', '18220000-0000-4000-8000-0000000000f2');

insert into financeiro.itens_faturaveis (id, cliente_id, origem_tipo, origem_id, valor_original_centavos, competencia) values
 ('18220000-0000-4000-8000-00000000005a', '18220000-0000-4000-8000-00000000000a', 'despesa_visita', '18220000-0000-4000-8000-00000000003a', 8500, date '2026-11-01'),
 -- Item de outra origem: o vínculo de comprovante é exclusivo de despesa de visita.
 ('18220000-0000-4000-8000-00000000005b', '18220000-0000-4000-8000-00000000000a', 'outra_origem', '18220000-0000-4000-8000-00000000003a', 8500, date '2026-11-01');

set local request.jwt.claims = '{"sub":"18220000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,2) $f$, '18220000-0000-4000-8000-00000000005a'),
  '55000', 'indisponivel', 'gate de anexo faturável fechado por padrão recusa'
);

reset role;
update financeiro.sso_anexo_faturavel_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18220000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,0) $f$, '18220000-0000-4000-8000-00000000005a'),
  '22023', 'dados_invalidos', 'revisão menor que 1 é recusada'
);
select throws_ok(
  $$ select financeiro.sso_vincular_comprovante_faturavel(gen_random_uuid(),2) $$,
  '42501', 'sem_acesso', 'item faturável inexistente é recusado'
);
select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,2) $f$, '18220000-0000-4000-8000-00000000005b'),
  '42501', 'sem_acesso', 'item de outra origem não aceita comprovante de despesa de visita'
);
select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,3) $f$, '18220000-0000-4000-8000-00000000005a'),
  '23514', 'comprovante_indisponivel', 'revisão cujo objeto não existe no bucket privado é recusada'
);

select (financeiro.sso_vincular_comprovante_faturavel('18220000-0000-4000-8000-00000000005a', 2)) as anexo \gset
select isnt(:'anexo'::text, null::text, 'comprovante real é vinculado ao item faturável');

select is(
  (financeiro.sso_vincular_comprovante_faturavel('18220000-0000-4000-8000-00000000005a', 2))::text,
  :'anexo', 'vincular de novo a mesma revisão reaproveita o vínculo, nunca duplica'
);

reset role;
set local request.jwt.claims = '{"sub":"18220000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,2) $f$, '18220000-0000-4000-8000-00000000005a'),
  '42501', 'sem_acesso', 'usuário sem a concessão faturavel.efetivar não vincula comprovante'
);

-- Comprovante da revisão trocado depois do vínculo: recusa explícita em vez de apontar para
-- outro arquivo em silêncio.
reset role;
update pcm.despesa_visita_realizacoes
  set comprovante_objeto_id = '18220000-0000-4000-8000-00000000004b', comprovante_caminho = 'cliente/despesa/comprovante-v2.pdf'
  where despesa_id = '18220000-0000-4000-8000-00000000003a';
set local request.jwt.claims = '{"sub":"18220000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_vincular_comprovante_faturavel(%L,2) $f$, '18220000-0000-4000-8000-00000000005a'),
  '23505', 'vinculo_conflitante', 'comprovante trocado depois do vínculo é recusado, nunca sobrescrito'
);

select * from finish();
rollback;
