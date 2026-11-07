-- ADR-1117: acesso mediado, gate e verificações permanecem fechados.
grant execute on function pcm.sso_gerar_visita_ou_suprimir(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) to authenticated;
