---
name: "docs-adr-0735-revalidacao-contrato-apos-espera-md"
description: "Documento Sinérgica SO: ADR-0735 — Revalidar autorização após espera em ativação"
alwaysApply: false
---

# ADR-0735 — Revalidar autorização após espera em ativação

**Status:** incremento preparado para diagnóstico; não homologado nem implantado.

Teste com duas sessões demonstrou que a ativação de contrato avulso pode obter autorização, aguardar bloqueio da proposta, e prosseguir após a permissão Comercial ter sido rebaixada. O caminho recorrente era negado por revalidação na interface financeira, que não existe no caminho avulso.

## Decisão

Após bloqueios da proposta e da oportunidade e imediatamente antes de alterar contrato, a função de ativação reconsulta a permissão efetiva Comercial com a guarda existente e falha fechada. Os dois tipos de contrato devem ser testados. A migration é aditiva e preserva assinatura, ACL, filtros, proteção dos dados de custos e todos os dados existentes.

Esta revalidação reduz a janela comprovada, mas não serializa integralmente a alteração de permissões: uma revogação pode ocorrer depois da última verificação. Não afirmar segurança total contra revogações concorrentes. Uma solução de serialização exige análise de todas as fontes de permissão, ordem de bloqueios e risco de deadlock, além de testes específicos. Também são necessários revisão adversarial, CI/db-tests e confirmação dos caminhos privilegiados antes de qualquer homologação. Nenhum faturamento ou integração é disparado pela migration.
