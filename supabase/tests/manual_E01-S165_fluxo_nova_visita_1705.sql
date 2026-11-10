-- Clone sintético, BEGIN/ROLLBACK. Inclui aprovação mediada, com 1045 simulada em
-- transação pela fixture inclusa. Depois simula relógio civil +1 dia via substituição
-- temporária da função de data; NÃO comprova comportamento real de 1045 nem do relógio.
\ir manual_E01-S165_aprovacao_nova_visita_1703.sql
reset role;
-- Avançar apenas o retorno da data civil mantendo verificações de fuso/gates da função.
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+1;$b$;begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_fixture_incompativel';end if;execute replace(d,a,b);
end; $$;
create temporary table fixture1705_revisao as select p.revisao,e.rotina_id from pcm.planos_manutencao p join pcm.sso_escolhas_nova_data_visita e on e.plano_id=p.id where e.request_id='16610000-0000-0000-0000-000000000231' and p.id='16610000-0000-0000-0000-000000000121';
grant select on fixture1705_revisao to authenticated;
set local role authenticated;
do $$ declare r jsonb;rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1705_revisao;
 begin
  perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
  raise exception 'geracao_com_fila_antiga_aceita';
 exception when check_violation then if sqlerrm<>'origem_antiga_exige_reconciliacao' then raise;end if;end;
end; $$;
do $$ declare a jsonb;b jsonb;g jsonb;g2 jsonb;rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1705_revisao;
 a:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000262','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 b:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000262','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if a is distinct from b or (a->>'canceladas')::integer<>1 or a->>'osAlteradas'<>'false' then raise exception 'retirada_replay_divergente: %',a;end if;
 g:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
 g2:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
 if g is distinct from g2 or g->>'osCriada'<>'false' or g->>'tarefaAuvoCriada'<>'false' then raise exception 'geracao_replay_divergente: %',g;end if;
end; $$;
reset role;
do $$ begin
 if (select estado from pcm.sso_fila_visita where preparada_id='16610000-0000-0000-0000-000000000161')<>'cancelado' then raise exception 'fila_antiga_nao_retirada';end if;
 if (select count(*) from pcm.sso_substituicoes_visita_materializadas where escolha_request_id='16610000-0000-0000-0000-000000000231' and preparada_antiga_id='16610000-0000-0000-0000-000000000161' and preparada_nova_id='16610000-0000-0000-0000-000000000261')<>1 then raise exception 'associacao_ausente_ou_duplicada';end if;
 if (select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121')<>2 then raise exception 'historico_ou_nova_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
