-- E01-S176 — corrige bug real em produção: toda leitura de pcm.equipamentos/sistemas/
-- sistema_itens via REST (GET) quebrava com 42P01→25006 "cannot execute SELECT FOR SHARE in a
-- read-only transaction".
--
-- Causa: a policy RLS restritiva `sso_equipamentos_cliente_select` (e as duas irmãs de
-- `sistemas`/`sistema_itens`, migration 1809) chamam `config.sso_estrutura_cliente_gate_ativo()`,
-- que faz `select habilitado ... for share nowait` — um lock de leitura. RLS USING roda DENTRO da
-- mesma consulta SELECT que o PostgREST expõe via GET, e o PostgREST sempre executa GET em
-- transação read-only. `FOR SHARE` nessa transação é proibido pelo Postgres incondicionalmente,
-- então a policy falhava em TODA leitura dessas 3 tabelas — com o gate aberto ou fechado,
-- qualquer usuário, sempre. Achado investigando "Dashboard indisponível" relatado em produção
-- em 2026-11-12.
--
-- O lock nunca teve função aqui: é uma leitura de flag booleana usada só para decidir se aplica a
-- checagem de autorização; não há escrita subsequente na mesma transação que precise ser
-- protegida contra alteração concorrente do gate. O padrão `for share` é correto dentro de RPCs de
-- ESCRITA (POST, sempre read-write no PostgREST) — foi reaproveisado por engano num contexto de
-- RLS/leitura, onde nunca poderia funcionar.
--
-- Fix: remove o lock; mantém toda a lógica (inclusive a trava de isolamento/advisory lock quando
-- o gate está ligado) exatamente como estava.
create or replace function config.sso_estrutura_cliente_gate_ativo() returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;
begin
 select habilitado into v_ativo from config.sso_estrutura_cliente_leitura_gate where id;
 if not found then raise exception 'gate_estrutura_indisponivel' using errcode='55000';end if;
 if v_ativo then
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001';end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 end if;
 return v_ativo;
end $$;
revoke all on function config.sso_estrutura_cliente_gate_ativo() from public,anon,authenticated,service_role;
