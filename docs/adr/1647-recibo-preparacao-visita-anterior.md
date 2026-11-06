---
name: "docs-adr-1647-recibo-preparacao-visita-anterior-md"
description: "Documento Sinérgica SO: ADR 1647: consulta de recibo da preparação anterior por Visita"
alwaysApply: false
---

# ADR 1647: consulta de recibo da preparação anterior por Visita

Pedidos já guardados pelo navegador para a preparação anterior não devem ser convertidos para outro protocolo nem reenviados ao núcleo privado. Uma consulta autenticada identifica o pedido pelo mesmo ator, Cliente e payload completo, sob a trava de autorização e a trava de request usada pelo comando original. Ela apenas retorna o recibo existente, sem criar ou alterar ocorrência.

Ausência de recibo é indeterminada: uma requisição anterior pode ainda chegar. A interface preserva o pedido para reconciliação. A consulta não comprova identidade canônica, não cria OS e não autoriza execução. As permissões atuais e o Cliente do Plano são novamente conferidos, inclusive na recuperação.
