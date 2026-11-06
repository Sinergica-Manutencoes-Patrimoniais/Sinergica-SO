---
name: "supabase-tests-manual-e01-s165-transicoes-revisao-concorrencia-1773-md"
description: "Documento Sinérgica SO: Transições de revisão e revogação — ordem inversa 1773"
alwaysApply: false
---

# Transições de revisão e revogação — ordem inversa 1773

Em clone descartável com dados sintéticos de `manual_E01-S165_impacto_calendario_nativo_1704.sql` até antes do início da revisão, as migrations 1771, 1772, 1774 e 1773 foram carregadas para revisão; a ordem de carregamento de 1773 e 1774 aqui foi inversa, portanto esta prova não demonstra a sequência completa de migrations. A revisão estática de 1773 confirmou inserção do helper privado de autorização no início dos corpos, antes da autorização/replay, preservando ACLs e assinaturas.

A sessão autenticada iniciou a revisão e manteve a transação aberta: a revogação concorrente de `plano.gerir` recebeu `55P03`/`autorizacao_em_alteracao`. Em seguida, com início confirmado somente no clone, a submissão foi testada da mesma forma e a revogação recebeu o mesmo erro. Os testes concorrentes foram revertidos; o clone foi descartado. O ensaio inverso, com revogação primeiro, foi feito separadamente pelo autor da migration. Sem deploy ou Auvo.
