-- ADR-1536: a declaração humana é explícita e não afirma completude externa.
create table pcm.sso_afirmacoes_fila_grupo (
 request_id uuid primary key references pcm.sso_declaracoes_fila_grupo(request_id),
 ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id), criado_em timestamptz not null default now()
);
alter table pcm.sso_afirmacoes_fila_grupo enable row level security;
alter table pcm.sso_afirmacoes_fila_grupo force row level security;
revoke all on pcm.sso_afirmacoes_fila_grupo from public,anon,authenticated,service_role;
create trigger sso_afirmacoes_fila_grupo_imutaveis before update or delete on pcm.sso_afirmacoes_fila_grupo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

alter function pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) rename to sso_declarar_fila_grupo_base_1679;
revoke all on function pcm.sso_declarar_fila_grupo_base_1679(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) from public,anon,authenticated,service_role;
-- Compatibilidade: somente repetição de comando anterior; não grava nova declaração sem afirmação.
create function pcm.sso_declarar_fila_grupo(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text,p_fila_revisao integer,p_fotografia_hash text,p_fontes text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 if not exists(select 1 from pcm.sso_declaracoes_fila_grupo d where d.request_id=p_request and d.ator_id=p_ator and d.cliente_id=p_cliente) then raise exception 'afirmacao_explicita_obrigatoria' using errcode='55000';end if;
 return pcm.sso_declarar_fila_grupo_base_1679(p_ator,p_request,p_cliente,p_plano,p_preparada,p_tipo,p_fila_revisao,p_fotografia_hash,p_fontes,p_motivo);
end; $$;
revoke all on function pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text) to authenticated;

create function pcm.sso_declarar_fila_grupo_confirmado(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text,p_fila_revisao integer,p_fotografia_hash text,p_fontes text,p_motivo text,p_nao_identificou_execucao boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v jsonb;v_existe boolean;
begin
 perform pcm.sso_conferir_acesso_fila_grupo(p_ator,p_cliente,p_plano,p_tipo);
 if p_nao_identificou_execucao is distinct from true then raise exception 'afirmacao_explicita_obrigatoria' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-grupo-declaracao:'||p_request::text,0));
 v:=pcm.sso_declarar_fila_grupo_base_1679(p_ator,p_request,p_cliente,p_plano,p_preparada,p_tipo,p_fila_revisao,p_fotografia_hash,p_fontes,p_motivo);
 select exists(select 1 from pcm.sso_afirmacoes_fila_grupo a where a.request_id=p_request) into v_existe;
 if not v_existe then
  insert into pcm.sso_afirmacoes_fila_grupo(request_id,ator_id,cliente_id) values(p_request,p_ator,p_cliente);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'preventiva.fila_grupo_afirmada','planos_manutencao',p_plano,
    jsonb_build_object('requestId',p_request,'preparadaId',p_preparada,'tipo',p_tipo,'naoIdentificouExecucaoNasFontesInformadas',true,'fontesExternasComprovadas',false));
 end if;
 return v||jsonb_build_object('declaracaoExplicita',true);
end; $$;
revoke all on function pcm.sso_declarar_fila_grupo_confirmado(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_fila_grupo_confirmado(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text,boolean) to authenticated;

create or replace function pcm.sso_declaracao_fila_grupo_atual(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;v_d pcm.sso_declaracoes_fila_grupo%rowtype;v_foto jsonb;
begin
 if p_tipo='calendario' then select ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes where preparada_id=p_preparada;
 elsif p_tipo='visita' then select ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes where preparada_id=p_preparada;
 else return false;end if;
 if v_ciclo is null then return false;end if;
 select d.* into v_d from pcm.sso_declaracoes_fila_grupo d
 where d.cliente_id=p_cliente and d.plano_id=p_plano and d.tipo=p_tipo and d.ciclo_id=v_ciclo order by d.criado_em desc,d.request_id desc limit 1;
 if not found or not exists(select 1 from pcm.sso_afirmacoes_fila_grupo a where a.request_id=v_d.request_id and a.ator_id=v_d.ator_id and a.cliente_id=v_d.cliente_id) then return false;end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,p_tipo);
 return v_foto is not distinct from v_d.fotografia;
end; $$;
revoke all on function pcm.sso_declaracao_fila_grupo_atual(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
