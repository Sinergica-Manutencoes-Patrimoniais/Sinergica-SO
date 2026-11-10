-- Clone sintético com migrations até 1691. BEGIN/ROLLBACK; aprovação 1045 segue bloqueada.
\ir manual_E01-S165_impacto_calendario_mediado.sql
reset role;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
-- Chamadas com papel autenticado e Cliente da sessão; replays conservam autorização.
set local role authenticated;
do $$ declare p uuid;f jsonb;a jsonb;b jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20) limit 1;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',p,'calendario');
 begin
  perform pcm.sso_escolher_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000092','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,0,'calendario','Conferido',f);
  raise exception 'escolha_retroativa_aceita';
 exception when check_violation then if sqlerrm<>'decisao_anterior_sem_escolha' then raise;end if;end;
 a:=pcm.sso_escolher_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000591','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'calendario','Conferido',f);
 b:=pcm.sso_escolher_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000591','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'calendario','Conferido',f);
 if a is distinct from b or a->>'alteracaoEscolhida'<>'true' or a->>'versaoOperacionalAplicada'<>'false' then raise exception 'escolha_ou_replay_divergente: %',a;end if;
end; $$;

reset role;
do $$ begin
 if not pcm.sso_escolha_alteracao_atual('calendario','16630000-1111-4000-8000-000000000591','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',2) then raise exception 'escolha_nao_reconhecida';end if;
 if exists(select 1 from pcm.sso_versoes_operacionais_ciclo where plano_id='16630000-1111-4000-8000-000000000011') then raise exception 'selo_antes_aprovacao';end if;
end; $$;
update config.sso_concessoes set ativa=false where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ declare p uuid;f jsonb;begin
 -- Sem permissão nem repetição de ID já confirmado deve avançar; parâmetros sintéticos completos.
 begin
  perform pcm.sso_escolher_alteracao_ciclo('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000591','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000061',2,1,'calendario','Conferido','{}'::jsonb);
  raise exception 'permissao_revogada_aceita';
 exception when insufficient_privilege then null;end;
end; $$;
reset role;
