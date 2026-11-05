-- ADR-1580: escolhas seladas passam a ser aplicadas na vigência, sem escrita em leitura.
create function pcm.sso_reserva_rascunho_vigente(p_legado uuid,p_indice integer,p_modo text,p_ciclo uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e pcm.sso_escolhas_reserva_futura_rascunho%rowtype;s pcm.sso_selos_reserva_futura_rascunho%rowtype;
 v pcm.plano_versoes%rowtype;v_atual jsonb;v_rotina jsonb;v_q integer;v_resultado jsonb;v_campo text;v_contagem integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
 if not ((p_legado is not null and p_indice is not null and p_modo is null and p_ciclo is null)
   or (p_legado is null and p_indice is null and p_modo in ('calendario','visita') and p_ciclo is not null)) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 lock table pcm.sso_escolhas_reserva_futura_rascunho,pcm.sso_selos_reserva_futura_rascunho,
  pcm.plano_versoes,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 for s in select x.* from pcm.sso_selos_reserva_futura_rascunho x join pcm.sso_escolhas_reserva_futura_rascunho y on y.request_id=x.escolha_request_id
  where (p_legado is not null and y.legado_id=p_legado and y.indice_legado=p_indice)
   or (p_ciclo is not null and x.modo=p_modo and x.ciclo_id=p_ciclo) loop
  select * into e from pcm.sso_escolhas_reserva_futura_rascunho where request_id=s.escolha_request_id;
  select * into v from pcm.plano_versoes where id=s.versao_id and plano_id=e.plano_id and estado='aprovado';
  if not found or v.vigencia_inicio is distinct from s.vigencia then raise exception 'selo_reserva_invalido' using errcode='23514';end if;
  -- Versão histórica fora da data do ciclo não compete com a vigente.
  if e.data_sso<v.vigencia_inicio or (v.vigencia_fim is not null and e.data_sso>v.vigencia_fim) then continue;end if;
  if s.vigencia>pcm.sso_data_civil_transicao_plano(e.plano_id,s.versao_id,s.vigencia) then continue;end if;
  if v_resultado is not null then raise exception 'selos_reserva_conflitantes' using errcode='23514';end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-reserva-ciclo:'||s.modo||':'||s.ciclo_id::text,0)) then raise exception 'reserva_em_alteracao' using errcode='55P03';end if;
  perform 1 from pcm.planos_manutencao where id=e.plano_id and cliente_id=e.cliente_id for share nowait;
  if not found then raise exception 'reserva_origem_indisponivel' using errcode='23514';end if;
  perform 1 from pcm.planos_preventivos where id=e.legado_id and cliente_id=e.cliente_id for share nowait;
  if not found then raise exception 'reserva_origem_indisponivel' using errcode='23514';end if;
  select * into v from pcm.plano_versoes where id=s.versao_id and plano_id=e.plano_id and estado='aprovado';
  if not found or s.versao_id is distinct from e.rascunho_id or s.modo is distinct from e.modo or v.vigencia_inicio is distinct from s.vigencia
   or e.data_sso<s.vigencia or (v.vigencia_fim is not null and e.data_sso>v.vigencia_fim) or jsonb_typeof(v.snapshot->'rotinas') is distinct from 'array' then raise exception 'selo_reserva_invalido' using errcode='23514';end if;
  select count(*) into v_contagem from pcm.plano_versoes x where x.plano_id=e.plano_id and x.estado='aprovado' and x.vigencia_inicio<=e.data_sso and (x.vigencia_fim is null or x.vigencia_fim>=e.data_sso);
  if v_contagem<>1 then raise exception 'versao_ciclo_indeterminada' using errcode='23514';end if;
  select count(*),min(x.item::text)::jsonb into v_q,v_rotina from jsonb_array_elements(v.snapshot->'rotinas') x(item) where x.item->>'id'=e.rotina_id::text;
  if v_q<>1 or jsonb_typeof(e.foto->'regraSso') is distinct from 'object' then raise exception 'rotina_reserva_indeterminada' using errcode='23514';end if;
  foreach v_campo in array array['id','rotina_logica_id','modo','alvo_tipo','sistema_id','equipamento_id','grupo_id','data_base','intervalo_n','intervalo_unidade','questionario_id'] loop
   if v_rotina->>v_campo is distinct from e.foto->'regraSso'->>v_campo then raise exception 'regra_reserva_obsoleta' using errcode='23514';end if;
  end loop;
  v_atual:=pcm.sso_foto_reserva_ciclo(e.plano_id,e.legado_id);
  if v_atual is null then raise exception 'reserva_origem_indisponivel' using errcode='23514';end if;
  for v_campo in select key from jsonb_object_keys(v_atual) as k(key) where key<>'planoRevisao' loop
   if v_atual->v_campo is distinct from e.foto->v_campo then raise exception 'reserva_origem_obsoleta' using errcode='23514';end if;
  end loop;
  if e.modo='calendario' then
   if not exists(select 1 from pcm.sso_ciclos_calendario_canonicos c join pcm.sso_series_ciclo_calendario t on t.id=c.serie_id where c.id=s.ciclo_id and c.indice=e.indice_sso and c.vencimento_original=e.data_sso and t.plano_id=e.plano_id and t.rotina_logica_id=(v_rotina->>'rotina_logica_id')::uuid) then raise exception 'identidade_reserva_divergente' using errcode='23514';end if;
  else
   lock table pcm.visitas,pcm.visita_origem_contratual,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes,pcm.feriados_declarados,pcm.sso_visitas_suprimidas_feriado,pcm.visita_ordens_servico,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias in share mode nowait;
   if not exists(select 1 from pcm.sso_ciclos_visita_canonicos c where c.id=s.ciclo_id and c.plano_id=e.plano_id and c.rotina_logica_id=(v_rotina->>'rotina_logica_id')::uuid
     and c.alvo_tipo=v_rotina->>'alvo_tipo' and c.alvo_id=(case v_rotina->>'alvo_tipo' when 'sistema' then v_rotina->>'sistema_id' when 'componente' then v_rotina->>'equipamento_id' when 'grupo' then v_rotina->>'grupo_id' end)::uuid
     and c.serie_id=(e.foto->'origemVisita'->>'serie_id')::uuid and c.semana_origem=(e.foto->'origemVisita'->>'semana_origem')::date)
    or not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.rotina_serie_vigencias g on g.plano_id=l.plano_id and g.rotina_logica_id=l.rotina_logica_id and g.serie_id=l.serie_id where l.plano_id=e.plano_id and l.rotina_logica_id=(v_rotina->>'rotina_logica_id')::uuid and l.serie_id=(e.foto->'origemVisita'->>'serie_id')::uuid and g.inicio<=e.data_sso and (g.fim is null or g.fim>=e.data_sso))
    or exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=(e.foto->'visita'->>'id')::uuid and vo.encerrado_em is null)
    or not exists(select 1 from pcm.visitas x where x.id=(e.foto->'visita'->>'id')::uuid and to_jsonb(x)=e.foto->'visita')
    or not exists(select 1 from pcm.visita_origem_contratual x where x.visita_id=(e.foto->'origemVisita'->>'visita_id')::uuid and to_jsonb(x)=e.foto->'origemVisita')
    or not exists(select 1 from pcm.regras_visita_contratual x where x.id=(e.foto->'regraVisita'->>'id')::uuid and x.id=pcm.sso_regra_efetiva_visita((e.foto->'visita'->>'id')::uuid) and to_jsonb(x)=e.foto->'regraVisita')
    or exists(select 1 from pcm.feriados_declarados f where f.cliente_id=e.cliente_id and f.ativo and f.data=e.data_sso and (f.contrato_id is null or f.contrato_id=(e.foto->'origemVisita'->>'contrato_id')::uuid))
    or exists(select 1 from pcm.sso_visitas_suprimidas_feriado f where f.visita_id=(e.foto->'visita'->>'id')::uuid)
   then raise exception 'visita_reserva_obsoleta' using errcode='23514';end if;
  end if;
  -- Fontes podem ter produzido efeito entre aprovação e vigência. Não suprimi-los.
  lock table pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado in share mode nowait;
  if e.decisao='somente_sso' and exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=e.legado_id and l.indice=e.indice_legado) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
  if e.decisao='somente_legado' and (
    (e.modo='calendario' and (exists(select 1 from pcm.sso_chamados_ciclo_preventivo c where c.ciclo_id=s.ciclo_id) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=c.preparada_id where c.ciclo_id=s.ciclo_id)))
    or (e.modo='visita' and (exists(select 1 from pcm.sso_chamados_ciclo_visita c where c.ciclo_id=s.ciclo_id) or exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=c.preparada_id where c.ciclo_id=s.ciclo_id)))
  ) then raise exception 'efeito_sso_exige_reconciliacao' using errcode='23514';end if;
  if e.decisao='integrar_ponte' and exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=e.legado_id and l.indice=e.indice_legado and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente' or exists(select 1 from pcm.ordens_servico o where o.ocorrencia_preventiva_id=l.id))) and not (
   (e.modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=s.ciclo_id and l.plano_id=e.legado_id and l.indice=e.indice_legado))
   or (e.modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=s.ciclo_id and l.plano_id=e.legado_id and l.indice=e.indice_legado))
  ) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
  if exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo=s.modo and r.ciclo_id=s.ciclo_id) or (r.legado_id=e.legado_id and r.indice_legado=e.indice_legado)) and (r.id is distinct from s.reserva_anterior_id or r.cliente_id is distinct from e.cliente_id or r.plano_id is distinct from e.plano_id or r.modo is distinct from s.modo or r.ciclo_id is distinct from s.ciclo_id or r.legado_id is distinct from e.legado_id or r.indice_legado is distinct from e.indice_legado)) or (s.reserva_anterior_id is not null and not exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.id=s.reserva_anterior_id and r.ativa and r.cliente_id=e.cliente_id and r.plano_id=e.plano_id and r.modo=s.modo and r.ciclo_id=s.ciclo_id and r.legado_id=e.legado_id and r.indice_legado=e.indice_legado)) then raise exception 'reserva_existente_exige_reconciliacao' using errcode='23514';end if;
  v_resultado:=jsonb_build_object('decisao',e.decisao,'clienteId',e.cliente_id,'planoId',e.plano_id,'legadoId',e.legado_id,'indiceLegado',e.indice_legado,'modo',s.modo,'cicloId',s.ciclo_id);
 end loop;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reserva_rascunho_vigente(uuid,integer,text,uuid) from public,anon,authenticated,service_role;

