---
name: "docs-adr-1085-observacao-os-reconciliacao-md"
description: "Documento Sinérgica SO: ADR-1085 — Observação local persistente de OS"
alwaysApply: false
---

# ADR-1085 — Observação local persistente de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar ocorrência local única por OS e histórico imutável das mudanças observadas no estado de sincronização, presença de identificador Auvo e data local. A captura será explícita por lote de até 50 OS do mesmo Cliente, com requestId, autorização por Cliente, revalidação de posse, locks ordenados e auditoria. Repetição idêntica retorna o recibo; não cria tarefa, não confirma estado remoto e não altera a OS. O identificador da tarefa e payloads não são copiados para o histórico.

## Limites

Não é varredura periódica, não prova ausência ou sucesso remoto, não classifica lease, não fecha alerta e não cobre Comercial ou Financeiro. Requer integração com a tela, testes em esquema completo, concorrência com transferência de Cliente, RLS/FORCE, troca de estado durante leitura, replay e revisão adversarial. Gate fechado e função privada até implantação coordenada.
