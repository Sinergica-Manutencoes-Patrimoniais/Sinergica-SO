-- E01-S181 (dispensa de orçamento operacional) — correção de bug real encontrado ao escrever
-- pgTAP de verdade pra essa fatia (auditoria de 2026-11-10 só tinha confirmado a existência do
-- schema/UI, não que a RPC fosse alcançável): `comercial.sso_dispensar_orcamento`,
-- `sso_revogar_dispensa`, `sso_consultar_dispensa` e `sso_historico_dispensa` (migrations 0437/0440)
-- nunca receberam `grant execute` a `authenticated` em nenhuma migration — confirmado por grep em
-- todo o repositório, nenhum wrapper "_mediada" cobre essas 4 funções (diferente do padrão usado
-- por outras RPCs desta mesma story, ex. `sso_listar_listas_materiais_mediada`, 1062). A UI real
-- (`DispensarOrcamento.tsx`) chama essas RPCs direto via `supabase.schema("comercial").rpc(...)`;
-- o teste de componente passa porque mocka o cliente Supabase e nunca pega esse erro — em qualquer
-- ambiente real (dev/staging/produção), "Dispensar Orçamento" falharia com 42501 permission denied
-- assim que o gate `sso_dispensa_orcamento_gate` fosse aberto. Mesmo padrão de bug já encontrado e
-- corrigido em E01-S167 AC-5 (migration 1831) nesta sessão.
--
-- O gate `comercial.sso_dispensa_orcamento_gate` já existe e já nasce fechado (0437) — este fix é
-- só a concessão de execução, não altera a regra de negócio nem abre nada em produção.
--
-- Reverso:
--   revoke execute on function comercial.sso_dispensar_orcamento(uuid, uuid, uuid, integer, text) from authenticated;
--   revoke execute on function comercial.sso_revogar_dispensa(uuid, uuid, uuid, integer, text) from authenticated;
--   revoke execute on function comercial.sso_consultar_dispensa(uuid) from authenticated;
--   revoke execute on function comercial.sso_historico_dispensa(uuid, uuid) from authenticated;

grant execute on function comercial.sso_dispensar_orcamento(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function comercial.sso_revogar_dispensa(uuid, uuid, uuid, integer, text) to authenticated;
grant execute on function comercial.sso_consultar_dispensa(uuid) to authenticated;
grant execute on function comercial.sso_historico_dispensa(uuid, uuid) to authenticated;
