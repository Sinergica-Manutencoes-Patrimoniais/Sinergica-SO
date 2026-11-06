-- ADR-1113: mediação transitória; gate misto permanece fechado.
create table comercial.sso_composicao_mista_tokens(
 txid bigint not null,request_id uuid not null,ator_id uuid not null references auth.users(id),proposta_id uuid not null references comercial.propostas(id),
 primary key(txid,request_id)
);
alter table comercial.sso_composicao_mista_tokens enable row level security;
alter table comercial.sso_composicao_mista_tokens force row level security;
revoke all on comercial.sso_composicao_mista_tokens from public,anon,authenticated,service_role;

alter function comercial.sso_preparar_orcamento_operacional(uuid,uuid,integer,uuid,integer,text,bigint,bigint,numeric,bigint)
 rename to sso_preparar_orcamento_operacional_nucleo;
revoke all on function comercial.sso_preparar_orcamento_operacional_nucleo(uuid,uuid,integer,uuid,integer,text,bigint,bigint,numeric,bigint)
 from public,anon,authenticated,service_role;

create function comercial.sso_preparar_orcamento_operacional(p_request_id uuid,p_proposta_id uuid,p_expected_revision integer,
 p_lista_id uuid,p_lista_revision integer,p_descricao text,p_custo_aquisicao_centavos bigint,p_custos_operacionais_centavos bigint,
 p_fator numeric,p_preco_centavos bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
 select habilitado into v_habilitado from comercial.sso_composicao_mista_gate where id for share;
 if not found then raise exception 'composicao_mista_indisponivel' using errcode='55000'; end if;
 if v_habilitado and not exists(select 1 from comercial.sso_composicao_mista_tokens t
   where t.txid=pg_catalog.txid_current() and t.request_id=p_request_id and t.ator_id=auth.uid() and t.proposta_id=p_proposta_id)
   then raise exception 'composicao_exige_fontes_conferidas' using errcode='23514'; end if;
 return comercial.sso_preparar_orcamento_operacional_nucleo(p_request_id,p_proposta_id,p_expected_revision,p_lista_id,p_lista_revision,
   p_descricao,p_custo_aquisicao_centavos,p_custos_operacionais_centavos,p_fator,p_preco_centavos);
end; $$;
revoke all on function comercial.sso_preparar_orcamento_operacional(uuid,uuid,integer,uuid,integer,text,bigint,bigint,numeric,bigint)
 from public,anon,authenticated,service_role;
