-- E01-S182 (Faturáveis por origem) — prova da publicação de documento de cobrança.
-- S182 tem 113 migrations e 5 arquivos de teste; `financeiro.sso_publicar_documento_cobranca_v2`
-- é dos comandos mais sensíveis do programa (dinheiro + superfície visível ao Cliente) e não
-- tinha nenhuma cobertura.
--
-- Além do caminho feliz e da idempotência, prova as três guardas que impedem publicar um
-- documento errado: o anexo precisa continuar byte-a-byte o mesmo objeto publicado no storage
-- (detecta troca do arquivo por baixo), a cobrança precisa continuar casando com o lançamento,
-- e uma republicação do mesmo lançamento torna a cobrança anterior obsoleta.
begin;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18200000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-financeiro@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18200000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-sem-concessao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18200000-0000-4000-8000-000000000001', 'superadmin', 'S182 Financeiro', true),
 ('18200000-0000-4000-8000-000000000002', 'colaborador', 'S182 Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18200000-0000-4000-8000-00000000000a', 'Cliente S182 A', true, '18200000-0000-4000-8000-000000000001'),
 ('18200000-0000-4000-8000-00000000000b', 'Cliente S182 B', true, '18200000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18200000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18200000-0000-4000-8000-00000000000a');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18200000-0000-4000-8000-00000000001a', 'CH-S182-COB', '18200000-0000-4000-8000-00000000000a', 'Chamado da cobrança', '18200000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18200000-0000-4000-8000-00000000002a', '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000001a', 'OS-S182-COB', 'OS faturada', 'corretiva', 'finalizado', now(), '18200000-0000-4000-8000-000000000001');
insert into pcm.os_notas (id, ordem_servico_id, cliente_id, mensagem, autor_tipo, created_by) values
 ('18200000-0000-4000-8000-00000000003a', '18200000-0000-4000-8000-00000000002a', '18200000-0000-4000-8000-00000000000a', 'Nota com anexo', 'interno', '18200000-0000-4000-8000-000000000001');

-- Objeto real no bucket privado `os-anexos`; a publicação guarda uma fotografia dele.
insert into storage.objects (id, bucket_id, name, metadata, updated_at) values
 ('18200000-0000-4000-8000-00000000004a', 'os-anexos', 'cliente-a/os-cob/laudo.pdf', '{"size": 1234, "mimetype": "application/pdf"}'::jsonb, now());
select metadata as obj_meta, updated_at as obj_em from storage.objects where id = '18200000-0000-4000-8000-00000000004a' \gset

insert into pcm.sso_portal_anexos_publicacoes (id, nota_id, cliente_id, ordem_servico_id, objeto_id, caminho, metadata_snapshot, objeto_updated_at, titulo, ator_id, request_id) values
 ('18200000-0000-4000-8000-00000000005a', '18200000-0000-4000-8000-00000000003a', '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000002a',
  '18200000-0000-4000-8000-00000000004a', 'cliente-a/os-cob/laudo.pdf', :'obj_meta'::jsonb, :'obj_em'::timestamptz, 'Laudo', '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-0000000000f1'),
 -- Mesma publicação, mas com fotografia divergente: simula o arquivo ter sido trocado depois.
 ('18200000-0000-4000-8000-00000000005b', '18200000-0000-4000-8000-00000000003a', '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000002a',
  '18200000-0000-4000-8000-00000000004a', 'cliente-a/os-cob/laudo.pdf', '{"size": 9999, "mimetype": "application/pdf"}'::jsonb, :'obj_em'::timestamptz, 'Laudo adulterado', '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-0000000000f2');

insert into financeiro.categorias (id, nome, tipo) values ('18200000-0000-4000-8000-00000000006a', 'Serviços S182', 'entrada');
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id, os_id, created_by) values
 ('18200000-0000-4000-8000-00000000007a', 'entrada', 'previsto', 150000, date '2026-11-01', date '2026-11-30', '18200000-0000-4000-8000-00000000006a',
  '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000002a', '18200000-0000-4000-8000-000000000001');
