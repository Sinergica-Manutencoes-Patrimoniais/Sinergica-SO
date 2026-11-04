-- ADR-0881: guarda da 1065 compartilhada; nenhuma reconciliação remota é feita aqui.
-- Qualifica o gate, cujo id era ambíguo com o campo de retorno.
create or replace function pcm.sso_listar_intencoes_os_triagem(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,revisao integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reprogramacao_os_enviada_gate g where g.id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.os_id,i.visita_origem_id,i.visita_destino_id,i.tarefa_auvo_id::text,i.estado,i.revisao,i.criado_em
    from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) order by i.id limit p_limite;
end;
$$;

create or replace function pcm.sso_listar_triagens_intencao_os(p_cliente_id uuid,p_intencao_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,resultado_declarado text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reprogramacao_os_enviada_gate g where g.id),false) then raise exception 'reprogramacao_enviada_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_intencao_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.reprogramacao_os_intencoes i join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
      where i.id=p_intencao_id and i.cliente_id=p_cliente_id) then raise exception 'intencao_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select e.id,e.revisao,e.acao,e.resultado_declarado,e.ator_id,e.criado_em
    from pcm.reprogramacao_os_intencao_eventos e where e.intencao_id=p_intencao_id and (p_apos is null or e.revisao>p_apos)
    order by e.revisao limit p_limite;
end;
$$;

create function pcm.sso_triagem_intencao_mediada(p_request_id uuid,p_evento_id uuid,p_intencao_id uuid,p_expected_revision integer,
  p_acao text,p_resultado text,p_tarefa text,p_referencia text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  return pcm.sso_triagem_intencao_os(p_request_id,p_evento_id,p_intencao_id,p_expected_revision,p_acao,p_resultado,p_tarefa,p_referencia,p_motivo);
end;
$$;
revoke all on function pcm.sso_triagem_intencao_mediada(uuid,uuid,uuid,integer,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_triagem_intencao_mediada(uuid,uuid,uuid,integer,text,text,text,text,text) to authenticated;

create function pcm.sso_listar_intencoes_triagem_mediada(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,estado text,revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  return query select * from pcm.sso_listar_intencoes_os_triagem(p_cliente_id,p_apos,p_limite);
end;
$$;
revoke all on function pcm.sso_listar_intencoes_triagem_mediada(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_intencoes_triagem_mediada(uuid,uuid,integer) to authenticated;

create function pcm.sso_listar_triagens_mediada(p_cliente_id uuid,p_intencao_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,resultado_declarado text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_intencao_os_mediada();
  return query select * from pcm.sso_listar_triagens_intencao_os(p_cliente_id,p_intencao_id,p_apos,p_limite);
end;
$$;
revoke all on function pcm.sso_listar_triagens_mediada(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_triagens_mediada(uuid,uuid,integer,integer) to authenticated;
