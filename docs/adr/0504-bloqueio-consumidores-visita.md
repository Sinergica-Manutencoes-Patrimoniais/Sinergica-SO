---
name: "docs-adr-0504-bloqueio-consumidores-visita-md"
description: "Documento Sinérgica SO: ADR-0504 — Bloqueio de consumidores ainda não integrados"
alwaysApply: false
---

# ADR-0504 — Bloqueio de consumidores ainda não integrados

Status: preparado, não aplicado nem homologado. Triggers bloqueiam inserção de retorno preparado, decisão, pendência técnica e finalização preparada quando a OS aponta para ocorrência legada já vinculada pela ponte de Visita 0723. O erro reverte toda a transação, inclusive eventuais alterações anteriores do mesmo comando; a proteção permanece mesmo se o gate de criação de vínculo for desligado. Sem vínculo de Visita, o legado não sofre bloqueio funcional por estes triggers.

Isso não adapta consumidores nem integra fila oficial; não cobre todos os escritores legados de status e não é prova de isolamento concorrente. Nenhum gate de geração, retorno ou homologação deve ser liberado antes de adaptação integral dos consumidores, inventário de caminhos, testes transacionais e revisão adversarial.
