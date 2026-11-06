-- ADR-1389: expõe somente a cópia autorizada, mantendo o núcleo privado.
create table pcm.sso_copia_plano_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_copia_plano_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_copia_plano_mediada_gate enable row level security;
alter table pcm.sso_copia_plano_mediada_gate force row level security;
revoke all on pcm.sso_copia_plano_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_copiar_plano_mediado(p_request_id uuid,p_cliente_id uuid,p_origem_plano_id uuid,p_origem_versao_id uuid,
 p_origem_revision integer,p_destino_plano_id uuid,p_destino_versao_id uuid,p_nome text,p_ator_esperado uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_copia_plano_mediada_gate where id and habilitado for share;
 if not found then raise exception 'copia_mediada_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_copia_plano_gate where id and habilitado for share;
 if not found then raise exception 'copia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_ator_esperado is distinct from auth.uid() or p_cliente_id is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Replays usam o recibo imutável do núcleo. Pedidos novos só podem copiar
 -- classificação explícita se a preservação estiver ativa e travada.
 if not exists(select 1 from pcm.sso_copias_plano where request_id=p_request_id) then
   select v.snapshot into v_snapshot from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id
     where p.id=p_origem_plano_id and p.cliente_id=p_cliente_id and v.id=p_origem_versao_id and v.estado='aprovado' for update of p for share of v;
   if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
   if exists(select 1 from jsonb_array_elements(v_snapshot->'rotinas') r where r ? 'natureza_tecnica' and r->'natureza_tecnica' <> 'null'::jsonb) then
     perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
     if not found then raise exception 'preservacao_natureza_desabilitada' using errcode='55000'; end if;
   end if;
 end if;
 v_resultado:=pcm.sso_copiar_plano_aprovado(p_request_id,p_cliente_id,p_origem_plano_id,p_origem_versao_id,p_origem_revision,p_destino_plano_id,p_destino_versao_id,p_nome,p_ator_esperado);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_copiar_plano_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_copiar_plano_mediado(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,uuid) to authenticated;
