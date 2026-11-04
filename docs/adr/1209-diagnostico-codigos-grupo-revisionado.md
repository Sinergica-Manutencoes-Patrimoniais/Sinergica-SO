# ADR-1209 — Diagnóstico revisionado de códigos de Grupos

## Decisão

Preparar consulta autenticada por ator, Cliente, lote e revisão para códigos informados de Grupos Quantitativos em staging. A consulta conserva o gate e as fontes do diagnóstico existente, usa ordenação `C` para cursor previsível e não devolve códigos de outros Clientes. A revisão do lote é travada durante a página; cadastros e aliases podem mudar entre chamadas.

As contagens são indícios locais, não reserva de código nem prova de unicidade global. Não atribuem código, aprovam linha ou alteram o cadastro; códigos existentes permanecem intactos.

## Gates

Manter flag e gate fechados até ensaios de RLS/FORCE, permissões, collation, revisão concorrente, paginação, desempenho e revisão adversarial. A consulta não resolve a política de namespace dos Grupos.