insert into financeiro.sso_portal_cobranca_publicacoes (id, lancamento_id, cliente_id, os_id, descricao_publica, valor_centavos, competencia, vencimento, autor_id, request_id) values
 ('18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000007a', '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000002a',
  'Serviço executado em novembro', 150000, date '2026-11-01', date '2026-11-30', '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-0000000000f3');

set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'),
  '55000', 'indisponivel', 'gates de documento de cobrança e de anexo do portal fechados recusam'
);

reset role;
update financeiro.sso_documento_cobranca_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'),
  '55000', 'indisponivel', 'só um dos dois gates aberto ainda recusa — publicar exige os dois'
);

reset role;
update pcm.sso_portal_anexo_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,null) $f$,
    '18200000-0000-4000-8000-00000000008a'),
  '22023', 'dados_invalidos', 'parâmetro nulo é recusado'
);

select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),gen_random_uuid(),%L) $f$,
    '18200000-0000-4000-8000-00000000005a'),
  '42501', 'sem_acesso', 'cobrança inexistente é recusada'
);

-- A guarda contra troca do arquivo: a fotografia do anexo não bate mais com o objeto no storage.
select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005b'),
  '23514', 'anexo_nao_publicado_ou_indisponivel', 'anexo cuja fotografia divergiu do objeto no storage nunca é publicado'
);

select (financeiro.sso_publicar_documento_cobranca_v2('18200000-0000-4000-8000-0000000000e1',
  '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a')) as vinculo \gset
select isnt(:'vinculo'::text, null::text, 'publicação válida cria o vínculo documento-cobrança');

select is(
  (financeiro.sso_publicar_documento_cobranca_v2('18200000-0000-4000-8000-0000000000e1',
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'))::text,
  :'vinculo', 'replay do mesmo requestId devolve o mesmo vínculo, nunca publica de novo'
);

select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(%L,%L,%L) $f$,
    '18200000-0000-4000-8000-0000000000e1', '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005b'),
  '23505', 'request_id_conflitante', 'mesmo requestId com anexo diferente é recusado'
);

select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'),
  '23505', 'vinculo_ativo_existente', 'o mesmo par cobrança+anexo nunca é vinculado duas vezes'
);

reset role;
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'),
  '42501', 'sem_acesso', 'usuário sem a concessão faturavel.efetivar não publica cobrança'
);

-- Republicar a cobrança do mesmo lançamento torna a anterior obsoleta.
reset role;
insert into financeiro.sso_portal_cobranca_publicacoes (id, lancamento_id, cliente_id, os_id, descricao_publica, valor_centavos, competencia, vencimento, autor_id, request_id, criado_em) values
 ('18200000-0000-4000-8000-00000000008b', '18200000-0000-4000-8000-00000000007a', '18200000-0000-4000-8000-00000000000a', '18200000-0000-4000-8000-00000000002a',
  'Serviço executado em novembro (revisado)', 150000, date '2026-11-01', date '2026-11-30', '18200000-0000-4000-8000-000000000001', '18200000-0000-4000-8000-0000000000f4', now() + interval '1 minute');
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008a', '18200000-0000-4000-8000-00000000005a'),
  '40001', 'cobranca_obsoleta', 'cobrança superada por republicação do mesmo lançamento não publica mais'
);

-- Lançamento alterado por fora também invalida a cobrança já publicada.
reset role;
update financeiro.lancamentos set valor_centavos = 999900 where id = '18200000-0000-4000-8000-00000000007a';
set local request.jwt.claims = '{"sub":"18200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_publicar_documento_cobranca_v2(gen_random_uuid(),%L,%L) $f$,
    '18200000-0000-4000-8000-00000000008b', '18200000-0000-4000-8000-00000000005a'),
  '40001', 'cobranca_obsoleta', 'valor do lançamento alterado por fora invalida a publicação da cobrança'
);

select * from finish();
rollback;
