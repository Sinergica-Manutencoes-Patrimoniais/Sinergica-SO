---
name: "docs-adr-1558-escolha-explicita-nova-data-md"
description: "Documento Sinérgica SO: ADR-1558 — Reconciliação explícita de data alterada"
alwaysApply: false
---

# ADR-1558 — Reconciliação explícita de data alterada

Status: em desenvolvimento, sem liberação operacional. A guarda 1045 permanece ativa.

Ao revisar uma Rotina cuja regra ou data-base muda, não presumir que ciclos de datas diferentes correspondem. O PCM escolhe expressamente a ocorrência já existente e o candidato da nova regra, de mesma identidade lógica e alvo, e confirma comparação e motivo. A decisão preserva a origem e data da ocorrência antiga e nunca cancela ou altera OS, Grupo, Chamado, execução ou tarefa externa. Exige revalidar fontes sob trava e não usa ausência em fonte parcial como prova integral.

A escolha vale apenas após aprovação e vigência; o ciclo novo é materializado pela regra canônica da nova versão com identidade própria, sem converter a identidade histórica nem deduzir vínculo por coincidência. Se a entrada antiga da fila ainda estiver comprovadamente aguardando e sem efeito externo, o PCM poderá aplicar a exclusão de sua fila por comando idempotente auditado; caso contrário permanecerá para reconciliação. A Visita candidata deve ser contratual válida, não suprimida por feriado, e respeitar permissões e versões. Não há reposição automática de feriado.

Antes de habilitar, concluir integração à avaliação de impacto, selagem transacional, geração e fila, confirmação visual, isolamento de Cliente, concorrência, replays e testes de fonte/feriado. Persistir apenas uma decisão sem seus efeitos operacionais não satisfaz este ADR. A aprovação real continua bloqueada por 1045 e evidências de fontes e fuso.
