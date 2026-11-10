-- ADR-0834: compatibilidade de leitura, sem liberar gate ou alterar ACL.
create or replace function pcm.sso_consultar_escopo_chamado_preparado(p_cliente_id uuid,p_chamado_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_revisao bigint; v_legado uuid; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) then
    raise exception 'comando_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null or not (
    config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is true or
    config.sso_autorizar_acao('chamado.continuacao.sugerir',p_cliente_id) is true or
    config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is true or
    config.sso_autorizar_acao('execucao.validar',p_cliente_id) is true) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  select c.sso_revisao,c.ordem_servico_id into v_revisao,v_legado from pcm.chamados c where c.id=p_chamado_id
    and c.cliente_id=p_cliente_id and c.deleted_at is null;
  if not found then raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if exists (select 1 from pcm.ordens_servico o where o.chamado_id=p_chamado_id
             and o.deleted_at is null and o.client_id is distinct from p_cliente_id)
    or exists (select 1 from pcm.ordens_servico o join pcm.chamados outro on outro.ordem_servico_id=o.id
      where o.chamado_id=p_chamado_id and o.deleted_at is null and outro.id<>p_chamado_id and outro.deleted_at is null)
    or (v_legado is not null and (
      not exists (select 1 from pcm.ordens_servico o where o.id=v_legado
        and o.client_id=p_cliente_id and o.deleted_at is null and (o.chamado_id is null or o.chamado_id=p_chamado_id))
      or exists (select 1 from pcm.chamados c where c.id<>p_chamado_id and c.ordem_servico_id=v_legado and c.deleted_at is null)
    )) then raise exception 'vinculo_legado_inconsistente' using errcode='23514'; end if;
  select jsonb_build_object('chamadoId',p_chamado_id,'revision',v_revisao,
    'composicaoCompleta',coalesce((select declarada_completa from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id),false),
    'parcelas',coalesce((select jsonb_agg(to_jsonb(p)) from
      (select id,descricao,situacao,os_atendimento_id from pcm.chamado_escopo_parcelas where chamado_id=p_chamado_id order by id limit 100) p),'[]'::jsonb),
    'continuacoes',coalesce((select jsonb_agg(to_jsonb(p)) from
      (select id,os_anterior_id,os_continuacao_id,descricao_restante,minutos_restantes,situacao from pcm.chamado_continuacoes_propostas where chamado_id=p_chamado_id order by id limit 100) p),'[]'::jsonb),
    'ordens',coalesce((select jsonb_agg(to_jsonb(o)) from
      (select id,titulo,status from pcm.ordens_servico where (chamado_id=p_chamado_id or (id=v_legado and chamado_id is null)) and client_id=p_cliente_id and deleted_at is null order by id limit 100) o),'[]'::jsonb),
    'incompleto',((select count(*) from pcm.chamado_escopo_parcelas where chamado_id=p_chamado_id)>100
      or (select count(*) from pcm.chamado_continuacoes_propostas where chamado_id=p_chamado_id)>100
      or (select count(*) from pcm.ordens_servico where (chamado_id=p_chamado_id or (id=v_legado and chamado_id is null)) and client_id=p_cliente_id and deleted_at is null)>100)) into v_resultado;
  return v_resultado;
end;
$$;
