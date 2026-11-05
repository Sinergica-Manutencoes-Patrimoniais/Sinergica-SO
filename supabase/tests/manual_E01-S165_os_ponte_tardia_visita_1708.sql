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
do $$ declare r jsonb;begin
 r:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000262','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if (r->>'canceladas')::integer<>1 then raise exception 'retirada_nao_ocorreu';end if;
end; $$;
reset role;
-- Ponte/OS sintéticas para representar fonte legada tardia, não envio real.
set local session_replication_role=replica;
insert into pcm.sso_vinculos_visita_legado(request_id,cliente_id,ocorrencia_visita_id,ocorrencia_legada_id,relacao_request_id,motivo,ator_id,payload,resultado) values('16610000-0000-0000-0000-000000000901','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000161','16610000-0000-0000-0000-000000000902','16610000-0000-0000-0000-000000000903','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) values('16610000-0000-0000-0000-000000000904','16610000-0000-0000-0000-00000000000a','OS-1708','fixture','preventiva','16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000902');
set local session_replication_role=origin;
set local role authenticated;
do $$ declare rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1705_revisao;
 begin
  perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
  raise exception 'os_legada_ignorada';
 exception when check_violation then if sqlerrm<>'origem_antiga_exige_reconciliacao' then raise;end if;end;
end; $$;
reset role;
do $$ begin
 if exists(select 1 from pcm.ocorrencias_visita_preparadas where id='16610000-0000-0000-0000-000000000261') or not exists(select 1 from pcm.ordens_servico where id='16610000-0000-0000-0000-000000000904') then raise exception 'efeito_indevido';end if;
end; $$;
