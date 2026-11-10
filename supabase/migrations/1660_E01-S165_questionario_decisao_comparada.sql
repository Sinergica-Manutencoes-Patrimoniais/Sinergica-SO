-- ADR-1517: comparação e aprovação revalidam a fonte mutável de questionário.
create function pcm.sso_fotografia_questionario_impacto(p_plano uuid,p_revisao integer,p_rascunho uuid,p_logica uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_snapshot jsonb;v_antiga jsonb;v_nova jsonb;v_atual jsonb;v_id_anterior text;v_id_atual uuid;v_ativo boolean;v_estado text;v_num integer;v_hash_antigo text;v_hash_atual text;
begin
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano,p_revisao,1,null);
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho::text then raise exception 'rascunho_indisponivel' using errcode='23514';end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=(v_previa->>'versaoAnteriorId')::uuid and plano_id=p_plano and estado='aprovado';
 if jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(j.item::text)::jsonb into v_num,v_antiga from jsonb_array_elements(v_snapshot->'rotinas') j(item) where j.item->>'rotina_logica_id'=p_logica::text;
 if v_num<>1 then raise exception 'rotina_anterior_indeterminada' using errcode='23514';end if;
 select count(*),min(to_jsonb(r)::text)::jsonb into v_num,v_nova from pcm.rotinas_manutencao r where r.plano_id=p_plano and r.versao_id=p_rascunho and r.rotina_logica_id=p_logica;
 if v_num>1 then raise exception 'rotina_rascunho_ambigua' using errcode='23514';end if;
 v_id_anterior:=v_antiga->>'questionario_id';v_id_atual:=(v_nova->>'questionario_id')::uuid;
 if jsonb_typeof(v_antiga->'questionario')='object' then v_hash_antigo:=encode(pg_catalog.sha256(pg_catalog.convert_to((v_antiga->'questionario')::text,'UTF8')),'hex');end if;
 if v_id_atual is not null then select to_jsonb(q),q.ativo into v_atual,v_ativo from pcm.questionarios q where q.id=v_id_atual;end if;
 if v_atual is not null then v_hash_atual:=encode(pg_catalog.sha256(pg_catalog.convert_to(v_atual::text,'UTF8')),'hex');end if;
 if v_nova is null then v_estado:='nao_comparavel';
 elsif v_id_anterior is null and v_id_atual is null then v_estado:='sem_questionario';
 elsif v_id_anterior is distinct from v_id_atual::text then v_estado:='referencia_alterada';
 elsif jsonb_typeof(v_antiga->'questionario') is distinct from 'object' or jsonb_typeof(v_antiga->'questionario'->'perguntas') is distinct from 'array' then v_estado:='historico_indeterminado';
 elsif v_atual is null or v_ativo is distinct from true or jsonb_typeof(v_atual->'perguntas') is distinct from 'array' then v_estado:='fonte_atual_indisponivel';
 elsif v_antiga->'questionario'=v_atual then v_estado:='conteudo_integral_igual';
 else v_estado:='conteudo_integral_diferente';end if;
 return jsonb_build_object('estado',v_estado,'historicoHash',v_hash_antigo,'atualHash',v_hash_atual);
end; $$;
revoke all on function pcm.sso_fotografia_questionario_impacto(uuid,integer,uuid,uuid) from public,anon,authenticated,service_role;

-- Preserva os campos da v2 e acrescenta a fotografia integral resumida.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_comparar_rotina_impacto_v2(uuid,uuid,uuid,integer,uuid,uuid,text)'::regprocedure);
 a text:=$antes$return v_base||jsonb_build_object('ciclo',v_ciclo,'visitaId',v_visita,'semanaOrigem',v_semana);$antes$;
 b text:=$depois$return v_base||jsonb_build_object('ciclo',v_ciclo,'visitaId',v_visita,'semanaOrigem',v_semana,'questionarioComparacao',pcm.sso_fotografia_questionario_impacto(p_plano_id,p_expected_plano,p_rascunho_id,(v_base->>'rotinaLogicaId')::uuid));$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_comparacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- Garante que a fonte não mude entre a comparação e a gravação da decisão.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure);
 a text:='pcm.rotinas_manutencao,pcm.plano_versoes,pcm.ocorrencias_rotina_preparadas,';
 b text:='pcm.questionarios,pcm.rotinas_manutencao,pcm.plano_versoes,pcm.ocorrencias_rotina_preparadas,';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_decisao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- Revalida somente com o gate de decisão comparada ativo; não altera a guarda 1045.
create function pcm.sso_exigir_comparacao_questionario_aprovacao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_item record;v_atual jsonb;
begin
 perform 1 from pcm.sso_decisao_comparada_gate where id and habilitado for share;if not found then return new;end if;
 if auth.uid() is null or current_setting('transaction_isolation')<>'read committed' then raise exception 'transacao_invalida' using errcode='25001';end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 lock table pcm.questionarios,pcm.rotinas_manutencao,pcm.plano_versoes,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,pcm.sso_ciclo_canonico_usos_versao,pcm.sso_ciclo_visita_usos_versao,pcm.sso_continuidades_ciclo_aprovadas,pcm.sso_continuidades_visita_aprovadas,pcm.sso_comparacoes_decisoes_impacto in share mode nowait;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 for v_item in
  select d.tipo,d.request_id,d.preparada_id,d.revisao_plano,c.comparacao from (
   select distinct on (x.preparada_id) 'calendario'::text tipo,x.request_id,x.preparada_id,x.revisao_plano from pcm.sso_decisoes_impacto_ocorrencia x where x.rascunho_id=v_rascunho and x.cliente_id=v_plano.cliente_id and x.plano_id=new.plano_id order by x.preparada_id,x.revisao desc
  ) d left join pcm.sso_comparacoes_decisoes_impacto c on c.tipo=d.tipo and c.request_id=d.request_id and c.cliente_id=v_plano.cliente_id and c.plano_id=new.plano_id and c.preparada_id=d.preparada_id
  union all
  select d.tipo,d.request_id,d.preparada_id,d.revisao_plano,c.comparacao from (
   select distinct on (x.preparada_id) 'visita'::text tipo,x.request_id,x.preparada_id,x.revisao_plano from pcm.sso_decisoes_impacto_visita x where x.rascunho_id=v_rascunho and x.cliente_id=v_plano.cliente_id and x.plano_id=new.plano_id order by x.preparada_id,x.revisao desc
  ) d left join pcm.sso_comparacoes_decisoes_impacto c on c.tipo=d.tipo and c.request_id=d.request_id and c.cliente_id=v_plano.cliente_id and c.plano_id=new.plano_id and c.preparada_id=d.preparada_id
 loop
  if v_item.revisao_plano is distinct from v_plano.revisao or jsonb_typeof(v_item.comparacao->'questionarioComparacao') is distinct from 'object' then raise exception 'comparacao_questionario_incompleta' using errcode='23514';end if;
  v_atual:=pcm.sso_fotografia_questionario_impacto(new.plano_id,v_plano.revisao,v_rascunho,(v_item.comparacao->>'rotinaLogicaId')::uuid);
  if v_item.comparacao->'questionarioComparacao' is distinct from v_atual then raise exception 'comparacao_questionario_obsoleta' using errcode='23514';end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_exigir_comparacao_questionario_aprovacao() from public,anon,authenticated,service_role;
create trigger sso_exigir_comparacao_questionario_aprovacao before insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_exigir_comparacao_questionario_aprovacao();
