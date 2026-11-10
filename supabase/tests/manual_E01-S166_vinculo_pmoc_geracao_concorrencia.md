---
name: "supabase-tests-manual-e01-s166-vinculo-pmoc-geracao-concorrencia-md"
description: "Documento Sinérgica SO: Vínculo PMOC e geração pelo Plano"
alwaysApply: false
---

# Vínculo PMOC e geração pelo Plano

Usar clone descartável com migrations até 1767. Preparar a fixture de comparação de Calendário até antes da primeira geração; no clone, inserir proposta PMOC e decisão validada sintéticas, com mesmo Cliente, Plano, Rotina, alvo e data do agendamento. A proposta e decisão são dados de preparação sintéticos, não provam sua criação pelas RPCs. Habilitar o gate do vínculo somente no clone.

Para vínculo primeiro, simular origem `pmoc` exclusivamente no clone, chamar como usuário autenticado `sso_vincular_ciclo_pmoc` e manter a transação aberta. A geração canônica concorrente recusa `origem_nao_comprovada`. Reverter ambas.

Para geração primeiro, simular origem `plano`, chamar a geração canônica e mantê-la aberta. O vínculo concorrente recebe `55P03` ao tentar travar o Plano. Após confirmar a geração sintética, simular origem `pmoc` no clone e repetir o vínculo: deve recusar `ocorrencia_plano_exige_reconciliacao`.

Em transação revertida, remover a preparada sintética com triggers desligados no clone e chamar duas vezes o vínculo com o mesmo request: os recibos devem ser idênticos. As chamadas sob teste usam triggers normais. As duas ordens e o replay passaram; a mudança de origem e as propostas foram simuladas, não comprovam uma jornada operacional completa. Nenhuma OS ou tarefa Auvo foi criada. Descartar o clone.
