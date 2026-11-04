-- SOMENTE banco descartável. Inicie após A_RETORNO_INSERIDO e antes do COMMIT de A.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
set local lock_timeout='3s';
set local request.jwt.claims='{"sub":"17390000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- Esta transação restaura o gate antes do commit; não ligar em ambiente compartilhado.
do $$begin if coalesce((select habilitado from pcm.sso_vinculo_os_grupo_gate where id),true) then raise exception 'gate_nao_estava_fechado'; end if; end$$;
update pcm.sso_vinculo_os_grupo_gate set habilitado=true where id;
select pcm.sso_declarar_vinculo_os_grupo('17390000-0000-4000-8000-000000000016','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000012','17390000-0000-4000-8000-000000000014','Teste sintético concorrente');
update pcm.sso_vinculo_os_grupo_gate set habilitado=false where id;
commit;
