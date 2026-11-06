---
name: "docs-adr-1323-ciclos-uniformes-mediados-md"
description: "Documento Sinérgica SO: ADR-1323 — Consulta mediada de ciclos por usuário e Cliente"
alwaysApply: false
---

# ADR-1323 — Consulta mediada de ciclos por usuário e Cliente

Estado: preparação local; gate fechado, sem autorização de implantação.

A consulta uniforme da S166 está privada. Preparar mediador autenticado que revalida ator esperado, Cliente e capacidade `plano.gerir`, toma a trava compartilhada de autorização e protege as linhas do Plano e da versão durante a consulta. A função privada continua responsável pelas regras de Rotina, período, tolerância, feriado e vínculo de Visita; suas próprias permissões e gate não são ampliados. Para Rotina por Visita, a verificação adicional `visita.confirmar` permanece no núcleo.

O mediador tem gate próprio fechado por padrão. A interface usa a nova rota somente sob flag desligada, mantendo a rota anterior durante a transição. Nenhum dado operacional é materializado, e nenhum vencimento é deslocado por feriado ou execução. Páginas sucessivas não compõem fotografia transacional; alterações independentes em Visitas ou feriados requerem verificação adicional.

Antes de habilitar, testar isolamento de Clientes, ator, revogação nas duas ordens, paginação, limites, versão e Rotina divergentes, mudanças simultâneas, RLS/FORCE e revisão adversarial. Rollback: desligar flag e gate, drenar consultas e só então remover a função e o gate após confirmar ausência de consumidores; não remover dados de Planos, Visitas ou feriados.
