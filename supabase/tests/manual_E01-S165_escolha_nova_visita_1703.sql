-- Clone isolado com migrations até 1703, BEGIN/ROLLBACK. O comando é privado nesta fase;
-- chamadas mediadas sob authenticated; não prova aprovação ou concorrência.
\ir manual_E01-S165_impacto_visita_mediado.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
set local session_replication_role=replica;
update pcm.visitas set inicio_em='2026-10-16 11:00+00',fim_em='2026-10-16 13:00+00' where id='16610000-0000-0000-0000-000000000083';
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000071','2026-10-12','16610000-0000-0000-0000-000000000001');
set local session_replication_role=origin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;n integer;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161','visita');
 select count(*) into n from pcm.sso_listar_candidatas_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,'2026-10-12','2026-10-18',f) where visita_id='16610000-0000-0000-0000-000000000083' and vencimento='2026-10-16';
 if n<>1 then raise exception 'candidata_ausente';end if;
 begin perform pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000230','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,1,'16610000-0000-0000-0000-000000000083','2026-10-17','calendário de campo','escolha',f);raise exception 'data_divergente_aceita';exception when serialization_failure then null;end;
 a:=pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000231','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,1,'16610000-0000-0000-0000-000000000083','2026-10-16','calendário de campo','escolha',f);
 b:=pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000231','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,1,'16610000-0000-0000-0000-000000000083','2026-10-16','calendário de campo','escolha',f);
 if a is distinct from b or a->>'substituicaoAplicada'<>'false' or a->>'fontesFeriadosCompletas'<>'false' then raise exception 'escolha_divergente';end if;
 if (pcm.sso_consultar_escolha_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2)->>'atual') is distinct from 'true' then raise exception 'escolha_nao_atual';end if;
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_escolher_nova_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,uuid,date,text,text,jsonb)','execute') then raise exception 'anon_escrita_aceita';end if;
end; $$;
set local role authenticated;
do $$ begin
 begin perform * from pcm.sso_listar_candidatas_nova_visita('16610000-0000-0000-0000-000000000099','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,'2026-10-12','2026-10-18','{}'::jsonb);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform * from pcm.sso_listar_candidatas_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,'2026-10-12','2026-10-18','{}'::jsonb);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
-- Uma decisão posterior sem escolha não deve mostrar a escolha anterior como atual.
set local role authenticated;
do $$ declare f jsonb;r jsonb;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161','visita');
 r:=pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000232','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2,2,'exige_reconciliacao','nova decisão','visita',f);
 if pcm.sso_consultar_escolha_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',2) is not null then raise exception 'escolha_obsoleta_visivel';end if;
end; $$;
reset role;
