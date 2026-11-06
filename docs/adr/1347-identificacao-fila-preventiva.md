# ADR 1347 — Identificação da fila preventiva local

## Contexto

A listagem da fila local apresenta identidade opaca de ciclo, dificultando a conferência de Rotina e alvo pelo PCM. O contrato anterior também é consumido pelo comando individual e deve permanecer compatível.

## Decisão

Adicionar consulta v2, sem modificar o contrato existente. Ela reutiliza a autorização e o gate da listagem anterior e acrescenta a identidade da Rotina e do alvo registrados na ocorrência preparada. O nome da Rotina vem do cadastro vinculado à versão e é apresentado como referência, não como comprovação de conteúdo imutável da fotografia aprovada. Vínculo inconsistente resulta em identificadores e nome ausentes, sem ocultar a entrada. A interface mantém o recurso desligado pela flag existente.

## Consequências

Não comprova disponibilidade atual, execução, cobertura da fila ou nome do ativo. Exige ensaios de autorização, isolamento, RLS/FORCE, alterações concorrentes, compatibilidade e revisão adversarial antes da ativação. Não cria OS e não acessa Auvo.
