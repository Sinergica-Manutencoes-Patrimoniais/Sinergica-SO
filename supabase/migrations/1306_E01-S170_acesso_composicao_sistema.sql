-- ADR-1137: o gate do comando e a proteção dos vínculos continuam fechados.
grant execute on function pcm.sso_salvar_composicao_sistema(uuid,uuid,uuid,uuid,uuid[],uuid[]) to authenticated;
