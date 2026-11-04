# ADR-1527 — Conferência direta das ocorrências de uma janela

## Contexto
A geração multirrotina retorna IDs concretos. A interface anterior varria até 1.000 obrigações do Plano para reencontrá-los, o que bloqueava a seleção para fila em Planos maiores e exigia muitas consultas paginadas.

## Decisão
Expor consulta por até 775 IDs de ocorrências preparadas por calendário, com os mesmos gates, capacidade, Cliente e Plano da consulta mediada existente. IDs repetidos, inválidos ou fora do Plano fazem a consulta inteira falhar; não retornar um subconjunto como se fosse completo. A resposta mantém os mesmos campos e a mesma semântica parcial da lista existente. A interface usa apenas os IDs recebidos nos comprovantes de geração, reconfirma-os no servidor e mantém a inclusão na fila como decisão explícita, sequencial e recuperável.

## Limites
A consulta não comprova execução, exclusividade de origens ou autorização futura; a inclusão continua reavaliada pelas RPCs existentes. Validar limite, isolamento, autorização, concorrência e desempenho antes de habilitar os gates já existentes. Não cria OS, envio Auvo ou novos gates.
