-- Executar apenas em sso_s167_tripla_os; passar request_id, os_id e titulo por -v.
\set ON_ERROR_STOP on
\if :{?revision}
\else
\set revision 1
\endif
set app.auvo_sync_write='true';
set role authenticated;
select set_config('request.jwt.claims','{"sub":"16798200-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',false);
select pcm.sso_converter_chamado_integral_autorizado(
  :'request_id'::uuid,:'revision'::bigint,'16798200-0000-4000-8000-000000000003','16798200-0000-4000-8000-000000000002',:'os_id'::uuid,
  jsonb_build_object('titulo',:'titulo','descricao','Parcela sintética','categoria','corretiva','prioridade','normal',
  'gravidade',3,'urgencia',3,'tendencia',3,'dor_cliente',null,'observacao',null,'local_descricao',null,
  'solicitante',null,'origem','manual','tipo_tarefa_id',null,'tecnico_funcionario_id',null,'data_agendada',null,
  'tipo_os','C2','pmoc_schedule_id',null,'origem_inspecao_item_id',null,'equipamento_id',null,'foto_urls','[]'::jsonb),
  'convertido_os',null);
