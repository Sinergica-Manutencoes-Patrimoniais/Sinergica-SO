---
name: "supabase-tests-manual-e01-s166-autorizacao-geracao-concorrencia-1770-md"
description: "Documento Sinérgica SO: Autorização e geração concorrentes — 1770"
alwaysApply: false
---

# Autorização e geração concorrentes — 1770

Ensaio em banco descartável com migrations 1614–1770, dados sintéticos e gates habilitados somente no clone. As fixtures de aprovação real 1731 de Calendário e Visita foram preparadas até antes da aprovação; também foram habilitados geração da versão anterior e gates dos lotes. O gate de origem do lote permaneceu desligado para exercitar o caminho que revelou a corrida. A guarda 1045 não foi modificada.

Em cada modo, uma sessão chamou o lote canônico e manteve a transação aberta por quatro segundos; a outra tentou revogar `plano.gerir`. Depois as ordens foram invertidas. A primeira operação concluiu e a segunda recebeu `autorizacao_em_alteracao` nas quatro combinações. Todas as transações foram revertidas. Os lotes reutilizaram ciclos existentes; replay com mesmo pedido e payload produziu JSON idêntico em ambos os modos. Ator do Cliente Calendário sem concessão para o Cliente Visita recebeu 42501 ao tentar seu lote.

Para provar criação nova, apenas no clone a versão sintética aprovada foi modificada com `session_replication_role=replica` para periodicidade diária. `sso_materializar_ciclo_canonico` produziu índice 1 com `criada=true`; enquanto sua transação estava aberta, a revogação recebeu `autorizacao_em_alteracao`. Na ordem inversa, geração recebeu o mesmo erro enquanto revogação estava aberta. Ambas as transações foram revertidas. Os ensaios usaram `lock_timeout=1s`, ator autenticado e operações reais, com `pg_sleep` apenas para manter a primeira transação aberta.

Roteiro: preparar as duas fixtures 1731 até imediatamente antes da aprovação; confirmar dados apenas no clone para permitir duas conexões; acionar gates mencionados; executar lote ou RPC direta em uma transação e manter aberta; em outra, atualizar concessão do ator, e inverter a ordem. Conferir código 55P03/mensagem `autorizacao_em_alteracao`; repetir com ciclo novo sintético e testar replay e Cliente sem concessão. Descartar banco inteiro. Não prova todos os papéis, escritores, estados, integração externa ou homologação. Nenhuma OS ou tarefa Auvo foi criada.
