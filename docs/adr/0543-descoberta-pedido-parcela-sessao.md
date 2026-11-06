---
name: "docs-adr-0543-descoberta-pedido-parcela-sessao-md"
description: "Documento Sinérgica SO: ADR-0543 — descoberta local de pedidos de parcela"
alwaysApply: false
---

# ADR-0543 — descoberta local de pedidos de parcela

Status: proposto; não homologado. A interface procura em `sessionStorage` pedidos cujo usuário, Cliente, item e documento correspondam à chave e ao conteúdo validado. A consulta do pedido no servidor exige autor e capacidade atuais. Nenhum pedido é apagado pela descoberta ou pela consulta; ausência no servidor permanece inconclusiva. O armazenamento de sessão não é cofre e está sujeito ao acesso do próprio navegador; não salva credenciais. Testar troca de sessão, seleção e pedidos ilegíveis antes de ativar.

0768 acrescenta consulta paginada no servidor dos comandos canônicos já registrados pelo ator atual e item autorizado, sem retornar payload ou valor. Não descobre pedido que ainda esteja em trânsito ou que falhou antes do commit; também não distingue a origem de todo comando canônico de alocação. A ausência continua inconclusiva. Gate de recuperação e grants permanecem fechados.
