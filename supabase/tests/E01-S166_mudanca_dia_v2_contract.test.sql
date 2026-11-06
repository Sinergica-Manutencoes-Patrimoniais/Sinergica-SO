-- Protocolo V2 S166: fixture transacional via RLS e RPCs públicas canônicas.
-- Este arquivo é preparado para CI local; não o execute até o ensaio final de lote.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(38);

-- Bootstrap de identidades pelo provisionador oficial. O usuário administrativo cria
-- a fixture via policies/RPCs normais; o segundo usuário é PCM escrita sem concessão.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('16670000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-v2-admin@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('16670000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-v2-negado@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now())
on conflict(id) do nothing;
select config.provisionar_usuario('16670000-0000-4000-8000-000000000001','superadmin','Fixture S166 V2');
select config.provisionar_usuario('16670000-0000-4000-8000-000000000002','colaborador','PCM sem concessão S166 V2');
insert into config.usuario_modulos(user_id,modulo,nivel)
values('16670000-0000-4000-8000-000000000002','pcm','escrita');

-- Falha injetada no último ID ordenado para provar rollback depois de 500 atualizações.
create function public.s166_v2_fail_selected_transition() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.visita_id::text = nullif(current_setting('app.s166_v2_fail_visita',true),'') then
   raise exception 's166_v2_injected_failure' using errcode='23514';
 end if;
 return new;
end $$;
create trigger z_s166_v2_fail_selected_transition
before insert on pcm.sso_visita_regra_transicoes
for each row execute function public.s166_v2_fail_selected_transition();

set local role authenticated;
set local request.jwt.claims = '{"sub":"16670000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

insert into pcm.clientes(id,nome,ativo,created_by)
values('16670000-0000-4000-8000-000000000010','Fixture transacional S166 V2',true,'16670000-0000-4000-8000-000000000001');
select config.sso_definir_concessao('16670000-0000-4000-8000-000000000101',0,'16670000-0000-4000-8000-000000000001',null,'plano.gerir','16670000-0000-4000-8000-000000000010',true,'pgTAP S166 V2');
select config.sso_definir_concessao('16670000-0000-4000-8000-000000000102',0,'16670000-0000-4000-8000-000000000001',null,'visita.confirmar','16670000-0000-4000-8000-000000000010',true,'pgTAP S166 V2');

insert into comercial.etapas_funil(id,nome,ordem,cor,tipo)
values
 ('16670000-0000-4000-8000-000000000020','Etapa aberta fixture S166',990,'#111111','aberta'),
 ('16670000-0000-4000-8000-000000000021','Etapa ganha fixture S166',991,'#00aa00','ganha');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo)
values('16670000-0000-4000-8000-000000000030','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000020','Oportunidade fixture S166');
insert into comercial.propostas(id,oportunidade_id,tipo,status,preco_centavos)
values('16670000-0000-4000-8000-000000000040','16670000-0000-4000-8000-000000000030','simples','aceita',0);
select comercial.fn_criar_contrato('16670000-0000-4000-8000-000000000040');
select comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='16670000-0000-4000-8000-000000000040'));

select pcm.sso_criar_regra_contratual(
 '16670000-0000-4000-8000-000000000111',0,
 '16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000051',
 (select id from comercial.contratos where proposta_id='16670000-0000-4000-8000-000000000040'),
 date_trunc('week',current_date::timestamp)::date+14,2,1,'12:00',60,0,'America/Sao_Paulo',
 date_trunc('week',current_date::timestamp)::date+14,null);

select throws_ok(
 $$select pcm.sso_iniciar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000201','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000060',1,3,date_trunc('week',current_date::timestamp)::date+21)$$,
 '55000',null,'gate fechado impede iniciar fotografia');
set local request.jwt.claims = '{"sub":"16670000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
select throws_ok(
 $$select pcm.sso_iniciar_mudanca_dia_v2('16670000-0000-4000-8000-000000000002','16670000-0000-4000-8000-000000000202','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000061',1,3,date_trunc('week',current_date::timestamp)::date+35)$$,
 '42501',null,'PCM escrita sem concessão não inicia fotografia');
set local request.jwt.claims = '{"sub":"16670000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';

-- Gates de geração e V2 são abertos apenas dentro desta transação de fixture.
reset role;
update pcm.sso_acesso_geracao_visita_gate set habilitado=true where id;
update pcm.sso_gerar_visita_contratual_gate set habilitado=true where id;
update pcm.sso_geracao_ou_supressao_gate set habilitado=true where id;
update pcm.sso_geracao_com_supressao_gate set habilitado=true where id;
update pcm.sso_supressao_semana_gate set habilitado=true where id;
update pcm.sso_coordenacao_feriados_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
update pcm.sso_origem_contratual_unica_gate set habilitado=true where id;
update pcm.sso_mudanca_dia_v2_gate set max_itens=600,max_bytes=1048576,ttl_seconds=3600 where id;
update pcm.sso_mudanca_dia_v2_gate set habilitado=true where id;
set local role authenticated;

