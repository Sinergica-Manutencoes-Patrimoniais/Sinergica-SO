# ADR-1535 — Revalidar OS conferidas ao aprovar revisão

A decisão de impacto já compara as OS conhecidas, mas a aprovação só revalidava o questionário. Uma OS podia mudar entre a confirmação do PCM e a aprovação, tornando a decisão anterior desatualizada.

No trigger existente e sob o gate de decisão comparada já existente, recalcular com as mesmas fontes, travas e projeção da comparação v3 e exigir igualdade das OS do Cliente e do sinal de outro Cliente. Decisões antigas sem esses campos precisam de nova conferência. A função auxiliar é privada; a aprovação mantém as permissões existentes e não exige `visita.confirmar` adicional. O histórico, OS e ocorrência não são alterados. A guarda independente 1045 permanece; a ausência de OS conhecidas não prova exclusividade global de fontes.

Aplicação coordenada exige testar calendário e Visita, alteração e criação de OS após decisão, revogação, concorrência e replay em clone, além de revisão adversarial. Não habilitar gates nem homologar com base apenas nesta migration. Reversão restaura o trigger da 1660 e remove a função auxiliar, sem excluir dados.
