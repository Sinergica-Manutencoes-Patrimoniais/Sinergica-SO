-- ADR-1260: gate existente permanece fechado e não provisiona segredo.
grant execute on function pcm.sso_receber_estrutura_xlsx_atestada(uuid,uuid,text,text,text,text,text,bigint,text) to authenticated;
grant execute on function pcm.sso_recuperar_estrutura_xlsx(uuid,text,text) to authenticated;
