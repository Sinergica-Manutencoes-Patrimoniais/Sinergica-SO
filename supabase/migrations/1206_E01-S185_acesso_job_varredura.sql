-- ADR-1055: acesso destinado apenas ao job interno; gates permanecem fechados.
grant execute on function pcm.sso_varrer_fila_local(uuid,uuid,integer) to service_role;
