---
name: "supabase-tests-manual-e01-s165-s166-aprovacao-lotes-concorrencia-md"
description: "Documento Sinérgica SO: Aprovação e lotes concorrentes de Calendário e Visita"
alwaysApply: false
---

# Aprovação e lotes concorrentes de Calendário e Visita

Clone descartável com migrations até 1769, somente dados sintéticos; gates 1731, geração da versão anterior, lote Calendário e lote Visita habilitados no clone. As fixtures `manual_E01-S165_aprovacao_real_calendario_1731.sql` e `manual_E01-S165_aprovacao_real_visita_1731.sql` foram preparadas até o ponto anterior à primeira aprovação, com commit para permitir duas sessões. A guarda 1045 permaneceu real; `session_replication_role=replica` foi usado apenas conforme fixture para abrir a vigência sintética do Calendário. O gate de comparação foi restaurado para falso antes de preparar a segunda fixture e ativado novamente por ela.

Foram invocadas a RPC `sso_aprovar_revisao_mediada` e, no Calendário, `sso_materializar_lote_calendario` com revisão 3 e janela da ocorrência sintética existente; na Visita, `sso_preparar_lote_visita_canonica` com revisão 3 e Visita 081. Uma sessão executou a primeira operação, manteve a transação aberta por quatro segundos e reverteu; durante a espera a outra tentou a operação concorrente com `lock_timeout=1s`. As duas ordens foram exercitadas nos dois modos.

Nos quatro ensaios, a primeira RPC terminou; a concorrente recebeu `revisao_impacto_concorrente_repetir` em três casos, e timeout de trava ao preparar o lote Visita quando a aprovação foi primeira. Os lotes reportaram `criada=false`, pois os ciclos já existiam. As transações foram revertidas. Isso demonstra contenção desses caminhos, não cobre criação de ciclo novo, confirmação após espera, todas as combinações de dados ou integrações externas.

No mesmo clone foi identificada separadamente uma corrida de revogação com o gate de origem de lote desligado: snapshot sintético alterado para recorrência diária permitiu criar novo índice 1 em `sso_materializar_ciclo_canonico`; após a RPC e antes do commit, outra sessão revogou `plano.gerir` e confirmou sem bloquear, seguida do commit da criação. A mudança de snapshot e os commits ocorreram apenas no clone. Nenhuma OS ou tarefa Auvo foi criada. Achado encaminhado para correção e verificação separadas.
