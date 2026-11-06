-- ADR-0428: somente metadados de versão aprovada, sem custo ou artefato.
create function pcm.sso_metadados_exportacao_plano(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype; v_versao pcm.plano_versoes%rowtype; v_qtd integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found then raise exception 'versao_aprovada_indisponivel' using errcode='23514'; end if;
 if jsonb_typeof(v_versao.snapshot->'rotinas')='array' then v_qtd:=jsonb_array_length(v_versao.snapshot->'rotinas'); else v_qtd:=null; end if;
 return jsonb_build_object('planoId',v_plano.id,'clienteId',v_plano.cliente_id,'nomePlano',v_plano.nome,'versaoId',v_versao.id,'numeroVersao',v_versao.numero,'vigenciaInicio',v_versao.vigencia_inicio,'vigenciaFim',v_versao.vigencia_fim,'rotinasSnapshot',v_qtd,'arrayRotinasDisponivel',v_qtd is not null,'custosIncluidos',false,'cronogramaOperacionalIncluido',false,'artefatoGerado',false);
end; $$;
revoke all on function pcm.sso_metadados_exportacao_plano(uuid,uuid,uuid) from public,anon,authenticated,service_role;
