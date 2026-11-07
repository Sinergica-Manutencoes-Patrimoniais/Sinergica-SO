create or replace function pcm.sso_bloquear_conferencia_campos_localizacao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ciclo integer;
begin
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1) into v_ciclo;
 if exists(select 1 from pcm.sso_campos_localizacao_staging s join pcm.sso_levantamento_linhas l on l.lote_id=s.lote_id and l.chave=s.linha_chave
  where s.lote_id=new.lote_id and s.revisao=(select max(x.revisao) from pcm.sso_campos_localizacao_staging x where x.lote_id=s.lote_id and x.linha_chave=s.linha_chave)
  and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=s.lote_id and r.linha_chave=s.linha_chave)
  and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=s.lote_id and i.linha_chave=s.linha_chave)
  and not exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=s.lote_id and a.linha_chave=s.linha_chave)
  and (not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false)
   or not exists(select 1 from pcm.sso_conferencia_linhas cl where cl.lote_id=s.lote_id and cl.linha_chave=s.linha_chave and cl.ciclo=v_ciclo and cl.atributos=l.atributos and cl.revisao<new.revisao)
   or not exists(select 1 from pcm.sso_conferencias_campos_localizacao c where c.lote_id=s.lote_id and c.linha_chave=s.linha_chave and c.ciclo=v_ciclo and c.revisao_campos=s.revisao and c.campos=s.campos and c.revisao<new.revisao))) then raise exception 'campos_localizacao_nao_conferidos_ou_integracao_desabilitada' using errcode='55000';end if;
 return new;
end;$$;

create or replace function pcm.sso_resumo_conferencia_lote(p_lote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_total integer;v_pendentes integer;v_ciclo integer;v_reabertura integer;
begin
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1),coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0) into v_ciclo,v_reabertura;
 select count(*),count(*) filter(where not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos)
  and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave)
  and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave)
  and not exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=l.lote_id and a.linha_chave=l.chave)) into v_total,v_pendentes from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id;
 return jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'total',v_total,'pendentes',v_pendentes,'conferenciaRegistrada',exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>v_reabertura));
end;$$;
