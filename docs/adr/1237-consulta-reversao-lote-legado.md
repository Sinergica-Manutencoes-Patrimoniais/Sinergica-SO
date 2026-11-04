# ADR-1237 — Consulta dos lotes para reversão

## Decisão

Preparar listagem paginada dos lotes de rascunhos e detalhe de seus Planos, origem, estado e revisão atuais, sem devolver fotografias ou parâmetros completos. A consulta usa o mesmo escopo de superadmin e capacidade do comando individual, e o detalhe reusa a leitura individual autorizada. A interface poderá apresentar revisões e pedir confirmação antes de chamar a avaliação de reversão.

## Limites

As consultas não comprovam ausência de dependências nem garantem fotografia entre páginas ou até o comando. A avaliação deve reconferir tudo transacionalmente. Gates continuam fechados; testar isolamento entre Clientes, limites, concorrência, permissões, RLS/FORCE e revisão adversarial antes de habilitar. Nenhuma reversão ou migração é executada por esta leitura.
