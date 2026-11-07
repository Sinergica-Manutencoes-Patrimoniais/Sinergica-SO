---
name: "docs-adr-1269-borda-levantamento-estruturado-md"
description: "Documento Sinérgica SO: ADR-1269 — Borda autenticada de levantamento estruturado declarado"
alwaysApply: false
---

# ADR-1269 — Borda autenticada de levantamento estruturado declarado

Status: proposta local; não registrada nem homologada.

A borda recebe JSON com contexto, dados e mapeamento declarados, após autenticação, limite compartilhado e confirmação explícita. O ator é derivado da sessão, nunca do corpo. A chamada usa cliente com token do usuário para a RPC de recepção, que continua responsável por autorização, triagem, identidade da OS/tarefa, idempotência e transação. O mapeamento fornecido é uma declaração de operador, não prova de questionário Auvo ou de origem. As fotos permanecem referências, sem download.

Entrada limitada, sem redirecionamento, sem log de conteúdo e com CORS restrito. Ausência de recibo ou erro após chamada à RPC significa resultado incerto; recuperação usa o mesmo request e conteúdo. Não registrar, implantar ou habilitar enquanto não houver prova de autenticação real, limite compartilhado, origem CORS, contratos e proteção contra concorrência e revisão adversarial.
