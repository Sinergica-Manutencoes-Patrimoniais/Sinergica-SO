-- ADR-1279: papel de serviço apenas; todos os gates originais permanecem fechados.
grant execute on function pcm.sso_ler_envelope_contrato_origem(uuid,uuid) to service_role;
grant execute on function pcm.sso_processar_tarefa_campo_atomica(uuid,uuid,jsonb) to service_role;
grant execute on function pcm.sso_registrar_evento_origem(uuid,uuid,jsonb) to service_role;
grant execute on function pcm.sso_listar_inbox_processamento(uuid,integer) to service_role;
