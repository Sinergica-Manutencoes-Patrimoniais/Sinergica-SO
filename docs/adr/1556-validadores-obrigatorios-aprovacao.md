---
name: "docs-adr-1556-validadores-obrigatorios-aprovacao-md"
description: "Documento Sinérgica SO: ADR-1556 — Validadores oficiais obrigatórios na aprovação mediada"
alwaysApply: false
---

# ADR-1556 — Validadores oficiais obrigatórios na aprovação mediada

A proteção 1045 bloqueia toda revisão. Os validadores de continuidade, comparação e fuso já existem, mas alguns retornam sem validar quando sua configuração está desligada. Simplesmente retirar 1045 permitiria aprovação com proteção parcial.

A rota mediada passa a exigir, antes de um novo comando, que os gates existentes de continuidade, decisão comparada, data civil e fuso congelado estejam ativos sob trava. Também verifica que a própria guarda 1045 e os triggers oficiais de validação, inventário, continuidade, retiradas e selagem estão presentes e habilitados, e preserva a trava da tabela de tokens até o término da transação. Uma configuração parcial falha fechada. Repetições de comando já registrado continuam tratadas pelo núcleo idempotente e exigem autorização atual. Não se cria gate, não se consulta o Auvo e a guarda 1045 permanece intacta; sua futura substituição exige alterar explicitamente esta verificação.

Isto é uma pré-condição de integração, não prova integral de fontes. Não autoriza liberar 1045: faltam revisão adversarial, provas de fontes oficiais positivas, consumidores de histórico/OS, cenários com e sem histórico, autorização/revogação, replays, concorrência, performance e homologação. Aplicar em conjunto e na ordem com as migrations 1702/1703, que criam os dois triggers de selagem exigidos, e seus testes; antes delas o wrapper permanece fechado por erro de dependência. A reversão restaura o wrapper 1651 sem excluir dados.
