---
name: "docs-adr-1366-leitura-mediada-fato-servico-md"
description: "Documento Sinérgica SO: ADR-1366 — Leitura mediada da identidade de serviço"
alwaysApply: false
---

# ADR-1366 — Leitura mediada da identidade de serviço

**Estado:** proposta; não aplicada nem homologada.

## Contexto e decisão

As telas de atestação e conferência precisam localizar o fato declarado de uma declaração de serviço, mas a função de leitura existente é privada. Adicionar uma entrada mediada com gate próprio inicialmente fechado, sessão, capacidades de validação de execução e financeiro, trava de autorização e validação da identidade de Cliente. A função privada permanece sem EXECUTE público. Retornar no máximo uma identidade; múltiplos resultados são erro explícito.

## Limites

Leitura não cria faturável nem comprova execução, exclusividade ou elegibilidade. Integração das telas depende da aplicação coordenada da migration e de todos os gates das demais fontes. Validar RLS/FORCE, ACL, ausência de privilégio direto no núcleo, revogação, concorrência, isolamento e revisão adversarial antes de ativar.
