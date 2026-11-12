-- E01-S182 (Faturáveis por origem) — prova da retirada de documento de cobrança do portal.
-- Par do `E01-S182_publicacao_documento_cobranca.test.sql`: fecha o ciclo de vida do documento
-- que o Cliente enxerga. `financeiro.sso_retira_documento_cobranca` não tinha cobertura.
--
-- A propriedade mais importante provada aqui: retirar é idempotente (retirar duas vezes não
-- duplica revogação nem falha) e libera o mesmo par cobrança+anexo para ser republicado — ou
-- seja, um documento retirado por engano pode voltar, sem precisar de outro anexo.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18210000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-retirada@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18210000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-retirada-sem-concessao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18210000-0000-4000-8000-000000000001', 'superadmin', 'S182 Retirada', true),
 ('18210000-0000-4000-8000-000000000002', 'colaborador', 'S182 Retirada Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18210000-0000-4000-8000-00000000000a', 'Cliente S182 Retirada', true, '18210000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18210000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18210000-0000-4000-8000-00000000000a');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18210000-0000-4000-8000-00000000001a', 'CH-S182-RET', '18210000-0000-4000-8000-00000000000a', 'Chamado da retirada', '18210000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18210000-0000-4000-8000-00000000002a', '18210000-0000-4000-8000-00000000000a', '18210000-0000-4000-8000-00000000001a', 'OS-S182-RET', 'OS faturada', 'corretiva', 'finalizado', now(), '18210000-0000-4000-8000-000000000001');
insert into pcm.os_notas (id, ordem_servico_id, cliente_id, mensagem, autor_tipo, created_by) values
 ('18210000-0000-4000-8000-00000000003a', '18210000-0000-4000-8000-00000000002a', '18210000-0000-4000-8000-00000000000a', 'Nota com anexo', 'interno', '18210000-0000-4000-8000-000000000001');
insert into storage.objects (id, bucket_id, name, metadata, updated_at) values
 ('18210000-0000-4000-8000-00000000004a', 'os-anexos', 'cliente-ret/os-ret/laudo.pdf', '{"size": 2048, "mimetype": "application/pdf"}'::jsonb, now());
select metadata as obj_meta, updated_at as obj_em from storage.objects where id = '18210000-0000-4000-8000-00000000004a' \gset
insert into pcm.sso_portal_anexos_publicacoes (id, nota_id, cliente_id, ordem_servico_id, objeto_id, caminho, metadata_snapshot, objeto_updated_at, titulo, ator_id, request_id) values
 ('18210000-0000-4000-8000-00000000005a', '18210000-0000-4000-8000-00000000003a', '18210000-0000-4000-8000-00000000000a', '18210000-0000-4000-8000-00000000002a',
  '18210000-0000-4000-8000-00000000004a', 'cliente-ret/os-ret/laudo.pdf', :'obj_meta'::jsonb, :'obj_em'::timestamptz, 'Laudo', '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-0000000000f1');

insert into financeiro.categorias (id, nome, tipo) values ('18210000-0000-4000-8000-00000000006a', 'Serviços S182 Retirada', 'entrada');
insert into financeiro.lancamentos (id, tipo, status, valor_centavos, data_competencia, data_vencimento, categoria_id, cliente_id, os_id, created_by) values
 ('18210000-0000-4000-8000-00000000007a', 'entrada', 'previsto', 250000, date '2026-11-01', date '2026-11-30', '18210000-0000-4000-8000-00000000006a',
  '18210000-0000-4000-8000-00000000000a', '18210000-0000-4000-8000-00000000002a', '18210000-0000-4000-8000-000000000001');
insert into financeiro.sso_portal_cobranca_publicacoes (id, lancamento_id, cliente_id, os_id, descricao_publica, valor_centavos, competencia, vencimento, autor_id, request_id) values
 ('18210000-0000-4000-8000-00000000008a', '18210000-0000-4000-8000-00000000007a', '18210000-0000-4000-8000-00000000000a', '18210000-0000-4000-8000-00000000002a',
  'Serviço executado', 250000, date '2026-11-01', date '2026-11-30', '18210000-0000-4000-8000-000000000001', '18210000-0000-4000-8000-0000000000f3');

update financeiro.sso_documento_cobranca_gate set habilitado = true where id;
update pcm.sso_portal_anexo_gate set habilitado = true where id;

set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (financeiro.sso_publicar_documento_cobranca_v2('18210000-0000-4000-8000-0000000000e1',
  '18210000-0000-4000-8000-00000000008a', '18210000-0000-4000-8000-00000000005a')) as vinculo \gset

select throws_ok(
  format($f$ select financeiro.sso_retira_documento_cobranca(%L,'   ') $f$, :'vinculo'),
  '22023', 'dados_invalidos', 'motivo em branco é recusado na retirada'
);
select throws_ok(
  $$ select financeiro.sso_retira_documento_cobranca(gen_random_uuid(),'Motivo válido') $$,
  '42501', 'sem_acesso', 'vínculo inexistente é recusado'
);

reset role;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_retira_documento_cobranca(%L,'Tentativa sem concessão') $f$, :'vinculo'),
  '42501', 'sem_acesso', 'usuário sem a concessão faturavel.efetivar não retira documento'
);

reset role;
update financeiro.sso_documento_cobranca_gate set habilitado = false where id;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_retira_documento_cobranca(%L,'Gate fechado') $f$, :'vinculo'),
  '55000', 'indisponivel', 'gate fechado recusa a retirada'
);

reset role;
update financeiro.sso_documento_cobranca_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select lives_ok(
  format($f$ select financeiro.sso_retira_documento_cobranca(%L,'Documento publicado por engano') $f$, :'vinculo'),
  'retirada válida é aceita'
);

reset role;
select is((select ativo from financeiro.sso_documentos_cobranca where id = :'vinculo'::uuid), false, 'vínculo fica inativo após a retirada');
select is((select count(*)::int from financeiro.sso_documentos_cobranca_revogacoes where vinculo_id = :'vinculo'::uuid), 1, 'a revogação fica registrada');

set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok(
  format($f$ select financeiro.sso_retira_documento_cobranca(%L,'Retirando de novo') $f$, :'vinculo'),
  'retirar de novo não falha (idempotente)'
);
reset role;
select is((select count(*)::int from financeiro.sso_documentos_cobranca_revogacoes where vinculo_id = :'vinculo'::uuid), 1, 'retirar de novo não duplica a revogação');

-- O par cobrança+anexo volta a ficar disponível: um documento retirado por engano pode voltar.
set local request.jwt.claims = '{"sub":"18210000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select isnt(
  (financeiro.sso_publicar_documento_cobranca_v2('18210000-0000-4000-8000-0000000000e2',
    '18210000-0000-4000-8000-00000000008a', '18210000-0000-4000-8000-00000000005a'))::text,
  :'vinculo', 'depois da retirada o mesmo par pode ser republicado, gerando um vínculo novo'
);

select * from finish();
rollback;
