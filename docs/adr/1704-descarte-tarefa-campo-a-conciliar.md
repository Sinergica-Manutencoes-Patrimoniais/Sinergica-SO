---
name: adr-1704
description: Descarte auditado de tarefa na fila Campo a conciliar.
alwaysApply: false
---

# Descarte de tarefa na fila Campo a conciliar

E01-S199 · Onda 8 do piloto PCM. O descarte exige motivo e cancela o Chamado provisório
pelo comando auditado da migration 1430. A OS, sua fase e a tarefa Auvo são preservadas,
inclusive em Planejamento. O comando mantém as verificações de ator, Cliente, capacidade,
revisão e vínculo. O motivo permanece na trilha do cancelamento.

A fila passa a excluir Chamados cancelados antes de ordenar e limitar a resposta. A
migration mantém a assinatura, as permissões e o gate de leitura da função de 1866.
A lista da fase da OS continua com seu próprio recorte. Nenhuma flag ou gate é aberto
por esta alteração.

O retorno do recorte pode ser feito em uma migration posterior que restaure o corpo de
1866. Os registros de cancelamento e a trilha de auditoria continuam disponíveis.
