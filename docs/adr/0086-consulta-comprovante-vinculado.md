---
name: "docs-adr-0086-consulta-comprovante-vinculado-md"
description: "Documento Sinérgica SO: ADR-0086 — Referência autorizada de comprovante por lançamento"
alwaysApply: false
---

# ADR-0086 — Referência autorizada de comprovante por lançamento

## Decisão

Criar consulta somente leitura que recebe o ID do lançamento e devolve exclusivamente o caminho do comprovante efetivamente vinculado, após verificar usuário ativo e permissão financeira atual segundo a regra já existente de `s184_acesso_interno_atual`. Exige objeto no bucket privado `financeiro-comprovantes`; lançamento, vínculo ou objeto ausentes e ausência de permissão recebem a mesma falha. A consulta não aceita caminho fornecido pelo cliente, não emite URL e não retorna valores financeiros.

É uma fundação para uma rota intermediada: por si só não impede emissão direta de URL assinada, não revoga URLs já emitidas e não fecha AC-6. Não mudar ainda a política de leitura do Storage, porque o aplicativo atual depende dela para downloads e uploads. A futura rota deve revalidar autenticação e permissão a cada requisição, resolver o caminho por este contrato, servir conteúdo sem URL reutilizável, e somente depois permitir bloqueio coordenado da leitura direta. Downloads e uploads, cliente antigo, cache e arquivos já publicados precisam de plano de rollout e testes reais em ambiente isolado.

## Compatibilidade

Consulta aditiva; mantém autorizações financeiras atuais, sem presumir escopo por Cliente ou ampliar `custo.ler`. Caminhos legados permanecem intocados. Aplicar localmente apenas para testes, sem deploy; rever escopo por Cliente, corrida de revogação e revisão adversarial antes de PASS.
