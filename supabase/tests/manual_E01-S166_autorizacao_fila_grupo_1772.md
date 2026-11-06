---
name: "supabase-tests-manual-e01-s166-autorizacao-fila-grupo-1772-md"
description: "Documento Sinérgica SO: Revogação e replay da fila de Grupo — 1772"
alwaysApply: false
---

# Revogação e replay da fila de Grupo — 1772

Em clone isolado com migrations até 1771 e dados sintéticos da fixture `manual_E01-S166_grupo_fila_afirmacao.sql`, foi semeado recibo sintético de reabertura com o payload esperado. Apenas no clone, `sso_conferir_acesso_fila_grupo` recebeu pausa de quatro segundos entre a conferência de autorização e a trava. A sessão autenticada iniciou o replay de `sso_reabrir_fila_grupo`; durante a pausa, outra revogou `plano.gerir` e confirmou. O replay ainda retornou o recibo. A prévia testada no mesmo arranjo recusou o acesso pela segunda conferência. A pausa evidencia uma intercalação possível, não é código de produção.

Após aplicar 1772 sem a pausa, o replay retornou normalmente quando iniciou primeiro e manteve a transação aberta; a revogação concorrente recebeu `55P03`/`autorizacao_em_alteracao`. Na ordem inversa, com a revogação aberta, o replay recebeu o mesmo erro. Ambas as transações foram revertidas. Uma revisão independente confirmou a posição da trava e preservação de ACLs/gates. As fixtures `manual_E01-S166_fila_grupo_conflitos_1750.sql` e `manual_E01-S166_reabrir_grupo_fila.sql` passaram em outro clone limpo até 1772; as fixtures de edição e inclusão/retirada 1768/1769 também passaram com 1771 e 1772.

Roteiro: preparar dados de Grupo em clone descartável; criar recibo sintético de reabertura; inserir pausa de teste pontual na função privada entre autorização e trava; iniciar replay e confirmar revogação enquanto aguarda; restaurar função e aplicar 1772; repetir com replay e revogação em ambas as ordens, mantendo a primeira transação aberta e revertendo ambas. Executar fixtures com transação externa e `ON_ERROR_STOP`. Nenhuma OS, deploy ou chamada ao Auvo. Não prova todas as fontes de autorização ou todos os consumidores.
