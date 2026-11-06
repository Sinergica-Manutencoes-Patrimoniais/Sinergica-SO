-- Função interna: os comandos de escrita já bloquearam o lote e autorizaram o ator.
create function pcm.sso_revisao_aprovacao_parcial_campos(p_lote_id uuid,p_chave text,p_ciclo integer,p_campos jsonb) returns integer language plpgsql stable security definer set search_path='' as $$
declare v_revision integer;
begin
 if not coalesce((select habilitado from pcm.sso_aprovacao_parcial_gate where id),false) then return null;end if;
 select a.revisao into v_revision from pcm.sso_aprovacoes_parciais_linhas a
 join pcm.sso_levantamento_linhas l on l.lote_id=a.lote_id and l.chave=a.linha_chave
 where a.lote_id=p_lote_id and a.linha_chave=p_chave and a.ciclo=p_ciclo
  and a.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)
  and a.atributos=l.atributos and a.campos_estruturados is not distinct from p_campos
  and a.codigo_revision=coalesce((select c.revisao from pcm.sso_codigo_staging c where c.lote_id=p_lote_id and c.linha_chave=p_chave),0)
  and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=p_lote_id and r.linha_chave=p_chave);
 return v_revision;
end;$$;
revoke all on function pcm.sso_revisao_aprovacao_parcial_campos(uuid,text,integer,jsonb) from public,anon,authenticated,service_role;