-- O gerador legado já chama este mediador para cada índice; não altera outros índices.
alter function pcm.sso_indice_legado_reservado_sso(uuid,integer) rename to sso_indice_legado_reservado_sso_antes_1724;
revoke all on function pcm.sso_indice_legado_reservado_sso_antes_1724(uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_indice_legado_reservado_sso(p_legado uuid,p_indice integer) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;
begin
 v:=pcm.sso_reserva_rascunho_vigente(p_legado,p_indice,null,null);
 if v is not null then return v->>'decisao'='somente_sso';end if;
 return pcm.sso_indice_legado_reservado_sso_antes_1724(p_legado,p_indice);
end; $$;
revoke all on function pcm.sso_indice_legado_reservado_sso(uuid,integer) from public,anon,authenticated,service_role;

-- Chamados e OS por Chamado usam este contrato já chamado por 1716.
alter function pcm.sso_conferir_execucao_sso_reservada(uuid,uuid,uuid,text) rename to sso_conferir_execucao_sso_reservada_antes_1724;
revoke all on function pcm.sso_conferir_execucao_sso_reservada_antes_1724(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_conferir_execucao_sso_reservada(p_cliente uuid,p_plano uuid,p_preparada uuid,p_modo text) returns void
language plpgsql volatile security definer set search_path='' as $$
declare c uuid;v jsonb;
begin
 if p_modo='calendario' then select ciclo_id into c from pcm.sso_ciclo_calendario_versoes where preparada_id=p_preparada;
 elsif p_modo='visita' then select ciclo_id into c from pcm.sso_ciclo_visita_versoes where preparada_id=p_preparada;
 else raise exception 'modo_invalido' using errcode='22023';end if;
 if c is null then raise exception 'ciclo_indisponivel' using errcode='23514';end if;
 v:=pcm.sso_reserva_rascunho_vigente(null,null,p_modo,c);
 if v is null then perform pcm.sso_conferir_execucao_sso_reservada_antes_1724(p_cliente,p_plano,p_preparada,p_modo);return;end if;
 if (v->>'clienteId')::uuid is distinct from p_cliente or (v->>'planoId')::uuid is distinct from p_plano then raise exception 'reserva_origem_indisponivel' using errcode='23514';end if;
 if v->>'decisao'='somente_legado' then raise exception 'ciclo_reservado_ao_legado' using errcode='23514';end if;
 if v->>'decisao'='integrar_ponte' and not (
  (p_modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes x join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=x.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where x.ciclo_id=c and l.plano_id=(v->>'legadoId')::uuid and l.indice=(v->>'indiceLegado')::integer))
  or (p_modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes x join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=x.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where x.ciclo_id=c and l.plano_id=(v->>'legadoId')::uuid and l.indice=(v->>'indiceLegado')::integer))
 ) then raise exception 'ponte_reservada_ausente' using errcode='23514';end if;
