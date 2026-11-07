-- ADR-0624: diagnóstico pontual; nenhuma conclusão de exclusividade.
create function financeiro.sso_diagnosticar_origens_fato_servico(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f financeiro.sso_fatos_execucao_declarados%rowtype; v financeiro.sso_vinculos_resposta_servico%rowtype;
 s financeiro.sso_snapshots_servico_extra%rowtype; p comercial.propostas%rowtype; rev pcm.sso_revisoes_validacao_os%rowtype;
 modo text; materiais bigint; integral boolean; decisao text; ultima integer; total bigint; versionadas bigint;
begin
 if not coalesce((select habilitado from financeiro.sso_fato_execucao_declarado_gate where id),false) or not coalesce((select habilitado from financeiro.sso_coordenacao_linhas_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_fato_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into f from financeiro.sso_fatos_execucao_declarados where id=p_fato_id and cliente_id=p_cliente_id;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v from financeiro.sso_vinculos_resposta_servico where id=f.vinculo_id and cliente_id=p_cliente_id and resposta_id=f.resposta_id;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 select * into s from financeiro.sso_snapshots_servico_extra where id=v.snapshot_id and cliente_id=p_cliente_id;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 select * into p from comercial.propostas where id=s.proposta_id and deleted_at is null;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 select * into rev from pcm.sso_revisoes_validacao_os where id=f.revisao_id and retorno_id=f.retorno_id;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 select coalesce(max(revisao),0),count(*) into ultima,versionadas from pcm.sso_revisoes_validacao_os where retorno_id=f.retorno_id;
 select count(*) into total from pcm.decisoes_validacao_os where retorno_id=f.retorno_id;
 select d.decisao into decisao from pcm.decisoes_validacao_os d where d.id=rev.decisao_id and d.retorno_id=f.retorno_id;
 select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p.id) m;
 select count(*) into materiais from financeiro.sso_material_linha_proposta x join financeiro.sso_material_declaracoes d on d.id=x.declaracao_id and d.cliente_id=p_cliente_id where x.proposta_id=s.proposta_id and x.versao=s.versao and x.linha_id=s.linha_id;
 select exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=p_cliente_id and i.origem_tipo='proposta_operacional' and i.origem_id=s.proposta_id) into integral;
 return jsonb_build_object('propostaAtual',p.status='aceita' and p.versao_atual=s.versao,'modo',modo,'revisaoPcmAtual',rev.revisao=ultima and total=versionadas and decisao='aprovar',
 'vinculosMaterialMesmaLinha',materiais,'itemIntegralExistente',integral,'exclusividadeComprovada',false,'geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_diagnosticar_origens_fato_servico(uuid,uuid) from public,anon,authenticated,service_role;
