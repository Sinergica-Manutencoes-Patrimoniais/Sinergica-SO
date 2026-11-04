-- ADR-0639: diagnóstico somente leitura; fotografia no registro da ocorrência.
create table pcm.sso_comparar_quantidade_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_comparar_quantidade_grupo_gate enable row level security;
alter table pcm.sso_comparar_quantidade_grupo_gate force row level security;
revoke all on pcm.sso_comparar_quantidade_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_comparar_quantidade_grupo_gate(id,habilitado) values(true,false);
create function pcm.sso_comparar_quantidade_grupo(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_grupo pcm.grupos_quantitativos%rowtype;v_versao pcm.plano_versoes%rowtype;v_encontrado boolean;
begin
 if not coalesce((select habilitado from pcm.sso_comparar_quantidade_grupo_gate where id),false) then raise exception 'comparacao_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_versao from pcm.plano_versoes where id=v_ocorrencia.versao_id and plano_id=v_ocorrencia.plano_id and estado='aprovado';
 if not found then raise exception 'versao_indisponivel' using errcode='23514'; end if;
 select * into v_grupo from pcm.grupos_quantitativos where id=v_ocorrencia.grupo_id and cliente_id=p_cliente_id;v_encontrado:=found;
 return jsonb_build_object('ocorrenciaId',v_ocorrencia.id,'grupoId',v_ocorrencia.grupo_id,'versaoId',v_versao.id,'vigenciaInicio',v_versao.vigencia_inicio,'vigenciaFim',v_versao.vigencia_fim,'vencimentoOriginal',v_ocorrencia.vencimento_original,
 'vencimentoNaVigencia',case when v_versao.vigencia_inicio is null then null else v_ocorrencia.vencimento_original>=v_versao.vigencia_inicio and (v_versao.vigencia_fim is null or v_ocorrencia.vencimento_original<=v_versao.vigencia_fim) end,
 'quantidadeRegistrada',v_ocorrencia.quantidade_snapshot::text,'revisaoRegistrada',v_ocorrencia.grupo_revisao,'registradaEm',v_ocorrencia.criado_em,
 'quantidadeAtual',case when v_encontrado then v_grupo.quantidade::text else null end,'revisaoAtual',case when v_encontrado then v_grupo.revisao else null end,
 'grupoAtualDisponivel',v_encontrado,'grupoAtualAtivo',case when v_encontrado then v_grupo.ativo and v_grupo.deleted_at is null else null end,
 'quantidadeDiferente',case when v_encontrado then v_grupo.quantidade is distinct from v_ocorrencia.quantidade_snapshot else null end,
 'fotografiaCongeladaNaAprovacao',false,'historicoRecalculado',false,'vigenciaCompletamenteValidada',false);
end; $$;
revoke all on function pcm.sso_comparar_quantidade_grupo(uuid,uuid) from public,anon,authenticated,service_role;
