-- Executar em clone com migrations até 1657, em BEGIN/ROLLBACK. Inclui fixture sintética.
\ir manual_E01-S165_impacto_calendario_mediado.sql
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
set local role authenticated;
create temporary table comparacao_1657 as select pcm.sso_comparar_rotina_impacto('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',(select preparada_id from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20)),'calendario') as foto;
do $$ declare p uuid;r jsonb;begin
 select (foto->>'preparadaId')::uuid into p from comparacao_1657;
 -- Replay anterior à migração continua acessível; criação sem comparação não pode passar.
 r:=pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000092','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,0,'manter_sem_alterar','continuidade conferida','calendario');
 if r->>'decisao' is distinct from 'manter_sem_alterar' then raise exception 'replay_legado_invalido';end if;
 begin
  perform pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000092','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,0,'manter_sem_alterar','continuidade conferida','calendario',(select foto from comparacao_1657));
  raise exception 'anexou_foto_a_decisao_antiga';
 exception when check_violation then if sqlerrm<>'decisao_anterior_sem_comparacao' then raise;end if;end;
 begin
  perform pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario');
  raise exception 'decisao_sem_comparacao_aceita';
 exception when check_violation then if sqlerrm<>'comparacao_obrigatoria' then raise;end if;end;
end; $$;
reset role;
update pcm.rotinas_manutencao set nome='Mudou depois da comparação' where versao_id='16630000-1111-4000-8000-000000000022';
set local role authenticated;
do $$ declare p uuid;f jsonb;begin
 select (foto->>'preparadaId')::uuid,foto into p,f from comparacao_1657;
 begin
  perform pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario',f);
  raise exception 'comparacao_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'comparacao_obsoleta' then raise;end if;end;
end; $$;
reset role;
update pcm.rotinas_manutencao set nome='Rotina fixture' where versao_id='16630000-1111-4000-8000-000000000022';
set local role authenticated;
do $$ declare p uuid;f jsonb;a jsonb;b jsonb;begin
 select (foto->>'preparadaId')::uuid,foto into p,f from comparacao_1657;
 a:=pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario',f);
 b:=pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario',f);
 if a is distinct from b or a->>'revisao' is distinct from '2' then raise exception 'replay_divergente';end if;
 begin
  perform pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario',f||'{"vencimentoOriginal":"2025-01-01"}'::jsonb);
  raise exception 'replay_com_foto_divergente_aceito';
 exception when unique_violation then if sqlerrm<>'request_id_conflitante' then raise;end if;end;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_comparacoes_decisoes_impacto where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'comparacao_duplicada_ou_ausente';end if;
 if (select count(*) from pcm.sso_decisoes_impacto_ocorrencia where plano_id='16630000-1111-4000-8000-000000000011')<>2 then raise exception 'decisao_duplicada_ou_ausente';end if;
end; $$;
