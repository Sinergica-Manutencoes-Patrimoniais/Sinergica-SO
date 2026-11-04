-- ADR-0418: diferenças de conteúdo e fotografia parcial de OS, sem decisão operacional.
create function pcm.sso_indicios_revisao_por_rotina(p_cliente_id uuid,p_plano_id uuid,p_revisao integer,p_apos uuid default null,p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_item jsonb; v_a jsonb; v_n jsonb; v_lista jsonb:='[]'::jsonb; v_os integer; v_logica uuid; v_alvo boolean; v_recorrencia boolean;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'impacto_revisao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'limite_invalido' using errcode='22023'; end if;
 v_base:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_revisao,p_limite,p_apos);
 for v_item in select value from jsonb_array_elements(v_base->'items') loop
   v_a:=v_item->'anterior';v_n:=v_item->'rascunho';v_logica:=(v_item->>'rotinaLogicaId')::uuid;
   v_alvo:=case when v_a='null'::jsonb or v_n='null'::jsonb then null else
     jsonb_build_array(v_a->'alvo_tipo',v_a->'sistema_id',v_a->'equipamento_id',v_a->'grupo_id') is distinct from jsonb_build_array(v_n->'alvo_tipo',v_n->'sistema_id',v_n->'equipamento_id',v_n->'grupo_id') end;
   v_recorrencia:=case when v_a='null'::jsonb or v_n='null'::jsonb then null else
     jsonb_build_array(v_a->'modo',v_a->'intervalo_n',v_a->'intervalo_unidade',v_a->'data_base') is distinct from jsonb_build_array(v_n->'modo',v_n->'intervalo_n',v_n->'intervalo_unidade',v_n->'data_base') end;
   select count(distinct os.id) into v_os from pcm.ocorrencias_rotina_preparadas o join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id and v.ocorrencia_legada_id is not null join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id
   where o.plano_id=p_plano_id and o.rotina_logica_id=v_logica and os.client_id=p_cliente_id and os.deleted_at is null and os.status not in ('finalizado','cancelado');
   v_lista:=v_lista||jsonb_build_array(jsonb_build_object('rotinaLogicaId',v_logica,'classificacao',v_item->'classificacao','alvoAlterado',v_alvo,'recorrenciaOuAncoraAlterada',v_recorrencia,'osAbertasVinculadasParciais',v_os,'questionarioConteudoPendente',v_item->'questionarioConteudoPendente'));
 end loop;
 return jsonb_build_object('revisao',p_revisao,'items',v_lista,'nextCursor',v_base->'nextCursor','fontesIncompletas',true,'impactoCalculado',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_indicios_revisao_por_rotina(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
