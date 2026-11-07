---
name: "docs-adr-0087-rota-comprovante-intermediada-md"
description: "Documento Sinérgica SO: ADR-0087 — Rota intermediada de comprovantes"
alwaysApply: false
---

# ADR-0087 — Rota intermediada de comprovantes

## Decisão

Rota autenticada recebe somente UUID do lançamento. Após autenticação aplica limite compartilhado por usuário e consulta a referência autorizada do ADR-0086 usando o JWT do solicitante. Baixa o objeto no servidor com credencial privilegiada e confere novamente a autorização e a referência antes de responder. Retorna bytes como anexo genérico, `nosniff` e `private, no-store`, sem URL assinada, caminho ou dados financeiros. Erros não expõem detalhes nem credenciais. O limite reutiliza a infraestrutura transacional existente de rate limit com namespace próprio.

Essa rota é aditiva: não altera downloads existentes ou políticas do Storage nesta etapa. Usuários ainda podem criar URLs assinadas enquanto políticas atuais permitirem; URLs anteriormente emitidas não são revogadas por essa rota. Não declarar AC-6 concluído. A verificação dupla reduz, mas não elimina, a janela entre última autorização e entrega dos bytes; acesso já entregue não pode ser retirado do dispositivo. Revalidar escopo por Cliente e permissões de custo antes de rollout. Não fazer deploy, nem ligar o cliente à rota sem validação integrada de Storage, rate limit, configuração e plano de migração.
