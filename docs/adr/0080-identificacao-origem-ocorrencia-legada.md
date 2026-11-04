# ADR-0080 — Identificação inicial de Ocorrências legadas

## Decisão

Em continuidade ao ADR-0075, adicionar `origem` à tabela existente com valor padrão `legado`, obrigatório e restrito por check a esse valor. Linhas e escritores antigos continuam pertencendo à mesma origem, sem alteração de UUID, Plano, ciclo, código ou relacionamento. A constraint bloqueia explicitamente qualquer origem nova, inclusive por service role, até a migração que adapte e comprove leitores, políticas, integrações e cardinalidades. Isso não materializa dados novos nem cria uma segunda estrutura operacional.

O valor padrão é justificado pela constraint já existente: todas as linhas permitidas nesta etapa pertencem a `planos_preventivos`. A alteração deve ser aplicada somente após validação das constraints efetivas; avaliar tempo de lock e compatibilidade na versão do PostgreSQL do ambiente alvo antes de rollout. Testar materialização e auditoria legadas. Não se pretende liberar uma linha de Rotina nova misturada a um Plano legado.

## Reversão e gate

Enquanto apenas `legado` for permitido, código anterior pode ignorar o campo. Removê-lo exige verificar leitores dependentes e plano específico; não reclassificar nem excluir dados. Antes de admitir outra origem é obrigatória nova migration com isolamento por Cliente em Ocorrências, avaliações e achados, revisão das funções privilegiadas e dos consumidores documentados no mapa de compatibilidade, testes concorrentes, compatibilidade de OS e revisão adversarial. Nenhum deploy é autorizado por esta decisão.
