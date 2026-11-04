-- Gate 0883 permanece fechado até esta validação estar instalada.
create function pcm.sso_validar_campos_aprovacao_parcial() returns trigger language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_campos jsonb;v_edicao record;v_ultima integer;v_conferida boolean:=false;
begin
 select tipo into v_tipo from pcm.sso_levantamento_linhas where lote_id=new.lote_id and chave=new.linha_chave;
 if v_tipo in ('area','local','sublocal') then
  select s.campos,s.revisao into v_campos,v_ultima from pcm.sso_campos_localizacao_staging s where s.lote_id=new.lote_id and s.linha_chave=new.linha_chave order by s.revisao desc limit 1;
  if found then select exists(select 1 from pcm.sso_conferencias_campos_localizacao c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=new.ciclo and c.revisao_campos=v_ultima and c.campos=v_campos and c.revisao<new.revisao) into v_conferida;end if;
 elsif v_tipo='sistema' then
  v_campos:='{}'::jsonb;
  for v_edicao in select campos,revisao_lote from pcm.sso_edicoes_sistema_staging where lote_id=new.lote_id and linha_chave=new.linha_chave order by revisao_lote loop v_campos:=v_campos||v_edicao.campos;v_ultima:=v_edicao.revisao_lote;end loop;
  if v_ultima is not null then select exists(select 1 from pcm.sso_conferencias_campos_sistema c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=new.ciclo and c.campos=v_campos and c.revisao_lote>v_ultima and c.revisao_lote<new.revisao) into v_conferida;else v_campos:=null;end if;
 elsif v_tipo in ('equipamento','componente') then
  v_campos:='{}'::jsonb;
  for v_edicao in select campos,revisao_lote from pcm.sso_edicoes_componente_staging where lote_id=new.lote_id and linha_chave=new.linha_chave order by revisao_lote loop v_campos:=v_campos||v_edicao.campos;v_ultima:=v_edicao.revisao_lote;end loop;
  if v_ultima is not null then select exists(select 1 from pcm.sso_conferencias_campos_componente c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=new.ciclo and c.campos=v_campos and c.revisao_lote>v_ultima and c.revisao_lote<new.revisao) into v_conferida;else v_campos:=null;end if;
 end if;
 if v_campos is not null and (v_conferida is not true or new.campos_estruturados is distinct from v_campos) then raise exception 'campos_estruturados_nao_conferidos_ou_divergentes' using errcode='23514';end if;
 if v_campos is null and new.campos_estruturados is not null then raise exception 'campos_estruturados_inexistentes' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function pcm.sso_validar_campos_aprovacao_parcial() from public,anon,authenticated,service_role;
create trigger sso_validar_campos_aprovacao_parcial before insert on pcm.sso_aprovacoes_parciais_linhas for each row execute function pcm.sso_validar_campos_aprovacao_parcial();
