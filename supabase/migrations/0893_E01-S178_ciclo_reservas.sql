create function pcm.sso_reservar_codigo_aprovacao_integral() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ciclo integer;v_linha record;v_codigo text;v_candidato text;v_existentes bigint;
begin
 if not coalesce((select habilitado from pcm.sso_reserva_codigo_parcial_gate where id),false) then return new;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1) into v_ciclo;
 for v_linha in select l.chave,l.atributos from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.tipo in ('sistema','equipamento','componente') and exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos and c.revisao<new.revisao) and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave) and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave) loop
  v_codigo:=nullif(btrim(v_linha.atributos->>'codigoInformado'),'');select nullif(btrim(s.codigo),'') into v_candidato from pcm.sso_codigo_staging s where s.lote_id=new.lote_id and s.linha_chave=v_linha.chave;
  if v_codigo is not null and v_candidato is not null and v_codigo is distinct from v_candidato then raise exception 'codigos_divergentes' using errcode='23514';end if;
  v_codigo:=coalesce(v_candidato,v_codigo);if v_codigo is null then continue;end if;
  if length(v_codigo)>200 or v_codigo<>upper(v_codigo) or v_codigo~'[[:space:]]' then raise exception 'codigo_invalido' using errcode='22023';end if;
  if exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo))=v_codigo) then raise exception 'codigo_indisponivel' using errcode='23505';end if;
  select (select count(*) from pcm.sistemas s where upper(btrim(s.codigo))=v_codigo)+(select count(*) from pcm.equipamentos e where upper(btrim(e.identificador))=v_codigo) into v_existentes;
  if v_existentes>1 then raise exception 'codigo_legado_ambiguo' using errcode='23505';end if;
  if v_existentes=1 then continue;end if;
  if exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.lote_id=new.lote_id and r.linha_chave=v_linha.chave and r.ciclo=v_ciclo and r.codigo=v_codigo and r.consumida_em is null and r.liberada_em is null) then continue;end if;
  insert into pcm.sso_reservas_codigo_parcial(lote_id,linha_chave,ciclo,codigo,ator_id,request_id) values(new.lote_id,v_linha.chave,v_ciclo,v_codigo,new.ator_id,new.request_id);
 end loop;
 return new;
end;$$;
revoke all on function pcm.sso_reservar_codigo_aprovacao_integral() from public,anon,authenticated,service_role;
create trigger sso_reservar_codigo_aprovacao_integral after insert on pcm.sso_conferencia_lotes for each row execute function pcm.sso_reservar_codigo_aprovacao_integral();

create function pcm.sso_liberar_reservas_por_decisao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_linha text;v_motivo text;v_ator uuid;v_reserva record;
begin
 if tg_table_name='sso_levantamento_rejeicoes' then v_linha:=new.linha_chave;v_motivo:='rejeicao: '||new.motivo;v_ator:=new.ator_id;
 else v_linha:=null;v_motivo:='reabertura: '||new.motivo;v_ator:=new.ator_id;end if;
 if not exists(select 1 from pcm.sso_reservas_codigo_parcial r where r.lote_id=new.lote_id and r.consumida_em is null and r.liberada_em is null and (v_linha is null or r.linha_chave=v_linha)) then return new;end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_concorrente_tente_novamente' using errcode='40001';end if;
 for v_reserva in update pcm.sso_reservas_codigo_parcial r set liberada_em=now(),liberada_por=v_ator,motivo_liberacao=v_motivo where r.lote_id=new.lote_id and r.consumida_em is null and r.liberada_em is null and (v_linha is null or r.linha_chave=v_linha) returning r.id,r.linha_chave,r.ciclo loop
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.reserva_codigo_liberada','sso_levantamentos',new.lote_id,jsonb_build_object('reservaId',v_reserva.id,'linhaChave',v_reserva.linha_chave,'ciclo',v_reserva.ciclo,'motivo',v_motivo));
 end loop;
 return new;
end;$$;
revoke all on function pcm.sso_liberar_reservas_por_decisao() from public,anon,authenticated,service_role;
create trigger sso_liberar_reservas_reabertura after insert on pcm.sso_conferencia_reaberturas for each row execute function pcm.sso_liberar_reservas_por_decisao();
create trigger sso_liberar_reservas_rejeicao after insert on pcm.sso_levantamento_rejeicoes for each row execute function pcm.sso_liberar_reservas_por_decisao();
