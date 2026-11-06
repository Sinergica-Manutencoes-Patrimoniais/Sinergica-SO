-- Executar em clone com migrations até 1662, em BEGIN/ROLLBACK. Inclui fixture sintética.
\ir manual_E01-S165_impacto_visita_mediado.sql
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
create temporary table comparacao_1657 as select pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181',(select preparada_id from pcm.sso_listar_decisoes_visita_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,null,20)),'visita') as foto;
-- Simula mudança só da identidade exibida, mantendo alvo, data e regra.
reset role;
update pcm.ocorrencias_visita_preparadas set semana_origem=semana_origem+7 where plano_id='16610000-0000-0000-0000-000000000121';
set local role authenticated;
do $$ declare p uuid;f jsonb;begin
 select (foto->>'preparadaId')::uuid,foto into p,f from comparacao_1657;
 begin
  perform pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000193','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita',f);
  raise exception 'identidade_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'comparacao_obsoleta' then raise;end if;end;
end; $$;
reset role;
update pcm.ocorrencias_visita_preparadas set semana_origem=semana_origem-7 where plano_id='16610000-0000-0000-0000-000000000121';
set local role authenticated;
do $$ declare p uuid;r jsonb;begin
 select (foto->>'preparadaId')::uuid into p from comparacao_1657;
 -- Replay anterior à migração continua acessível; criação sem comparação não pode passar.
 r:=pcm.sso_decidir_impacto_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000182','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,0,'manter_sem_alterar','continuidade conferida','visita');
 if r->>'decisao' is distinct from 'manter_sem_alterar' then raise exception 'replay_legado_invalido';end if;
 begin
  perform pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000182','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,0,'manter_sem_alterar','continuidade conferida','visita',(select foto from comparacao_1657));
  raise exception 'anexou_foto_a_decisao_antiga';
 exception when check_violation then if sqlerrm<>'decisao_anterior_sem_comparacao' then raise;end if;end;
 begin
  perform pcm.sso_decidir_impacto_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000190','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita');
  raise exception 'decisao_sem_comparacao_aceita';
 exception when check_violation then if sqlerrm<>'comparacao_obrigatoria' then raise;end if;end;
end; $$;
reset role;
update pcm.rotinas_manutencao set nome='Mudou depois da comparação' where versao_id='16610000-0000-0000-0000-000000000181';
set local role authenticated;
do $$ declare p uuid;f jsonb;begin
 select (foto->>'preparadaId')::uuid,foto into p,f from comparacao_1657;
 begin
  perform pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita',f);
  raise exception 'comparacao_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'comparacao_obsoleta' then raise;end if;end;
end; $$;
reset role;
update pcm.rotinas_manutencao set nome='Rotina lote' where versao_id='16610000-0000-0000-0000-000000000181';
set local role authenticated;
do $$ declare p uuid;f jsonb;a jsonb;b jsonb;begin
 select (foto->>'preparadaId')::uuid,foto into p,f from comparacao_1657;
 a:=pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita',f);
 b:=pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita',f);
 if a is distinct from b or a->>'revisao' is distinct from '2' then raise exception 'replay_divergente';end if;
 begin
  perform pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p,2,1,'exige_reconciliacao','conferido','visita',f||'{"vencimentoOriginal":"2025-01-01"}'::jsonb);
  raise exception 'replay_com_foto_divergente_aceito';
 exception when unique_violation then if sqlerrm<>'request_id_conflitante' then raise;end if;end;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_comparacoes_decisoes_impacto where plano_id='16610000-0000-0000-0000-000000000121')<>1 then raise exception 'comparacao_duplicada_ou_ausente';end if;
 if (select count(*) from pcm.sso_decisoes_impacto_visita where plano_id='16610000-0000-0000-0000-000000000121')<>2 then raise exception 'decisao_duplicada_ou_ausente';end if;
end; $$;
