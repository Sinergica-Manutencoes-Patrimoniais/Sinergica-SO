-- Clone descartável, BEGIN/ROLLBACK. Exercita somente a guarda 1696 usando tabelas
-- temporárias homônimas; não substitui jornada integrada dos comandos reais.
\ir manual_E01-S168_coordenacao_visita_1696.sql
create temporary table retorno_os_preparado (like pcm.retorno_os_preparado including defaults);
create temporary table decisoes_validacao_os (like pcm.decisoes_validacao_os including defaults);
create temporary table sso_finalizacoes_os_validadas (like pcm.sso_finalizacoes_os_validadas including defaults);
create trigger verificar before insert on retorno_os_preparado for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
create trigger verificar before insert on decisoes_validacao_os for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
create trigger verificar before insert on sso_finalizacoes_os_validadas for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
-- Retorno válido e rejeições de Cliente e origem.
insert into retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem,cobertura_comprovada)
 values ('16891000-0000-4000-8000-000000000101','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','teste-1696','manual_declarado',false);
do $$ begin
 begin insert into retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem,cobertura_comprovada) values ('16891000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000099','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','errado','manual_declarado',false);raise exception 'cliente_invalido_aceito';exception when check_violation then null;end;
 begin insert into retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem,cobertura_comprovada) values ('16891000-0000-4000-8000-000000000103','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','errado','auvo_verificado',false);raise exception 'origem_invalida_aceita';exception when insufficient_privilege then null;end;
end; $$;
-- Decisão exige ator atual; o retorno apontado é a fixture real do schema pcm.
insert into decisoes_validacao_os(id,retorno_id,request_id,decisao,actor_id) values ('16891000-0000-4000-8000-000000000104','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000105','devolver','16891000-0000-4000-8000-000000000001');
do $$ begin
 begin insert into decisoes_validacao_os(id,retorno_id,request_id,decisao,actor_id) values ('16891000-0000-4000-8000-000000000106','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000107','devolver','16891000-0000-4000-8000-000000000099');raise exception 'ator_invalido_aceito';exception when insufficient_privilege then null;end;
end; $$;
-- Finalização exige OS finalizada, atestação atual e pendência para resposta não OK.
set local session_replication_role=replica;
update pcm.ordens_servico set status='finalizado' where id='16891000-0000-4000-8000-000000000017';
set local session_replication_role=origin;
insert into sso_finalizacoes_os_validadas(request_id,retorno_id,os_id,atestacao_request_id,revisao_decisao,payload,resultado,ator_id)
 values ('16891000-0000-4000-8000-000000000108','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'{}','{}','16891000-0000-4000-8000-000000000001');
do $$ begin
 begin insert into sso_finalizacoes_os_validadas(request_id,retorno_id,os_id,atestacao_request_id,revisao_decisao,payload,resultado,ator_id) values ('16891000-0000-4000-8000-000000000109','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',2,'{}','{}','16891000-0000-4000-8000-000000000001');raise exception 'revisao_invalida_aceita';exception when check_violation then null;end;
end; $$;
