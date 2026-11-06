-- ADR-1573: consulta mediada da reserva corrente; não concede escrita.
create function pcm.sso_consultar_reserva_ciclo_legado(p_ator uuid,p_cliente uuid,p_plano uuid,p_legado uuid,p_indice integer,p_modo text,p_preparada uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_data date;v_data_legado date;v_alvo text;v_alvo_id uuid;v_foto jsonb;v_efeitos jsonb;v pcm.sso_reservas_ciclo_legado%rowtype;
begin
 if p_indice is null or p_indice<0 or p_preparada is null or p_modo is null or p_modo not in ('calendario','visita') then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false); else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);end if;
 if not exists(select 1 from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501';end if;
 lock table pcm.planos_manutencao,pcm.planos_preventivos,pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,pcm.sso_reservas_ciclo_legado,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado,pcm.os_rotina_vinculos_explicitos,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 if p_modo='calendario' then
  select c.ciclo_id,o.vencimento_original,o.alvo_tipo,o.alvo_id into v_ciclo,v_data,v_alvo,v_alvo_id from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_preparadas o on o.id=c.preparada_id join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_preparada and o.plano_id=p_plano and p.cliente_id=p_cliente;
 else
  select c.ciclo_id,o.vencimento_original,o.alvo_tipo,o.alvo_id into v_ciclo,v_data,v_alvo,v_alvo_id from pcm.sso_ciclo_visita_versoes c join pcm.ocorrencias_visita_preparadas o on o.id=c.preparada_id join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_preparada and o.plano_id=p_plano and p.cliente_id=p_cliente;
 end if;
 if v_ciclo is null then raise exception 'ciclo_indisponivel' using errcode='42501';end if;
 if exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo=p_modo and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice)) and (r.cliente_id is distinct from p_cliente or r.plano_id is distinct from p_plano)) then raise exception 'reserva_conflitante' using errcode='23514';end if;
 if (select count(*) from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo=p_modo and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice)))>1 then raise exception 'reserva_conflitante' using errcode='23514';end if;
 select * into v from pcm.sso_reservas_ciclo_legado r where r.ativa and r.cliente_id=p_cliente and r.plano_id=p_plano and ((r.modo=p_modo and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice)) order by r.criado_em desc limit 1;
 if v.id is not null and (v.modo is distinct from p_modo or v.ciclo_id is distinct from v_ciclo or v.legado_id is distinct from p_legado or v.indice_legado is distinct from p_indice) then raise exception 'reserva_conflitante' using errcode='23514';end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false); else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);end if;
 select jsonb_build_object(
  'ocorrenciaLegadaExistente',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice),
  'efeitoLegado',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente')),
  'osLegada',exists(select 1 from pcm.ocorrencias_preventivas l join pcm.ordens_servico os on os.ocorrencia_preventiva_id=l.id where l.plano_id=p_legado and l.indice=p_indice),
  'chamadoSso',case when p_modo='calendario' then exists(select 1 from pcm.sso_chamados_ciclo_preventivo c where c.ciclo_id=v_ciclo) else exists(select 1 from pcm.sso_chamados_ciclo_visita c where c.ciclo_id=v_ciclo) end,
  'grupoSso',case when p_modo='calendario' then exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=c.preparada_id where c.ciclo_id=v_ciclo) else exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo) end,
  'osVinculadaSso',p_modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.os_rotina_vinculos_explicitos x on x.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo),
  'ponteDivergente',case when p_modo='calendario' then exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and (l.plano_id<>p_legado or l.indice<>p_indice)) else exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and (l.plano_id<>p_legado or l.indice<>p_indice)) end,
  'ponteExistente',case when p_modo='calendario' then exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=p_legado and l.indice=p_indice) else exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id join pcm.ocorrencias_preventivas l on l.id=b.ocorrencia_legada_id where c.ciclo_id=v_ciclo and l.plano_id=p_legado and l.indice=p_indice) end,
  'fontesExternasComprovadas',false) into v_efeitos;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado);
 if v_foto is null then raise exception 'foto_indisponivel' using errcode='23514';end if;
 v_foto:=v_foto||jsonb_build_object('modo',p_modo,'cicloId',v_ciclo,'preparadaId',p_preparada,'indiceLegado',p_indice,'vencimento',v_data);
 v_data_legado:=pcm.sso_vencimento_ciclo_calendario((v_foto->>'primeiraData')::date,(v_foto->>'intervalo')::integer,v_foto->>'unidade',p_indice);
 if v.id is null then return jsonb_build_object('cicloId',v_ciclo,'registrada',false,'revisao',0,'fotoAtual',v_foto,'vencimento',v_data,'alvoTipo',v_alvo,'alvoId',v_alvo_id,'efeitos',v_efeitos,'dataLegado',v_data_legado,'indiceSolicitado',p_indice);end if;
 return jsonb_build_object('cicloId',v_ciclo,'fotoAtual',v_foto,'vencimento',v_data,'alvoTipo',v_alvo,'alvoId',v_alvo_id,'efeitos',v_efeitos,'dataLegado',v_data_legado,'indiceSolicitado',p_indice,'registrada',true,'revisao',v.revisao,'decisao',v.decisao,'legadoId',v.legado_id,'indiceLegado',v.indice_legado,'modo',v.modo,'preparadaId',v.preparada_id,'foto',v.foto-'payload'-'confirmacao','atual',(v.foto-'payload'-'confirmacao') is not distinct from pcm.sso_foto_reserva_ciclo(v.plano_id,v.legado_id));
end; $$;
revoke all on function pcm.sso_consultar_reserva_ciclo_legado(uuid,uuid,uuid,uuid,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_reserva_ciclo_legado(uuid,uuid,uuid,uuid,integer,text,uuid) to authenticated;
