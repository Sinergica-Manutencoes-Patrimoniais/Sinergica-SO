# ADR-0043 — Criação completa de Rotina em rascunho

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

O comando de criação completo grava em uma transação alvo, recorrência, tempo e referência, tolerâncias, instrução e questionário, com revisão do Plano, auditoria e `requestId`. Questionário é apenas referência ao cadastro existente: snapshot e versão congelada continuam requisito da aprovação futura. Não há execução nem sincronização. O comando anterior permanece compatível com sua identidade idempotente e não inventa os campos novos.

Sem configuração, tolerâncias são zero; tempo ou referência ausentes permanecem pendentes. Alvo e questionário são conferidos no servidor. O comando não autoriza, aprova nem modifica versões aprovadas. Revalidação de concorrência, transições, integração com dependências e revisão adversarial seguem obrigatórias antes de PASS.
