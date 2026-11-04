-- ADR-1162: nova fotografia invalida conferência anterior sem excluir histórico.
create or replace function pcm.sso_snapshot_basico_os(o pcm.ordens_servico) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',o.id,'clienteId',o.client_id,'numero',o.numero,'titulo',o.titulo,'descricao',o.descricao,
  'categoria',o.categoria,'status',o.status,'prioridade',o.prioridade,'localDescricao',o.local_descricao,'excluidaEm',o.deleted_at,
  'equipamentoId',o.equipamento_id,'tipoTarefaId',o.tipo_tarefa_id,'tecnicoFuncionarioId',o.tecnico_funcionario_id,
  'sistemaId',o.sistema_id,'questionarioId',o.questionario_id);
$$;
