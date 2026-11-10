-- Clone descartável com migrations até 1707, BEGIN/ROLLBACK.
\ir manual_E01-S165_escolha_nova_visita_1703.sql
set local role authenticated;
do $$ declare f jsonb;r jsonb;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161','visita');
 r:=pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000233','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,3,'16610000-0000-0000-0000-000000000083','2026-10-16','fonte revisada','nova escolha',f);
 if r->>'visitaEscolhida' is distinct from '16610000-0000-0000-0000-000000000083' then raise exception 'nova_escolha_incorreta: %',r;end if;
end; $$;
reset role;
do $$ begin if (select count(*) from pcm.sso_escolhas_nova_data_visita where preparada_id='16610000-0000-0000-0000-000000000161' and visita_id='16610000-0000-0000-0000-000000000083')<>2 then raise exception 'historico_de_escolhas_nao_preservado';end if;end; $$;
