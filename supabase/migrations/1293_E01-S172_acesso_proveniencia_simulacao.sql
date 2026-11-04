-- ADR-1129: acesso mediado, mantendo gates fechados.
grant execute on function pcm.sso_reprogramar_visita_com_proveniencia(uuid,uuid,uuid,uuid,integer,timestamptz,timestamptz,text,date,jsonb,boolean,boolean) to authenticated;
