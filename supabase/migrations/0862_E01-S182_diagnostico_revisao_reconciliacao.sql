create function financeiro.sso_diagnosticar_revisao_reconciliacao(p_cliente_id uuid,p_decisao_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d financeiro.sso_reconciliacoes_servico_material%rowtype; m financeiro.sso_material_declaracoes%rowtype; r financeiro.sso_revisoes_origens_reconciliacao%rowtype; situacao text;
begin
 if not coalesce((select habilitado from financeiro.sso_guarda_reconciliacao_material_gate where id),false) or not coalesce((select habilitado from financeiro.sso_revisao_origens_reconciliacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_decisao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into d from financeiro.sso_reconciliacoes_servico_material where id=p_decisao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into m from financeiro.sso_material_declaracoes where id=d.material_id and cliente_id=p_cliente_id;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 select * into r from financeiro.sso_revisoes_origens_reconciliacao where decisao_id=d.id and servico_id=d.servico_id;
 if not found then situacao:='desconhecida'; elsif r.material_revisao=m.revisao and r.material_estado=m.estado then situacao:='material_sem_alteracao_detectada'; else situacao:='material_alterado'; end if;
 return jsonb_build_object('decisaoId',d.id,'revisaoOrigens',situacao,'decisao',d.decisao,'bloqueioCandidatoMaterial',true,'exclusividadeComprovada',false,'autorizaFaturamento',false);
end $$;
revoke all on function financeiro.sso_diagnosticar_revisao_reconciliacao(uuid,uuid) from public,anon,authenticated,service_role;
