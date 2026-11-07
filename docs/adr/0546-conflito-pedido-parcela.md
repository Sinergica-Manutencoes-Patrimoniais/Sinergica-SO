---
name: "docs-adr-0546-conflito-pedido-parcela-md"
description: "Documento Sinérgica SO: ADR-0546 — conflitos de pedido de parcela"
alwaysApply: false
---

# ADR-0546 — conflitos de pedido de parcela

Status: proposto; não homologado. A interface distingue códigos estruturados de conflito de revisão, unicidade, validação, acesso e indisponibilidade da última tentativa, sem mostrar texto bruto. Uma rejeição desta tentativa não prova que uma tentativa anterior não tenha sido confirmada; o pedido permanece guardado e deve ser consultado no servidor antes de qualquer nova ação. Falhas de rede ou respostas desconhecidas seguem incertas. Não há limpeza automática, reenvio ao Auvo ou cobrança externa. Testes de erro, troca de sessão e transações concorrentes são obrigatórios.

O comando canônico grava apenas comandos confirmados na mesma transação; exceções revertem suas escritas. Não existe fonte persistida de rejeições definitivas para consulta segura. 0771 oferece somente prévia de impedimentos atuais de uma nova parcela, sem classificar tentativa anterior, reservar saldo ou garantir execução. Ausência no histórico permanece inconclusiva.
