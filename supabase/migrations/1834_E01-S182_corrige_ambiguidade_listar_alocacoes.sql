-- E01-S182 — correção de bug real encontrado ao escrever pgTAP de verdade: em
-- `financeiro.sso_listar_alocacoes_mediada` (1559), o parâmetro de saída `id` (da cláusula
-- `returns table(id uuid, ...)`) sombreia a coluna `id` do gate
-- `financeiro.sso_correcao_faturavel_mediada_gate`, e o PL/pgSQL deste projeto trata o conflito
-- como erro (`plpgsql.variable_conflict = error`). Toda chamada real — com o gate aberto ou
-- fechado — quebra com `column reference "id" is ambiguous` (42702) antes de chegar em qualquer
-- regra de negócio. Função nunca foi alcançável de verdade. Fix: qualifica a tabela do gate com
-- alias, sem mudar nenhuma regra.
create or replace function financeiro.sso_listar_alocacoes_mediada(p_ator_id uuid,p_cliente_id uuid,p_item_id uuid,p_apos uuid)
returns table(id uuid,documento_ref text,valor_centavos bigint,estornada boolean,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_item_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_correcao_faturavel_mediada_gate g where g.id and g.leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or not exists(select 1 from financeiro.itens_faturaveis i where i.id=p_item_id and i.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from financeiro.sso_listar_alocacoes_faturavel(p_item_id,p_apos);
end; $$;
