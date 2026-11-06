# ADR-1223 — Consulta mediada da proposta atual no Portal

## Decisão

Preparar entradas autenticadas para listar propostas operacionais atuais e consultar seu detalhe público por Cliente e OS. As entradas mantêm os núcleos privados e reutilizam sua projeção de dados públicos, autorização e visibilidade. A lista exige vínculo ativo do síndico e OS do Cliente; o detalhe também confere a proposta e versão atuais.

As consultas não publicam nem aceitam propostas. A projeção não deve expor custos internos; dados legados e revogação concorrente ainda precisam de prova. As leituras não são snapshot entre páginas ou com itens.

## Gates

Flag e gate permanecem fechados até testes de RLS/FORCE, autorização, retirada e mudança de versão, privacidade do payload, concorrência e revisão adversarial. Não ativar com base somente na validação da interface.
