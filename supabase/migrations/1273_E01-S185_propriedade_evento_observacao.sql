-- ADR-1118: propriedade por evento antes de permitir futura transferência.
create table pcm.sso_proprietarios_eventos_observacao_os(
 os_id uuid not null, revisao integer not null, cliente_id uuid not null references pcm.clientes(id),
 primary key(os_id,revisao),
 foreign key(os_id,revisao) references pcm.sso_observacoes_os_eventos(os_id,revisao)
);
alter table pcm.sso_proprietarios_eventos_observacao_os enable row level security;
alter table pcm.sso_proprietarios_eventos_observacao_os force row level security;
revoke all on pcm.sso_proprietarios_eventos_observacao_os from public,anon,authenticated,service_role;
create trigger sso_proprietarios_eventos_os_imutaveis before update or delete on pcm.sso_proprietarios_eventos_observacao_os
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

-- As implementações existentes recusam transferência da observação corrente.
-- Se o histórico de conflitos contradisser essa premissa, não inferir titularidade.
-- Bloquear escritores durante o backfill e instalação do trigger evita eventos
-- sem proprietário entre a fotografia inicial e a proteção dos novos inserts.
lock table pcm.sso_observacoes_os, pcm.sso_observacoes_os_eventos, pcm.sso_conflitos_propriedade_os_eventos in share row exclusive mode;
do $$
begin
 if exists(select 1 from pcm.sso_observacoes_os_eventos e left join pcm.sso_observacoes_os o on o.os_id=e.os_id where o.os_id is null)
  or exists(select 1 from pcm.sso_conflitos_propriedade_os_eventos c join pcm.sso_observacoes_os o on o.os_id=c.os_id
   where c.cliente_observacao_id is distinct from o.cliente_id) then
  raise exception 'propriedade_historica_nao_comprovada' using errcode='23514';
 end if;
end; $$;
insert into pcm.sso_proprietarios_eventos_observacao_os(os_id,revisao,cliente_id)
 select e.os_id,e.revisao,o.cliente_id from pcm.sso_observacoes_os_eventos e join pcm.sso_observacoes_os o on o.os_id=e.os_id;

create function pcm.sso_fixar_proprietario_evento_os() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
 select o.cliente_id into v_cliente from pcm.sso_observacoes_os o where o.os_id=new.os_id for share;
 if not found then raise exception 'observacao_indisponivel' using errcode='23514'; end if;
 insert into pcm.sso_proprietarios_eventos_observacao_os(os_id,revisao,cliente_id) values(new.os_id,new.revisao,v_cliente);
 return new;
end; $$;
revoke all on function pcm.sso_fixar_proprietario_evento_os() from public,anon,authenticated,service_role;
create trigger sso_fixar_proprietario_evento_os after insert on pcm.sso_observacoes_os_eventos
 for each row execute function pcm.sso_fixar_proprietario_evento_os();

create or replace function pcm.sso_listar_observacoes_os(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,estado_local text,sincronizacao text,possui_tarefa boolean,fonte_atualizada_em timestamptz,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null
  or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_observacoes_os o where o.os_id=p_os_id and o.cliente_id<>p_cliente_id) then
  raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select e.revisao,e.estado_local,e.sincronizacao,e.possui_tarefa,e.fonte_atualizada_em,e.criado_em
  from pcm.sso_observacoes_os_eventos e join pcm.sso_proprietarios_eventos_observacao_os p on p.os_id=e.os_id and p.revisao=e.revisao
  where e.os_id=p_os_id and p.cliente_id=p_cliente_id and e.revisao>p_apos order by e.revisao limit p_limite;
end; $$;