end; $$;
revoke all on function pcm.sso_conferir_execucao_sso_reservada(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

-- Envios e criação de OS da ocorrência legada respeitam escolha selada.
alter function pcm.sso_exigir_ponte_legada_reservada(uuid) rename to sso_exigir_ponte_legada_reservada_antes_1724;
revoke all on function pcm.sso_exigir_ponte_legada_reservada_antes_1724(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_exigir_ponte_legada_reservada(p_legada uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare l pcm.ocorrencias_preventivas%rowtype;v jsonb;
begin
 select * into l from pcm.ocorrencias_preventivas where id=p_legada for share nowait;if not found then return;end if;
 v:=pcm.sso_reserva_rascunho_vigente(l.plano_id,l.indice,null,null);
 if v is null then perform pcm.sso_exigir_ponte_legada_reservada_antes_1724(p_legada);return;end if;
 if v->>'decisao'='somente_sso' then raise exception 'indice_reservado_ao_sso' using errcode='23514';end if;
 if v->>'decisao'='integrar_ponte' and not (
  (v->>'modo'='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=(v->>'cicloId')::uuid and b.ocorrencia_legada_id=p_legada))
  or (v->>'modo'='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id where c.ciclo_id=(v->>'cicloId')::uuid and b.ocorrencia_legada_id=p_legada))
 ) then raise exception 'ponte_reservada_ausente' using errcode='23514';end if;
end; $$;
revoke all on function pcm.sso_exigir_ponte_legada_reservada(uuid) from public,anon,authenticated,service_role;

-- Aprovação mediada exige também os dois selos; não altera nem desativa 1045.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_validadores_revisao_ativos()'::regprocedure);
 a text:=$antes$  ('sso_selar_nova_visita','pcm.sso_selar_nova_visita()'::regprocedure,5)$antes$;
 b text:=$depois$  ('sso_selar_nova_visita','pcm.sso_selar_nova_visita()'::regprocedure,5),
  ('sso_selar_reserva_calendario_rascunho','pcm.sso_selar_reserva_calendario_rascunho()'::regprocedure,5),
  ('sso_selar_reserva_visita_rascunho','pcm.sso_selar_reserva_visita_rascunho()'::regprocedure,5)$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,'if v_n<>10 then','')))/length('if v_n<>10 then')<>1 then raise exception 'verificador_revisao_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,b),'if v_n<>10 then','if v_n<>12 then');
end; $migracao$;

-- A aprovação muda a revisão do Plano antes da vigência: preservar a reserva
-- anterior somente quando um selo futuro a referencia e todas as demais fontes
-- permanecem idênticas. Sem esse selo, mantém o CAS histórico integral.
create function pcm.sso_foto_reserva_operacional_valida(p_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare r pcm.sso_reservas_ciclo_legado%rowtype;v_atual jsonb;v_anterior jsonb;v_contagem integer;
begin
 select * into r from pcm.sso_reservas_ciclo_legado where id=p_id and ativa for share nowait;
 if not found then return false;end if;
 v_atual:=pcm.sso_foto_reserva_ciclo(r.plano_id,r.legado_id);
 v_anterior:=r.foto-'payload'-'confirmacao';
 if v_atual is null then return false;end if;
 if v_anterior is not distinct from v_atual then return true;end if;
 if (v_anterior-'planoRevisao') is distinct from (v_atual-'planoRevisao') then return false;end if;
 lock table pcm.sso_selos_reserva_futura_rascunho,pcm.sso_escolhas_reserva_futura_rascunho,pcm.plano_versoes in share mode nowait;
 select count(*) into v_contagem from pcm.sso_selos_reserva_futura_rascunho s
  join pcm.sso_escolhas_reserva_futura_rascunho e on e.request_id=s.escolha_request_id
  join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=e.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
  where s.reserva_anterior_id=r.id and s.modo=r.modo and s.ciclo_id=r.ciclo_id and e.cliente_id=r.cliente_id and e.plano_id=r.plano_id and e.legado_id=r.legado_id and e.indice_legado=r.indice_legado and s.vigencia>pcm.sso_data_civil_transicao_plano(e.plano_id,s.versao_id,s.vigencia);
 return v_contagem=1;
end; $$;
revoke all on function pcm.sso_foto_reserva_operacional_valida(uuid) from public,anon,authenticated,service_role;

do $migracao$
declare d text;a text;b text;
begin
 d:=pg_catalog.pg_get_functiondef('pcm.sso_indice_legado_reservado_sso_antes_1724(uuid,integer)'::regprocedure);
 a:=$antes$(r.foto - 'payload' - 'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(r.plano_id,r.legado_id)$antes$;
 b:=$depois$not pcm.sso_foto_reserva_operacional_valida(r.id)$depois$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'mediador_indice_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_conferir_execucao_sso_reservada_antes_1724(uuid,uuid,uuid,text)'::regprocedure);
 a:=$antes$(v_res.foto - 'payload' - 'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(v_res.plano_id,v_res.legado_id)$antes$;
 b:=$depois$not pcm.sso_foto_reserva_operacional_valida(v_res.id)$depois$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'mediador_sso_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_ponte_legada_reservada_antes_1724(uuid)'::regprocedure);
 a:=$antes$(v_res.foto-'payload'-'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(v_res.plano_id,v_res.legado_id)$antes$;
 b:=$depois$not pcm.sso_foto_reserva_operacional_valida(v_res.id)$depois$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'mediador_ponte_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
