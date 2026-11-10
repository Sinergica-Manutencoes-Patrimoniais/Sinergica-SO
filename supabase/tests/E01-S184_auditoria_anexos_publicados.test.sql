-- E01-S184 AC-6/FR-006: inventário auditado de anexos de OS publicados (migration 1829).
-- Não exercita o fluxo completo de publicação/revogação de 0465 (já coberto por S183) — insere
-- publicações/revogações diretamente para provar só a leitura nova: quem pode ver custos audita
-- cross-Cliente o que está público hoje; revogado nunca aparece; paginação funciona.
begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18403000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-s184aud@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18403000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'colaborador-s184aud@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into pcm.clientes (id, nome, ativo, created_by) values ('18403000-0000-0000-0000-000000000002', 'Conta S184 Auditoria', true, '18403000-0000-0000-0000-000000000011');
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18403000-0000-0000-0000-000000000011', 'superadmin', 'Admin S184 Auditoria', true),
 ('18403000-0000-0000-0000-000000000012', 'colaborador', 'Operador S184 Auditoria', true);
insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18403000-0000-0000-0000-000000000013', 'CH-S184-AUD', '18403000-0000-0000-0000-000000000002', 'Chamado auditoria S184', '18403000-0000-0000-0000-000000000011');
insert into pcm.ordens_servico (id, client_id, numero, titulo, categoria, created_by, chamado_id) values
 ('18403000-0000-0000-0000-000000000014', '18403000-0000-0000-0000-000000000002', 'OS-S184-AUD', 'OS auditoria S184', 'corretiva', '18403000-0000-0000-0000-000000000011', '18403000-0000-0000-0000-000000000013');
insert into pcm.os_notas (id, ordem_servico_id, cliente_id, anexo_path, autor_tipo, created_by) values
 ('18403000-0000-0000-0000-000000000015', '18403000-0000-0000-0000-000000000014', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000002/ativa-1.pdf', 'interno', '18403000-0000-0000-0000-000000000011'),
 ('18403000-0000-0000-0000-000000000016', '18403000-0000-0000-0000-000000000014', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000002/revogada.pdf', 'interno', '18403000-0000-0000-0000-000000000011'),
 ('18403000-0000-0000-0000-000000000017', '18403000-0000-0000-0000-000000000014', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000002/ativa-2.pdf', 'interno', '18403000-0000-0000-0000-000000000011');
insert into pcm.sso_portal_anexos_publicacoes (id, nota_id, cliente_id, ordem_servico_id, objeto_id, caminho, titulo, ator_id, request_id) values
 ('18403000-0000-0000-0000-000000000031', '18403000-0000-0000-0000-000000000015', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000014', gen_random_uuid(), '18403000-0000-0000-0000-000000000002/ativa-1.pdf', 'Anexo ativo 1', '18403000-0000-0000-0000-000000000011', gen_random_uuid()),
 ('18403000-0000-0000-0000-000000000032', '18403000-0000-0000-0000-000000000016', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000014', gen_random_uuid(), '18403000-0000-0000-0000-000000000002/revogada.pdf', 'Anexo revogado', '18403000-0000-0000-0000-000000000011', gen_random_uuid()),
 ('18403000-0000-0000-0000-000000000034', '18403000-0000-0000-0000-000000000017', '18403000-0000-0000-0000-000000000002', '18403000-0000-0000-0000-000000000014', gen_random_uuid(), '18403000-0000-0000-0000-000000000002/ativa-2.pdf', 'Anexo ativo 2', '18403000-0000-0000-0000-000000000011', gen_random_uuid());
insert into pcm.sso_portal_anexos_revogacoes (id, publicacao_id, motivo, ator_id, request_id) values
 ('18403000-0000-0000-0000-000000000033', '18403000-0000-0000-0000-000000000032', 'continha custo de fornecedor publicado por engano', '18403000-0000-0000-0000-000000000011', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub":"18403000-0000-0000-0000-000000000012","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$ select * from pcm.sso_auditoria_anexos_publicados() $$, '42501', 'sem_acesso', 'colaborador sem permissão de custos não audita anexos publicados');

set local request.jwt.claims = '{"sub":"18403000-0000-0000-0000-000000000011","role":"authenticated","user_role":"superadmin"}';
select is((select count(*)::int from pcm.sso_auditoria_anexos_publicados()), 2, 'auditoria lista só publicações ativas — revogada fica de fora');
select is((select count(*)::int from pcm.sso_auditoria_anexos_publicados() where id = '18403000-0000-0000-0000-000000000032'), 0, 'anexo revogado nunca aparece no inventário, mesmo para quem audita');
select is((select titulo from pcm.sso_auditoria_anexos_publicados() where id = '18403000-0000-0000-0000-000000000031'), 'Anexo ativo 1', 'inventário traz título e vínculo corretos do anexo ativo');
select is((select cliente_id from pcm.sso_auditoria_anexos_publicados() where id = '18403000-0000-0000-0000-000000000031'), '18403000-0000-0000-0000-000000000002'::uuid, 'inventário identifica a Conta de cada anexo publicado');
select is((select count(*)::int from pcm.sso_auditoria_anexos_publicados(p_apos := '18403000-0000-0000-0000-000000000031')), 1, 'paginação (p_apos) avança sem repetir o item já visto');
select is((select id from pcm.sso_auditoria_anexos_publicados(p_apos := '18403000-0000-0000-0000-000000000031')), '18403000-0000-0000-0000-000000000034'::uuid, 'item seguinte da página é o anexo ativo mais recente');

select * from finish();
rollback;
