-- ADR-0262: consulta de candidatos, sem chamar comandos de criação.
create function pcm.sso_preparar_importacao_cronograma(p_cliente_id uuid,p_lote_id uuid,p_plano_id uuid,p_apos text,p_limite integer)
returns table(chave text,candidata boolean,identidade text,mapeamento_id uuid,alvo_atual text,pendencias text[],revisao_lote integer,revisao_plano integer,aprovacao_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype; v_plano pcm.planos_manutencao%rowtype; v_aprovacao pcm.sso_cronograma_aprovacoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%';
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id and p.estado='rascunho';
 if not found then raise exception 'plano_indisponivel' using errcode='23514'; end if;
 select * into v_aprovacao from pcm.sso_cronograma_aprovacoes a where a.lote_id=p_lote_id and a.revisao_aprovacao=v_lote.revisao;
 if not found then raise exception 'lote_sem_aprovacao_atual' using errcode='23514'; end if;
 return query select c.chave,coalesce(c.tipo_linha='dado' and c.situacao is distinct from 'rejeitada',false),c.identidade,c.mapeamento_id,c.alvo_atual,c.pendencias,v_lote.revisao,v_plano.revisao,v_aprovacao.id
 from pcm.sso_conferir_alvos_cronograma(p_cliente_id,p_lote_id,p_apos,p_limite) c;
end; $$;
revoke all on function pcm.sso_preparar_importacao_cronograma(uuid,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
