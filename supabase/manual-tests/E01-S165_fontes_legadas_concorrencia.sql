-- Execute somente em banco descartável, enquanto OUTRA sessão segura a trava
-- hashtextextended('sso-impacto-revisao-protocolo-global-v1', 0).
-- Tudo nesta sessão é revertido; os UPDATEs não atingem registros.
begin;
set local app.auvo_sync_write = 'true';
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
do $$
begin
  begin
    update pcm.ordens_servico set id=id where false;
    raise exception 'controle_nao_serializado';
  exception when lock_not_available then null; end;
  begin
    update pcm.planos_preventivos set id=id where false;
    raise exception 'planos_preventivos_nao_serializados';
  exception when lock_not_available then null; end;
  begin
    update pcm.sso_declaracoes_planos_legados set request_id=request_id where false;
    raise exception 'declaracoes_legadas_nao_serializadas';
  exception when lock_not_available then null; end;
end $$;
rollback;
