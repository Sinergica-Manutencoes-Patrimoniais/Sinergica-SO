-- E01-S190 task 8 — a classificação preserva identidade, histórico e evidência (AC-1, AC-2).
--
-- O QUE ESTA PROVA EXISTE PARA IMPEDIR: a frase "Assessment vira tipo de Inspeção" tem duas
-- leituras. Uma recria o registro em outro lugar e perde item, mídia, vínculo com Chamado e com
-- a Proposta do Comercial. A outra, que é a decidida na ADR-1697, só PREENCHE o campo de tipo que
-- já existia e estava nulo. Este arquivo falha se alguém, algum dia, implementar a primeira.
--
-- Cobre permitido E negado, e confere RLS FORCE em toda tabela tocada (migrations 1868 e 1869).
begin;
select plan(35);

-- ── Fixture ───────────────────────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('19000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's190-pcm@test.local',        crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()),
 ('19000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's190-sem-acesso@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now());

insert into config.usuarios (user_id, papel, nome, ativo) values
 ('19000000-0000-4000-8000-000000000001', 'superadmin',   'S190 PCM',        true),
 ('19000000-0000-4000-8000-000000000002', 'colaborador',  'S190 Sem acesso', true);

insert into pcm.clientes (id, nome, ativo, created_by) values
 ('19000000-0000-4000-8000-000000000010', '[TESTE] Cliente S190', true, '19000000-0000-4000-8000-000000000001');

-- Um tipo de inspeção DIFERENTE, para provar que a classificação não atropela escolha alheia.
insert into pcm.tipos_inspecao (id, nome, ativo) values
 ('19000000-0000-4000-8000-000000000020', '[TESTE] Inspeção Predial S190', true);

-- ── RLS FORCE em toda tabela tocada pelas migrations 1868/1869 ───────────────────────────────
-- `enable` sozinho deixa o dono da tabela passar por cima; `force` é o que o os-grade exige.
select is(
  (select count(*) from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'pcm'
      and c.relname in ('inspecoes', 'inspecao_itens', 'tipos_inspecao', 'planos_manutencao', 'chamados')
      and c.relrowsecurity and c.relforcerowsecurity),
  5::bigint,
  'RLS FORCE ligada nas 5 tabelas que a classificação toca'
);

-- ── Catálogo (migration 1868) ────────────────────────────────────────────────────────────────
select is(
  (select nome from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'Diagnóstico Inicial do Cliente',
  'o tipo aprovado existe no catálogo, com o nome da decisão do Fabrício'
);
select is(
  (select ativo from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  true, 'o tipo nasce ativo — tipo inativo não aparece na tela de Inspeções'
);
select is(
  (select count(*) from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  1::bigint, 'a chave é única: reaplicar a migration não duplica catálogo'
);
select throws_ok(
  $$ insert into pcm.tipos_inspecao (nome, chave) values ('Duplicata', 'diagnostico_inicial_cliente') $$,
  '23505', null, 'índice único parcial recusa uma segunda linha com a mesma chave'
);

-- ── AC-1: identidade, histórico e evidência sobrevivem à CLASSIFICAÇÃO ───────────────────────
-- Monta um Assessment exatamente na forma legada (sem tipo, como os registros de produção), com
-- o trigger desligado — é o estado que a migration 1868 encontrou na base real.
set local role postgres;
alter table pcm.inspecoes disable trigger s190_classificar_diagnostico_inicial;

insert into pcm.inspecoes (id, client_id, titulo, data_inspecao, e_assessment, motivo_assessment, observacoes_gerais, created_by, created_at)
values ('19000000-0000-4000-8000-000000000030', '19000000-0000-4000-8000-000000000010',
        '[TESTE] Assessment legado S190', date '2026-03-01', true, 'inicio',
        'histórico que não pode sumir', '19000000-0000-4000-8000-000000000001', timestamptz '2026-03-01 09:00:00-03');

insert into pcm.inspecao_itens (id, inspecao_id, client_id, sistema, descricao, midias, auvo_questao_chave, destino, destino_responsavel, created_by)
values ('19000000-0000-4000-8000-000000000031', '19000000-0000-4000-8000-000000000030',
        '19000000-0000-4000-8000-000000000010', 'eletrico', 'Quadro sem identificação',
        '[{"tipo":"foto","path":"evidencia/s190.jpg","nome":"s190.jpg"}]'::jsonb,
        'q-s190-1', 'chamado', 'sinergica', '19000000-0000-4000-8000-000000000001');

insert into pcm.chamados (id, numero, cliente_id, titulo, origem, origem_inspecao_item_id, created_by)
values ('19000000-0000-4000-8000-000000000032', 'CH-S190-1', '19000000-0000-4000-8000-000000000010',
        '[TESTE] Chamado derivado do assessment', 'inspecao',
        '19000000-0000-4000-8000-000000000031', '19000000-0000-4000-8000-000000000001');

alter table pcm.inspecoes enable trigger s190_classificar_diagnostico_inicial;

-- Fotografia do "antes", para comparar depois sem depender de literais repetidos.
create temporary table s190_antes on commit drop as
  select (select count(*) from pcm.inspecoes)       as inspecoes,
         (select count(*) from pcm.inspecao_itens)  as itens,
         (select created_at from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030') as criado_em;

-- O MESMO update da migration 1868, passo 3. Rodá-lo aqui é o que prova que a operação escolhida
-- é de classificação: ela não tem `insert`, não tem `delete` e não toca em `id`.
update pcm.inspecoes i
   set tipo_inspecao_id = (select t.id from pcm.tipos_inspecao t where t.chave = 'diagnostico_inicial_cliente'),
       updated_at = now()
 where i.e_assessment and i.tipo_inspecao_id is null;

select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  (select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'AC-1: o assessment legado passou a ser Inspeção do tipo Diagnóstico Inicial do Cliente'
);
select is(
  (select count(*) from pcm.inspecoes), (select inspecoes from s190_antes),
  'AC-1: nenhum registro de inspeção foi criado nem apagado pela classificação'
);
select is(
  (select count(*) from pcm.inspecao_itens), (select itens from s190_antes),
  'AC-1: nenhum item foi recriado — a identidade da inspeção não mudou, então nada foi religado'
);
select is(
  (select created_at from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  (select criado_em from s190_antes),
  'AC-1: histórico preservado — `created_at` do registro original permanece'
);
select is(
  (select e_assessment from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  true, 'AC-1/AC-8: `e_assessment` permanece — é o sinônimo histórico, não lixo a remover'
);
select is(
  (select motivo_assessment from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  'inicio', 'AC-1: o motivo do assessment sobrevive à classificação'
);
select is(
  (select observacoes_gerais from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  'histórico que não pode sumir', 'AC-1: observações do registro original intactas'
);
select is(
  (select midias -> 0 ->> 'path' from pcm.inspecao_itens where id = '19000000-0000-4000-8000-000000000031'),
  'evidencia/s190.jpg', 'AC-1: a evidência (mídia do item) continua apontando para o mesmo arquivo'
);
select is(
  (select auvo_questao_chave from pcm.inspecao_itens where id = '19000000-0000-4000-8000-000000000031'),
  'q-s190-1', 'AC-1: a chave de idempotência do questionário Auvo sobrevive'
);
select is(
  (select origem_inspecao_item_id from pcm.chamados where id = '19000000-0000-4000-8000-000000000032'),
  '19000000-0000-4000-8000-000000000031'::uuid,
  'AC-1: o Chamado derivado continua vinculado ao mesmo item — nenhum vínculo quebrou'
);

-- ── A classificação é regra, não mutirão (trigger da migration 1868) ─────────────────────────
select is(
  (select count(*) from pcm.inspecoes where e_assessment and tipo_inspecao_id is null),
  0::bigint,
  'invariante: não existe assessment sem tipo depois da migration'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin","user_modulos":{"pcm":"escrita"}}';

-- (a) assessment novo nasce classificado.
insert into pcm.inspecoes (id, client_id, titulo, e_assessment, motivo_assessment, created_by)
values ('19000000-0000-4000-8000-000000000033', '19000000-0000-4000-8000-000000000010',
        '[TESTE] Assessment novo S190', true, 'anual', '19000000-0000-4000-8000-000000000001');
select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000033'),
  (select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'assessment criado DEPOIS da migration já nasce com o tipo — backfill não vira verdade de um dia'
);

-- (b) o caminho inverso: criar pelo menu de Inspeções escolhendo o tipo também é um Diagnóstico
-- Inicial. Sem isto, o registro ficaria invisível para a Visão 360 e para o Comercial.
insert into pcm.inspecoes (id, client_id, titulo, tipo_inspecao_id, created_by)
values ('19000000-0000-4000-8000-000000000034', '19000000-0000-4000-8000-000000000010',
        '[TESTE] Diagnóstico pelo menu de Inspeções',
        (select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
        '19000000-0000-4000-8000-000000000001');
select is(
  (select e_assessment from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000034'),
  true, 'inspeção criada com o tipo Diagnóstico Inicial também é assessment para o modelo antigo'
);

-- Nunca atropela tipo já escolhido por alguém.
insert into pcm.inspecoes (id, client_id, titulo, e_assessment, tipo_inspecao_id, created_by)
values ('19000000-0000-4000-8000-000000000035', '19000000-0000-4000-8000-000000000010',
        '[TESTE] Assessment com tipo próprio', true,
        '19000000-0000-4000-8000-000000000020', '19000000-0000-4000-8000-000000000001');
select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000035'),
  '19000000-0000-4000-8000-000000000020'::uuid,
  'a regra só preenche nulo: tipo já escolhido por um humano não é sobrescrito'
);

-- Auditoria: cada classificação deixa rastro nomeado, com o ator real. A leitura é feita fora do
-- papel `authenticated` de propósito — `audit` é append-only e NÃO concede USAGE de schema a
-- ninguém; quem escreve é o trigger `security definer`, e é assim que tem de ser.
set local role postgres;
select is(
  (select count(*) from audit.events
    where action = 'inspecao.classificada_diagnostico_inicial'
      and entity = 'inspecoes'
      and entity_id in ('19000000-0000-4000-8000-000000000033', '19000000-0000-4000-8000-000000000034')),
  2::bigint, 'toda classificação em tempo de execução vira evento em audit.events'
);
select is(
  (select payload ->> 'identidade_preservada' from audit.events
    where action = 'inspecao.classificada_diagnostico_inicial'
      and entity_id = '19000000-0000-4000-8000-000000000033'),
  'true', 'o evento declara explicitamente que a identidade foi preservada'
);

-- ── NEGADO (AC de segurança): sem pcm, não há Diagnóstico Inicial nenhum ──────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{}}';
select is(
  (select count(*) from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  0::bigint, 'negado: quem não tem o módulo PCM não enxerga o tipo novo no catálogo'
);
select is(
  (select count(*) from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000030'),
  0::bigint, 'negado: quem não tem o módulo PCM não enxerga o Diagnóstico Inicial classificado'
);
select throws_ok(
  $$ insert into pcm.inspecoes (client_id, titulo, e_assessment, created_by)
     values ('19000000-0000-4000-8000-000000000010', 'x', true, '19000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'negado: sem pcm:escrita, criar Diagnóstico Inicial é recusado pela RLS'
);

-- ── AC-2: PMOC como modalidade do Plano (migration 1869) ─────────────────────────────────────
set local role postgres;
insert into pcm.planos_manutencao (id, cliente_id, nome, created_by, updated_by) values
 ('19000000-0000-4000-8000-000000000040', '19000000-0000-4000-8000-000000000010', '[TESTE] Plano comum S190',
  '19000000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000041', '19000000-0000-4000-8000-000000000010', '[TESTE] Plano PMOC S190',
  '19000000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-000000000001');

select is(
  (select modalidade from pcm.planos_manutencao where id = '19000000-0000-4000-8000-000000000040'),
  'padrao', 'AC-2: Plano existente continua padrão — a modalidade é aditiva, não reclassifica tudo'
);
select throws_ok(
  $$ update pcm.planos_manutencao set modalidade = 'assessment'
      where id = '19000000-0000-4000-8000-000000000040' $$,
  '23514', null, 'modalidade fora de (padrao, pmoc) é recusada pelo CHECK'
);

update pcm.planos_manutencao set modalidade = 'pmoc' where id = '19000000-0000-4000-8000-000000000041';
select is(
  (select count(*) from pcm.planos_manutencao where id = '19000000-0000-4000-8000-000000000041' and revisao = 1),
  1::bigint,
  'AC-2: classificar como PMOC não incrementa revisão — rotinas e ocorrências já geradas ficam válidas'
);

-- Concessão individual: `plano.gerir` exige concessão por usuário (`exige_concessao_individual`).
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('19000000-0000-4000-8000-000000000001', 'plano.gerir', '19000000-0000-4000-8000-000000000010');

-- ── Revisão adversarial: dois achados reproduzidos, agora travados por teste ─────────────────
--
-- ACHADO 1 — "o reverso apaga escolha de gente". A regra grava evento em DOIS casos: quando ela
-- preenche o TIPO de um assessment (`tipo_anterior` nulo) e quando preenche o MARCADOR de uma
-- inspeção cujo tipo um humano escolheu na tela (`tipo_anterior` preenchido). Um reverso que
-- varresse os eventos sem distinguir os dois zeraria o tipo que a pessoa escolheu. Os testes
-- abaixo rodam o reverso EXATO do cabeçalho da migration 1868 e provam a diferença.
select is(
  (select payload ->> 'tipo_anterior' from audit.events
    where action = 'inspecao.classificada_diagnostico_inicial'
      and entity_id = '19000000-0000-4000-8000-000000000034'),
  (select id::text from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'achado 1: quando só o marcador foi preenchido, o evento registra o tipo que já existia'
);

-- ACHADO 3 — "o reverso não reverte". A regra é idempotente e persistente: zerar o tipo de um
-- registro que ainda tem `e_assessment = true` faz o trigger preenchê-lo de volta na mesma
-- transação. Por isso o cabeçalho da migration 1868 manda DERRUBAR O TRIGGER PRIMEIRO, e a ordem
-- não é estilo — é a diferença entre reverter e não reverter. O par de asserções abaixo prova a
-- ordem, para que ninguém a troque achando que é só arrumação.
update pcm.inspecoes i set tipo_inspecao_id = null
 where i.tipo_inspecao_id = (select t.id from pcm.tipos_inspecao t where t.chave = 'diagnostico_inicial_cliente')
   and exists (select 1 from audit.events e
                where e.action = 'inspecao.classificada_diagnostico_inicial'
                  and e.entity = 'inspecoes' and e.entity_id = i.id
                  and (e.payload ->> 'tipo_anterior') is null);
select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000033'),
  (select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'achado 3: com o trigger de pé, o reverso não tem efeito — a ordem do cabeçalho é obrigatória'
);

-- Agora na ordem certa (equivale ao `drop trigger` do cabeçalho; aqui é `disable` porque a
-- transação do teste tem de voltar ao estado anterior).
alter table pcm.inspecoes disable trigger s190_classificar_diagnostico_inicial;
update pcm.inspecoes i set tipo_inspecao_id = null
 where i.tipo_inspecao_id = (select t.id from pcm.tipos_inspecao t where t.chave = 'diagnostico_inicial_cliente')
   and exists (select 1 from audit.events e
                where e.action = 'inspecao.classificada_diagnostico_inicial'
                  and e.entity = 'inspecoes' and e.entity_id = i.id
                  and (e.payload ->> 'tipo_anterior') is null);
alter table pcm.inspecoes enable trigger s190_classificar_diagnostico_inicial;

select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000033'),
  null::uuid,
  'achado 1: o reverso desfaz a classificação que a regra escreveu'
);
select is(
  (select tipo_inspecao_id from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000034'),
  (select id from pcm.tipos_inspecao where chave = 'diagnostico_inicial_cliente'),
  'achado 1: o reverso NÃO apaga o tipo que um humano escolheu na tela'
);

-- ACHADO 2 — "a regra desfaz a escrita de quem tenta desmarcar". Com o tipo Diagnóstico Inicial
-- presente, tentar gravar `e_assessment = false` é revertido pela regra. É consequência direta de
-- os dois campos serem o MESMO fato, mas tem de ser comportamento decidido e visível, não efeito
-- colateral descoberto em produção: quem quiser que o registro deixe de ser Diagnóstico Inicial
-- muda o TIPO, que é o campo canônico desde esta story.
update pcm.inspecoes set e_assessment = false where id = '19000000-0000-4000-8000-000000000034';
select is(
  (select e_assessment from pcm.inspecoes where id = '19000000-0000-4000-8000-000000000034'),
  true,
  'achado 2: com o tipo Diagnóstico Inicial, desmarcar e_assessment é revertido pela regra'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin","user_modulos":{"pcm":"escrita"}}';
select is(
  (select count(*) from pcm.planos_pmoc where cliente_id = '19000000-0000-4000-8000-000000000010'),
  1::bigint, 'AC-2: a visão filtrada traz só o Plano da modalidade PMOC'
);
select is(
  (select id from pcm.planos_pmoc where cliente_id = '19000000-0000-4000-8000-000000000010'),
  '19000000-0000-4000-8000-000000000041'::uuid,
  'AC-2: o Plano na visão filtrada é o MESMO registro, com o mesmo id — não houve cópia'
);

-- NEGADO na visão filtrada: `security_invoker` faz a RLS por cliente continuar decidindo. Uma
-- view `security definer` devolveria o Plano de qualquer condomínio a qualquer autenticado.
set local request.jwt.claims = '{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select is(
  (select count(*) from pcm.planos_pmoc),
  0::bigint, 'negado: sem a capacidade plano.gerir no cliente, a visão filtrada não devolve nada'
);

reset role;
select * from finish();
rollback;
