-- ADR-0409: fotografia conservadora; nunca autoriza transição de ocorrência.
create function pcm.sso_diagnosticar_fechamento_preventivo(p_cliente_id uuid,p_plano_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_legada uuid; v_decl pcm.sso_declaracoes_escopo_preventivo%rowtype; v_total integer; v_fora integer; v_faltantes integer; v_nao_final integer; v_sem_validacao integer;
begin
 if not coalesce((select habilitado from pcm.sso_escopo_preventivo_gate where id),false) then raise exception 'escopo_preventivo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select v.ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id where o.id=p_ocorrencia_id and p.id=p_plano_id and p.cliente_id=p_cliente_id;
 if v_legada is null then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
 select * into v_decl from pcm.sso_declaracoes_escopo_preventivo where ocorrencia_preparada_id=p_ocorrencia_id order by revisao desc limit 1;
 if v_decl.request_id is null then return jsonb_build_object('declaracaoExistente',false,'fechamentoAutorizado',false,'motivoBloqueio','escopo_nao_declarado'); end if;
 select count(*),count(*) filter(where not (os.id=any(v_decl.os_ids))),count(*) filter(where os.status is distinct from 'finalizado'),
   count(*) filter(where not exists(select 1 from pcm.sso_finalizacoes_os_validadas f where f.os_id=os.id))
 into v_total,v_fora,v_nao_final,v_sem_validacao from pcm.ordens_servico os where os.client_id=p_cliente_id and os.ocorrencia_preventiva_id=v_legada and os.deleted_at is null;
 select count(*) into v_faltantes from unnest(v_decl.os_ids) d(id) where not exists(select 1 from pcm.ordens_servico os where os.id=d.id and os.client_id=p_cliente_id and os.ocorrencia_preventiva_id=v_legada and os.deleted_at is null);
 return jsonb_build_object('declaracaoExistente',true,'revisao',v_decl.revisao,'osDeclaradas',cardinality(v_decl.os_ids),'osAtuais',v_total,'osNaoDeclaradas',v_fora,'osDeclaradasAusentes',v_faltantes,'osNaoFinalizadas',v_nao_final,'osSemFinalizacaoValidada',v_sem_validacao,'fotografiaNaoAutoriza',true,'fechamentoAutorizado',false,'motivoBloqueio','integralidade_e_concorrencia_nao_comprovadas');
end; $$;
revoke all on function pcm.sso_diagnosticar_fechamento_preventivo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
