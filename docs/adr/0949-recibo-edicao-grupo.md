---
name: "docs-adr-0949-recibo-edicao-grupo-md"
description: "Documento Sinérgica SO: ADR-0949 — Recibo transacional para edição de grupo"
alwaysApply: false
---

# ADR-0949 — Recibo transacional para edição de grupo

Status: preparação local, não homologada. Complementa ADR-0947 e ADR-0948.

## Decisão

Cada edição recebe um UUID de tentativa independente do grupo. Uma fronteira `SECURITY DEFINER`, sem execução concedida aos papéis da aplicação, valida ator, papel atual e claim, obtém a trava de autorização e consulta recibo privado antes de chamar a edição atômica existente. Mesmo ator, grupo e conteúdo repetidos retornam sem reexecutar; qualquer divergência é conflito. A alteração, o recibo imutável e o evento de auditoria compartilham a transação. Assim, uma resposta perdida não faz uma repetição sobrescrever edição posterior.

O cliente experimental preserva a tentativa por ator e grupo em `sessionStorage`, confere sessão e conteúdo antes de enviar e limpa apenas após resposta confirmada ou conflito de revisão definitivo. Essa retenção não coordena abas, dispositivos ou fechamento de aba; não apagar tentativa incerta para contornar bloqueio. O recibo não é autorização para uma nova edição.

## Limites

Revisar o proprietário da função e FORCE RLS, equivalência das políticas contornadas pelo definer, fontes de autorização, locks, integridade dos recibos, auditoria, privacidade e retenção. Provar replay após outra edição, payload divergente, falha e rollback, concorrência, sessão revogada, recuperação após recarregar e rollout coordenado. Manter flag desligada e funções privadas até testes integrados e revisão adversarial.
