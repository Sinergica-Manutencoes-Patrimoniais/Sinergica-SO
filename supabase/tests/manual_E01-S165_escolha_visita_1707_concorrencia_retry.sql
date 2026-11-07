begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ declare f jsonb;r jsonb;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000166','visita');
 begin r:=pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000272','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000166',2,0,'16610000-0000-0000-0000-000000000083','2026-10-16','fonte','concorrencia',f);
 raise exception 'duplicata_aceita'; exception when unique_violation then if sqlerrm<>'candidata_ja_escolhida' then raise;end if; end;end; $$;
rollback;
