---
name: data-model
description: Modelo de leitura da pesquisa 360 sem alteração de entidades.
alwaysApply: false
---

# Modelo de leitura

Resultado tipado: chave tipo:id, tipo, id, nome, código/TAG, areaId, localId, sistemaId, parentId.
Tipos: Área, Local, Sistema, Equipamento, Componente, Grupo Quantitativo.
Localização física (Área/Local) não substitui pertencimento funcional (Sistema/pai de Equipamento).
A pesquisa usa o código atual do Grupo; nenhum código é inventado. Sem tabela ou FK nova.
Cursor é a última chave da página; paginação não promete snapshot imutável entre chamadas.

