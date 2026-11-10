---
name: "docs-adr-1362-projecao-operacao-vinculos-ambiguos-md"
description: "Documento Sinérgica SO: ADR-1362 — Salvaguardas da projeção operacional de Chamados"
alwaysApply: false
---

# ADR-1362 — Salvaguardas da projeção operacional de Chamados

**Estado:** proposta; não aplicada nem homologada.

## Contexto e decisão

A migration 1484 reconhece vínculo legado unilateral na projeção, mas pode suprimir um Chamado quando a OS não aparece no quadro, quando a relação direta pertence a outro Cliente ou quando vários Chamados apontam para a mesma OS. Nesses casos a supressão pode ocultar trabalho.

Manter `security_invoker` e o contrato da view; suprimir o cartão apenas quando a OS vinculada pertence ao mesmo Cliente, não está excluída e passa pelo mesmo filtro de visibilidade da projeção. Para vínculo apenas legado, exigir adicionalmente que a OS não tenha Chamado canônico e que não haja outro Chamado ativo visível do mesmo Cliente apontando para ela. Referências ambíguas permanecem para conferência; nenhuma relação é escrita ou corrigida.

## Limites

As subconsultas respeitam RLS do invocador: ausência de outro Chamado visível não prova ausência global. A OS com vínculo apenas legado continua projetada sem `chamado_id`; a alteração não conclui o quadro gerencial 1:N nem reconcilia cadastros. Antes da implantação, verificar definição instalada, índices, políticas, vínculos ocultos por RLS, ambiguidades entre Clientes e revisão adversarial. Testes de banco e integração permanecem pendentes.
