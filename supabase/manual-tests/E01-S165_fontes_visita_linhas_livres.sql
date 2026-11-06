-- SOMENTE clone sintético isolado após E01-S165_fontes_visita_linhas_reais.sql; trava livre, rollback obrigatório.
begin;
insert into pcm.sso_ciclos_visita_canonicos(id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem)
values ('16598200-0000-4000-8000-000000000002','17252000-0000-4000-8000-000000000010','17252000-0000-4000-8000-000000000013','sistema','17252000-0000-4000-8000-000000000009','17252000-0000-4000-8000-000000000007','2026-11-02');
insert into pcm.sso_ciclo_visita_versoes(preparada_id,ciclo_id,versao_id,ator_id)
values ('17252000-0000-4000-8000-000000000015','16598200-0000-4000-8000-000000000001','17252000-0000-4000-8000-000000000011','17252000-0000-4000-8000-000000000001');
insert into pcm.sso_decisoes_impacto_visita(request_id,cliente_id,plano_id,rascunho_id,preparada_id,ciclo_id,revisao_plano,revisao,decisao,motivo,fotografia,ator_id,payload,resultado)
values ('16598200-0000-4000-8000-000000000003','17252000-0000-4000-8000-000000000002','17252000-0000-4000-8000-000000000010','17252000-0000-4000-8000-000000000011','17252000-0000-4000-8000-000000000015','16598200-0000-4000-8000-000000000001',1,1,'manter_sem_alterar','Sintético','{}','17252000-0000-4000-8000-000000000001','{}','{}');
rollback;