-- 501 ocorrências são materializadas pelo produtor canônico; nenhum INSERT direto
-- em visitas/origem e nenhuma integração Auvo é chamada.
do $$
declare v_anchor date:=date_trunc('week',current_date::timestamp)::date+14;v_week date;v_start timestamptz;v_id uuid;
begin
 for i in 1..501 loop
   -- A nova vigência é anchor+21; iniciar aqui garante que todos os 501
   -- registros pertençam ao conjunto cuja data efetiva está sendo alterada.
   v_week:=v_anchor+(7*(i+2));
   v_start:=(v_week+1+time '12:00') at time zone 'America/Sao_Paulo';
   v_id:=('16670000-0000-4000-8000-'||lpad(to_hex(i+2000),12,'0'))::uuid;
   perform pcm.sso_gerar_visita_ou_suprimir(
     '16670000-0000-4000-8000-000000000001',
     ('16670000-0000-4000-8000-'||lpad(to_hex(i+4000),12,'0'))::uuid,
     '16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050',
     '16670000-0000-4000-8000-000000000051',v_week,v_id,v_start,null,'fixture transacional sem despacho Auvo');
 end loop;
end $$;

select is((select count(*)::int from pcm.visita_origem_contratual where serie_id='16670000-0000-4000-8000-000000000050'),501,'fixture canônico criou exatamente 501 origens contratuais');
-- Fotografia sequencial simulada: pgTAP está em uma transação/conexão só e não prova
-- concorrência real entre sessões. O ensaio de duas sessões permanece necessário.
select is((pcm.sso_iniciar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000062',1,3,date_trunc('week',current_date::timestamp)::date+35)->>'estado'),'montando','fotografia sequencial inicia');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',0)->'itens'),100,'fotografia lê primeira página antes da mutação');
select pcm.sso_editar_visita('16670000-0000-4000-8000-000000000501',1,'16670000-0000-4000-8000-0000000007d1',null,null,
 (date_trunc('week',current_date::timestamp)::date+14+21+1+time '12:15') at time zone 'America/Sao_Paulo',
 ((date_trunc('week',current_date::timestamp)::date+14+21+1+time '12:15') at time zone 'America/Sao_Paulo')+interval '60 minutes',
 'America/Sao_Paulo',null,0);
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',1)->'itens'),100,'segunda página reflete conjunto alterado');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',2)->'itens'),100,'terceira página da fotografia alterada');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',3)->'itens'),100,'quarta página da fotografia alterada');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',4)->'itens'),100,'quinta página do conjunto após cursor');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401',5)->'itens'),1,'sexta página conclui cursor avançado após alteração');
select is((pcm.sso_selar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000401')->>'estado'),'invalidada','selagem detecta alteração entre páginas');
select pcm.sso_editar_visita('16670000-0000-4000-8000-000000000502',2,'16670000-0000-4000-8000-0000000007d1',null,null,
 (date_trunc('week',current_date::timestamp)::date+14+21+1+time '12:00') at time zone 'America/Sao_Paulo',
 ((date_trunc('week',current_date::timestamp)::date+14+21+1+time '12:00') at time zone 'America/Sao_Paulo')+interval '60 minutes',
 'America/Sao_Paulo',null,0);

-- Somente agora, após edição e restauração (revisão atual 3), criamos a fotografia
-- que será selada e confirmada; ela não reutiliza snapshot com revisão antiga.
select is((pcm.sso_iniciar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000061',1,3,date_trunc('week',current_date::timestamp)::date+35)->>'estado'),'montando','start v2 aceita fotografia acima de 500 dentro do orçamento');
select is((pcm.sso_iniciar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000050','16670000-0000-4000-8000-000000000061',1,3,date_trunc('week',current_date::timestamp)::date+35)->>'mudancaId'),'16670000-0000-4000-8000-000000000301','retry do start retorna a mesma fotografia');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',0)->'itens'),100,'primeira página tem 100 linhas');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',1)->'itens'),100,'segunda página tem 100 linhas');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',2)->'itens'),100,'terceira página tem 100 linhas');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',3)->'itens'),100,'quarta página tem 100 linhas');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',4)->'itens'),100,'quinta página tem 100 linhas');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',5)->'itens'),1,'sexta página contém o item 501');
select is((pcm.sso_selar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301')->>'estado'),'pronta','fotografia completa de 501 itens sela');

select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',0)->'itens'),100,'retry de página retorna a mesma página');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',1)->'itens'),100,'página 1 principal');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',2)->'itens'),100,'página 2 principal');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',3)->'itens'),100,'página 3 principal');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',4)->'itens'),100,'página 4 principal');
select is(jsonb_array_length(pcm.sso_pagina_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301',5)->'itens'),1,'página 5 principal');
select is((pcm.sso_selar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301')->>'estado'),'pronta','fotografia completa de 501 itens sela');

select set_config('app.s166_v2_fail_visita','16670000-0000-4000-8000-0000000009c5',true);
select throws_ok(
 $$select pcm.sso_confirmar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301')$$,
 '23514','s166_v2_injected_failure','falha no último item aborta confirmação inteira');
reset role;
select is((select count(*)::int from pcm.sso_visita_regra_transicoes where request_id='16670000-0000-4000-8000-000000000301'),0,'rollback não deixa transições parciais');
select is((select count(*)::int from pcm.regras_visita_contratual where id='16670000-0000-4000-8000-000000000061'),0,'rollback não deixa regra nova parcial');

drop trigger z_s166_v2_fail_selected_transition on pcm.sso_visita_regra_transicoes;
drop function public.s166_v2_fail_selected_transition();
set local role authenticated;
select is((pcm.sso_confirmar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301')->>'visitasMovidas')::int,501,'retry sem falha aplica todos os 501 itens');
reset role;
select is((select count(*)::int from pcm.sso_mudanca_dia_v2_itens i
 join audit.events e on e.entity_id=i.visita_id and e.action='visita.editada'
 where i.mudanca_id='16670000-0000-4000-8000-000000000301'
   and (e.payload->'depois'->>'revisao')::int=i.revisao_visita+1
   and e.payload ? 'antes' and e.payload ? 'depois'),501,'lote mantém auditoria individual com snapshots completos');
select is((select count(*)::int from pcm.sso_mudanca_dia_v2_itens i
 join pcm.visita_comandos c on c.payload->>'visitaId'=i.visita_id::text and c.payload->>'tipo'='editarVisita'
 where i.mudanca_id='16670000-0000-4000-8000-000000000301'
   and (c.resultado->>'revision')::int=i.revisao_visita+1),501,'lote mantém recibo idempotente individual por Visita');
select set_config('app.s166_expected_receipt',
 (select recibo::text from pcm.sso_mudancas_dia_v2 where id='16670000-0000-4000-8000-000000000301'),true);
set local role authenticated;
select is(pcm.sso_confirmar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301'),
 current_setting('app.s166_expected_receipt')::jsonb,'replay retorna recibo idêntico');

-- Gate fechado permite recuperar somente o recibo já aplicado.
reset role;
update pcm.sso_mudanca_dia_v2_gate set habilitado=false where id;
set local role authenticated;
select is(pcm.sso_confirmar_mudanca_dia_v2('16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000301'),
 current_setting('app.s166_expected_receipt')::jsonb,'gate fechado preserva replay do recibo aplicado');

-- Contrato V1: mesma RPC mantém replay e o teto legado de 500.
reset role;
update pcm.sso_mudanca_dia_atomica_gate set habilitado=true where id;
update pcm.calendario_alteracao_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_criar_regra_contratual(
 '16670000-0000-4000-8000-000000000112',0,
 '16670000-0000-4000-8000-000000000070','16670000-0000-4000-8000-000000000071',
 (select id from comercial.contratos where proposta_id='16670000-0000-4000-8000-000000000040'),
 date_trunc('week',current_date::timestamp)::date+14,2,1,'12:00',60,0,'America/Sao_Paulo',
 date_trunc('week',current_date::timestamp)::date+14,null);
select is((pcm.sso_alterar_dia_com_visitas('16670000-0000-4000-8000-000000000701','16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000070','16670000-0000-4000-8000-000000000072',1,3,date_trunc('week',current_date::timestamp)::date+21,'[]'::jsonb)->>'revision')::int,2,'RPC V1 segue aceitando alteração válida com lista vazia');
reset role;
select set_config('app.s166_expected_v1_receipt',
 (select resultado::text from pcm.calendario_contratual_comandos where request_id='16670000-0000-4000-8000-000000000701'),true);
set local role authenticated;
select is(pcm.sso_alterar_dia_com_visitas('16670000-0000-4000-8000-000000000701','16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000070','16670000-0000-4000-8000-000000000072',1,3,date_trunc('week',current_date::timestamp)::date+21,'[]'::jsonb),
 current_setting('app.s166_expected_v1_receipt')::jsonb,'RPC V1 preserva replay');
select throws_ok(
 $$select pcm.sso_alterar_dia_com_visitas('16670000-0000-4000-8000-000000000702','16670000-0000-4000-8000-000000000001','16670000-0000-4000-8000-000000000010','16670000-0000-4000-8000-000000000070','16670000-0000-4000-8000-000000000073',1,3,date_trunc('week',current_date::timestamp)::date+21,(select jsonb_agg(jsonb_build_object('visitaId',('16670000-0000-4000-8000-'||lpad(to_hex(i),12,'0'))::uuid,'revisao',1) order by i) from generate_series(1,501) i))$$,
 '22023',null,'V1 mantém limite legado de 500 sem afetar V2');

select * from finish();
rollback;
