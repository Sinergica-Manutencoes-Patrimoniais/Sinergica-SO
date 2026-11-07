-- Executar em clone, BEGIN/ROLLBACK; 1045 e data simuladas na fixture inclusa.
\ir manual_E01-S165_visita_rascunho_aprovacao_1723.sql
reset role;
create temporary table geracao_visita1728 as select p.revisao,r.id rotina from pcm.planos_manutencao p join pcm.rotinas_manutencao r on r.plano_id=p.id and r.versao_id='16610000-0000-0000-0000-000000000181' where p.id='16610000-0000-0000-0000-000000000121';
grant select on geracao_visita1728 to authenticated;
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','17280000-0000-0000-0000-000000000002','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if (r->>'canceladas')::integer<>1 then raise exception 'retirada_visita_falhou: %',r;end if;
end; $$;
do $$ declare a jsonb;b jsonb;rev integer;rot uuid;begin
 select revisao,rotina into strict rev,rot from geracao_visita1728;
 a:=pcm.sso_preparar_visita_canonica('17280000-0000-0000-0000-000000000003','16610000-0000-0000-0000-00000000000a','17280000-0000-0000-0000-000000000004','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte sintética');
 b:=pcm.sso_preparar_visita_canonica('17280000-0000-0000-0000-000000000003','16610000-0000-0000-0000-00000000000a','17280000-0000-0000-0000-000000000004','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte sintética');
 if a is distinct from b or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'geracao_visita_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_selos_reserva_futura_rascunho s join pcm.sso_ciclo_visita_versoes c on c.ciclo_id=s.ciclo_id where s.escolha_request_id='16610000-0000-0000-0000-000000000935' and c.preparada_id='17280000-0000-0000-0000-000000000004') then raise exception 'ciclo_visita_nao_reutilizou_selo';end if;
end; $$;
