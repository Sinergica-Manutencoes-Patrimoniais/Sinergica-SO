-- ADR-0705: a função 0929 verifica gate fechado, ator, Cliente e capacidade.
grant execute on function pcm.sso_reconciliar_request_os_chamado(uuid,uuid,uuid,uuid,bigint,text,text,text) to authenticated;
