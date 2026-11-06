---
name: "supabase-tests-manual-e01-s53-concorrencia-1675-md"
description: "Documento Sinérgica SO: Concorrência de edição e geração legada — 1675"
alwaysApply: false
---

# Concorrência de edição e geração legada — 1675

Executar apenas em clone descartável com migrations até 1675, nunca em base real. Carregar `manual_E01-S53_concorrencia_1675_setup.sql` e abrir sessões A e B em READ COMMITTED. Em A e B usar `select set_config('request.jwt.claims','{"role":"service_role"}',false);`.

1. A: `begin; select pcm.materializar_ocorrencias_preventivas('16750000-0000-4000-8000-000000000011',current_date);` (não confirmar). B: `begin; set local lock_timeout='500ms'; update pcm.planos_preventivos set intervalo_n=2 where id='16750000-0000-4000-8000-000000000011';` deve resultar em `55P03`. B: rollback. A: commit. B: repetir o update em nova transação; deve falhar pela guarda que proíbe alterar regra após ocorrência. Verificar que a ocorrência tem vencimento original, o Plano mantém intervalo 1 e nova materialização não duplica.
2. Em outro Plano, A: `begin; update pcm.planos_preventivos set primeira_data=current_date+1 where id='16750000-0000-4000-8000-000000000012';` (não confirmar). B: begin, lock_timeout 500ms e materializar para `current_date+1`; deve falhar `55P03`. Fazer rollback em B e commit em A. Materialização repetida em B deve gerar ciclo 0 para `current_date+1`, não para a regra anterior. Repetir o segundo cenário com rollback em A: geração deve usar a regra anterior.

Executar casos de permissão/replay existentes em lote. Descartar o clone inteiro depois. A guarda 1045 e os gates não devem ser alterados. Nenhuma OS ou tarefa Auvo deve ser criada.
