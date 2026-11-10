---
name: "docs-adr-0524-parcelas-aditivas-e-saldo-legado-md"
description: "Documento Sinérgica SO: ADR-0524 — parcelas aditivas e saldo legado"
alwaysApply: false
---

# ADR-0524 — parcelas aditivas e saldo legado

Status: inviável sem evolução coordenada; diagnóstico, não aplicado nem homologado. Uma tabela separada de alocações adicionais preservaria o índice legado, mas as consultas e comandos de `0404` somam somente `financeiro.sso_faturavel_alocacoes`, incluindo os saldos do item e documento, e `0429` protege lançamentos usando essa mesma tabela. Portanto, uma parcela efetiva apenas na tabela nova seria invisível a esses caminhos e poderia permitir saldo excedido ou alterações indevidas no lançamento.

É necessário inventariar e migrar atomicamente todos os leitores/escritores, estornos, regras de fechamento e proteções de lançamento para uma fonte canônica unificada, com plano de compatibilidade e testes concorrentes. Enquanto não houver essa coordenação, uma tabela paralela não deve ser tratada como alocação efetiva, e a unicidade histórica permanece.

0749 prepara controlador privado de totais das alocações canônicas não estornadas e adapta somente a consulta 0733 a ele, sem criar parcela paralela. Outras rotas ainda usam somas e verificações próprias, incluindo 0404 (alocação e estorno), 0429 (proteção de lançamento), 0510 (diagnóstico) e 0716/0720/0728 (seleção e documento interno). Não se deve ativar comportamento novo até todas serem coordenadas e revisadas. Não houve cobrança, lançamento, aplicação ou teste.
