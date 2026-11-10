-- Exclusivamente em clone descartável com 1046 aplicada e gate 0787 ligado.
-- Outra sessão deve manter a trava transacional
-- hashtextextended('sso-impacto-revisao-protocolo-global-v1', 0).
-- Os INSERTs são vazios: nenhuma linha sintética é criada.
begin;
do $$
begin
  begin
    insert into pcm.sso_ciclos_visita_canonicos select * from pcm.sso_ciclos_visita_canonicos where false;
    raise exception 'ciclo_nao_serializado';
  exception when lock_not_available then null; end;
  begin
    insert into pcm.sso_ciclo_visita_versoes select * from pcm.sso_ciclo_visita_versoes where false;
    raise exception 'identidade_nao_serializada';
  exception when lock_not_available then null; end;
  begin
    insert into pcm.sso_decisoes_impacto_visita select * from pcm.sso_decisoes_impacto_visita where false;
    raise exception 'decisao_nao_serializada';
  exception when lock_not_available then null; end;
end $$;
rollback;
