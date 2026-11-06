-- Uma linha rejeitada permanece no histórico, sem exigir aplicação de seus campos.
-- Se a rejeição for reaberta, o ciclo novo exige nova conferência do retrato atual.
create or replace function pcm.sso_bloquear_conferencia_campos_localizacao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ciclo integer;
begin
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1) into v_ciclo;
 if exists(select 1 from pcm.sso_campos_localizacao_staging s join pcm.sso_levantamento_linhas l on l.lote_id=s.lote_id and l.chave=s.linha_chave
  where s.lote_id=new.lote_id and s.revisao=(select max(x.revisao) from pcm.sso_campos_localizacao_staging x where x.lote_id=s.lote_id and x.linha_chave=s.linha_chave)
  and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=s.lote_id and r.linha_chave=s.linha_chave)
  and (not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false)
   or not exists(select 1 from pcm.sso_conferencia_linhas cl where cl.lote_id=s.lote_id and cl.linha_chave=s.linha_chave and cl.ciclo=v_ciclo and cl.atributos=l.atributos and cl.revisao<new.revisao)
   or not exists(select 1 from pcm.sso_conferencias_campos_localizacao c where c.lote_id=s.lote_id and c.linha_chave=s.linha_chave and c.ciclo=v_ciclo and c.revisao_campos=s.revisao and c.campos=s.campos and c.revisao<new.revisao))) then raise exception 'campos_localizacao_nao_conferidos_ou_integracao_desabilitada' using errcode='55000';end if;
 return new;
end;$$;
