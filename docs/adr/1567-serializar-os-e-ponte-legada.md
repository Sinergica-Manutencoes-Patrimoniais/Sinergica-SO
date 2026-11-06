# ADR 1567 — Serializar OS e ponte de ciclo legado

## Contexto
A ponte explícita PCM vincula um ciclo SSO a uma ocorrência legada e verifica ausência de OS. A guarda de OS consulta a ponte, mas a consulta anterior à trava implícita da chave estrangeira pode concorrer com sua criação.

## Decisão
Antes da guarda existente de OS, obter trava compartilhada na ocorrência legada. As rotas de ponte calendário e Visita já obtêm trava exclusiva na mesma linha antes de verificar efeitos e criar a ponte. Assim, a segunda operação observa o resultado confirmado da primeira, sob READ COMMITTED. Escritas de OS legada e das duas pontes falham fechadas em outros níveis de isolamento. Não se presume equivalência por alvo ou data; a escolha explícita permanece necessária.

## Limites
Não classifica todos os ciclos futuros, não comprova fontes externas e não libera a guarda 1045. Cobertura de reconciliação de escopo futuro ainda precisa de implementação e prova integradas. A migration não modifica histórico ou OS existentes.
