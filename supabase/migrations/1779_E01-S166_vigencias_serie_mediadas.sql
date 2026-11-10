-- ADR-1637: mediação de vigências preserva núcleos e histórico privados.
-- Ambas as consultas retornam coluna id; qualifica o gate para evitar ambiguidade PL/pgSQL.
do $patch$
declare f regprocedure;d text;a text:='from pcm.ocorrencia_rotina_gate where id';b text:='from pcm.ocorrencia_rotina_gate g where g.id';
begin
 foreach f in array array['pcm.sso_listar_vigencias_rotina_serie(uuid,uuid,uuid,uuid,integer)'::regprocedure,'pcm.sso_listar_eventos_vigencia_serie(uuid,uuid,integer,integer)'::regprocedure] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'consulta_vigencia_incompativel: %',f using errcode='55000';end if;
  d:=replace(d,a,b);
  a:='from pcm.planos_manutencao where id=p_plano_id';b:='from pcm.planos_manutencao p where p.id=p_plano_id';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'consulta_plano_incompativel: %',f using errcode='55000';end if;
  execute replace(d,a,b);
  a:='from pcm.ocorrencia_rotina_gate where id';b:='from pcm.ocorrencia_rotina_gate g where g.id';
 end loop;
end; $patch$;
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_vigencia_rotina_serie(uuid,uuid,uuid,uuid,uuid,integer,text,date,text)'::regprocedure);
 a text:='raise exception ''revisao_obsoleta'' using errcode=''40001''';b text:='raise exception ''revisao_obsoleta'' using errcode=''P0011''';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'decisao_vigencia_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
create function pcm.sso_conferir_vigencia_serie_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_escrita then perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 else perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait; end if;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
end; $$;
revoke all on function pcm.sso_conferir_vigencia_serie_mediada(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_listar_vigencias_serie_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_rotina uuid,p_serie uuid,p_apos uuid,p_limite integer)
returns table(id uuid,inicio date,fim date,revisao integer,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_vigencia_serie_mediada(p_ator,p_cliente,p_plano,false);
 return query select * from pcm.sso_listar_vigencias_rotina_serie(p_plano,p_rotina,p_serie,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_vigencias_serie_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_vigencias_serie_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_eventos_vigencia_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_vigencia uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_vigencia_serie_mediada(p_ator,p_cliente,p_plano,false);
 return query select * from pcm.sso_listar_eventos_vigencia_serie(p_plano,p_vigencia,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_eventos_vigencia_mediada(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_eventos_vigencia_mediada(uuid,uuid,uuid,uuid,integer,integer) to authenticated;

create function pcm.sso_decidir_vigencia_serie_mediada(p_ator uuid,p_cliente uuid,p_request uuid,p_plano uuid,p_rotina uuid,p_serie uuid,p_vigencia uuid,p_revisao integer,p_acao text,p_data date,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_vigencia_serie_mediada(p_ator,p_cliente,p_plano,true);
 return pcm.sso_decidir_vigencia_rotina_serie(p_request,p_plano,p_rotina,p_serie,p_vigencia,p_revisao,p_acao,p_data,p_motivo);
end; $$;
revoke all on function pcm.sso_decidir_vigencia_serie_mediada(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text,date,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_vigencia_serie_mediada(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text,date,text) to authenticated;
