-- Clone descartável, BEGIN/ROLLBACK. Aprovação da fixture é simulada: 1045 é
-- substituída apenas na transação e retorna ao estado original no ROLLBACK.
\ir manual_E01-S165_aprovacao_nova_visita_1703.sql
reset role;
create temporary table fixture1707_rev as select p.revisao,e.rotina_id from pcm.planos_manutencao p join pcm.sso_escolhas_nova_data_visita e on e.plano_id=p.id where e.request_id='16610000-0000-0000-0000-000000000231' and p.id='16610000-0000-0000-0000-000000000121';
grant select on fixture1707_rev to authenticated;
set local role authenticated;
do $$ declare rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1707_rev;
 begin
  perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000270','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000271','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
  raise exception 'uso_antes_vigencia_aceito';
 exception when check_violation then if sqlerrm<>'substituicao_ainda_nao_vigente' then raise;end if;end;
end; $$;
reset role;
do $$ begin if exists(select 1 from pcm.sso_ciclo_visita_usos_versao where preparada_id='16610000-0000-0000-0000-000000000271') or exists(select 1 from pcm.sso_substituicoes_visita_materializadas where preparada_nova_id='16610000-0000-0000-0000-000000000271') then raise exception 'uso_ou_vinculo_antecipado';end if;end; $$;
