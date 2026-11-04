-- ADR-1164: gates de produtor e de contrato corretivo continuam fechados.
grant execute on function pcm.sso_t24_produzir_corretiva(uuid,uuid,uuid,integer) to authenticated;
