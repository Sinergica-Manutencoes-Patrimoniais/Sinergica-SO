-- ADR-1159: gate do produtor segue fechado e validação interna continua obrigatória.
grant execute on function pcm.sso_t24_produzir_preventiva(uuid,uuid,uuid,integer) to authenticated;
