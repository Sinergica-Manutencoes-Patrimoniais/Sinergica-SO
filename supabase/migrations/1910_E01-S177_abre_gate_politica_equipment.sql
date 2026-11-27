-- E01-S177: abre pcm.sso_politica_equipment_gate, que habilita a tela "Política de Equipment por
-- categoria" (Visão 360 → Estrutura, flag VITE_SSO_POLITICA_EQUIPMENT_ENABLED).
--
-- AUTORIZAÇÃO: dono do projeto, 27/11/2026 — confirmou que a trava NÃO foi aberta à mão em
-- produção e pediu migration.
--
-- O QUE ABRE
--   pcm.sso_listar_politica_equipment e pcm.sso_configurar_politica_equipment (1151/1152): lista
--   categorias e grava, com revisão otimista, idempotência por request_id, motivo obrigatório e
--   audit.events, se uma categoria tem "Equipment controlado". Só superadmin com JWT superadmin.
--   A política é GLOBAL (vale para todas as contas) e nasce vazia — categoria sem linha = não
--   controlada.
--
-- POR QUE É SEGURO ABRIR AGORA (fail-closed)
--   A trava também é pré-condição de pcm.sso_t24_produzir_corretiva (1330) e das fontes T-24
--   corretiva/preventiva (1340/1341), que enfileiram Equipment no Auvo. Elas continuam
--   protegidas por gates próprios, FECHADOS (ex.: pcm.sso_t24_contrato_corretiva_gate), e exigem
--   política explícita "controlado = true" por categoria, que hoje não existe para nenhuma. Esta
--   migration não envia nada ao Auvo e não altera a fila: a tela diz isso ("a integração ainda
--   está pendente").
--
-- REVERSO, a qualquer momento e sem deploy de código:
--   update pcm.sso_politica_equipment_gate set habilitado = false where id;
-- (a política já gravada permanece; só as RPCs voltam a recusar com 55000.)
do $abre$
declare v_linhas integer;
begin
 if pg_catalog.to_regclass('pcm.sso_politica_equipment_gate') is null then
  raise exception 'trava pcm.sso_politica_equipment_gate ausente: a migration 1151 não foi aplicada' using errcode='42P01';
 end if;
 update pcm.sso_politica_equipment_gate set habilitado = true where id and not habilitado;
 get diagnostics v_linhas = row_count;
 raise notice 'E01-S177: % trava(s) aberta(s) nesta execução', v_linhas;
end
$abre$;
