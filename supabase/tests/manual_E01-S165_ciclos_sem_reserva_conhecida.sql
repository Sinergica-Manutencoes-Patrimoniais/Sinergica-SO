-- Clone descartavel, transacao revertida; relacao positiva nao afirma equivalencia.
begin;
\ir manual_E01-S165_reserva_ciclo_1714_setup.sql
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
select pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relacao verificada');
select pcm.materializar_ocorrencias_preventivas('16630000-1111-4000-8000-000000000097',current_date);
do $$ begin
 if not exists(select 1 from pcm.ocorrencias_preventivas l join pcm.planos_preventivos p on p.id=l.plano_id where p.id='16630000-1111-4000-8000-000000000097' and p.sistema_id='16630000-1111-4000-8000-000000000033' and l.indice=0 and l.vencimento=current_date) then raise exception 'legada_ausente';end if;
 if not exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011' and o.alvo_id='16630000-1111-4000-8000-000000000033' and o.vencimento_original=current_date) then raise exception 'sso_ausente';end if;
 if exists(select 1 from pcm.sso_reservas_ciclo_legado where legado_id='16630000-1111-4000-8000-000000000097') then raise exception 'escolha_inesperada';end if;
end $$;
rollback;
