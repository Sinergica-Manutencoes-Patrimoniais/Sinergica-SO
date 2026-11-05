begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select pcm.sso_legada_resolvida_por_escolha_rascunho('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',3,'16610000-0000-0000-0000-000000000936');
rollback;
