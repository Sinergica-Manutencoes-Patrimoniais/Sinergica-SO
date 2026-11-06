# ADR 1443 — OS de Grupo no Chamado do ciclo

Quando já existe Chamado para o ciclo de Grupo, a criação de OS usa esse Chamado e a autorização transacional de múltiplas OS. A decisão e o vínculo explícito aceitam somente o Chamado associado ao mesmo ciclo. Sem Chamado, o caminho anterior permanece. A mudança depende da transição coordenada 1:N, das permissões e dos gates existentes; não abre gates nem cria tarefa Auvo.

Validar ambos os modos, concorrência entre criações, numeração, repetição, retorno, autorização, supressão e revisão adversarial antes de habilitar.
