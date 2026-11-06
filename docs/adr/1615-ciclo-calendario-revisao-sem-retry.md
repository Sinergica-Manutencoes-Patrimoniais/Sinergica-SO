# ADR-1615: revisão divergente na geração de Calendário

Uma revisão de Plano divergente na preparação de ciclo é conflito definitivo. `40001` causa repetição automática no PostgREST de ensaio e pode deixar a chamada pendente.

O comando canônico retorna `P0011` com `revisao_obsoleta`, inclusive quando chamado pelo fluxo de ciclo vencido. A alteração preserva autorização, locks, replay, demais erros e assinaturas. A interface libera nova conferência somente após rejeição definitiva na primeira tentativa; pedidos anteriores e resultados incertos são preservados.

Consumidores externos que reconhecem apenas `40001` devem reconhecer o par `P0011` e `revisao_obsoleta`. Não há ativação nem comunicação externa nesta alteração.
