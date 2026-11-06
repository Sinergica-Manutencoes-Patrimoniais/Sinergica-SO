-- Clone descartável com migrations até 1697; executar em BEGIN/ROLLBACK.
\ir manual_E01-S165_escolha_alteracao_1691.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ declare p uuid;r jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20) limit 1;
 r:=pcm.sso_consultar_escolha_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario');
 if r->>'registrada'<>'true' or r->>'atual'<>'true' then raise exception 'escolha_nao_projetada: %',r;end if;
 begin perform pcm.sso_consultar_escolha_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario');raise exception 'outro_cliente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
update pcm.rotinas_manutencao set nome='Mudou depois da escolha' where versao_id='16630000-1111-4000-8000-000000000022';
set local role authenticated;
do $$ declare p uuid;r jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20) limit 1;
 r:=pcm.sso_consultar_escolha_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario');
 if r->>'registrada'<>'true' or r->>'atual'<>'false' then raise exception 'escolha_obsoleta_nao_detectada: %',r;end if;
end; $$;
reset role;
