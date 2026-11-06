-- ADR-1432: diagnóstico por identidade, sem alterar origem ou destino.
create function pcm.sso_conferir_mapeamento_plano(p_ator_id uuid,p_cliente_id uuid,p_plano_legado_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_antigo pcm.planos_preventivos%rowtype; v_mapa pcm.sso_rascunhos_planos_legados%rowtype;
 v_plano pcm.planos_manutencao%rowtype; v_rotina pcm.rotinas_manutencao%rowtype; v_versao pcm.plano_versoes%rowtype;
begin
 perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);
 select * into v_antigo from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 select * into v_mapa from pcm.sso_rascunhos_planos_legados where plano_legado_id=p_plano_legado_id and cliente_id=p_cliente_id;
 if not found then return jsonb_build_object('planoId',p_plano_legado_id,'mapeado',false); end if;
 select * into v_plano from pcm.planos_manutencao where id=v_mapa.plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'mapeamento_inconsistente' using errcode='23514'; end if;
 select * into v_versao from pcm.plano_versoes where id=v_mapa.versao_id and plano_id=v_plano.id;
 if not found then raise exception 'mapeamento_inconsistente' using errcode='23514'; end if;
 select * into v_rotina from pcm.rotinas_manutencao where id=v_mapa.rotina_id and plano_id=v_plano.id and versao_id=v_versao.id;
 if not found then raise exception 'mapeamento_inconsistente' using errcode='23514'; end if;
 return jsonb_build_object('planoId',p_plano_legado_id,'mapeado',true,'versao',v_versao.numero,'estadoVersao',v_versao.estado,
   'origemAlterada',to_jsonb(v_antigo) is distinct from v_mapa.payload->'fotografia',
   'identidadePreservada',v_antigo.id=v_plano.id,'nomePreservado',v_antigo.nome=v_plano.nome and v_antigo.nome=v_rotina.nome,
   'alvoPreservado',v_antigo.sistema_id is not distinct from v_rotina.sistema_id and v_antigo.equipamento_id is not distinct from v_rotina.equipamento_id and v_rotina.grupo_id is null,
   'questionarioPreservado',v_antigo.questionario_id is not distinct from v_rotina.questionario_id,
   'recorrenciaOrigem',jsonb_build_object('inicio',v_antigo.primeira_data,'intervalo',v_antigo.intervalo_n,'unidade',v_antigo.intervalo_unidade),
   'recorrenciaDestino',jsonb_build_object('inicio',v_rotina.data_base,'intervalo',v_rotina.intervalo_n,'unidade',v_rotina.intervalo_unidade,'modo',v_rotina.modo),
   'tempoValidado',v_rotina.tempo_minutos is not null and v_rotina.tempo_minutos>0 and v_rotina.tipo_tempo is not null,
   'tipoTarefaOrigem',v_antigo.tipo_tarefa_id,'revisaoPlano',v_plano.revisao,'estadoPlano',v_plano.estado,'equivalenciaComprovada',false);
end; $$;
revoke all on function pcm.sso_conferir_mapeamento_plano(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_mapeamento_plano(uuid,uuid,uuid) to authenticated;
