-- ADR-0905: não deixar o cliente contornar o processamento confiável futuro.
-- Exige gate fechado e não concede acesso a outra identidade; não apaga dados.
do $$
declare v_habilitado boolean;
begin
 select habilitado into v_habilitado from pcm.sso_origem_xlsx_cronograma_gate where id for update;
 if v_habilitado is distinct from false then
   raise exception 'fechar_gate_origem_xlsx_antes_da_migracao' using errcode='55000';
 end if;
 revoke all on function pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;
end $$;
