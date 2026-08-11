-- 0198_E03-S10_leads_readonly.sql — Sinérgica SO
-- Story E03-S10, AC-3. Primeira etapa da aposentadoria de `comercial.leads`: revoga INSERT/UPDATE
-- de `service_role` e `authenticated` — a tabela segue LEGÍVEL por um ciclo (não dropada ainda,
-- isso é a migration seguinte, 0199). Se algo ainda tentar escrever aqui depois desta migration
-- (agente com deploy antigo, script esquecido), a falha é visível e imediata (erro de permissão),
-- não perda silenciosa de dado.
--
-- Pré-condição verificada em produção antes desta migration (AC-1/AC-2, task 1/2 do tasks.md):
-- `comercial.leads` tem 0 linhas, sempre teve — a E02-S09 nunca rodou UAT de WhatsApp real, e a
-- E03-S09 (agente já usando `fn_registrar_oportunidade`) está deployada e `ACTIVE` desde antes
-- desta migration. Nada para migrar (AC-2 é no-op: contagem origem 0 = contagem destino 0).
--
-- Reverso:
--   grant insert, update on comercial.leads to authenticated, service_role;

revoke insert, update on comercial.leads from authenticated, service_role;
