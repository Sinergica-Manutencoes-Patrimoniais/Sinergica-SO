-- Executar em clone, BEGIN/ROLLBACK; 1045 e data simuladas na fixture inclusa.
\ir manual_E01-S165_visita_ponte_1728_aprovacao.sql
reset role;
-- Recusar OS da fonte legada antes da ponte, com gatilhos reais e sem envio.
do $$ begin
 begin
  insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) values('17280000-0000-0000-0000-000000000011','16610000-0000-0000-0000-00000000000a','OS-V1728','Fixture','preventiva','16610000-0000-0000-0000-000000000001','17280000-0000-0000-0000-000000000010');
  raise exception 'os_sem_ponte_aceita';
 exception when check_violation then if sqlerrm<>'ponte_reservada_ausente' then raise;end if;end;
end; $$;
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

-- Vincular a ocorrência já existente pelo comando mediado, sem criar OS/Auvo.
update pcm.sso_materializar_visita_legado_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_visita_legada_mediada('16610000-0000-0000-0000-000000000001','17280000-0000-0000-0000-000000000012','16610000-0000-0000-0000-00000000000a','17280000-0000-0000-0000-000000000004','16610000-0000-0000-0000-000000000930','16610000-0000-0000-0000-000000000933','vínculo conferido');
 b:=pcm.sso_materializar_visita_legada_mediada('16610000-0000-0000-0000-000000000001','17280000-0000-0000-0000-000000000012','16610000-0000-0000-0000-00000000000a','17280000-0000-0000-0000-000000000004','16610000-0000-0000-0000-000000000930','16610000-0000-0000-0000-000000000933','vínculo conferido');
 if a is distinct from b or a->>'legadaId'<>'17280000-0000-0000-0000-000000000010' or a->>'ocorrenciaLegadaCriada'<>'false' or a->>'osCriada'<>'false' then raise exception 'ponte_ou_replay_divergente: %',a;end if;
end; $$;
reset role;

-- A guarda reconhece a ponte depois da vinculação mediada.
do $$ begin perform pcm.sso_exigir_ponte_legada_reservada('17280000-0000-0000-0000-000000000010');end; $$;
