# ADR-1192 — Horizonte parcial de capacidade mediado

## Contexto

A tela de horizonte chama consulta privada 0454. Ela fornece contagens de disponibilidade e Visitas por semana, sem provar completude, calcular saldo ou consolidar horas. A execução autenticada direta está revogada.

## Decisão

Preparar entrada autenticada que valide ator, Cliente, período e permissão de capacidade, mantenha o gate existente e reutilize a consulta privada. A interface seleciona a entrada mediada apenas com flag adicional desligada e verifica sessão e contrato. Não mudar a fonte nem promover contagens a capacidade efetiva.

## Liberação

Não aplicar ou habilitar antes de verificar propriedade, RLS/FORCE, contrato PostgREST, concorrência de gate e revogação, origem das contagens, fuso, permissões e revisão adversarial. A trava consultiva depende de os escritores também a respeitarem; não é uma fotografia completa de disponibilidade, demanda ou execução.
