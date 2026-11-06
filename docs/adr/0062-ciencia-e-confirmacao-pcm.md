---
name: "docs-adr-0062-ciencia-e-confirmacao-pcm-md"
description: "Documento Sinérgica SO: ADR-0062 — Ciência do Cliente e confirmação PCM"
alwaysApply: false
---

# ADR-0062 — Ciência do Cliente e confirmação PCM

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

A política efetiva é resolvida por Visita, contrato, Cliente e padrão sem controle, nessa ordem. Ciência informativa não bloqueia. Quando configurada como obrigatória, a liberação de envio exige confirmação do Cliente com data, responsável, canal e observação; ausência ou registro incompleto mantém o envio bloqueado. A confirmação PCM é independente e não equivale a consentimento do Cliente nem a envio externo.

**SPEC_DEVIATION:** o cenário AC-2 da spec pode ser lido como se a confirmação do Cliente fosse pré-requisito para a confirmação PCM. A decisão consolidada F07 exige confirmação do Cliente **antes do envio**, portanto prevalece. Não reabrir a decisão operacional. Confirmação do Cliente, política efetiva e revisão devem ser verificadas no servidor antes de E01-S168 produzir intenção externa. O cálculo puro de prévia não é autorização nem substitui essa validação; não existe envio real nesta etapa.

Políticas configuradas têm escopo exclusivo de Cliente, contrato ou Visita, sempre vinculadas ao mesmo Cliente; resolução é feita no servidor com permissão `visita.confirmar`. Escrita direta permanece fechada até existir comando auditado de configuração. Mudanças concorrentes e captura transacional na confirmação ainda exigem tratamento antes de liberar o fluxo completo.
