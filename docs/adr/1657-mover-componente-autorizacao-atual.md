# ADR-1657 — Autorização transacional no movimento de Componente

## Estado

Proposta E01-S176, não aplicada nem homologada.

## Decisão

Reforçar `sso_mover_componente` mantendo contrato, recibo, ACL, histórico e verificação dos Clientes atual e original. Exigir READ COMMITTED e adquirir try-lock compartilhado do protocolo 0319 antes de consultar autorização, recibo ou bloquear linhas; negar contenda com 55P03. A guarda 1303 e a hierarquia 1797 continuam independentes; a função não habilita gates e não aplica mudança a dados existentes.

## Limites

Garantia de revogação depende de escritores de autorização seguirem o mesmo protocolo e não equivale a proteção completa dos destinos. A ordem da guarda 1303 inclui leitura do gate de cadastros, e a 1797 tem trava própria e locks de posição; concorrência com alterações de gate, outras ordens de locks, clientes com isolamento diferente e snapshots de retry exigem testes e revisão adversarial antes de aplicar. Nenhuma capacidade adicional é concedida.
