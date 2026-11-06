# ADR-0547 — Preservação de características de Grupo

Com gate habilitado, escrita de características estruturadas não pode omitir chaves existentes: alterações de valor explícitas são possíveis, mas retirada exige futura decisão e trilha auditada próprias. Guarda cobre chamada do levantamento e caminhos legados, inclusive edições concorrentes, sem modificar dados existentes. Com gate desligado, mantém comportamento anterior. Esta proteção não substitui conferência de origem nem aprova operação. Testes e revisão de compatibilidade obrigatórios antes de habilitar.
