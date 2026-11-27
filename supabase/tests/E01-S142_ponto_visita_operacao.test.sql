begin;
select plan(3);
set local app.auvo_sync_write = 'true';

insert into auth.users(id, instance_id, aud, role, email)
values ('14200000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ponto-gut@example.test');
insert into pcm.clientes(id, nome, ativo, created_by)
values ('14200000-0000-4000-8000-000000000010','Cliente fictício GUT',true,'14200000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, status, created_by, created_at)
values
 ('14200000-0000-4000-8000-000000000021','14200000-0000-4000-8000-000000000010','OS-T142-A','INÍCIO VISITA ','corretiva','solicitacao','14200000-0000-4000-8000-000000000001','2026-11-01'),
 ('14200000-0000-4000-8000-000000000022','14200000-0000-4000-8000-000000000010','OS-T142-B',U&'IN\0049\0301CIO VISITA\00A0','corretiva','solicitacao','14200000-0000-4000-8000-000000000001','2026-11-07'),
 ('14200000-0000-4000-8000-000000000023','14200000-0000-4000-8000-000000000010','OS-T142-C',E'\tFim Visita\n','corretiva','solicitacao','14200000-0000-4000-8000-000000000001','2026-11-06'),
 ('14200000-0000-4000-8000-000000000024','14200000-0000-4000-8000-000000000010','OS-T142-D','Início Visita Extra','corretiva','solicitacao','14200000-0000-4000-8000-000000000001','2026-11-04'),
 ('14200000-0000-4000-8000-000000000025','14200000-0000-4000-8000-000000000010','OS-T142-E','Reparar ventilação','corretiva','solicitacao','14200000-0000-4000-8000-000000000001','2026-11-05');

create temporary view gut_fixture as
select * from pcm.operacao_itens
where cliente_id = '14200000-0000-4000-8000-000000000010'
  and item_tipo = 'ordem_servico'
  and status not in ('finalizado', 'cancelado')
  and data_agendada is null and tecnico_funcionario_id is null and auvo_task_id is null;

select is((select count(*)::int from gut_fixture), 2, 'O total GUT ignora as três variantes exatas de ponto');
select is(
  (select numero from gut_fixture order by score_pcm desc, created_at desc, item_id limit 1),
  'OS-T142-E'::text, 'A primeira página apresenta a OS elegível mais recente'
);
select is(
  (select numero from gut_fixture order by score_pcm desc, created_at desc, item_id limit 1 offset 1),
  'OS-T142-D'::text, 'A página seguinte preserva o título semelhante que não é ponto'
);
select * from finish();
rollback;
