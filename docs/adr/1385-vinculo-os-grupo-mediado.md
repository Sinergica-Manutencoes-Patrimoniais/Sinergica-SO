# ADR-1385 — Vínculo de OS ao Grupo mediado

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Adicionar entradas mediadas para listar OS candidatas e declarar vínculo com ocorrência de Grupo, preservando os núcleos privados, os gates e as capacidades de gestão do Plano e validação. Leitura e escrita têm gates próprios desligados. A consulta recusa Grupo de Visita suprimida; a escrita reutiliza a guarda transacional da dependência, o request idempotente e a auditoria existentes. Não modifica a OS, cria tarefa ou comprova execução.

## Limites

A relação continua declaração humana, não prova de equivalência ou execução. Validar permissões, RLS/FORCE, histórico, grupos de calendário e Visita, concorrência com supressão, paginação, recuperação e revisão adversarial antes da ativação.
